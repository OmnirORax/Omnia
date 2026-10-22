import { useEffect, useMemo, type CSSProperties } from "react";
import { useAppearance } from "./Context";
import { paintSceneSelection, type SceneSelectionPaint } from "./sceneFeedback";
import { registerPaintVariable } from "./paintVariables";
import { SELECTOR_FEEDBACK, TARGETS } from "./registry";
import { brightHex, tint, valueFor } from "./resolve";
import { type SelectionRule, type VisualPart } from "./visualSelection";
import { pathEdges, type Point } from "./selectionGeometry";

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
  mix: "--omnium-selector-glyph-mix",
  glow: "--omnium-selector-glow",
};
function startSelectionPulse(elements: Element[]) {
  if (!elements.length) return () => {};
  const supported = [
    [signal.mix, "<percentage>", "65%"], [signal.glow, "<length>", "3px"],
  ].every(([name, syntax, initial]) => registerPaintVariable(name, syntax, false, initial));
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let animations: Animation[] = [];
  const start = () => {
    animations.forEach(animation => animation.cancel()); animations = [];
    if (!supported || reduced.matches || document.hidden) return;
    // Non-inherited variables animate only the actual paint hosts. Never put
    // inherited animated paint on :root: it invalidates the entire application.
    animations = elements.filter(element => typeof element.animate === "function").map(element => element.animate([
      { [signal.mix]: "95%", [signal.glow]: "9px", easing: "ease-in-out" },
      { [signal.mix]: "8%", [signal.glow]: "0.5px", easing: "ease-in-out" },
      { [signal.mix]: "95%", [signal.glow]: "9px" },
    ], { duration: 1000, iterations: Infinity }));
    // New preview targets join the existing clock instead of restarting it.
    if (document.timeline.currentTime !== null) animations.forEach(animation => { animation.startTime = 0; });
  };
  start();
  reduced.addEventListener("change", start);
  document.addEventListener("visibilitychange", start);
  return () => { animations.forEach(animation => animation.cancel()); reduced.removeEventListener("change", start); document.removeEventListener("visibilitychange", start); };
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

function useFeedbackPaints() {
  const appearance = useAppearance();
  return useMemo(() => Object.fromEntries(Object.entries(SELECTOR_FEEDBACK).map(([tone, defaults]) => {
    const target = TARGETS.find(target => target.id === `ui.guides.selector.${tone}`)!;
    const get = (property: string) => appearance && !appearance.safe
      ? valueFor(appearance.base, appearance.state, target, property) : target.defaults![property];
    return [tone, { ink: brightHex(String(get("color") ?? defaults.color), Number(get("brightness"))),
      opacity: Number(get("opacity")), glow: Number(get("glow")) }];
  })) as Record<Tone, FeedbackPaint>, [appearance?.base, appearance?.state, appearance?.safe]);
}

/** A logical feedback target needs a live sample when no scene/UI part is
 * selected. Reuse the actual trace renderer and its existing shared values. */
export function SelectorFeedbackSample({ targets }: { targets: string[] }) {
  const paints = useFeedbackPaints();
  const tones = (Object.keys(SELECTOR_FEEDBACK) as Tone[]).filter(tone => {
    const target = TARGETS.find(target => target.id === `ui.guides.selector.${tone}`)!;
    return !target.hidden && targets.includes(target.id);
  });
  if (!tones.length) return null;
  return <svg className="selector-feedback-sample" viewBox={`0 0 ${tones.length * 128} 52`} role="img" aria-label="Live selector feedback preview">
    {tones.map((tone, index) => <g key={tone} transform={`translate(${index * 128 + 4},4)`}>
      <SelectionTrace tone={tone} paint={paints[tone]} mark={{ key: tone, x: 0, y: 0, width: 116, height: 26, rx: 6, ry: 6, surface: true }} />
      <text x="58" y="43" textAnchor="middle" fill="currentColor" fontSize="11">{SELECTOR_FEEDBACK[tone].label}</text>
    </g>)}
  </svg>;
}

/** Native paint variables and SVG seams animate feedback; no per-frame DOM discovery or writes. */
export function VisualSelectionOverlay({ selected, excluded, preview, candidate, guide, guides, paths = [] }: {
  selected: VisualPart[]; excluded: VisualPart[]; preview: VisualPart[]; candidate: SelectionRule | null;
  guide: [Point, Point] | null;
  guides: { key: string; points: [Point, Point]; include: boolean; direction: boolean }[];
  paths?: { key: string; points: Point[]; closed: boolean; disabledEdges: number[]; preview: boolean; include?: boolean }[];
}) {
  const paints = useFeedbackPaints();
  useEffect(() => {
    const targets = new Map<string, SceneSelectionPaint>();
    for (const part of [...selected, ...preview]) if (part.target.binding?.selection?.renderer === "scene")
      targets.set(part.target.id, { color: paints.included.ink, opacity: paints.included.opacity });
    if (!targets.size) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0, previous = -Infinity;
    // Scene feedback changes only registered renderer paint, at most 30 fps.
    // No DOM or geometry discovery belongs in this animation loop.
    const draw = (time: number) => {
      frame = 0;
      if (document.hidden) return;
      if (time - previous >= 1000 / 30) {
        previous = time;
        paintSceneSelection(targets, reduced.matches ? .6 : .5 + .5 * Math.cos(time * Math.PI * 2 / 1000));
      }
      if (!reduced.matches) frame = requestAnimationFrame(draw);
    };
    const resume = () => {
      cancelAnimationFrame(frame); previous = -Infinity;
      if (document.hidden) paintSceneSelection(new Map(), 0); else draw(performance.now());
    };
    resume(); reduced.addEventListener("change", resume); document.addEventListener("visibilitychange", resume);
    return () => {
      cancelAnimationFrame(frame); reduced.removeEventListener("change", resume); document.removeEventListener("visibilitychange", resume);
      paintSceneSelection(new Map(), 0);
    };
  }, [selected, preview, paints]);
  useEffect(() => {
    const names = ["omnium-selector-selected", "omnium-selector-excluded", "omnium-selector-preview"];
    const highlights = typeof Highlight !== "undefined" && !!CSS.highlights;
    if (highlights) {
      CSS.highlights.set(names[0], new Highlight(...selected.flatMap(part => part.range ? [part.range] : [])));
      CSS.highlights.set(names[1], new Highlight(...excluded.flatMap(part => part.range ? [part.range] : [])));
      CSS.highlights.set(names[2], new Highlight(...preview.flatMap(part => part.range ? [part.range] : [])));
      for (const name of names) CSS.highlights.get(name)!.priority = 10;
    }
    type GlyphPaint = { kind: "icon" | "text"; feedback: FeedbackPaint; pseudo: string };
    const paint = new Map<HTMLElement | SVGElement, { glyph?: GlyphPaint; surface?: FeedbackPaint }>();
    for (const [parts, feedback] of [[selected, paints.included], [excluded, paints.excluded], [preview, candidate?.include === false ? paints.excluded : paints.included]] as const) {
      for (const part of parts) {
        if (part.target.binding?.selection?.renderer === "scene") continue;
        if (part.role === "background" && part.element instanceof HTMLElement) {
          paint.set(part.element, { ...paint.get(part.element), surface: feedback });
        } else if (!(part.range && highlights) && (part.role === "icon" || part.role === "text")) {
          paint.set(part.element, { ...paint.get(part.element), glyph: { kind: part.role, feedback,
            pseudo: part.target.id === "text.ui.placeholders" ? "::placeholder" : "" } });
        }
      }
    }
    // Read source paint once, then own a removable stylesheet/marker layer. The
    // renderer's inline paint remains available to other previews and is never replaced.
    const attribute = "data-visual-selection-ink";
    const plans = [...paint].map(([element, { glyph, surface }], index) => {
      const computed = getComputedStyle(element, glyph?.pseudo || null);
      const pseudo = glyph?.pseudo ?? "";
      let declaration = "", hostDeclaration = "";
      if (glyph) {
        const { kind, feedback } = glyph;
        const filter = computed.filter === "none" ? "" : computed.filter;
        const shadow = computed.textShadow === "none" ? "" : computed.textShadow + ",";
        const ink = feedbackInk(feedback), blur = feedbackGlow(feedback);
        const source = (element.hasAttribute(attribute) ? computed.getPropertyValue("--omnium-selector-source-color").trim() : "") || computed.color;
        const color = glyphColor(source, feedback), textShadow = `${shadow}0 0 ${blur} ${ink}`;
        // Resolve variables on the host before inheriting paint into ::placeholder.
        hostDeclaration = pseudo ? `--omnium-selector-placeholder-color:${color};--omnium-selector-placeholder-shadow:${textShadow};` : "";
        declaration = `--omnium-selector-source-color:${source};` + (kind === "icon" ? `filter:${filter} drop-shadow(0 0 ${blur} ${ink})!important;` :
          `color:${pseudo ? "var(--omnium-selector-placeholder-color)" : color}!important;text-shadow:${pseudo ? "var(--omnium-selector-placeholder-shadow)" : textShadow}!important;`);
      }
      if (surface) {
        const original = getComputedStyle(element).boxShadow;
        const shadow = original === "none" ? "" : `${original},`;
        const weight = `calc(${mix} * ${surface.opacity} * .3)`;
        // An inset tint paints the actual rounded surface below its contents,
        // including image/gradient backgrounds. No blur, wrappers or value writes.
        const tint = `color-mix(in srgb,transparent calc(100% - ${weight}),${surface.ink} ${weight})`;
        const fill = `box-shadow:${shadow}inset 0 0 0 100vmax ${tint}!important;`;
        if (pseudo) hostDeclaration += fill; else declaration += fill;
      }
      return { element, pseudo, marker: `selection-${index}`, previous: element.getAttribute(attribute), declaration, hostDeclaration };
    });
    const style = document.createElement("style");
    style.setAttribute("data-visual-selector", "");
    style.textContent = plans.map(plan => {
      const selector = `:root:root:root [${attribute}="${plan.marker}"]`;
      return `${plan.hostDeclaration ? `${selector}{${plan.hostDeclaration}}` : ""}${selector}${plan.pseudo}{${plan.declaration}}`;
    }).join("\n");
    document.head.append(style);
    for (const plan of plans) plan.element.setAttribute(attribute, plan.marker);
    const stopPulse = startSelectionPulse([...new Set([...selected, ...excluded, ...preview]
      .filter(part => !part.target.binding?.selection && (part.role === "text" || part.role === "icon" || part.role === "background")).map(part => part.element))]);
    return () => {
      stopPulse();
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
      if (part.range || part.role === "icon" || part.role === "text" || part.target.binding?.selection?.renderer === "scene") continue;
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
      if (existing) existing.surface ||= part.role === "background" && !(part.element instanceof HTMLElement);
      else marks.set(part.element, { ...bounds, key: part.key, surface: part.role === "background" && !(part.element instanceof HTMLElement) });
    }
    return [...marks.values()];
  };
  const marks = marksFor(selected), omissions = marksFor(excluded), candidates = marksFor(preview);
  return <div data-visual-selector className="visual-selection-overlay">
    <style>{glyphFeedback("omnium-selector-selected", paints.included) + glyphFeedback("omnium-selector-excluded", paints.excluded) +
      glyphFeedback("omnium-selector-preview", candidate?.include === false ? paints.excluded : paints.included)}</style>
    <svg aria-hidden="true" width="100%" height="100%">
      <defs><marker id="selector-line-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto-start-reverse">
        <path d="M0 0L7 3.5L0 7" fill="none" stroke="context-stroke" />
      </marker></defs>
      {marks.map(mark => <SelectionTrace key={mark.key} mark={mark} tone="included" paint={paints.included} />)}
      {omissions.map(mark => <SelectionTrace key={mark.key} mark={mark} tone="excluded" paint={paints.excluded} />)}
      {candidates.map(mark => <SelectionTrace key={mark.key} mark={mark} tone={candidate?.include === false ? "excluded" : "included"}
        paint={candidate?.include === false ? paints.excluded : paints.included} preview />)}
      {paths.map(path => {
        const edges = pathEdges(path.points, path.closed);
        const stroke = (disabled: boolean) => edges.flatMap(([a, b], index) => path.disabledEdges.includes(index) === disabled
          ? [`M${a.x} ${a.y}L${b.x} ${b.y}`] : []).join(" ");
        return <g key={path.key} className="visual-selection-path" style={{ color: feedbackInk(path.preview && path.include !== undefined ? paints.included : paints.boundary) }}>
          <path className="visual-selection-line" d={stroke(false)} fill="none" />
          <path className="visual-selection-line is-disabled" d={stroke(true)} fill="none" />
          {path.closed && path.points.length > 2 && path.points.length < 24 && path.points.map((p, index) => <circle key={index} className="visual-selection-line-end" cx={p.x} cy={p.y} r="2.5" />)}
          {!path.preview && path.closed && edges.length < 24 && edges.map(([a, b], index) => <text key={index} className="visual-selection-edge-label"
            x={(a.x + b.x) / 2 + 4} y={(a.y + b.y) / 2 - 4}>{index + 1}</text>)}
        </g>;
      })}
      {guides.map(({ key, points: [a, b], direction }) => <line key={key} className="visual-selection-line is-accepted"
        x1={a.x} y1={a.y} x2={b.x} y2={b.y} markerEnd={direction ? "url(#selector-line-arrow)" : undefined}
        style={{ color: feedbackInk(paints.boundary) }} />)}
      {guide && <g style={{ color: feedbackInk(candidate?.include === false ? paints.excluded : paints.included) }}>
        <line className="visual-selection-line" x1={guide[0].x} y1={guide[0].y} x2={guide[1].x} y2={guide[1].y}
          markerEnd={candidate?.line?.mode === "direction" ? "url(#selector-line-arrow)" : undefined} />
        {guide.map((p, index) => <circle key={index} className="visual-selection-line-end" cx={p.x} cy={p.y} r="3" />)}
      </g>}
    </svg>
  </div>;
}
