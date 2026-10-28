import { useEffect, useLayoutEffect, useRef } from "react";
import { containers } from "./layout";
import { useUI } from "./context";
import { dragSurface } from "./liveDrag";
import type { ResizeRect } from "./resizeGeometry";

/** Project the existing live payload into a viewport, retaining its ownership,
 * handlers and original geometry. Removing the projection restores that geometry. */
function project(element: HTMLElement) {
  const rect = element.getBoundingClientRect(), computed = getComputedStyle(element);
  // React/Rnd own inline geometry and className. A persistent data marker plus
  // CSS variables keep this projection independent of their ordinary rerenders.
  const styles={"--ui-viewport-left":`${rect.x}px`,"--ui-viewport-top":`${rect.y}px`,
    "--ui-viewport-width":`${rect.width}px`,"--ui-viewport-height":`${rect.height}px`,
    "--ui-viewport-background":computed.backgroundColor,"--ui-viewport-padding":computed.padding,"--ui-viewport-border":computed.border};
  const saved = Object.keys(styles).map(key => [key, element.style.getPropertyValue(key), element.style.getPropertyPriority(key)]), popover = element.getAttribute("popover");
  const spacer = document.createElement("div"); spacer.dataset.uiNativeTag = "transparent"; spacer.inert = true;
  if (!["fixed", "absolute"].includes(computed.position)) {
    spacer.style.cssText = `width:${rect.width}px;height:${rect.height}px;visibility:hidden;pointer-events:none`;
    element.before(spacer);
  }
  const original = element.getAttribute("data-ui-viewport-original");
  for(const [key,value] of Object.entries(styles))element.style.setProperty(key,value);
  element.dataset.uiViewportOriginal = JSON.stringify({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
  element.classList.add("ui-frame-viewport");
  element.setAttribute("popover", "manual"); element.showPopover();
  return {
    set(next: ResizeRect) {
      const values={"--ui-viewport-left":`${next.x}px`,"--ui-viewport-top":`${next.y}px`,
        "--ui-viewport-width":`${next.width}px`,"--ui-viewport-height":`${next.height}px`};
      for(const [key,value] of Object.entries(values))if(element.style.getPropertyValue(key)!==value)element.style.setProperty(key,value);
    },
    restore() {
      if (element.isConnected && element.matches(":popover-open")) element.hidePopover(); if (popover === null) element.removeAttribute("popover"); else element.setAttribute("popover", popover);
      element.classList.remove("ui-frame-viewport"); spacer.remove();
      if (original === null) element.removeAttribute("data-ui-viewport-original"); else element.setAttribute("data-ui-viewport-original", original);
      for (const [key, value, priority] of saved) { if (value) element.style.setProperty(key, value, priority); else element.style.removeProperty(key); }
    },
  };
}
export function FrameViewportSystem() {
  const ui = useUI(), active = useRef(new Map<string, { element: HTMLElement; projection: ReturnType<typeof project>; rect: ResizeRect & { full?: boolean } }>());
  const seenLayout = useRef<unknown>(null), cached = useRef<ReturnType<typeof containers>>([]), pending = useRef(new Set<string>());
  useLayoutEffect(() => {
    const changed = seenLayout.current !== ui.layout;
    if (!changed && !pending.current.size && ![...active.current.values()].some(entry => !entry.element.isConnected)) return;
    if (changed) {
      seenLayout.current = ui.layout;
      cached.current = containers(ui.layout).filter(([, value]) => value.viewport && !value.closed && !value.collapsed);
      pending.current.clear();
    }
    const desired = new Map(cached.current);
    for (const [key, entry] of active.current) if (!desired.has(key) || !entry.element.isConnected) { entry.projection.restore(); active.current.delete(key); }
    for (const [key, state] of desired) {
      let entry = active.current.get(key);
      if (!entry) {
        const root = document.querySelector<HTMLElement>(`[data-ui-resident-root="${CSS.escape(key)}"]`); if (!root) { pending.current.add(key); continue; }
        pending.current.delete(key);
        const element = dragSurface(root); entry = { element, projection: project(element), rect: state.viewport! }; active.current.set(key, entry);
      }
      const rect = entry.rect = state.viewport!;
      entry.projection.set(rect.full ? { x: 8, y: 8, width: innerWidth - 16, height: innerHeight - 16 } : { x: Math.min(rect.x, innerWidth - 40), y: Math.min(rect.y, innerHeight - 40), width: Math.min(rect.width, innerWidth - 16), height: Math.min(rect.height, innerHeight - 16) });
    }
  });
  useEffect(() => {
    const resize = () => { for (const { projection, rect } of active.current.values()) projection.set(rect.full
      ? { x: 8, y: 8, width: innerWidth - 16, height: innerHeight - 16 }
      : { ...rect, x: Math.min(rect.x, innerWidth - 40), y: Math.min(rect.y, innerHeight - 40), width: Math.min(rect.width, innerWidth - 16), height: Math.min(rect.height, innerHeight - 16) }); };
    window.addEventListener("resize", resize); return () => window.removeEventListener("resize", resize);
  }, []);
  useLayoutEffect(() => () => { for (const entry of active.current.values()) entry.projection.restore(); active.current.clear(); }, []);
  return null;
}
