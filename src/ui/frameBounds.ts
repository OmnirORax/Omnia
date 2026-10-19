import { useLayoutEffect, useRef, useState } from "react";
export type ContentBounds = { x: number; y: number; width: number; height: number };
/** Measure occupied content, never the saved wrapping width of a contour frame. */
export function residentBounds(root: HTMLElement): ContentBounds {
  if (!root.classList.contains("ui-frame-root")) return root.getBoundingClientRect();
  const parts = [
    ...root.querySelectorAll<HTMLElement>(".ui-frame-handle,.ui-resident-slot,.empty-ui-slot"),
  ].filter(
    (el) =>
      el.closest("[data-ui-resident-root]") === root &&
      el.getClientRects().length &&
      !el.closest("[data-ui-ghost],.ui-drag-source"),
  );
  const rects = parts.map((el) => el.getBoundingClientRect());
  if (!rects.length) return root.getBoundingClientRect();
  const x = Math.min(...rects.map((r) => r.x)) - 8,
    y = Math.min(...rects.map((r) => r.y)) - 8;
  return {
    x,
    y,
    width: Math.max(...rects.map((r) => r.right)) + 8 - x,
    height: Math.max(...rects.map((r) => r.bottom)) + 8 - y,
  };
}
export function useFrameBounds() {
  const ref = useRef<HTMLDivElement>(null),
    [bounds, setBounds] = useState<ContentBounds>({ x: -8, y: -8, width: 160, height: 58 });
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const box = residentBounds(root),
          origin = root.getBoundingClientRect();
        const next = {
          x: box.x - origin.x,
          y: box.y - origin.y,
          width: box.width,
          height: box.height,
        };
        setBounds((old) =>
          Object.keys(next).every(
            (k) => Math.abs(old[k as keyof ContentBounds] - next[k as keyof ContentBounds]) < 0.5,
          )
            ? old
            : next,
        );
      });
    };
    const resize = new ResizeObserver(measure);
    const observe = () => {
      resize.disconnect();
      resize.observe(root);
      root
        .querySelectorAll(".ui-frame-handle,.ui-resident-slot,.empty-ui-slot")
        .forEach((el) => resize.observe(el));
      measure();
    };
    const mutations = new MutationObserver(observe);
    mutations.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["style", "class", "hidden"],
    });
    observe();
    return () => {
      resize.disconnect();
      mutations.disconnect();
      cancelAnimationFrame(raf);
    };
  });
  return { ref, bounds };
}
