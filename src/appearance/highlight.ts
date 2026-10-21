import type { RegisteredTarget } from "./registry";
import { EFFECT_PROPERTIES } from "./registry";
import { effectScope } from "./uiEffects";

export type HighlightTarget = { target: RegisteredTarget; active: boolean };
export type HierarchyScenePulse = {
  pulse: (targets: ReadonlyMap<string, boolean>, strength: number) => void;
  clear: () => void;
};
const sceneSources = new Set<HierarchyScenePulse>();
export function registerHierarchyScene(source: HierarchyScenePulse) {
  sceneSources.add(source);
  return () => { source.clear(); sceneSources.delete(source); };
}
const owners = (owner: string) => owner.startsWith("function:")
  ? `[data-ui-function="${CSS.escape(owner.slice(9))}"]:not([data-ui-palette])`
  : `:is([data-ui-resident-root="${CSS.escape(owner)}"],[data-ui-proxy-for="${CSS.escape(owner)}"])`;
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
      ? base === "symbols.ui" ? `${target.binding?.animation?.selector ?? target.binding?.selector},button[data-ui-native-icon]` : target.binding?.animation?.selector ?? target.binding?.selector
      : target.binding?.selector)?.replace(/::placeholder/g, "");
    let elements: Element[];
    if (selector) elements = query(scoped(target, selector));
    else if (base.startsWith("ui.scrollbars.")) elements = query(target.instance ? `${owners(target.instance.owner)},${owners(target.instance.owner)} *` : "body *")
      .filter(element => element instanceof HTMLElement &&
        (element.scrollHeight > element.clientHeight + 1 || element.scrollWidth > element.clientWidth + 1));
    else if (target.instance) elements = query(owners(target.instance.owner));
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

type PaintElement = HTMLElement | SVGElement;
type PaintValue = { value: string; priority: string; computed: string; written?: string };
let pulseSequence = 0;
/** Pulse actual paint only. Inline overrides and custom text highlights are removed exactly on exit. */
export function highlightHierarchy(entries: HighlightTarget[], targets: RegisteredTarget[], property: string) {
  const saved = new Map<PaintElement, Map<string, PaintValue>>();
  const attributes = new Map<Element, string | null>();
  const placeholders = new Map<Element, string>();
  const value = (element: PaintElement, key: string) => {
    const map = saved.get(element) ?? new Map<string, PaintValue>(); saved.set(element, map);
    let old = map.get(key);
    if (!old) {
      old = { value: element.style.getPropertyValue(key), priority: element.style.getPropertyPriority(key),
        computed: getComputedStyle(element).getPropertyValue(key) };
      map.set(key, old);
    }
    return old;
  };
  const write = (element: PaintElement, key: string, paint: string) => {
    const old = value(element, key);
    element.style.setProperty(key, paint, "important");
    old.written = element.style.getPropertyValue(key);
  };
  const style = document.createElement("style");
  style.setAttribute("data-appearance-pulse-style", ""); document.head.append(style);
  const name = `omnium-appearance-hover-${++pulseSequence}`;
  const textHighlights = typeof Highlight !== "undefined" && !!CSS.highlights;
  const tag = (element: Element) => {
    if (!attributes.has(element)) {
      attributes.set(element, element.getAttribute("data-appearance-pulse"));
      element.setAttribute("data-appearance-pulse", `${name}-${attributes.size}`);
    }
    return element.getAttribute("data-appearance-pulse")!;
  };
  const color = (base: string, strength: number) =>
    `color-mix(in srgb, ${!base || /^(auto|none|normal)$/.test(base.trim()) ? "currentColor" : base} ${90 - strength * 55}%, white ${10 + strength * 55}%)`;
  const shadows = (base: string, glow: string) => `${base && base !== "none" ? base + "," : ""}${glow}`;
  const sceneTargets = new Map(entries.filter(({ target }) => !target.instance && target.binding && !target.binding.selector && !target.id.startsWith("ui."))
    .map(entry => [entry.target.id, entry.active]));
  let matches: Match[] = [], dirty = true, frame = 0, previous = 0, stopped = false;
  const began = performance.now(), reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const observer = new MutationObserver(() => { dirty = true; });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true });
  const pulse = (time: number) => {
    if (stopped) return;
    frame = requestAnimationFrame(pulse);
    if (document.hidden || time - previous < 32) return;
    previous = time;
    const wave = reduced.matches ? 0.6 : 0.5 - 0.5 * Math.cos((time - began) * Math.PI * 2 / 1200);
    if (dirty) {
      matches = matchesFor(entries, targets, property); dirty = false;
      if (textHighlights) {
        CSS.highlights.set(name, new Highlight(...matches.filter(match => match.active).flatMap(match => match.ranges ?? [])));
        CSS.highlights.set(`${name}-muted`, new Highlight(...matches.filter(match => !match.active).flatMap(match => match.ranges ?? [])));
      }
    }
    const rules = [
      `::highlight(${name}){color:${color("currentColor", wave)};text-shadow:0 0 ${2 + wave * 8}px currentColor}`,
      `::highlight(${name}-muted){color:${color("currentColor", wave * .5)};text-shadow:0 0 ${1 + wave * 4}px currentColor}`,
    ];
    for (const { element, target, active, scrollbar, ranges } of matches) {
      if (!visible(element) || !(element instanceof HTMLElement || element instanceof SVGElement)) continue;
      const strength = wave * (active ? 1 : .5), base = target.instance?.base ?? target.id;
      if (ranges) {
        if (!textHighlights) for (const range of ranges) {
          const parent = range.startContainer.parentElement;
          if (!parent || !visible(parent)) continue;
          write(parent, "color", color(value(parent, "color").computed, strength));
          write(parent, "text-shadow", shadows(value(parent, "text-shadow").computed, `0 0 ${strength * 8}px currentColor`));
        }
        continue;
      }
      if (scrollbar) {
        const id = tag(element), original = value(element, "scrollbar-color").computed;
        const colors = original.match(/rgba?\([^)]+\)|#[\da-f]+/gi) ?? ["#5a899e", "#07121b"];
        const thumb = color(colors[0], base.endsWith("thumb") ? strength : 0), track = color(colors[1] ?? "#07121b", base.endsWith("track") ? strength : 0);
        write(element, "scrollbar-color", `${thumb} ${track}`);
        rules.push(`:root:root:root [data-appearance-pulse="${id}"]::-webkit-scrollbar-${scrollbar}{background-color:${scrollbar === "thumb" ? thumb : track}!important}`);
      } else if (base === "text.ui.placeholders") {
        const id = tag(element), ink = placeholders.get(element) ?? getComputedStyle(element, "::placeholder").color;
        placeholders.set(element, ink);
        rules.push(`:root:root:root [data-appearance-pulse="${id}"]::placeholder{color:${color(ink, strength)}!important;text-shadow:0 0 ${strength * 8}px currentColor!important}`);
      } else if (base === "symbols.ui") {
        if (element.matches("[data-ui-native-icon]")) {
          const original = value(element, "--ui-native-filter").computed.trim();
          write(element, "--ui-native-filter", `${original && original !== "none" ? original : ""} brightness(${1 + strength * .9}) drop-shadow(0 0 ${strength * 5}px white)`);
        } else if (element.matches("svg,img,.appearance-icon-mask")) {
          const original = value(element, "filter").computed;
          write(element, "filter", `${original && original !== "none" ? original : ""} brightness(${1 + strength}) drop-shadow(0 0 ${strength * 5}px white)`);
        } else {
          write(element, "color", color(value(element, "color").computed, strength));
          write(element, "text-shadow", shadows(value(element, "text-shadow").computed, `0 0 ${strength * 8}px currentColor`));
        }
      } else if (element.matches(".ui-contour") && target.binding?.css === "background-color") {
        const fill = element.querySelector<SVGElement>(":scope > rect[mask]");
        if (fill) write(fill, "fill", color(value(fill, "fill").computed, strength));
      } else if (target.binding?.css) {
        const key = target.binding.css;
        if (key === "border-color") for (const side of ["top", "right", "bottom", "left"]) {
          const edge = `border-${side}-color`; write(element, edge, color(value(element, edge).computed, strength));
        } else write(element, key, color(value(element, key).computed, strength));
        if (target.binding.text) write(element, "text-shadow", shadows(value(element, "text-shadow").computed, `0 0 ${strength * 8}px currentColor`));
        if (key === "background-color") {
          const image = value(element, "background-image").computed;
          if (image && image !== "none") write(element, "background-image", `linear-gradient(rgb(255 255 255 / ${strength * .25}),rgb(255 255 255 / ${strength * .25})),${image}`);
        }
      } else if (target.instance) {
        const original = value(element, "filter").computed;
        write(element, "filter", `${original && original !== "none" ? original : ""} brightness(${1 + strength * .8})`);
      }
    }
    style.textContent = rules.join("\n");
    for (const source of sceneSources) source.pulse(sceneTargets, wave);
  };
  const stop = () => {
    if (stopped) return;
    stopped = true; cancelAnimationFrame(frame); observer.disconnect();
    for (const source of sceneSources) source.clear();
    if (textHighlights) { CSS.highlights.delete(name); CSS.highlights.delete(`${name}-muted`); }
    for (const [element, properties] of saved) for (const [key, old] of properties)
      if (old.written === element.style.getPropertyValue(key)) {
        if (old.value) element.style.setProperty(key, old.value, old.priority); else element.style.removeProperty(key);
      }
    for (const [element, old] of attributes)
      if (old === null) element.removeAttribute("data-appearance-pulse"); else element.setAttribute("data-appearance-pulse", old);
    style.remove(); window.removeEventListener("blur", stop); document.removeEventListener("visibilitychange", hidden);
  };
  const hidden = () => { if (document.hidden) stop(); };
  window.addEventListener("blur", stop); document.addEventListener("visibilitychange", hidden);
  frame = requestAnimationFrame(pulse);
  return { stop };
}
