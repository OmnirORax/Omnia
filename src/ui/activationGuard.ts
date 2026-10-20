import { useEffect, useRef } from "react";
const UI = "[data-ui-function],[data-ui-drag],[data-ui-resident-root],.toolbar,.ui-bubble-drag";
/** Block the trailing click from a completed/cancelled drag, but clear the guard on
 * the next independent press so a deliberate click after dropping still works. */
export function useDragActivationGuard() {
  const blocked = useRef(0),
    press = useRef<{ x: number; y: number; moved: boolean } | null>(null),
    native = useRef(false);
  const suppress = useRef(() => {
    blocked.current = performance.now() + 1000;
  }).current;
  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      blocked.current = 0;
      press.current =
        e.target instanceof Element && e.target.closest(UI)
          ? { x: e.clientX, y: e.clientY, moved: false }
          : null;
    };
    const move = (e: PointerEvent) => {
      if (
        press.current &&
        Math.hypot(e.clientX - press.current.x, e.clientY - press.current.y) > 5
      ) {
        press.current.moved = true;
        blocked.current = Infinity;
      }
    };
    const up = (e: PointerEvent) => {
      if (e.button !== 0 && e.type !== "pointercancel") return;
      if (press.current?.moved && !native.current) suppress();
      press.current = null;
    };
    const start = (e: DragEvent) => {
      if (e.target instanceof Element && e.target.closest(UI)) {
        // Internal pointer dragging prevents the browser's native drag later in
        // this dispatch. A cancelled native start must not leave this guard active.
        queueMicrotask(() => {
          if (e.defaultPrevented) return;
          native.current = true;
          blocked.current = Infinity;
        });
      }
    };
    const end = () => {
      native.current = false;
      if (blocked.current) suppress();
      press.current = null;
    };
    const click = (e: MouseEvent) => {
      if (
        performance.now() < blocked.current &&
        e.target instanceof Element &&
        e.target.closest(UI)
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
        blocked.current = 0;
      }
    };
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", up, true);
    window.addEventListener("dragstart", start, true);
    window.addEventListener("dragend", end, true);
    window.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", up, true);
      window.removeEventListener("dragstart", start, true);
      window.removeEventListener("dragend", end, true);
      window.removeEventListener("click", click, true);
    };
  }, [suppress]);
  return suppress;
}
