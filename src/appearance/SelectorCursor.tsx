import { useLayoutEffect, useRef } from "react";
import { SelectorSymbol, SELECTOR_VIEW, type SelectorConfiguration } from "./SelectorSymbol";

/** Pointer motion updates only this element; it does not render the application tree. */
export function SelectorCursor({ configuration, initial, include = true }: { include?: boolean; configuration: SelectorConfiguration; initial: { x: number; y: number } }) {
  const root = useRef<HTMLDivElement>(null), last = useRef(initial);
  useLayoutEffect(() => {
    let frame = 0;
    const offset = { x: 0, y: 0 };
    const paint = () => {
      frame = 0;
      if (root.current) root.current.style.transform = `translate3d(${last.current.x - offset.x}px,${last.current.y - offset.y}px,0)`;
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
      last.current = { x: event.clientX, y: event.clientY };
      if (!frame) frame = requestAnimationFrame(paint);
    };
    window.addEventListener("pointermove", move, true);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); window.removeEventListener("pointermove", move, true); };
  }, []);
  return <div ref={root} data-visual-selector className="visual-selector-cursor" aria-hidden="true">
    <SelectorSymbol configuration={configuration} include={include} precision />
  </div>;
}
