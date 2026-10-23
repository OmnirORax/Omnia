import { unavailableControl } from "./ui/controlAvailability";
import { createPaintClipReader, clipCanvas } from "./ui/paintClip";
import { effectsFor } from "./appearance/resolve";
import { uiEffectTargets, effectSelector, effectScope, textOwner } from "./appearance/uiEffects";
import { createElementEffectsResolver } from "./appearance/localEffects";
import { useEffect, useMemo, useRef } from "react";
import type { WorkspaceSettings } from "./workspaceActions";
import { clearUILightningContours, drawUILightning, drawUIElectricText } from "./uiLightning";
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
    const draw = () => {
      frame = 0;
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      const a = current.current,
        now = performance.now();
      if (!document.hidden && !reduced.matches)
        phase += Math.min(0.1, previous ? (now - previous) / 1000 : 0);
      previous = now;
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
      const resolver = plan.current;
      let processed = 0;
      const paintClip = createPaintClipReader(width, height);
      for (const target of uiEffectTargets) {
        const fx = effectsFor(a, target.id),
          hasLocal = resolver.activeLocalBases.has(target.id) || !!(target.hidden && target.parent && resolver.activeLocalBases.has(target.parent));
        if (!effectVisible(fx) && !hasLocal) continue;
        const selector = effectSelector(target);
        context.shadowBlur = (fx.glow ?? a.glow) * 12;
        context.strokeStyle =
          context.fillStyle =
          context.shadowColor =
            fx.color ?? (fx.effect === "electric-text" ? a.textColor : undefined) ?? a.accent;
        const localParts = resolver.forTarget(target).filter(local => local.instance?.part && effectVisible(resolver.localStyle(local)));
        const localJobs = localParts.flatMap(local => [...document.querySelectorAll<HTMLElement>(local.binding?.animation?.selector ?? local.binding?.selector ?? selector)].map(element => ({ element, local })));
        const replacedSurfaces = new Set(target.binding?.text ? [] : localJobs.map(job => job.element));
        const candidates: { element: HTMLElement; local?: typeof target }[] = [...localJobs,
          ...[...document.querySelectorAll<HTMLElement>(selector)].filter(element => !replacedSurfaces.has(element)).map(element => ({ element }))];
        for (let index = 0; index < Math.min(350, candidates.length) && processed < 350; index++) {
          const { element, local: exact } = candidates[index];
          if (
            !element.getClientRects().length ||
            element.closest("[hidden],.ui-drag-source,[data-visual-selector]") || unavailableControl(element) ||
            getComputedStyle(element).visibility === "hidden"
          )
            continue;
          const r = element.getBoundingClientRect();
          if (
            !r.width ||
            !r.height ||
            r.bottom < 0 ||
            r.top > height ||
            r.right < 0 ||
            r.left > width
          )
            continue;
          const clip = paintClip(element);
          if (!clip.width || !clip.height || r.right <= clip.x || r.left >= clip.x + clip.width || r.bottom <= clip.y || r.top >= clip.y + clip.height) continue;
          const localFx = exact ? resolver.localStyle(exact) : resolver.resolve(target, element);
          if (!effectVisible(localFx)) continue;
          context.strokeStyle = context.fillStyle = context.shadowColor = localFx.color ?? a.accent;
          context.shadowBlur = (localFx.glow ?? a.glow) * 12;
          const localTime = phase * localFx.motion;
          const baseScope = { ...effectScope(target, element), clip: paintClip };
          const scope = exact && target.binding?.text
            ? { key: exact.id, shape: "glyphs" as const, clip: paintClip, text: (parent: HTMLElement) => textOwner(parent)?.target.id === target.id,
              node: (node: Node) => resolver.nodeOwner(target, node)?.id === exact.id,
              input: (input: HTMLElement) => input === element && resolver.textHostOwner(target, input)?.id === exact.id, icons: false }
            : { ...baseScope, node: (node: Node) => !resolver.nodeOwner(target, node),
              input: (input: HTMLElement) => (!baseScope.input || baseScope.input(input)) && !resolver.textHostOwner(target, input) };
          processed++;
          moving ||= localFx.motion > 0;
          const seed = effectSeed(
            `${target.id}:${element.dataset.uiFunction ?? element.closest<HTMLElement>("[data-ui-resident-root]")?.dataset.uiResidentRoot ?? `${element.className}:${index}`}`,
          );
          context.save(); clipCanvas(context, clip);
          if (localFx.effect === "electric-text") {
            electricBudget -= drawUIElectricText(
              context,
              element,
              r,
              localFx,
              localTime,
              a.opacity * (localFx.opacity ?? 1),
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
              a.opacity * (localFx.opacity ?? 1),
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
      }
      context.globalAlpha = 1;
      context.shadowBlur = 0;
      if (!reduced.matches && moving) timer = setTimeout(request, 1000 / 30);
    };
    const request = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };
    redraw.current = request;
    const resume = () => {
      previous = 0;
      request();
    };
    const fontsLoaded = () => {
      clearUILightningContours();
      request();
    };
    const observer = new MutationObserver(records => {
      const relevant = records.some(record => !(record.target instanceof Element ? record.target : record.target.parentElement)?.closest("[data-visual-selector],style,script,canvas"));
      if (!relevant) return;
      if (records.some(record => record.attributeName === "disabled" || record.attributeName === "aria-disabled" ||
          record.attributeName === "class" && record.target instanceof Element && record.target.classList.contains("property-node"))) clearUILightningContours();
      plan.current.invalidate();
      if (uiEffectTargets.some(target => effectVisible(effectsFor(current.current, target.id))) || plan.current.activeLocalBases.size) request();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class", "hidden", "disabled", "aria-disabled"],
    });
    document.fonts.addEventListener("loadingdone", fontsLoaded);
    const layoutChanged = () => { clearUILightningContours(); request(); };
    window.addEventListener("resize", layoutChanged);
    document.addEventListener("load", request, true);
    document.addEventListener("scroll", layoutChanged, true);
    document.addEventListener("input", request, true);
    document.addEventListener("visibilitychange", resume);
    reduced.addEventListener("change", resume);
    request();
    return () => {
      document.fonts.removeEventListener("loadingdone", fontsLoaded);
      observer.disconnect();
      cancelAnimationFrame(frame);
      if (timer !== undefined) clearTimeout(timer);
      window.removeEventListener("resize", layoutChanged);
      document.removeEventListener("load", request, true);
      document.removeEventListener("scroll", layoutChanged, true);
      document.removeEventListener("input", request, true);
      document.removeEventListener("visibilitychange", resume);
      reduced.removeEventListener("change", resume);
      redraw.current = () => {};
    };
  }, []);
  useEffect(() => {
    redraw.current();
  }, [appearance]);
  return <canvas ref={canvas} className="window-sparkles" aria-hidden="true" />;
}
