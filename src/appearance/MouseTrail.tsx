import { PAGE_INPUT_SUSPEND } from "../ui/pageInputBoundary";
import { useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useAppearance } from "./Context";
import { effectsFromValues } from "./resolve";
import mouseTrail from "./mouseTrail.function";

/** Global pointer effect adapter. Settings and serialization use the master controller. */
export function MouseTrail() {
  const ctx = useAppearance()!;
  const target = ctx.targets.find(target => target.id === mouseTrail.consumer.id)!;
  const values = mouseTrail.readInputs(property => ctx.renderRead(target, property));
  const fx = effectsFromValues(property => values[property]);
  const enabled = !ctx.safe && fx.effect !== "off";
  const trail = useRef<SVGGElement>(null), dust = useRef<SVGGElement>(null);
  const settings = useRef(fx); settings.current = fx;
  useLayoutEffect(() => {
    if (!enabled) return;
    let frame = 0;
    let last: { x: number; y: number } | null = null;
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    const points: { x: number; y: number; time: number }[] = [];
    const lifetime = () => 120 + (settings.current.boltLength ?? .35) * 680;
    const segments = [...trail.current!.children] as SVGLineElement[];
    const particles = [...dust.current!.children] as SVGCircleElement[];
    const clearTrail = () => { points.length = 0; [...segments, ...particles].forEach(segment => segment.setAttribute("opacity", "0")); };
    const paint = (now = performance.now()) => {
      frame = 0;
      const duration = lifetime(), fx = settings.current;
      const capacity = Math.max(2, Math.round(32 * Math.min(1, fx.density)));
      while (points.length && (now - points[0].time > duration || points.length > capacity)) points.shift();
      segments.forEach((segment, index) => {
        const a = points[index], b = points[index + 1];
        if (fx.effect !== "lightning" || !a || !b) { segment.setAttribute("opacity", "0"); return; }
        segment.setAttribute("x1", String(a.x)); segment.setAttribute("y1", String(a.y));
        segment.setAttribute("x2", String(b.x)); segment.setAttribute("y2", String(b.y));
        const strength = Math.max(0, 1 - (now - a.time) / duration);
        segment.setAttribute("opacity", String(strength * strength));
        segment.setAttribute("stroke-width", String((.5 + 2 * strength) * (fx.starSize ?? 1) * (0.5 + fx.intensity)));
      });
      particles.forEach((particle, index) => {
        const point = points[index];
        if (fx.effect === "lightning" || !point) { particle.setAttribute("opacity", "0"); return; }
        const age = Math.max(0, (now - point.time) / duration), angle = index * 2.39996;
        particle.setAttribute("cx", String(point.x + Math.cos(angle) * age * (4 + fx.motion * 40)));
        particle.setAttribute("cy", String(point.y + Math.sin(angle) * age * (4 + fx.motion * 40)));
        particle.setAttribute("r", String((.7 + index % 3 * .5) * (fx.starSize ?? 1) * (0.5 + fx.intensity) * (1 - age * .5)));
        particle.setAttribute("opacity", String((1 - age) ** 2));
      });
      if (points.length) frame = requestAnimationFrame(paint);
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const next = { x: event.clientX, y: event.clientY }, now = performance.now();
      if (!reducedMotion.matches && document.visibilityState !== "hidden") {
        const previous = points.at(-1);
        if (previous && Math.hypot(next.x - previous.x, next.y - previous.y) > 200) clearTrail();
        if (!points.length && last) points.push({ ...last, time: now });
        if (!previous || Math.hypot(next.x - previous.x, next.y - previous.y) >= 2) {
          points.push({ ...next, time: now });
          if (points.length > segments.length + 1) points.shift();
        }
      } else clearTrail();
      last = next;
      if (!frame) frame = requestAnimationFrame(paint);
    };
    window.addEventListener("pointermove", move, true);
    window.addEventListener(PAGE_INPUT_SUSPEND, clearTrail);
    document.addEventListener("pointerleave", clearTrail);
    document.addEventListener("visibilitychange", clearTrail);
    reducedMotion.addEventListener("change", clearTrail);
    return () => { cancelAnimationFrame(frame);
      document.removeEventListener("pointerleave", clearTrail); window.removeEventListener("pointermove", move, true); window.removeEventListener(PAGE_INPUT_SUSPEND, clearTrail);
      document.removeEventListener("visibilitychange", clearTrail); reducedMotion.removeEventListener("change", clearTrail); };
  }, [enabled]);
  if (!enabled) return null;
  return createPortal(<svg data-visual-selector className="mouse-trail" aria-hidden="true"
    style={{ color: fx.color, opacity: fx.opacity, filter: fx.glow ? `drop-shadow(0 0 ${fx.glow * 4}px ${fx.color})` : undefined }}>
      <g ref={dust}>{Array.from({ length: 33 }, (_, index) => <circle key={index} opacity="0" />)}</g>
      <g ref={trail}>{Array.from({ length: 32 }, (_, index) => <line key={index} opacity="0" />)}</g>
    </svg>, document.body);
}
