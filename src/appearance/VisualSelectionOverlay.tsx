import { useEffect, useMemo, useRef, type RefObject, type CSSProperties } from "react";
import { useAppearance } from "./Context";
import { paintSceneSelection, type SceneSelectionPaint } from "./sceneFeedback";
import { SELECTOR_FEEDBACK, TARGETS } from "./registry";
import { brightHex, tint } from "./resolve";
import { type SelectionRule, type VisualPart, type VisualMeasurements, createVisualMeasurements } from "./visualSelection";
import { selectorPulseSettings, selectorPulseLevel, type SelectorPulseSettings } from "./selectorFeedback";
import { SELECTOR_SURFACE_OPACITY, SELECTOR_PAINT_PEAK, selectorSurfaceStrength, remainingSurfaceTint, paintAlpha } from "./selectorSurface";
import selectorFeedback from "./selectorFeedback.function";
import { pathEdges, type Point } from "./selectionGeometry";

type Mark = { key: string; x: number; y: number; width: number; height: number; rx: number; ry: number; surface: boolean };
const rectAttributes = (mark: Mark) => ({ x: mark.x, y: mark.y, width: mark.width, height: mark.height, rx: mark.rx, ry: mark.ry });
type Tone = keyof typeof SELECTOR_FEEDBACK;
type FeedbackPaint = { ink: string; hot: string; opacity: number; glow: number };
const feedbackStyle = (paint: FeedbackPaint): CSSProperties => ({
  "--visual-selection-ink": paint.ink, "--visual-selection-core": feedbackCore(paint),
  "--visual-selection-hot": paint.hot, "--visual-selection-opacity": paint.opacity,
  "--visual-selection-hairline": `${1 / Math.max(1, devicePixelRatio)}px`,
  "--visual-selection-glow": paint.glow,
  "--visual-selection-surface-strength": SELECTOR_SURFACE_OPACITY * SELECTOR_PAINT_PEAK,
} as CSSProperties);
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
const signal = { mix: "--omnium-selector-glyph-mix", surface: "--omnium-selector-surface-mix" };
type SurfaceHost = { element: HTMLElement; opacity: number; inheritedOpacity: number; transmission: number };
type SurfaceSources = { current: SurfaceHost[] };
/** One continuous clock, no React frames, layout reads or browser custom-property
 * keyframe interpolation. Membership changes only replace this cached host list. */
function useSelectionPulse(elements: Element[], settings: SelectorPulseSettings, root: RefObject<HTMLDivElement | null>, sources?: SurfaceSources, revision = "") {
  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const surfaces = [...(root.current?.children ?? [])].filter((element): element is SVGSVGElement =>
      element instanceof SVGSVGElement && !element.classList.contains("visual-selection-seams"));
    const hosts = elements.filter((element): element is HTMLElement | SVGElement => element instanceof HTMLElement || element instanceof SVGElement);
    if (!hosts.length && !surfaces.length) return;
    const previous = hosts.flatMap(element => [signal.mix, signal.surface].map(property => ({ element, property,
      value: element.style.getPropertyValue(property), priority: element.style.getPropertyPriority(property) })));
    let frame = 0;
    const draw = (time: number) => {
      frame = 0;
      const level = settings.enabled && !reduced.matches ? selectorPulseLevel(time / settings.duration, settings.depth) : 1;
      const strength = SELECTOR_PAINT_PEAK * level;
      const weight = `${(100 * strength).toFixed(5)}%`;
      for (const element of hosts) element.style.setProperty(signal.mix, weight);
      for (const source of sources?.current ?? []) {
        const inherited = selectorSurfaceStrength(source.inheritedOpacity, strength) * source.transmission;
        source.element.style.setProperty(signal.surface, `${100 * remainingSurfaceTint(source.opacity, strength, inherited)}%`);
      }
      for (const surface of surfaces) surface.style.opacity = String(level);
      if (settings.enabled && !reduced.matches && !document.hidden) frame = requestAnimationFrame(draw);
    };
    const resume = () => { cancelAnimationFrame(frame); if (!document.hidden) draw(performance.now()); };
    resume();
    reduced.addEventListener("change", resume); document.addEventListener("visibilitychange", resume);
    return () => {
      cancelAnimationFrame(frame);
      for (const { element, property, value, priority } of previous) {
        if (value) element.style.setProperty(property, value, priority); else element.style.removeProperty(property);
      }
      for (const surface of surfaces) surface.style.removeProperty("opacity");
      reduced.removeEventListener("change", resume); document.removeEventListener("visibilitychange", resume);
    };
  }, [elements, settings, root, sources, revision]);
}
const mix = "var(--omnium-selector-glyph-mix,82%)";
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

function usePulseSettings() {
  const appearance = useAppearance();
  const target = appearance?.targets.find(target => target.id === selectorFeedback.consumer.id);
  const values = appearance && target && !appearance.safe
    ? selectorFeedback.readInputs(property => appearance.read(target, property))
    : { pulse: true, speed: .25, intensity: .3 };
  const key = JSON.stringify(values);
  return useMemo(() => selectorPulseSettings(values), [key]);
}
/** A logical feedback target needs a live sample when no scene/UI part is
 * selected. Reuse the actual trace renderer and its existing shared values. */
export function SelectorFeedbackSample({ targets }: { targets: string[] }) {
  const pulse = usePulseSettings();
  const pulseRoot = useRef<HTMLDivElement>(null);
  const paints = useFeedbackPaints();
  const tones = (Object.keys(SELECTOR_FEEDBACK) as Tone[]).filter(tone => {
    const target = TARGETS.find(target => target.id === `ui.guides.selector.${tone}`)!;
    return !target.hidden && (targets.includes(target.id) || targets.includes(selectorFeedback.consumer.id));
  });
  const sampleHosts = useMemo<Element[]>(() => [], [tones.join("|")]);
  useSelectionPulse(sampleHosts, pulse, pulseRoot);
  if (!tones.length) return null;
  const width = tones.length * 128;
  return <div ref={pulseRoot} data-visual-selector data-pulse={pulse.enabled} className="selector-feedback-sample"
    title="Animation speed controls pulse pace; Effect intensity controls fade depth. Pulse off keeps steady selection feedback.">
    <svg viewBox={`0 0 ${width} 52`} role="img" aria-label="Live selector feedback preview">
      {tones.map((tone, index) => <g key={tone} transform={`translate(${index * 128 + 4},4)`}>
        <SelectionTrace tone={tone} paint={paints[tone]} mark={{ key: tone, x: 0, y: 0, width: 116, height: 26, rx: 6, ry: 6, surface: true }} />
        <text x="58" y="43" textAnchor="middle" fill="currentColor" fontSize="11">{SELECTOR_FEEDBACK[tone].label}</text>
      </g>)}
    </svg>
  </div>;
}

/** Pulse updates cached paint hosts only; SVG seams retain their separate native animation. */
export function VisualSelectionOverlay({ selected, excluded, preview, candidate, guide, guides, paths = [], measurements }: {
  measurements?: VisualMeasurements;
  selected: VisualPart[]; excluded: VisualPart[]; preview: VisualPart[]; candidate: SelectionRule | null;
  guide: [Point, Point] | null;
  guides: { key: string; points: [Point, Point]; include: boolean; direction: boolean }[];
  paths?: { key: string; points: Point[]; closed: boolean; disabledEdges: number[]; preview: boolean; include?: boolean }[];
}) {
  const paints = useFeedbackPaints();
  const pulse = usePulseSettings();
  const pulseRoot = useRef<HTMLDivElement>(null);
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
    .filter(part => part.target.binding?.selection?.renderer !== "scene" && (part.role === "text" || part.role === "icon" || part.role === "background")).map(part => part.element))], [visible]);
  const surfaceSources = useRef<SurfaceHost[]>([]);
  useEffect(() => {
    const targets = new Map<string, SceneSelectionPaint>();
    for (const [parts, paint] of [[selected, paints.included], [preview, pendingPaint]] as const)
      for (const part of parts) if (part.target.binding?.selection?.renderer === "scene")
        targets.set(part.target.id, { color: paint.ink, opacity: paint.opacity });
    if (!targets.size) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    // Only registered scene paint is updated; follow display refresh without a 30 fps step.
    // No DOM or geometry discovery belongs in this animation loop.
    const draw = (time: number) => {
      frame = 0;
      if (document.hidden) return;
      paintSceneSelection(targets, reduced.matches || !pulse.enabled ? SELECTOR_PAINT_PEAK
        : SELECTOR_PAINT_PEAK * selectorPulseLevel(time / pulse.duration, pulse.depth));
      if (!reduced.matches && pulse.enabled) frame = requestAnimationFrame(draw);
    };
    const resume = () => {
      cancelAnimationFrame(frame);
      if (document.hidden) paintSceneSelection(new Map(), 0); else draw(performance.now());
    };
    resume(); reduced.addEventListener("change", resume); document.addEventListener("visibilitychange", resume);
    return () => {
      cancelAnimationFrame(frame); reduced.removeEventListener("change", resume); document.removeEventListener("visibilitychange", resume);
      paintSceneSelection(new Map(), 0);
    };
  }, [selected, preview, paints, pendingPaint, pulse]);
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
    const surfaces = new Map([...paint].flatMap(([element, plan]) => element instanceof HTMLElement && plan.surface ? [[element, plan.surface] as const] : []));
    const material = new WeakMap<HTMLElement, number>();
    const transmission = (element: HTMLElement) => {
      const cached = material.get(element);
      if (cached !== undefined) return cached;
      const style = getComputedStyle(element);
      // Images have their own ink; don't assume their pixels are transparent.
      const value = style.backgroundImage !== "none" ? 0 : 1 - paintAlpha(style.backgroundColor);
      material.set(element, value); return value;
    };
    const sceneBackdrops = [[visible.selected, paints.included], [visible.preview, pendingPaint]] as const;
    const backdrops = sceneBackdrops.flatMap(([parts, feedback]) => parts
      .filter(part => part.role === "background" && part.target.binding?.selection?.renderer === "scene")
      .map(part => ({ element: part.element, feedback, bounds: measure.bounds(part.element) })));
    surfaceSources.current = [...surfaces].map(([element, feedback]) => {
      let ancestor = element.parentElement, exposure = transmission(element);
      while (ancestor && !surfaces.has(ancestor)) { exposure *= transmission(ancestor); ancestor = ancestor.parentElement; }
      let parent = ancestor ? surfaces.get(ancestor) : undefined;
      if (!ancestor && backdrops.length) {
        const bounds = measure.bounds(element);
        const backdrop = backdrops.find(source => source.feedback.ink === feedback.ink && !element.contains(source.element) &&
          bounds.left >= source.bounds.left && bounds.top >= source.bounds.top && bounds.right <= source.bounds.right && bounds.bottom <= source.bounds.bottom);
        if (backdrop) {
          // Portalled windows may sit over the selected scene rather than inside
          // its DOM subtree. Count transmission only above their common owner.
          exposure = 1;
          let current: HTMLElement | null = element;
          while (current && !current.contains(backdrop.element)) { exposure *= transmission(current); current = current.parentElement; }
          if (current) { ancestor = current; parent = backdrop.feedback; }
        }
      }
      return { element, opacity: feedback.opacity, inheritedOpacity: parent?.ink === feedback.ink ? parent.opacity : 0, transmission: ancestor ? exposure : 0 };
    });
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
        const weight = `var(${signal.surface},${100 * selectorSurfaceStrength(surface.opacity, SELECTOR_PAINT_PEAK)}%)`;
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
      surfaceSources.current = [];
      for (const { element, marker, previous } of plans) {
        if (element.getAttribute(attribute) !== marker) continue;
        if (previous === null) element.removeAttribute(attribute); else element.setAttribute(attribute, previous);
      }
    };
  }, [visible, candidate?.include, paints, pendingPaint, measure]);

  useSelectionPulse(pulseHosts, pulse, pulseRoot, surfaceSources,
    `${paints.included.opacity}:${paints.excluded.opacity}:${pendingPaint.opacity}`);

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
  return <div ref={pulseRoot} data-visual-selector data-pulse={pulse.enabled} className="visual-selection-overlay">
    <style>{glyphFeedback("omnium-selector-selected", paints.included) + glyphFeedback("omnium-selector-excluded", paints.excluded) +
      glyphFeedback("omnium-selector-preview", candidate?.include === false ? paints.excluded : pendingPaint)}</style>
    <svg aria-hidden="true" width="100%" height="100%">
      {marks.map(mark => <SelectionTrace key={mark.key} mark={mark} tone="included" paint={paints.included} seam={false} />)}
      {omissions.map(mark => <SelectionTrace key={mark.key} mark={mark} tone="excluded" paint={paints.excluded} seam={false} />)}
      {candidates.map(mark => <SelectionTrace key={mark.key} mark={mark} tone={candidate?.include === false ? "excluded" : "included"}
        paint={candidate?.include === false ? paints.excluded : pendingPaint} preview seam={false} />)}
    </svg>
    <svg className="visual-selection-seams" aria-hidden="true" width="100%" height="100%"
      style={{ "--visual-selection-hairline": `${1 / Math.max(1, devicePixelRatio)}px` } as CSSProperties}>
      <defs><marker id="selector-line-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto-start-reverse">
        <path d="M0 0L7 3.5L0 7" fill="none" stroke="context-stroke" />
      </marker></defs>
      <g style={feedbackStyle(paints.included)} opacity={paints.included.opacity}>{marks.map(mark =>
        <rect key={mark.key} {...rectAttributes(mark)} className="visual-selection-seam" />)}</g>
      <g style={feedbackStyle(paints.excluded)} opacity={paints.excluded.opacity}>{omissions.map(mark =>
        <rect key={mark.key} {...rectAttributes(mark)} className="visual-selection-seam" />)}</g>
      <g style={feedbackStyle(pendingPaint)} opacity={pendingPaint.opacity}>{candidates.map(mark =>
        <rect key={mark.key} {...rectAttributes(mark)} className="visual-selection-seam" />)}</g>
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
