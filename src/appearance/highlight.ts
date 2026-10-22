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
type VariablePulse = { element: PaintElement; variable: string; from: string; to: string; syntax: string; inherited: boolean };
const registeredVariables = new Set<string>();
function registerPulseVariable(name: string, syntax: string, inherits: boolean) {
  if (registeredVariables.has(name)) return true;
  if (!CSS.registerProperty) return false;
  const initialValue = syntax === "<color>" ? "transparent" : syntax === "<length>" ? "0px" : syntax === "<percentage>" ? "0%" : "0";
  try { CSS.registerProperty({ name, syntax, inherits, initialValue }); }
  catch (error) { if (!(error instanceof DOMException) || error.name !== "InvalidModificationError") return false; }
  registeredVariables.add(name); return true;
}
let pulseSequence = 0;
/** Discover/read once, then let the browser animate actual paint. No per-frame UI style scans/writes. */
export function highlightHierarchy(entries: HighlightTarget[], targets: RegisteredTarget[], property: string) {
  const saved = new Map<PaintElement, Map<string, PaintValue>>(), attributes = new Map<Element, string | null>();
  const computed = new Map<Element, CSSStyleDeclaration>();
  const read = (element: Element) => {
    let style = computed.get(element); if (!style) { style = getComputedStyle(element); computed.set(element, style); }
    return style;
  };
  const value = (element: PaintElement, key: string) => {
    const map = saved.get(element) ?? new Map<string, PaintValue>(); saved.set(element, map);
    let old = map.get(key);
    if (!old) {
      old = { value: element.style.getPropertyValue(key), priority: element.style.getPropertyPriority(key), computed: read(element).getPropertyValue(key) };
      map.set(key, old);
    }
    return old;
  };
  const write = (element: PaintElement, key: string, paint: string, priority = "important") => {
    const old = value(element, key); element.style.setProperty(key, paint, priority); old.written = element.style.getPropertyValue(key);
  };
  const style = document.createElement("style"); style.setAttribute("data-appearance-pulse-style", ""); document.head.append(style);
  const name = `omnium-appearance-hover-${++pulseSequence}`, textHighlights = typeof Highlight !== "undefined" && !!CSS.highlights;
  const began = performance.now() - 160, duration = 1200, reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const accent = getComputedStyle(document.documentElement).getPropertyValue("--omnium-accent").trim() || "#60ddec";
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1;
  const colorContext = canvas.getContext("2d")!;
  const colors = new Map<string, number[]>();
  const rgba = (paint: string) => {
    let color = colors.get(paint);
    if (!color) {
      colorContext.clearRect(0, 0, 1, 1); colorContext.fillStyle = "#60ddec";
      colorContext.fillStyle = paint; colorContext.fillRect(0, 0, 1, 1);
      color = [...colorContext.getImageData(0, 0, 1, 1).data]; colors.set(paint, color);
    }
    return color;
  };
  const accentRGB = rgba(accent);
  // Keep alpha unchanged: translucent windows must not turn into opaque white panels.
  const lit = (paint: string, gain: number, tint: number) => {
    const channels = rgba(paint);
    return `rgba(${channels.slice(0, 3).map((c, i) => Math.min(255, Math.round(c * (1 + gain) + accentRGB[i] * tint))).join(",")},${channels[3] / 255})`;
  };
  const shadow = (base: string, glow: string) => `${base && base !== "none" ? base + "," : ""}${glow}`;
  const cleanFilter = (base: string) => base && base.trim() !== "none" ? base.trim() : "";
  const sceneTargets = new Map(entries.filter(({ target }) => !target.instance && target.binding && !target.binding.selector && !target.id.startsWith("ui."))
    .map(entry => [entry.target.id, entry.active]));
  let animations: Animation[] = [], fallback: VariablePulse[] = [], pending = 0, sceneFrame = 0, previousScene = 0, stopped = false;
  const restorePaint = () => {
    animations.forEach(animation => animation.cancel()); animations = []; fallback = [];
    for (const [element, properties] of saved) for (const [key, old] of properties)
      if (old.written === element.style.getPropertyValue(key)) {
        if (old.value) element.style.setProperty(key, old.value, old.priority); else element.style.removeProperty(key);
      }
    for (const [element, old] of attributes)
      if (old === null) element.removeAttribute("data-appearance-pulse"); else element.setAttribute("data-appearance-pulse", old);
    saved.clear(); attributes.clear(); computed.clear();
  };
  const observer = new MutationObserver(() => schedulePrepare());
  const observe = () => observer.observe(document.body, { subtree: true, childList: true, characterData: true,
    attributes: true, attributeFilter: ["hidden", "open", "class", "data-ui-native-hidden", "data-ui-native-icon", "data-ui-visual-kind"] });
  const mix = (pulse: VariablePulse, amount: number) => {
    if (pulse.syntax === "<color>") {
      const a = rgba(pulse.from), b = rgba(pulse.to);
      return `rgba(${a.slice(0, 3).map((v, i) => Math.round(v + (b[i] - v) * amount)).join(",")},${(a[3] + (b[3] - a[3]) * amount) / 255})`;
    }
    const suffix = pulse.syntax === "<length>" ? "px" : pulse.syntax === "<percentage>" ? "%" : "";
    return String(parseFloat(pulse.from) + (parseFloat(pulse.to) - parseFloat(pulse.from)) * amount) + suffix;
  };
  const waveAt = (time: number) => reduced.matches ? .6 : .5 - .5 * Math.cos((time - began) * Math.PI * 2 / duration);
  const pump = (time: number) => {
    sceneFrame = 0; if (stopped || document.hidden) return;
    const wave = waveAt(time);
    for (const pulse of fallback) write(pulse.element, pulse.variable, mix(pulse, wave), "");
    if (sceneTargets.size && time - previousScene >= 32) {
      previousScene = time; for (const source of sceneSources) source.pulse(sceneTargets, wave);
    }
    if (fallback.length || sceneTargets.size) sceneFrame = requestAnimationFrame(pump);
  };
  const prepare = () => {
    pending = 0; if (stopped) return;
    observer.disconnect(); restorePaint();
    const matches = matchesFor(entries, targets, property).filter(match => visible(match.element));
    const paints: (() => void)[] = [], variables = new Map<PaintElement, Map<string, VariablePulse>>(), rules: string[] = [], tags = new Map<Element, string>();
    const variable = (element: PaintElement, key: string, syntax: string, from: string, to: string, inherited = false) => {
      const name = `--omnium-hierarchy-${key}`, group = variables.get(element) ?? new Map<string, VariablePulse>();
      variables.set(element, group); value(element, name);
      group.set(name, { element, variable: name, syntax, from, to, inherited }); return `var(${name})`;
    };
    const paint = (element: PaintElement, key: string, target: string) => {
      value(element, key); paints.push(() => write(element, key, target));
    };
    const color = (element: PaintElement, key: string, gain: number, tint: number) => {
      const base = value(element, key).computed;
      paint(element, key, variable(element, key, "<color>", base === "auto" ? accent : base, lit(base === "auto" ? accent : base, gain, tint)));
    };
    const tag = (element: Element) => {
      const existing = tags.get(element); if (existing) return existing;
      const id = `${name}-${attributes.size + 1}`; attributes.set(element, element.getAttribute("data-appearance-pulse"));
      tags.set(element, id);
      paints.push(() => element.setAttribute("data-appearance-pulse", id)); return id;
    };
    const glow = (element: PaintElement, text: boolean, strength: number) => {
      const key = text ? "text-shadow" : "box-shadow", blur = variable(element, `${text ? "text" : "box"}-glow`, "<length>", "0px", `${strength}px`);
      paint(element, key, shadow(value(element, key).computed, `0 0 ${blur} ${accent}`));
    };
    if (textHighlights) {
      CSS.highlights.set(name, new Highlight(...matches.filter(match => match.active).flatMap(match => match.ranges ?? [])));
      CSS.highlights.set(`${name}-muted`, new Highlight(...matches.filter(match => !match.active).flatMap(match => match.ranges ?? [])));
      if (matches.some(match => match.ranges?.length)) {
        const root = document.documentElement, tint = variable(root, "highlight-tint", "<percentage>", "0%", "24%", true),
          blur = variable(root, "highlight-glow", "<length>", "0px", "10px", true);
        rules.push(`::highlight(${name}){color:color-mix(in srgb,currentColor calc(100% - ${tint}),${accent} ${tint});text-shadow:0 0 ${blur} ${accent}}`,
          `::highlight(${name}-muted){color:color-mix(in srgb,currentColor calc(100% - ${tint}),${accent} ${tint});text-shadow:0 0 calc(${blur} * .5) ${accent}}`);
      }
    }
    // All geometry/style reads finish before any temporary paint is written.
    for (const { element, target, active, scrollbar, ranges } of matches) {
      if (!(element instanceof HTMLElement || element instanceof SVGElement)) continue;
      const scale = active ? 1 : .5, base = target.instance?.base ?? target.id;
      const control = base.startsWith("ui.buttons") || base.startsWith("ui.headers") || base.startsWith("ui.fields") || element.matches("button,input,textarea,select");
      if (ranges) {
        if (!textHighlights) for (const range of ranges) {
          const parent = range.startContainer.parentElement; if (!parent || !visible(parent)) continue;
          color(parent, "color", .25 * scale, .14 * scale); glow(parent, true, 10 * scale);
        }
      } else if (scrollbar) {
        const id = tag(element), ink = value(element, "scrollbar-color").computed.match(/rgba?\([^)]+\)|#[\da-f]+/gi) ?? ["#5a899e", "#07121b"];
        const thumb = base.endsWith("thumb") ? variable(element, "scroll-thumb", "<color>", ink[0], lit(ink[0], .3 * scale, .2 * scale), true)
          : variables.get(element)?.has("--omnium-hierarchy-scroll-thumb") ? "var(--omnium-hierarchy-scroll-thumb)" : ink[0];
        const track = base.endsWith("track") ? variable(element, "scroll-track", "<color>", ink[1] ?? "#07121b", lit(ink[1] ?? "#07121b", .1 * scale, .06 * scale), true)
          : variables.get(element)?.has("--omnium-hierarchy-scroll-track") ? "var(--omnium-hierarchy-scroll-track)" : ink[1] ?? "#07121b";
        paint(element, "scrollbar-color", `${thumb} ${track}`);
        rules.push(`:root:root:root [data-appearance-pulse="${id}"]::-webkit-scrollbar-${scrollbar}{background-color:${scrollbar === "thumb" ? thumb : track}!important}`);
      } else if (base === "text.ui.placeholders") {
        const id = tag(element), ink = getComputedStyle(element, "::placeholder").color;
        const inkPulse = variable(element, "placeholder-color", "<color>", ink, lit(ink, .2 * scale, .12 * scale), true),
          blur = variable(element, "placeholder-glow", "<length>", "0px", `${8 * scale}px`, true);
        rules.push(`:root:root:root [data-appearance-pulse="${id}"]::placeholder{color:${inkPulse}!important;text-shadow:0 0 ${blur} ${accent}!important}`);
      } else if (base === "symbols.ui" || !target.binding?.css && target.instance) {
        const native = element.matches("[data-ui-native-icon]"), key = native ? "--ui-native-filter" : "filter";
        if (native || element.matches("svg,img,.appearance-icon-mask") || !target.binding?.css) {
          const brightness = variable(element, "icon-brightness", "<number>", "1", String(1 + scale * .6)),
            blur = variable(element, "icon-glow", "<length>", "0px", `${6 * scale}px`);
          paint(element, key, `${cleanFilter(value(element, key).computed)} brightness(${brightness}) drop-shadow(0 0 ${blur} ${accent})`);
        } else { color(element, "color", .25 * scale, .14 * scale); glow(element, true, 10 * scale); }
      } else if (element.matches(".ui-contour") && target.binding?.css === "background-color") {
        const fill = element.querySelector<SVGElement>(":scope > rect[mask]"); if (fill) color(fill, "fill", .08 * scale, .025 * scale);
      } else if (target.binding?.css) {
        const key = target.binding.css, gain = (control ? .35 : .08) * scale, tint = (control ? .2 : .025) * scale;
        if (key === "border-color") for (const edge of ["top", "right", "bottom", "left"]) color(element, `border-${edge}-color`, gain, (control ? .4 : .12) * scale);
        else color(element, key, gain, tint);
        if (key === "background-color") {
          const image = value(element, "background-image").computed;
          if (image.includes("gradient(") && !image.includes("url(")) {
            let stop = 0;
            paint(element, "background-image", image.replace(/rgba?\([^)]+\)|#[\da-f]{3,8}\b/gi, ink =>
              variable(element, `gradient-${stop++}`, "<color>", ink, lit(ink, gain, tint))));
          }
        }
        if (target.binding.text) glow(element, true, 10 * scale);
        else if (control) glow(element, false, 10 * scale);
      }
    }
    style.textContent = rules.join("\n");
    for (const [element, group] of variables) {
      const from: Record<string, string> = {}, to: Record<string, string> = {};
      for (const pulse of group.values()) {
        const native = registerPulseVariable(pulse.variable, pulse.syntax, pulse.inherited);
        write(element, pulse.variable, reduced.matches ? mix(pulse, .6) : pulse.from, "");
        if (reduced.matches) continue;
        if (native && typeof element.animate === "function") { from[pulse.variable] = pulse.from; to[pulse.variable] = pulse.to; }
        else fallback.push(pulse);
      }
      if (Object.keys(from).length) {
        const animation = element.animate([
          { ...from, offset: 0, easing: "ease-in-out" },
          { ...to, offset: .5, easing: "ease-in-out" },
          { ...from, offset: 1 },
        ], { duration, iterations: Infinity });
        animation.currentTime = (performance.now() - began) % duration; animations.push(animation);
      }
    }
    paints.forEach(apply => apply()); computed.clear(); observe();
    if ((fallback.length || sceneTargets.size) && !sceneFrame) sceneFrame = requestAnimationFrame(pump);
  };
  function schedulePrepare() { if (!stopped && !pending) pending = requestAnimationFrame(prepare); }
  const stop = () => {
    if (stopped) return; stopped = true;
    cancelAnimationFrame(pending); cancelAnimationFrame(sceneFrame); observer.disconnect(); restorePaint();
    for (const source of sceneSources) source.clear();
    if (textHighlights) { CSS.highlights.delete(name); CSS.highlights.delete(`${name}-muted`); }
    style.remove(); window.removeEventListener("blur", stop); document.removeEventListener("visibilitychange", hidden); reduced.removeEventListener("change", schedulePrepare);
  };
  const hidden = () => { if (document.hidden) stop(); };
  window.addEventListener("blur", stop); document.addEventListener("visibilitychange", hidden); reduced.addEventListener("change", schedulePrepare);
  schedulePrepare(); return { stop };
}
