import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import { useAppearance } from "./Context";
import { paintSceneSelection, scenePartAt, type SceneSelectionPaint } from "./sceneFeedback";
import { registerPaintVariable } from "./paintVariables";
import { SELECTOR_FEEDBACK, TARGETS } from "./registry";
import { brightHex, tint } from "./resolve";
import { type SelectionRule, type VisualPart, type VisualMeasurements, createVisualMeasurements } from "./visualSelection";
import { laserSparkles, SELECTOR_PULSE_MS, SELECTOR_SPARKLE_BUDGET, type LaserSparkle } from "./selectorLaser";
import { pathEdges, type Point } from "./selectionGeometry";

type Mark = { key: string; x: number; y: number; width: number; height: number; rx: number; ry: number; surface: boolean };
const rectAttributes = (mark: Mark) => ({ x: mark.x, y: mark.y, width: mark.width, height: mark.height, rx: mark.rx, ry: mark.ry });
type Tone = keyof typeof SELECTOR_FEEDBACK;
type FeedbackPaint = { ink: string; hot: string; opacity: number; glow: number };
const feedbackStyle = (paint: FeedbackPaint): CSSProperties => ({
  "--visual-selection-ink": paint.ink, "--visual-selection-core": feedbackCore(paint),
  "--visual-selection-hot": paint.hot, "--visual-selection-opacity": paint.opacity,
  "--visual-selection-hairline": `${1 / Math.max(1, devicePixelRatio)}px`,
  "--visual-selection-glow": paint.glow, "--visual-selection-period": `${SELECTOR_PULSE_MS}ms`,
} as CSSProperties);
/** Tiny HTML layers composite independently of the full-screen SVG. */
function LaserSparkles({ sparks, paint, frame }: { sparks: LaserSparkle[]; paint: FeedbackPaint; frame?: { width: number; height: number } }) {
  return <div className="visual-selection-sparkles" aria-hidden="true" style={feedbackStyle(paint)}>{sparks.map((spark, index) =>
    <span key={index} className="visual-selection-sparkle" style={{
      left: frame ? `${spark.x / frame.width * 100}%` : spark.x,
      top: frame ? `${spark.y / frame.height * 100}%` : spark.y,
      width: 10 * spark.scale, height: 10 * spark.scale,
    }}><span className="visual-selection-sparkle-energy" style={{ animationDelay: `${spark.delay}s` }} /></span>
  )}</div>;
}
function SelectionTrace({ mark, tone, paint, preview = false, seam = true }: { mark: Mark; tone: Tone; paint: FeedbackPaint; preview?: boolean; seam?: boolean }) {
  const attributes = rectAttributes(mark);
  const style = feedbackStyle(paint);
  return <g style={style} className={`visual-selection-trace is-${tone} ${preview ? "is-preview" : ""}`}>
    {mark.surface && <rect {...attributes} className="visual-selection-surface" />}
    <rect {...attributes} className="visual-selection-halo" />
    <rect {...attributes} className="visual-selection-bloom" />
    <rect {...attributes} className="visual-selection-rail" />
    {seam && <rect {...attributes} className="visual-selection-seam" />}
  </g>;
}
const signal = { mix: "--omnium-selector-glyph-mix" };
/** Retain the animations of unchanged hosts when a hover pattern changes. A
 * category transition must never cancel/recreate the accepted selection's pulse. */
function useSelectionPulse(elements: Element[]) {
  const animations = useRef(new Map<Element, Animation>()), hosts = useRef(elements);
  hosts.current = elements;
  const refresh = useRef<() => void>(() => {});
  useEffect(() => {
    const supported = registerPaintVariable(signal.mix, "<percentage>", false, "65%");
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      const wanted = new Set(supported && !reduced.matches && !document.hidden ? hosts.current : []);
      for (const [element, animation] of animations.current) if (!wanted.has(element)) {
        animation.cancel(); animations.current.delete(element);
      }
      for (const element of wanted) if (!animations.current.has(element) && typeof element.animate === "function") {
        const animation = element.animate([
          { [signal.mix]: "82%", easing: "ease-in-out" },
          { [signal.mix]: "58%", easing: "ease-in-out" },
          { [signal.mix]: "82%" },
        ], { duration: SELECTOR_PULSE_MS, iterations: Infinity });
        if (document.timeline.currentTime !== null) animation.startTime = 0;
        animations.current.set(element, animation);
      }
    };
    refresh.current = sync; sync();
    reduced.addEventListener("change", sync); document.addEventListener("visibilitychange", sync);
    return () => {
      refresh.current = () => {};
      for (const animation of animations.current.values()) animation.cancel();
      animations.current.clear();
      reduced.removeEventListener("change", sync); document.removeEventListener("visibilitychange", sync);
    };
  }, []);
  useEffect(() => { refresh.current(); }, [elements]);
}
const mix = "var(--omnium-selector-glyph-mix,65%)";
const feedbackCore = (paint: FeedbackPaint, whiteness = .8) => {
  const white = Math.min(1, Math.max(0, paint.glow)) * whiteness * 100;
  return `color-mix(in srgb,${paint.ink} ${100 - white}%,${paint.hot} ${white}%)`;
};
const feedbackInk = (paint: FeedbackPaint) => tint(paint.ink, 1, paint.opacity);
const feedbackGlow = (paint: FeedbackPaint) => `${2 * paint.glow}px`;
const glyphColor = (base: string, paint: FeedbackPaint) => {
  const weight = `calc(${mix} * ${paint.opacity})`;
  return `color-mix(in srgb,${base} calc(100% - ${weight}),${feedbackCore(paint, .18)} ${weight})`;
};
const laserShadow = (paint: FeedbackPaint) => `0 0 ${feedbackGlow(paint)} ${feedbackInk(paint)}`;
const glyphFeedback = (name: string, paint: FeedbackPaint) =>
  `::highlight(${name}){color:${glyphColor("currentColor", paint)};background-color:transparent;text-shadow:${laserShadow(paint)}}`;

function useFeedbackPaints() {
  const appearance = useAppearance();
  const entries = Object.entries(SELECTOR_FEEDBACK).map(([tone, defaults]) => {
    const target = TARGETS.find(target => target.id === `ui.guides.selector.${tone}`)!;
    const get = (property: string) => appearance && !appearance.safe
      ? appearance.read(target, property) : target.defaults![property];
    return [tone, { ink: brightHex(String(get("color") ?? defaults.color), Number(get("brightness"))),
      hot: brightHex("#ffffff", Number(get("brightness"))), opacity: Number(get("opacity")), glow: Number(get("glow")) }];
  });
  // Unrelated object paint changes must not tear down/re-measure every feedback
  // host or restart its native animation while a color picker is dragged.
  const key = JSON.stringify(entries);
  return useMemo(() => Object.fromEntries(entries) as Record<Tone, FeedbackPaint>, [key]);
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
  const width = tones.length * 128;
  return <div data-visual-selector className="selector-feedback-sample" style={{ "--visual-selection-period": `${SELECTOR_PULSE_MS}ms` } as CSSProperties}>
    <svg viewBox={`0 0 ${width} 52`} role="img" aria-label="Live selector feedback preview">
      {tones.map((tone, index) => <g key={tone} transform={`translate(${index * 128 + 4},4)`}>
        <SelectionTrace tone={tone} paint={paints[tone]} mark={{ key: tone, x: 0, y: 0, width: 116, height: 26, rx: 6, ry: 6, surface: true }} />
        <text x="58" y="43" textAnchor="middle" fill="currentColor" fontSize="11">{SELECTOR_FEEDBACK[tone].label}</text>
      </g>)}
    </svg>
    {tones.map((tone, index) => <LaserSparkles key={tone} paint={paints[tone]} frame={{ width, height: 52 }}
      sparks={laserSparkles({ key: tone, x: index * 128 + 4, y: 4, width: 116, height: 26, rx: 6, ry: 6 }, 3)} />)}
  </div>;
}

/** Native paint variables and SVG seams animate feedback; no per-frame DOM discovery or writes. */
export function VisualSelectionOverlay({ selected, excluded, preview, candidate, guide, guides, paths = [], measurements }: {
  measurements?: VisualMeasurements;
  selected: VisualPart[]; excluded: VisualPart[]; preview: VisualPart[]; candidate: SelectionRule | null;
  guide: [Point, Point] | null;
  guides: { key: string; points: [Point, Point]; include: boolean; direction: boolean }[];
  paths?: { key: string; points: Point[]; closed: boolean; disabledEdges: number[]; preview: boolean; include?: boolean }[];
}) {
  const paints = useFeedbackPaints();
  const pendingPaint = useMemo(() => ({ ...paints.included, opacity: paints.included.opacity * .6 }), [paints]);
  const measure = useMemo(() => measurements ?? createVisualMeasurements(), [measurements, selected, excluded, preview]);
  // Membership is app-wide; only feedback in the viewport needs paint, text
  // Highlights or native animation. Scrolling refreshes the catalog/snapshot.
  const visible = useMemo(() => {
    const onScreen = (part: VisualPart) => measure.rects(part).some(rect =>
      rect.right > 0 && rect.bottom > 0 && rect.left < innerWidth && rect.top < innerHeight && rect.right > rect.left && rect.bottom > rect.top);
    return { selected: selected.filter(onScreen), excluded: excluded.filter(onScreen), preview: preview.filter(onScreen) };
  }, [selected, excluded, preview, measure]);
  const pulseHosts = useMemo(() => [...new Set([...visible.selected, ...visible.excluded, ...visible.preview]
    .filter(part => !part.target.binding?.selection && (part.role === "text" || part.role === "icon" || part.role === "background")).map(part => part.element))], [visible]);
  useSelectionPulse(pulseHosts);
  useEffect(() => {
    const targets = new Map<string, SceneSelectionPaint>();
    for (const [parts, paint] of [[selected, paints.included], [preview, pendingPaint]] as const)
      for (const part of parts) if (part.target.binding?.selection?.renderer === "scene")
        targets.set(part.target.id, { color: paint.ink, opacity: paint.opacity });
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
        paintSceneSelection(targets, reduced.matches ? .6 : .55 + .45 * Math.cos(time * Math.PI * 2 / SELECTOR_PULSE_MS));
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
  }, [selected, preview, paints, pendingPaint]);
  useEffect(() => {
    const names = ["omnium-selector-selected", "omnium-selector-excluded", "omnium-selector-preview"];
    const highlights = typeof Highlight !== "undefined" && !!CSS.highlights;
    if (highlights) {
      CSS.highlights.set(names[0], new Highlight(...visible.selected.flatMap(part => part.range ? [part.range] : [])));
      CSS.highlights.set(names[1], new Highlight(...visible.excluded.flatMap(part => part.range ? [part.range] : [])));
      CSS.highlights.set(names[2], new Highlight(...visible.preview.flatMap(part => part.range ? [part.range] : [])));
      for (const name of names) CSS.highlights.get(name)!.priority = 10;
    }
    type GlyphPaint = { kind: "icon" | "text"; feedback: FeedbackPaint; pseudo: string };
    const paint = new Map<HTMLElement | SVGElement, { glyph?: GlyphPaint; surface?: FeedbackPaint }>();
    for (const [parts, feedback] of [[visible.selected, paints.included], [visible.excluded, paints.excluded], [visible.preview, candidate?.include === false ? paints.excluded : pendingPaint]] as const) {
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
        const color = glyphColor(source, feedback), textShadow = `${shadow}${laserShadow(feedback)}`;
        // Resolve variables on the host before inheriting paint into ::placeholder.
        hostDeclaration = pseudo ? `--omnium-selector-placeholder-color:${color};--omnium-selector-placeholder-shadow:${textShadow};` : "";
        declaration = `--omnium-selector-source-color:${source};` + (kind === "icon" ? `filter:${filter} drop-shadow(0 0 ${blur} ${ink})!important;` :
          `color:${pseudo ? "var(--omnium-selector-placeholder-color)" : color}!important;text-shadow:${pseudo ? "var(--omnium-selector-placeholder-shadow)" : textShadow}!important;`);
      }
      if (surface) {
        const original = getComputedStyle(element).boxShadow;
        const shadow = original === "none" ? "" : `${original},`;
        const weight = `calc(${mix} * ${surface.opacity} * .2)`;
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
    return () => {
      for (const name of names) CSS.highlights?.delete(name);
      style.remove();
      for (const { element, marker, previous } of plans) {
        if (element.getAttribute(attribute) !== marker) continue;
        if (previous === null) element.removeAttribute(attribute); else element.setAttribute(attribute, previous);
      }
    };
  }, [visible, candidate?.include, paints, pendingPaint]);

  // Background and contour matches on the same element share one trace. Cache
  // bounds/style reads across accepted/excluded/preview layers for this render.
  const { marks, omissions, candidates } = useMemo(() => {
    const geometry = new Map<Element, Omit<Mark, "key" | "surface"> | null>();
    const marksFor = (parts: VisualPart[]) => {
      const marks = new Map<Element, Mark>();
      for (const part of parts) {
        if (part.range || part.role === "icon" || part.role === "text" || part.target.binding?.selection?.renderer === "scene") continue;
        let bounds = geometry.get(part.element);
        if (bounds === undefined) {
          const rect = measure.bounds(part.element);
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
    return { marks: marksFor(visible.selected), omissions: marksFor(visible.excluded), candidates: marksFor(visible.preview) };
  }, [visible, measure]);
  // Canvas surfaces have no DOM contour to trace. Give their background a sparse
  // sparkle field, rejecting foreground/UI hits once, never in the animation loop.
  const sceneSparks = useMemo(() => {
    const parts = [...new Map([...selected, ...preview].filter(part => part.target.binding?.selection?.renderer === "scene").map(part => [part.target.id, part])).values()];
    let budget = Math.min(6, SELECTOR_SPARKLE_BUDGET);
    return parts.flatMap(part => {
      const rect = measure.bounds(part.element);
      const count = budget; budget -= count;
      return laserSparkles({ key: part.key, x: rect.x, y: rect.y, width: rect.width, height: rect.height }, count, true)
        .filter(spark => document.elementFromPoint(spark.x, spark.y) === part.element && scenePartAt(part.target.id, part.element, spark.x, spark.y));
    });
  }, [selected, preview]);
  const inkSparks = useMemo(() => {
    const sparks: LaserSparkle[] = [], seen = new Set<Element>();
    let remaining = SELECTOR_SPARKLE_BUDGET - sceneSparks.length;
    for (const part of [...visible.selected, ...visible.preview]) {
      if (!remaining || seen.has(part.element) || part.target.binding?.selection?.renderer === "scene") continue;
      seen.add(part.element);
      const rects = measure.rects(part);
      for (const rect of rects.slice(0, 2)) {
        const left = Math.max(0, rect.left), top = Math.max(0, rect.top);
        const right = Math.min(innerWidth, rect.right), bottom = Math.min(innerHeight, rect.bottom);
        const box = { key: part.key, x: left, y: top, width: right - left, height: bottom - top };
        const points = laserSparkles(box, Math.min(2, remaining), part.role !== "contour");
        sparks.push(...points); remaining -= points.length;
      }
    }
    return sparks;
  }, [visible, measure, sceneSparks]);
  return <div data-visual-selector className="visual-selection-overlay" style={{ "--visual-selection-period": `${SELECTOR_PULSE_MS}ms` } as CSSProperties}>
    <style>{glyphFeedback("omnium-selector-selected", paints.included) + glyphFeedback("omnium-selector-excluded", paints.excluded) +
      glyphFeedback("omnium-selector-preview", candidate?.include === false ? paints.excluded : pendingPaint)}</style>
    <svg aria-hidden="true" width="100%" height="100%">
      <defs><marker id="selector-line-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto-start-reverse">
        <path d="M0 0L7 3.5L0 7" fill="none" stroke="context-stroke" />
      </marker></defs>
      {marks.map(mark => <SelectionTrace key={mark.key} mark={mark} tone="included" paint={paints.included} seam={false} />)}
      {omissions.map(mark => <SelectionTrace key={mark.key} mark={mark} tone="excluded" paint={paints.excluded} seam={false} />)}
      {candidates.map(mark => <SelectionTrace key={mark.key} mark={mark} tone={candidate?.include === false ? "excluded" : "included"}
        paint={candidate?.include === false ? paints.excluded : pendingPaint} preview seam={false} />)}
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
    <svg className="visual-selection-seams" aria-hidden="true" width="100%" height="100%">
      <g style={feedbackStyle(paints.included)} opacity={paints.included.opacity}>{marks.map(mark =>
        <rect key={mark.key} {...rectAttributes(mark)} className="visual-selection-seam" />)}</g>
      <g style={feedbackStyle(paints.excluded)} opacity={paints.excluded.opacity}>{omissions.map(mark =>
        <rect key={mark.key} {...rectAttributes(mark)} className="visual-selection-seam" />)}</g>
    </svg>
    <LaserSparkles sparks={[...sceneSparks, ...inkSparks]} paint={paints.included} />
  </div>;
}
