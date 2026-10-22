import { useEffect, useMemo, type CSSProperties } from "react";
import { useAppearance } from "./Context";
import { registerPaintVariable } from "./paintVariables";
import { SELECTOR_FEEDBACK, TARGETS } from "./registry";
import { brightHex, tint, valueFor } from "./resolve";
import { boundaryElement, type SelectionBoundary, type SelectionRule, type VisualPart } from "./visualSelection";

type Mark = { key: string; x: number; y: number; width: number; height: number; rx: number; ry: number; surface: boolean };
const rectAttributes = (mark: Mark) => ({ x: mark.x, y: mark.y, width: mark.width, height: mark.height, rx: mark.rx, ry: mark.ry });
type Tone = keyof typeof SELECTOR_FEEDBACK;
type FeedbackPaint = { ink: string; opacity: number; glow: number };
function SelectionTrace({ mark, tone, paint, preview = false }: { mark: Mark; tone: Tone; paint: FeedbackPaint; preview?: boolean }) {
  const attributes = rectAttributes(mark);
  const style = { "--visual-selection-ink": paint.ink, "--visual-selection-opacity": paint.opacity,
    "--visual-selection-glow": paint.glow } as CSSProperties;
  return <g style={style} className={`visual-selection-trace is-${tone} ${preview ? "is-preview" : ""}`}>
    {mark.surface && <rect {...attributes} className="visual-selection-surface" />}
    <rect {...attributes} className="visual-selection-halo" />
    <rect {...attributes} className="visual-selection-rail" />
    <rect {...attributes} className="visual-selection-seam" />
  </g>;
}
const signal = {
  strength: "--omnium-selector-strength",
  mix: "--omnium-selector-glyph-mix",
  glow: "--omnium-selector-glow",
};
function startSelectionPulse() {
  const supported = [
    [signal.strength, "<number>", "0.82"], [signal.mix, "<percentage>", "65%"], [signal.glow, "<length>", "3px"],
  ].every(([name, syntax, initial]) => registerPaintVariable(name, syntax, true, initial));
  const root = document.documentElement, reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let animation: Animation | undefined;
  const start = () => {
    animation?.cancel(); animation = undefined;
    if (!supported || reduced.matches || document.hidden || typeof root.animate !== "function") return;
    animation = root.animate([
      { [signal.strength]: "1", [signal.mix]: "95%", [signal.glow]: "9px", easing: "ease-in-out" },
      { [signal.strength]: "0.18", [signal.mix]: "8%", [signal.glow]: "0.5px", easing: "ease-in-out" },
      { [signal.strength]: "1", [signal.mix]: "95%", [signal.glow]: "9px" },
    ], { duration: 1000, iterations: Infinity });
  };
  start();
  reduced.addEventListener("change", start);
  document.addEventListener("visibilitychange", start);
  return () => { animation?.cancel(); reduced.removeEventListener("change", start); document.removeEventListener("visibilitychange", start); };
}
const glow = "var(--omnium-selector-glow,3px)";
const mix = "var(--omnium-selector-glyph-mix,65%)";
const feedbackInk = (paint: FeedbackPaint) => tint(paint.ink, 1, paint.opacity);
const feedbackGlow = (paint: FeedbackPaint) => `calc(${glow} * ${paint.glow})`;
const glyphColor = (base: string, paint: FeedbackPaint) => {
  const weight = `calc(${mix} * ${paint.opacity})`;
  return `color-mix(in srgb,${base} calc(100% - ${weight}),${paint.ink} ${weight})`;
};
const glyphFeedback = (name: string, paint: FeedbackPaint) =>
  `::highlight(${name}){color:${glyphColor("currentColor", paint)};background-color:transparent;text-shadow:0 0 ${feedbackGlow(paint)} ${feedbackInk(paint)}}`;

/** Native paint variables and SVG seams animate feedback; no per-frame DOM discovery or writes. */
export function VisualSelectionOverlay({ selected, excluded, preview, candidate, boundary, hoverBoundary }: {
  selected: VisualPart[]; excluded: VisualPart[]; preview: VisualPart[]; candidate: SelectionRule | null;
  boundary: SelectionBoundary | null; hoverBoundary: SelectionBoundary | null;
}) {
  const appearance = useAppearance();
  const paints = useMemo(() => Object.fromEntries(Object.entries(SELECTOR_FEEDBACK).map(([tone, defaults]) => {
    const target = TARGETS.find(target => target.id === `ui.guides.selector.${tone}`)!;
    const get = (property: string) => appearance && !appearance.safe
      ? valueFor(appearance.base, appearance.state, target, property) : target.defaults![property];
    return [tone, { ink: brightHex(String(get("color") ?? defaults.color), Number(get("brightness"))),
      opacity: Number(get("opacity")), glow: Number(get("glow")) }];
  })) as Record<Tone, FeedbackPaint>, [appearance?.base, appearance?.state, appearance?.safe]);
  useEffect(startSelectionPulse, []);
  useEffect(() => {
    const names = ["omnium-selector-selected", "omnium-selector-excluded", "omnium-selector-preview"];
    const highlights = typeof Highlight !== "undefined" && !!CSS.highlights;
    if (highlights) {
      CSS.highlights.set(names[0], new Highlight(...selected.flatMap(part => part.range ? [part.range] : [])));
      CSS.highlights.set(names[1], new Highlight(...excluded.flatMap(part => part.range ? [part.range] : [])));
      CSS.highlights.set(names[2], new Highlight(...preview.flatMap(part => part.range ? [part.range] : [])));
      for (const name of names) CSS.highlights.get(name)!.priority = 10;
    }
    const paint = new Map<HTMLElement | SVGElement, { kind: "icon" | "text"; feedback: FeedbackPaint; pseudo: string }>();
    for (const [parts, feedback] of [[selected, paints.included], [excluded, paints.excluded], [preview, candidate?.include === false ? paints.excluded : paints.included]] as const) {
      for (const part of parts) {
        if ((part.range && highlights) || !(part.role === "icon" || part.role === "text")) continue;
        paint.set(part.element, { kind: part.role, feedback, pseudo: part.target.id === "text.ui.placeholders" ? "::placeholder" : "" });
      }
    }
    // Read source paint once, then own a removable stylesheet/marker layer. The
    // renderer's inline paint remains available to other previews and is never replaced.
    const attribute = "data-visual-selection-ink";
    const plans = [...paint].map(([element, { kind, feedback, pseudo }], index) => {
      const computed = getComputedStyle(element, pseudo || null);
      const filter = computed.filter === "none" ? "" : computed.filter;
      const shadow = computed.textShadow === "none" ? "" : computed.textShadow + ",";
      const ink = feedbackInk(feedback), blur = feedbackGlow(feedback);
      const declaration = kind === "icon" ? `filter:${filter} drop-shadow(0 0 ${blur} ${ink})!important` :
        `color:${glyphColor(computed.color, feedback)}!important;text-shadow:${shadow}0 0 ${blur} ${ink}!important`;
      return { element, pseudo, marker: `selection-${index}`, previous: element.getAttribute(attribute), declaration };
    });
    const style = document.createElement("style");
    style.setAttribute("data-visual-selector", "");
    style.textContent = plans.map(plan => `:root:root:root [${attribute}="${plan.marker}"]${plan.pseudo}{${plan.declaration}}`).join("\n");
    document.head.append(style);
    for (const plan of plans) plan.element.setAttribute(attribute, plan.marker);
    return () => {
      for (const name of names) CSS.highlights?.delete(name);
      style.remove();
      for (const { element, marker, previous } of plans) {
        if (element.getAttribute(attribute) !== marker) continue;
        if (previous === null) element.removeAttribute(attribute); else element.setAttribute(attribute, previous);
      }
    };
  }, [selected, excluded, preview, candidate?.include, paints]);

  // Background and contour matches on the same element share one trace. Cache
  // bounds/style reads across accepted/excluded/preview layers for this render.
  const geometry = new Map<Element, Omit<Mark, "key" | "surface"> | null>();
  const marksFor = (parts: VisualPart[]) => {
    const marks = new Map<Element, Mark>();
    for (const part of parts) {
      if (part.range || part.role === "icon" || part.role === "text") continue;
      let bounds = geometry.get(part.element);
      if (bounds === undefined) {
        const rect = part.element.getBoundingClientRect();
        if (!rect.width || !rect.height || rect.bottom < 0 || rect.right < 0 || rect.top > innerHeight || rect.left > innerWidth) bounds = null;
        else {
          const radii = getComputedStyle(part.element).borderTopLeftRadius.split(" ");
          const radius = (value: string, size: number) => Math.min(size / 2, (parseFloat(value) || 0) * (value.endsWith("%") ? size / 100 : 1));
          bounds = { x: rect.x, y: rect.y, width: rect.width, height: rect.height,
            rx: radius(radii[0], rect.width), ry: radius(radii[1] ?? radii[0], rect.height) };
        }
        geometry.set(part.element, bounds);
      }
      if (!bounds) continue;
      const existing = marks.get(part.element);
      if (existing) existing.surface ||= part.role === "background";
      else marks.set(part.element, { ...bounds, key: part.key, surface: part.role === "background" });
    }
    return [...marks.values()];
  };
  const marks = marksFor(selected), omissions = marksFor(excluded), candidates = marksFor(preview);
  const rectFor = (anchor: SelectionBoundary | null, key: string): Mark | undefined => {
    const root = anchor && boundaryElement(anchor);
    const rect = root === document.body ? { x: 3, y: 3, width: innerWidth - 6, height: innerHeight - 6 } : root?.getBoundingClientRect();
    return rect ? { key, ...{ x: rect.x, y: rect.y, width: Math.max(0, rect.width), height: Math.max(0, rect.height) }, rx: 4, ry: 4, surface: false } : undefined;
  };
  const edge = rectFor(boundary, "boundary"), hover = rectFor(hoverBoundary ?? candidate?.boundary ?? null, "preview-boundary");
  return <div data-visual-selector className="visual-selection-overlay">
    <style>{glyphFeedback("omnium-selector-selected", paints.included) + glyphFeedback("omnium-selector-excluded", paints.excluded) +
      glyphFeedback("omnium-selector-preview", candidate?.include === false ? paints.excluded : paints.included)}</style>
    <svg aria-hidden="true" width="100%" height="100%">
      {marks.map(mark => <SelectionTrace key={mark.key} mark={mark} tone="included" paint={paints.included} />)}
      {omissions.map(mark => <SelectionTrace key={mark.key} mark={mark} tone="excluded" paint={paints.excluded} />)}
      {candidates.map(mark => <SelectionTrace key={mark.key} mark={mark} tone={candidate?.include === false ? "excluded" : "included"}
        paint={candidate?.include === false ? paints.excluded : paints.included} preview />)}
      {edge && <SelectionTrace mark={edge} tone="boundary" paint={paints.boundary} />}
      {hover && (hoverBoundary || (candidate && !candidate.part)) && <SelectionTrace mark={hover}
        tone={!candidate ? "boundary" : candidate.include ? "included" : "excluded"}
        paint={!candidate ? paints.boundary : candidate.include ? paints.included : paints.excluded} preview />}
    </svg>
  </div>;
}
