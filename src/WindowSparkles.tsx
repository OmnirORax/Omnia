import { hierarchyTextLevel, subscribeHierarchyTextFeedback } from "./appearance/hierarchyTextFeedback";
import { effectGeometryStyle } from "./appearance/effectInvalidation";
import { unavailableControl } from "./ui/controlAvailability";
import { createPaintClipReader, clipCanvas } from "./ui/paintClip";
import { effectsFor } from "./appearance/resolve";
import { uiEffectTargets, effectSelector, effectScope, textOwner } from "./appearance/uiEffects";
import { createElementEffectsResolver } from "./appearance/localEffects";
import { useEffect, useMemo, useRef } from "react";
import type { GlyphScope } from "./uiLightning";
import type { SparkleStyle } from "./graph/effects";
import type { PaintClip } from "./ui/paintClip";
import type { RegisteredTarget } from "./appearance/registry";
import type { WorkspaceSettings } from "./workspaceActions";
import { clearUILightningContours, invalidateUILightningContours, drawUILightning, drawUIElectricText } from "./uiLightning";
import { effectSeed, effectVisible, fallingStar, perimeterPoint } from "./graph/effects";

/** Pointer-transparent decoration follows live UI bounds, including portalled windows. */
export function WindowSparkles({
  appearance,
  source = appearance,
}: {
  appearance: WorkspaceSettings["appearance"];
  source?: WorkspaceSettings["appearance"];
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    current = useRef(appearance);
  current.current = appearance;
  const effectPlan = useMemo(() => createElementEffectsResolver(source, appearance), [source, appearance]);
  const plan = useRef(effectPlan); plan.current = effectPlan;
  const redraw = useRef<() => void>(() => {});
  useEffect(() => {
    const surface = canvas.current!,
      context = surface.getContext("2d");
    if (!context) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0,
      timer: ReturnType<typeof setTimeout> | undefined,
      phase = 0,
      previous = 0;
    type Job = { target: RegisteredTarget; element: HTMLElement; rect: DOMRect; clip: PaintClip;
      fx: SparkleStyle; scope: GlyphScope; seed: number };
    let jobs: Job[] = [], dirty = true, measuredWidth = 0, measuredHeight = 0, lastPaint = 0;
    let observed = new Set<HTMLElement>();
    const measure = (a: WorkspaceSettings["appearance"], width: number, height: number) => {
      const next: Job[] = [], resolver = plan.current;
      const paintClip = createPaintClipReader(width, height);
      for (const target of uiEffectTargets) {
        const fx = effectsFor(a, target.id),
          hasLocal = resolver.activeLocalBases.has(target.id) || !!(target.hidden && target.parent && resolver.activeLocalBases.has(target.parent));
        if (!effectVisible(fx) && !hasLocal) continue;
        const selector = effectSelector(target);
        const localParts = resolver.forTarget(target).filter(local => local.instance?.part && effectVisible(resolver.localStyle(local)));
        const localJobs = localParts.flatMap(local => [...document.querySelectorAll<HTMLElement>(local.binding?.animation?.selector ?? local.binding?.selector ?? selector)].map(element => ({ element, local })));
        const replacedSurfaces = new Set(target.binding?.text ? [] : localJobs.map(job => job.element));
        const candidates: { element: HTMLElement; local?: typeof target }[] = [...localJobs,
          ...[...document.querySelectorAll<HTMLElement>(selector)].filter(element => !replacedSurfaces.has(element)).map(element => ({ element }))];
        for (let index = 0; index < Math.min(350, candidates.length) && next.length < 350; index++) {
          const { element, local: exact } = candidates[index];
          if (!element.getClientRects().length || element.closest("[hidden],.ui-drag-source,[data-visual-selector]") || unavailableControl(element) || getComputedStyle(element).visibility === "hidden") continue;
          const rect = element.getBoundingClientRect();
          if (!rect.width || !rect.height || rect.bottom < 0 || rect.top > height || rect.right < 0 || rect.left > width) continue;
          const clip = paintClip(element);
          if (!clip.width || !clip.height || rect.right <= clip.x || rect.left >= clip.x + clip.width || rect.bottom <= clip.y || rect.top >= clip.y + clip.height) continue;
          const localFx = exact ? resolver.localStyle(exact) : resolver.resolve(target, element);
          if (!effectVisible(localFx)) continue;
          const baseScope = { ...effectScope(target, element), clip: paintClip };
          const scope = exact && target.binding?.text
            ? { key: exact.id, shape: "glyphs" as const, clip: paintClip, text: (parent: HTMLElement) => textOwner(parent)?.target.id === target.id,
              node: (node: Node) => resolver.nodeOwner(target, node)?.id === exact.id,
              input: (input: HTMLElement) => input === element && resolver.textHostOwner(target, input)?.id === exact.id, icons: false }
            : { ...baseScope, node: (node: Node) => !resolver.nodeOwner(target, node),
              input: (input: HTMLElement) => (!baseScope.input || baseScope.input(input)) && !resolver.textHostOwner(target, input) };
          const seed = effectSeed(`${target.id}:${element.dataset.uiFunction ?? element.closest<HTMLElement>("[data-ui-resident-root]")?.dataset.uiResidentRoot ?? `${element.className}:${index}`}`);
          next.push({ target, element, rect, clip, fx: localFx, scope, seed });
        }
      }
      const hosts = new Set(next.map(job => job.element));
      for (const host of observed) if (!hosts.has(host)) resized.unobserve(host);
      for (const host of hosts) if (!observed.has(host)) resized.observe(host);
      observed = hosts;
      return next;
    };
    const draw = () => {
      frame = 0;
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      const a = current.current,
        now = performance.now();
      if (!document.hidden && !reduced.matches)
        phase += Math.min(0.1, previous ? (now - previous) / 1000 : 0);
      previous = now; lastPaint = now;
      const ratio = Math.min(devicePixelRatio, 1.5),
        width = innerWidth,
        height = innerHeight;
      if (
        surface.width !== Math.round(width * ratio) ||
        surface.height !== Math.round(height * ratio)
      ) {
        surface.width = Math.round(width * ratio);
        surface.height = Math.round(height * ratio);
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      if (document.hidden || a.theme !== "neon" || a.opacity === 0) return;
      context.shadowBlur = a.glow * 12;
      let moving = false,
        lightningBudget = 1800,
        electricBudget = 1_200_000;
      if (dirty || measuredWidth !== width || measuredHeight !== height) {
        jobs = measure(a, width, height); dirty = false;
        measuredWidth = width; measuredHeight = height;
      }
      for (const { target, element, rect: r, clip, fx: localFx, scope, seed } of jobs) {
        // Detached hosts are cheap to reject without reading layout.
        if (!element.isConnected) continue;
        context.strokeStyle = context.fillStyle = context.shadowColor = localFx.color ?? a.accent;
        context.shadowBlur = (localFx.glow ?? a.glow) * 12;
        const localTime = phase * localFx.motion;
        const hover = target.binding?.text ? hierarchyTextLevel(scope.key, element) : undefined;
        const hoverOpacity = hover === undefined ? 1 : .25 + .75 * hover;
        moving ||= localFx.motion > 0;
        context.save(); clipCanvas(context, clip);
        if (localFx.effect === "electric-text") {
          electricBudget -= drawUIElectricText(
            context,
            element,
            r,
            localFx,
            localTime,
            a.opacity * (localFx.opacity ?? 1) * hoverOpacity,
            !reduced.matches && localFx.motion > 0,
            electricBudget,
            scope,
          );
          context.restore();
          continue;
        }
        if (localFx.effect === "lightning") {
          lightningBudget -= drawUILightning(
            context,
            element,
            r,
            localFx,
            localTime,
            seed,
            a.opacity * (localFx.opacity ?? 1) * hoverOpacity,
            !reduced.matches && localFx.motion > 0,
            lightningBudget,
            scope,
          );
          context.restore();
          continue;
        }
        const snow = localFx.effect === "falling-stars";
        const count = Math.ceil(
          localFx.density *
            Math.min(
              snow ? 40 : 12,
              Math.max(3, snow ? (r.width * r.height) / 1800 : (r.width + r.height) / 90),
            ),
        );
        for (let i = 0; i < count; i++) {
          const falling = fallingStar(seed, i, localTime);
          const p = snow
            ? {
                x: falling.x * Math.max(0, r.width - 8) + 4,
                y: falling.y * Math.max(0, r.height - 8) + 4,
              }
            : perimeterPoint(r.width + 4, r.height + 4, seed + i / count + localTime * 0.025);
          const x = r.x + p.x - (snow ? 0 : 2),
            y = r.y + p.y - (snow ? 0 : 2);
          context.globalAlpha =
            a.opacity *
            (localFx.opacity ?? 1) *
            localFx.intensity *
            (snow
              ? falling.twinkle
              : 0.35 + (0.65 * (Math.sin(localTime * 2.5 + i * 2 + seed * 21) + 1)) / 2);
          context.beginPath();
          if (localFx.effect === "stars" || localFx.effect === "starfield" || snow) {
            const size = 3 * (localFx.effect === "starfield" ? (localFx.starSize ?? 1) : 1);
            context.moveTo(x - size, y);
            context.lineTo(x + size, y);
            context.moveTo(x, y - size);
            context.lineTo(x, y + size);
            context.stroke();
          } else if (localFx.effect === "sparks") {
            context.moveTo(x - 1, y + 3);
            context.lineTo(x + 1, y - 3);
            context.stroke();
          } else {
            context.arc(x, y, 1.3, 0, Math.PI * 2);
            context.fill();
          }
        }
        context.restore();
      }
      context.globalAlpha = 1;
      context.shadowBlur = 0;
      if (!reduced.matches && moving) request();
    };
    const request = (urgent = false) => {
      if (urgent && timer !== undefined) { clearTimeout(timer); timer = undefined; }
      if (frame || timer !== undefined) return;
      const wait = urgent ? 0 : Math.max(0, 1000 / 30 - (performance.now() - lastPaint));
      if (wait > 0) timer = setTimeout(() => { timer = undefined; request(true); }, wait);
      else frame = requestAnimationFrame(draw);
    };
    const invalidate = () => { dirty = true; request(true); };
    const invalidateMasks = () => { clearUILightningContours(); invalidate(); };
    const stopTextFeedback = subscribeHierarchyTextFeedback(() => {
      if (uiEffectTargets.some(target => effectVisible(effectsFor(current.current, target.id))) || plan.current.activeLocalBases.size) request();
    });
    redraw.current = invalidate;
    const resume = () => {
      previous = 0;
      invalidate();
    };
    const fontsLoaded = () => {
      invalidateMasks();
    };
    const observer = new MutationObserver(records => {
      const styles = new Map<Element, string>();
      const changed = new Set<Element>();
      for (const record of records) {
        const element = record.target instanceof Element ? record.target : record.target.parentElement;
        if (!element || element.closest("[data-visual-selector],style,script,canvas")) continue;
        if (record.attributeName === "style") {
          let currentStyle = styles.get(element);
          if (currentStyle === undefined) { currentStyle = effectGeometryStyle(element.getAttribute("style")); styles.set(element, currentStyle); }
          if (effectGeometryStyle(record.oldValue) === currentStyle) continue;
        }
        changed.add(element);
      }
      if (!changed.size) return;
      invalidateUILightningContours(changed); plan.current.invalidate(); dirty = true;
      if (uiEffectTargets.some(target => effectVisible(effectsFor(current.current, target.id))) || plan.current.activeLocalBases.size) request(true);
    });
    observer.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true,
      attributes: true,
      attributeOldValue: true,
      attributeFilter: ["style", "class", "hidden", "disabled", "aria-disabled"],
    });
    document.fonts.addEventListener("loadingdone", fontsLoaded);
    const layoutChanged = invalidateMasks;
    const loaded = () => invalidateMasks();
    const resized = new ResizeObserver(invalidateMasks);
    resized.observe(document.documentElement);
    window.addEventListener("resize", layoutChanged);
    document.addEventListener("load", loaded, true);
    document.addEventListener("scroll", layoutChanged, true);
    document.addEventListener("input", invalidateMasks, true);
    document.addEventListener("visibilitychange", resume);
    reduced.addEventListener("change", resume);
    request();
    return () => {
      stopTextFeedback();
      document.fonts.removeEventListener("loadingdone", fontsLoaded);
      observer.disconnect(); resized.disconnect();
      cancelAnimationFrame(frame);
      if (timer !== undefined) clearTimeout(timer);
      window.removeEventListener("resize", layoutChanged);
      document.removeEventListener("load", loaded, true);
      document.removeEventListener("scroll", layoutChanged, true);
      document.removeEventListener("input", invalidateMasks, true);
      document.removeEventListener("visibilitychange", resume);
      reduced.removeEventListener("change", resume);
      redraw.current = () => {};
    };
  }, []);
  useEffect(() => {
    redraw.current();
  }, [appearance, effectPlan]);
  return <canvas ref={canvas} className="window-sparkles" aria-hidden="true" />;
}
