import { useLayoutEffect } from "react";

let cursor: { x: number; y: number } | undefined;
export const cursorPosition = () => cursor ?? { x: innerWidth / 2, y: innerHeight / 3 };

/** Track without React state so pointer motion never rerenders the workspace. */
export function useCursorTracking() {
  useLayoutEffect(() => {
    const track = (event: MouseEvent) => { cursor = { x: event.clientX, y: event.clientY }; };
    window.addEventListener("pointermove", track, true);
    window.addEventListener("pointerdown", track, true);
    window.addEventListener("contextmenu", track, true);
    return () => {
      window.removeEventListener("pointermove", track, true);
      window.removeEventListener("pointerdown", track, true);
      window.removeEventListener("contextmenu", track, true);
    };
  }, []);
}
