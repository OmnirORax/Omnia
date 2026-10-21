import type { RegisteredTarget } from "./registry";
import { EFFECT_PROPERTIES } from "./registry";
import { effectScope } from "./uiEffects";

export type HighlightShape = {
  points: { x: number; y: number }[];
  active: boolean;
  closed?: boolean;
  clip?: { x: number; y: number; width: number; height: number };
};
export type HighlightTarget = { target: RegisteredTarget; active: boolean };
type SceneSource = (targets: ReadonlyMap<string, boolean>) => HighlightShape[];
const sceneSources = new Set<SceneSource>();
/** Renderer references are transient; lazy scene modules register without entering UI state. */
export function registerHierarchyScene(source: SceneSource) {
  sceneSources.add(source);
  return () => { sceneSources.delete(source); };
}
const svgNS = "http://www.w3.org/2000/svg";
const owners = (owner: string) => owner.startsWith("function:")
  ? `[data-ui-function="${CSS.escape(owner.slice(9))}"]:not([data-ui-palette])`
  : `:is([data-ui-resident-root="${CSS.escape(owner)}"],[data-ui-proxy-for="${CSS.escape(owner)}"])`;
const rectangle = (r: { x: number; y: number; width: number; height: number }) => [
  { x: r.x, y: r.y }, { x: r.x + r.width, y: r.y },
  { x: r.x + r.width, y: r.y + r.height }, { x: r.x, y: r.y + r.height },
];
const visible = (element: Element) => {
  if (!element.isConnected || !element.getClientRects().length || element.closest("[hidden],[data-shortcut-runner]")) return false;
  const style = getComputedStyle(element);
  return style.visibility !== "hidden" && style.display !== "none";
};
type Match = { element: Element; target: RegisteredTarget; active: boolean; scrollbar?: "thumb" | "track"; ranges?: Range[] };

function matchesFor(entries: HighlightTarget[], targets: RegisteredTarget[], property: string): Match[] {
  const selectorCache = new Map<string, Element[]>();
  const query = (selector: string) => {
    let result = selectorCache.get(selector);
    if (!result) {
      result = [...document.querySelectorAll(selector)].filter(element =>
        !element.closest("[data-appearance-highlight],[data-shortcut-runner],[data-ui-palette],[data-ui-native-hidden]"));
      selectorCache.set(selector, result);
    }
    return result;
  };
  const scoped = (target: RegisteredTarget, selector: string) => {
    const scope = target.instance && owners(target.instance.owner);
    return scope ? `:is(${scope}:is(${selector}),${scope} :is(${selector}))` : selector;
  };
  const matches = new Map<string, Map<Element, Match>>();
  for (const { target, active } of entries) {
    const base = target.instance?.base ?? target.id;
    const map = matches.get(base) ?? new Map<Element, Match>();
    matches.set(base, map);
    const selector = (EFFECT_PROPERTIES.includes(property) || base === "symbols.ui"
      ? target.binding?.animation?.selector ?? target.binding?.selector
      : target.binding?.selector)?.replace(/::placeholder/g, "");
    let elements: Element[];
    if (selector) elements = query(scoped(target, selector));
    else if (base.startsWith("ui.scrollbars.")) elements = query(target.instance ? `${owners(target.instance.owner)},${owners(target.instance.owner)} *` : "body *")
      .filter(element => element instanceof HTMLElement &&
        (element.scrollHeight > element.clientHeight + 1 || element.scrollWidth > element.clientWidth + 1));
    else if (target.instance) elements = query(owners(target.instance.owner));
    else if (base === "workspace.background") elements = query(".spatial-workspace canvas");
    else continue;
    const locals = targets.filter(item => item.instance?.base === base);
    for (const element of elements) {
      if (base === "text.ui.placeholders" &&
        (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) || element.value || !element.placeholder)) continue;
      // An instance's own binding wins over the categorical binding on its parts.
      const local = locals.filter(item => selector ? element.matches(scoped(item, selector))
        : !!element.closest(owners(item.instance!.owner)))
        .sort((a, b) => (b.instance!.path?.length ?? 0) + Number(b.instance!.owner.startsWith("function:")) -
          (a.instance!.path?.length ?? 0) - Number(a.instance!.owner.startsWith("function:")))[0];
      if (local && local.id !== target.id) continue;
      map.set(element, { element, target, active,
        scrollbar: base.startsWith("ui.scrollbars.") ? base.endsWith(".thumb") ? "thumb" : "track" : undefined });
    }
  }
  const result = [...matches.values()].flatMap(map => [...map.values()]);
  for (const match of result) {
    const { element, target } = match;
    if (!target.binding?.text || !(element instanceof HTMLElement) || element.matches("input,textarea,select")) continue;
    const scope = effectScope({ ...target, id: target.instance?.base ?? target.id }, element);
    match.ranges = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    for (let text = walker.nextNode(); text; text = walker.nextNode()) {
      const parent = text.parentElement;
      if (!text.textContent?.trim() || !(parent instanceof HTMLElement) || !scope.text?.(parent)) continue;
      const range = document.createRange(); range.selectNodeContents(text); match.ranges.push(range);
    }
  }
  return result;
}

function clippedRect(rect: DOMRect | DOMRectReadOnly, element: Element) {
  let left = Math.max(1, rect.left), top = Math.max(1, rect.top),
    right = Math.min(innerWidth - 1, rect.right), bottom = Math.min(innerHeight - 1, rect.bottom);
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    const style = getComputedStyle(parent), bounds = parent.getBoundingClientRect();
    if (/hidden|clip|scroll|auto/.test(style.overflowX)) { left = Math.max(left, bounds.left); right = Math.min(right, bounds.right); }
    if (/hidden|clip|scroll|auto/.test(style.overflowY)) { top = Math.max(top, bounds.top); bottom = Math.min(bottom, bounds.bottom); }
  }
  return right - left > 1 && bottom - top > 1 ? { x: left, y: top, width: right - left, height: bottom - top } : null;
}
function uiShapes(matches: Match[]): HighlightShape[] {
  const shapes: HighlightShape[] = [];
  for (const { element, active, scrollbar, ranges } of matches) {
    if (!visible(element)) continue;
    const push = (bounds: DOMRect | DOMRectReadOnly) => {
      const rect = clippedRect(bounds, element);
      if (rect) shapes.push({ points: rectangle(rect), active, closed: true });
    };
    if (scrollbar && element instanceof HTMLElement) {
      const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
      const vertical = element.scrollHeight > element.clientHeight + 1 && /auto|scroll/.test(style.overflowY);
      const horizontal = element.scrollWidth > element.clientWidth + 1 && /auto|scroll/.test(style.overflowX);
      if (vertical) {
        const width = Math.max(6, element.offsetWidth - element.clientWidth - (parseFloat(style.borderLeftWidth) || 0) - (parseFloat(style.borderRightWidth) || 0));
        const height = scrollbar === "track" ? element.clientHeight : Math.max(16, element.clientHeight ** 2 / element.scrollHeight);
        const y = rect.y + element.clientTop + (scrollbar === "track" ? 0 : element.scrollTop / (element.scrollHeight - element.clientHeight) * (element.clientHeight - height));
        push(new DOMRect(rect.right - width, y, width, height));
      }
      if (horizontal) {
        const height = Math.max(6, element.offsetHeight - element.clientHeight - (parseFloat(style.borderTopWidth) || 0) - (parseFloat(style.borderBottomWidth) || 0));
        const width = scrollbar === "track" ? element.clientWidth : Math.max(16, element.clientWidth ** 2 / element.scrollWidth);
        const x = rect.x + element.clientLeft + (scrollbar === "track" ? 0 : element.scrollLeft / (element.scrollWidth - element.clientWidth) * (element.clientWidth - width));
        push(new DOMRect(x, rect.bottom - height, width, height));
      }
    } else if (ranges) {
      for (const range of ranges) {
        const parent = range.startContainer.parentElement;
        if (!parent || !visible(parent)) continue;
        for (const rect of range.getClientRects()) {
          const bounds = clippedRect(rect, parent);
          if (bounds) shapes.push({ points: rectangle(bounds), active, closed: true });
        }
      }
    } else push(element.getBoundingClientRect());
  }
  return shapes;
}

/** Temporary pointer-transparent top layer; no target styling, layout, history or selection writes. */
export function highlightHierarchy(entries: HighlightTarget[], targets: RegisteredTarget[], property: string) {
  const overlay = document.createElement("div");
  overlay.setAttribute("data-appearance-highlight", "");
  overlay.setAttribute("aria-hidden", "true");
  overlay.setAttribute("popover", "manual");
  overlay.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;max-width:none;max-height:none;margin:0;padding:0;border:0;background:transparent;pointer-events:none;overflow:hidden;z-index:2147483647;";
  const svg = document.createElementNS(svgNS, "svg");
  svg.style.cssText = "display:block;width:100%;height:100%;overflow:hidden;pointer-events:none";
  overlay.append(svg); document.body.append(overlay);
  try { overlay.showPopover(); } catch { overlay.removeAttribute("popover"); }
  const sceneTargets = new Map(entries.filter(entry => !entry.target.instance).map(entry => [entry.target.id, entry.active]));
  let matches: Match[] = [], dirty = true, frame = 0, previous = 0, signature = "", stopped = false;
  const observer = new MutationObserver(records => {
    if (records.some(record => !(record.target instanceof Element) || !record.target.closest("[data-appearance-highlight]"))) dirty = true;
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true });
  const node = (name: string, attributes: Record<string, string>) => {
    const element = document.createElementNS(svgNS, name);
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
    return element;
  };
  const paint = (time: number) => {
    if (stopped) return;
    frame = requestAnimationFrame(paint);
    if (document.hidden || time - previous < 32) return;
    previous = time;
    if (dirty) { matches = matchesFor(entries, targets, property); dirty = false; }
    const shapes = uiShapes(matches);
    for (const source of sceneSources) shapes.push(...source(sceneTargets));
    // Scene markers stay behind visible floating UI even though the overlay is above it.
    const occluders = shapes.some(shape => shape.clip) ? [...document.querySelectorAll(".floating-window,.ui-floating-group-viewport,.ui-free-function,.function-frame,.spatial-controls,.camera-guide")]
      .filter(visible).map(element => element.getBoundingClientRect()) : [];
    const key = JSON.stringify([innerWidth, innerHeight, shapes, occluders.map(r => [r.x, r.y, r.width, r.height])]);
    if (key === signature) return;
    signature = key;
    const fragment = document.createDocumentFragment(), defs = node("defs", {});
    const mask = node("mask", { id: "appearance-scene-mask", maskUnits: "userSpaceOnUse", x: "0", y: "0", width: String(innerWidth), height: String(innerHeight) });
    mask.append(node("rect", { width: String(innerWidth), height: String(innerHeight), fill: "white" }));
    for (const r of occluders) mask.append(node("rect", { x: String(r.x), y: String(r.y), width: String(r.width), height: String(r.height), fill: "black" }));
    defs.append(mask); fragment.append(defs);
    const seen = new Set<string>();
    for (const shape of shapes.sort((a, b) => Number(a.active) - Number(b.active))) {
      const points = shape.points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
      const identity = `${points}:${shape.active}:${!!shape.clip}`;
      if (seen.has(identity) || shape.points.length < 2) continue;
      seen.add(identity);
      const group = node("g", shape.clip ? { mask: "url(#appearance-scene-mask)" } : {});
      if (shape.clip) {
        const id = `appearance-clip-${seen.size}`;
        const clip = node("clipPath", { id });
        clip.append(node("rect", { x: String(shape.clip.x), y: String(shape.clip.y), width: String(shape.clip.width), height: String(shape.clip.height) }));
        defs.append(clip); group.setAttribute("clip-path", `url(#${id})`);
      }
      const attributes = { points, fill: "none", "stroke-linejoin": "round", "stroke-linecap": "round", "vector-effect": "non-scaling-stroke" };
      const tag = shape.closed ? "polygon" : "polyline";
      group.append(node(tag, { ...attributes, stroke: "#07121b", "stroke-width": "4", opacity: shape.active ? "0.9" : "0.5" }));
      group.append(node(tag, { ...attributes, stroke: shape.active ? "#82f4ff" : "#becbd5", "stroke-width": "2", opacity: shape.active ? "1" : "0.65", "stroke-dasharray": shape.active ? "none" : "4 4" }));
      fragment.append(group);
    }
    svg.replaceChildren(fragment);
  };
  frame = requestAnimationFrame(paint);
  const stop = () => {
    if (stopped) return;
    stopped = true; cancelAnimationFrame(frame); observer.disconnect(); overlay.remove();
    window.removeEventListener("blur", stop); document.removeEventListener("visibilitychange", hidden);
  };
  const hidden = () => { if (document.hidden) stop(); };
  window.addEventListener("blur", stop); document.addEventListener("visibilitychange", hidden);
  return { stop };
}
