import { useEffect, useRef } from "react";
import type { WorkspaceSettings } from "./workspaceActions";
import { clearUILightningContours, drawUILightning, drawUIElectricText } from "./uiLightning";
import { effectSeed, effectVisible, fallingStar, perimeterPoint, resolveTargetSparkles, type SurfaceTarget } from "./graph/effects";

/** Pointer-transparent decoration follows live UI bounds, including portalled windows. */
export function WindowSparkles({ appearance }: { appearance: WorkspaceSettings["appearance"] }) {
  const canvas = useRef<HTMLCanvasElement>(null), current = useRef(appearance); current.current = appearance;
  const redraw = useRef<() => void>(() => {});
  useEffect(() => {
    const surface = canvas.current!, context = surface.getContext("2d"); if (!context) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const selectors: [SurfaceTarget, string][] = [
      ["windows", ".floating-window:not(.is-collapsed) > .floating-window-content, .ui-frame-handle, .ui-panel-body:not([hidden]), .ui-contour"],
      ["buttons", "button[data-ui-function], .frame-mini-control"],
      ["fields", ".ui-form-control"],
    ];
    let frame = 0, timer: ReturnType<typeof setTimeout> | undefined, phase = 0, previous = 0;
    const draw = () => {
      frame = 0; if (timer !== undefined) clearTimeout(timer); timer = undefined;
      const a = current.current, now = performance.now();
      if (!document.hidden && !reduced.matches) phase += Math.min(0.1, previous ? (now - previous) / 1000 : 0);
      previous = now;
      const ratio = Math.min(devicePixelRatio, 1.5), width = innerWidth, height = innerHeight;
      if (surface.width !== Math.round(width * ratio) || surface.height !== Math.round(height * ratio)) { surface.width = Math.round(width * ratio); surface.height = Math.round(height * ratio); }
      context.setTransform(ratio, 0, 0, ratio, 0, 0); context.clearRect(0, 0, width, height);
      if (document.hidden || a.theme !== "neon" || a.opacity === 0) return;
      context.shadowBlur = a.glow * 12;
      let moving = false, lightningBudget = 1800, electricBudget = 1_200_000;
      for (const [target, selector] of selectors) {
        const fx = resolveTargetSparkles(a, target); if (!effectVisible(fx)) continue;
        context.strokeStyle = context.fillStyle = context.shadowColor = fx.color ?? a.accent;
        const time = phase * fx.motion;
        const candidates = [...document.querySelectorAll<HTMLElement>(selector)];
        for (let index = 0; index < Math.min(100, candidates.length); index++) {
          const element = candidates[index]; if (!element.getClientRects().length || element.closest("[hidden],.ui-drag-source") || getComputedStyle(element).visibility === "hidden") continue;
          const r = element.getBoundingClientRect(); if (!r.width || !r.height || r.bottom < 0 || r.top > height || r.right < 0 || r.left > width) continue;
          moving ||= fx.motion > 0;
          const seed = effectSeed(`${target}:${element.dataset.uiFunction ?? element.closest<HTMLElement>("[data-ui-resident-root]")?.dataset.uiResidentRoot ?? `${element.className}:${index}`}`);
          if (fx.effect === "electric-text") {
            electricBudget -= drawUIElectricText(context, element, r, fx, time, a.opacity, !reduced.matches && fx.motion > 0, electricBudget);
            continue;
          }
          if (fx.effect === "lightning") {
            lightningBudget -= drawUILightning(context, element, r, fx, time, seed, a.opacity, !reduced.matches && fx.motion > 0, lightningBudget);
            continue;
          }
          const snow = fx.effect === "falling-stars";
          const count = Math.ceil(fx.density * Math.min(snow ? 40 : 12, Math.max(3, snow ? r.width * r.height / 1800 : (r.width + r.height) / 90)));
          for (let i = 0; i < count; i++) {
            const falling = fallingStar(seed, i, time);
            const p = snow ? { x: falling.x * Math.max(0, r.width - 8) + 4, y: falling.y * Math.max(0, r.height - 8) + 4 } : perimeterPoint(r.width + 4, r.height + 4, seed + i / count + time * 0.025);
            const x = r.x + p.x - (snow ? 0 : 2), y = r.y + p.y - (snow ? 0 : 2);
            context.globalAlpha = a.opacity * fx.intensity * (snow ? falling.twinkle : 0.35 + 0.65 * (Math.sin(time * 2.5 + i * 2 + seed * 21) + 1) / 2);
            context.beginPath();
            if (fx.effect === "stars" || snow) { context.moveTo(x - 3, y); context.lineTo(x + 3, y); context.moveTo(x, y - 3); context.lineTo(x, y + 3); context.stroke(); }
            else if (fx.effect === "sparks") { context.moveTo(x - 1, y + 3); context.lineTo(x + 1, y - 3); context.stroke(); }
            else { context.arc(x, y, 1.3, 0, Math.PI * 2); context.fill(); }
          }
        }
      }
      context.globalAlpha = 1; context.shadowBlur = 0;
      if (!reduced.matches && moving) timer = setTimeout(request, 1000 / 30);
    };
    const request = () => { if (!frame) frame = requestAnimationFrame(draw); };
    redraw.current = request;
    const resume = () => { previous = 0; request(); };
    const fontsLoaded = () => { clearUILightningContours(); request(); };
    const observer = new MutationObserver(() => { if (current.current.theme === "neon" && selectors.some(([target]) => effectVisible(resolveTargetSparkles(current.current, target)))) request(); });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class", "hidden"] });
    document.fonts.addEventListener("loadingdone", fontsLoaded); window.addEventListener("resize", request); document.addEventListener("load", request, true); document.addEventListener("scroll", request, true); document.addEventListener("input", request, true); document.addEventListener("visibilitychange", resume); reduced.addEventListener("change", resume); request();
    return () => { document.fonts.removeEventListener("loadingdone", fontsLoaded); observer.disconnect(); cancelAnimationFrame(frame); if (timer !== undefined) clearTimeout(timer); window.removeEventListener("resize", request); document.removeEventListener("load", request, true); document.removeEventListener("scroll", request, true); document.removeEventListener("input", request, true); document.removeEventListener("visibilitychange", resume); reduced.removeEventListener("change", resume); redraw.current = () => {}; };
  }, []);
  useEffect(() => { redraw.current(); }, [appearance]);
  return <canvas ref={canvas} className="window-sparkles" aria-hidden="true" />;
}
