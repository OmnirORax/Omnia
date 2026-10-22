import { useLayoutEffect, useRef } from "react";
import { SelectorSymbol, SELECTOR_VIEW, type SelectorConfiguration } from "./SelectorSymbol";

/** Pointer motion updates only this element; it does not render the application tree. */
export function SelectorCursor({ configuration, initial }: { configuration: SelectorConfiguration; initial: { x: number; y: number } }) {
  const root = useRef<HTMLDivElement>(null), last = useRef(initial);
  const trail = useRef<SVGGElement>(null), dust = useRef<SVGGElement>(null);
  const mode = useRef(configuration.trail); mode.current = configuration.trail;
  useLayoutEffect(() => {
    let frame = 0;
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    const points: { x: number; y: number; time: number }[] = [];
    const lifetime = 240;
    const segments = [...trail.current!.children] as SVGLineElement[];
    const particles = [...dust.current!.children] as SVGCircleElement[];
    const clearTrail = () => { points.length = 0; [...segments, ...particles].forEach(segment => segment.setAttribute("opacity", "0")); };
    const offset = { x: 0, y: 0 };
    const paint = (now = performance.now()) => {
      frame = 0;
      if (root.current) root.current.style.transform = `translate3d(${last.current.x - offset.x}px,${last.current.y - offset.y}px,0)`;
      while (points.length && now - points[0].time > lifetime) points.shift();
      segments.forEach((segment, index) => {
        const a = points[index], b = points[index + 1];
        if (mode.current === "stardust" || !a || !b) { segment.setAttribute("opacity", "0"); return; }
        segment.setAttribute("x1", String(a.x)); segment.setAttribute("y1", String(a.y));
        segment.setAttribute("x2", String(b.x)); segment.setAttribute("y2", String(b.y));
        const strength = Math.max(0, 1 - (now - a.time) / lifetime);
        segment.setAttribute("opacity", String(strength * strength));
        segment.setAttribute("stroke-width", String(.5 + 2 * strength));
      });
      particles.forEach((particle, index) => {
        const point = points[index];
        if (mode.current !== "stardust" || !point) { particle.setAttribute("opacity", "0"); return; }
        const age = Math.max(0, (now - point.time) / lifetime), angle = index * 2.39996;
        particle.setAttribute("cx", String(point.x + Math.cos(angle) * age * 12));
        particle.setAttribute("cy", String(point.y + Math.sin(angle) * age * 12));
        particle.setAttribute("r", String((.7 + index % 3 * .5) * (1 - age * .5)));
        particle.setAttribute("opacity", String((1 - age) ** 2));
      });
      if (points.length) frame = requestAnimationFrame(paint);
    };
    const measure = () => {
      const rect = root.current!.getBoundingClientRect();
      offset.x = rect.width * SELECTOR_VIEW.x / SELECTOR_VIEW.width;
      offset.y = rect.height * SELECTOR_VIEW.y / SELECTOR_VIEW.height;
      cancelAnimationFrame(frame); paint();
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root.current!);
    const move = (event: PointerEvent) => {
      const next = { x: event.clientX, y: event.clientY }, now = performance.now();
      if (!reducedMotion.matches && document.visibilityState !== "hidden") {
        const previous = points.at(-1);
        if (previous && Math.hypot(next.x - previous.x, next.y - previous.y) > 200) clearTrail();
        if (!points.length) points.push({ ...last.current, time: now });
        if (!previous || Math.hypot(next.x - previous.x, next.y - previous.y) >= 2) {
          points.push({ ...next, time: now });
          if (points.length > segments.length + 1) points.shift();
        }
      } else clearTrail();
      last.current = next;
      if (!frame) frame = requestAnimationFrame(paint);
    };
    window.addEventListener("pointermove", move, true);
    window.addEventListener("blur", clearTrail);
    document.addEventListener("visibilitychange", clearTrail);
    reducedMotion.addEventListener("change", clearTrail);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); window.removeEventListener("pointermove", move, true); window.removeEventListener("blur", clearTrail);
      document.removeEventListener("visibilitychange", clearTrail); reducedMotion.removeEventListener("change", clearTrail); };
  }, []);
  return <>
    <svg data-visual-selector className="visual-selector-trail" aria-hidden="true">
      <g ref={dust}>{Array.from({ length: 33 }, (_, index) => <circle key={index} opacity="0" />)}</g>
      <g ref={trail}>{Array.from({ length: 32 }, (_, index) => <line key={index} opacity="0" />)}</g>
    </svg>
    <div ref={root} data-visual-selector className="visual-selector-cursor" aria-hidden="true">
    <SelectorSymbol configuration={configuration} precision />
  </div></>;
}
