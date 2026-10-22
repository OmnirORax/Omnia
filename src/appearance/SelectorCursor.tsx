import { useEffect, useRef } from "react";
import { SelectorSymbol, type SelectorConfiguration } from "./SelectorSymbol";

/** Pointer motion updates only this element; it does not render the application tree. */
export function SelectorCursor({ configuration, initial }: { configuration: SelectorConfiguration; initial: { x: number; y: number } }) {
  const root = useRef<HTMLDivElement>(null), last = useRef(initial);
  useEffect(() => {
    let frame = 0;
    const paint = () => {
      frame = 0;
      if (root.current) root.current.style.transform = `translate3d(${last.current.x - 17.5}px,${last.current.y - 17}px,0)`;
    };
    paint();
    const move = (event: PointerEvent) => {
      last.current = { x: event.clientX, y: event.clientY };
      if (!frame) frame = requestAnimationFrame(paint);
    };
    window.addEventListener("pointermove", move, true);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("pointermove", move, true); };
  }, []);
  return <div ref={root} data-visual-selector className="visual-selector-cursor" aria-hidden="true">
    <SelectorSymbol configuration={configuration} />
  </div>;
}
