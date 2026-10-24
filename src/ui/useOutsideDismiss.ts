import { useLayoutEffect, useRef } from "react";
import { useActiveLayer } from "./ActiveContext";

const listeners = new Set<(event: PointerEvent) => void>();
const outsidePress = (event: PointerEvent) => {
  for (const listener of [...listeners]) listener(event);
};

/** Share an early capture listener so UI drag/selection handlers cannot swallow
 * dismissal. Never consume the press: the clicked control still works normally. */
export function useOutsideDismiss(
  open: boolean,
  roots: () => (Element | null)[],
  dismiss: () => void,
) {
  const layer = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => { layer.current = roots().findLast((root): root is HTMLElement => root instanceof HTMLElement && !root.matches("button")) ?? null; });
  useActiveLayer(open, layer, dismiss);
  const current = useRef({ open, roots, dismiss });
  useLayoutEffect(() => { current.current = { open, roots, dismiss }; });
  useLayoutEffect(() => {
    const listener = (event: PointerEvent) => {
      const { open, roots, dismiss } = current.current;
      if (!open || event.target instanceof Element && event.target.closest("[data-context-controller]")) return;
      const path = event.composedPath();
      if (!roots().some(root => root && (path.includes(root) || root.contains(event.target as Node))))
        dismiss();
    };
    if (!listeners.size) window.addEventListener("pointerdown", outsidePress, true);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
      if (!listeners.size) window.removeEventListener("pointerdown", outsidePress, true);
    };
  }, []);
}
