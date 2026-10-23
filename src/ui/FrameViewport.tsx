import { useEffect, useLayoutEffect, useRef } from "react";
import { containers } from "./layout";
import { useUI } from "./context";
import { dragSurface } from "./liveDrag";
import type { ResizeRect } from "./resizeGeometry";

/** Project the existing live payload into a viewport, retaining its ownership,
 * handlers and original geometry. Removing the projection restores that geometry. */
function project(element: HTMLElement) {
  const rect = element.getBoundingClientRect(), computed = getComputedStyle(element);
  const keys = ["position", "inset", "left", "top", "right", "bottom", "width", "height", "min-width", "min-height", "max-width", "max-height", "margin", "transform", "translate", "rotate", "scale", "z-index", "box-sizing", "--ui-viewport-background", "--ui-viewport-padding", "--ui-viewport-border"];
  const saved = keys.map(key => [key, element.style.getPropertyValue(key), element.style.getPropertyPriority(key)]), popover = element.getAttribute("popover");
  const spacer = document.createElement("div"); spacer.dataset.uiNativeTag = "transparent"; spacer.inert = true;
  if (!["fixed", "absolute"].includes(computed.position)) {
    spacer.style.cssText = `width:${rect.width}px;height:${rect.height}px;visibility:hidden;pointer-events:none`;
    element.before(spacer);
  }
  const original = element.getAttribute("data-ui-viewport-original");
  element.dataset.uiViewportOriginal = JSON.stringify({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
  element.style.setProperty("--ui-viewport-background", computed.backgroundColor);
  element.style.setProperty("--ui-viewport-padding", computed.padding);
  element.style.setProperty("--ui-viewport-border", computed.border);
  element.classList.add("ui-frame-viewport");
  element.setAttribute("popover", "manual"); element.showPopover();
  return {
    set(next: ResizeRect) {
      const styles = { position: "fixed", inset: "auto", left: `${next.x}px`, top: `${next.y}px`, right: "auto", bottom: "auto",
        width: `${next.width}px`, height: `${next.height}px`, "min-width": "0", "min-height": "0", "max-width": "none", "max-height": "none",
        margin: "0", transform: "none", translate: "none", rotate: "none", scale: "none", "z-index": "30000", "box-sizing": "border-box" };
      for (const [key, value] of Object.entries(styles))
        if (element.style.getPropertyValue(key) !== value || element.style.getPropertyPriority(key) !== "important") element.style.setProperty(key, value, "important");
    },
    restore() {
      element.hidePopover(); if (popover === null) element.removeAttribute("popover"); else element.setAttribute("popover", popover);
      element.classList.remove("ui-frame-viewport"); spacer.remove();
      if (original === null) element.removeAttribute("data-ui-viewport-original"); else element.setAttribute("data-ui-viewport-original", original);
      for (const [key, value, priority] of saved) { if (value) element.style.setProperty(key, value, priority); else element.style.removeProperty(key); }
    },
  };
}
export function FrameViewportSystem() {
  const ui = useUI(), active = useRef(new Map<string, { element: HTMLElement; projection: ReturnType<typeof project>; rect: ResizeRect & { full?: boolean } }>());
  useLayoutEffect(() => {
    const desired = new Map(containers(ui.layout).filter(([, value]) => value.viewport && !value.closed && !value.collapsed));
    for (const [key, entry] of active.current) if (!desired.has(key) || !entry.element.isConnected) { entry.projection.restore(); active.current.delete(key); }
    for (const [key, state] of desired) {
      let entry = active.current.get(key);
      if (!entry) {
        const root = document.querySelector<HTMLElement>(`[data-ui-resident-root="${CSS.escape(key)}"]`); if (!root) continue;
        const element = dragSurface(root); entry = { element, projection: project(element), rect: state.viewport! }; active.current.set(key, entry);
      }
      const rect = entry.rect = state.viewport!;
      entry.projection.set(rect.full ? { x: 8, y: 8, width: innerWidth - 16, height: innerHeight - 16 } : { x: Math.min(rect.x, innerWidth - 40), y: Math.min(rect.y, innerHeight - 40), width: Math.min(rect.width, innerWidth - 16), height: Math.min(rect.height, innerHeight - 16) });
    }
  }, [ui.layout]);
  useEffect(() => {
    const resize = () => { for (const { projection, rect } of active.current.values()) projection.set(rect.full
      ? { x: 8, y: 8, width: innerWidth - 16, height: innerHeight - 16 }
      : { ...rect, x: Math.min(rect.x, innerWidth - 40), y: Math.min(rect.y, innerHeight - 40), width: Math.min(rect.width, innerWidth - 16), height: Math.min(rect.height, innerHeight - 16) }); };
    window.addEventListener("resize", resize); return () => window.removeEventListener("resize", resize);
  }, []);
  useLayoutEffect(() => () => { for (const entry of active.current.values()) entry.projection.restore(); active.current.clear(); }, []);
  return null;
}
