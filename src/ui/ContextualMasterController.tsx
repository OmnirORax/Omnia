import { useEffect, useLayoutEffect, useRef, type ReactNode, type WheelEvent } from "react";
import { createPortal } from "react-dom";
import { useActiveLayer } from "./ActiveContext";
import { uiPointerHeld } from "./pointerOwnership";

/** Transient contextual projection: reuse the caller's controls, never open or
 * persist unrelated controller categories just to invoke a common operation. */
export function ContextualMasterController({ title, hint, position, onClose, onDismiss, onWheel, children, radial = false }: {
  title: string; hint?: string; position: { x: number; y: number } | null;
  onClose: () => void; onDismiss?:()=>void; onWheel?: (event: WheelEvent) => void; children: ReactNode; radial?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const openingPress = useRef(false);
  useLayoutEffect(() => { openingPress.current = !!position && uiPointerHeld(); }, [!!position]);
  useActiveLayer(!!position, root, onClose,undefined,onDismiss??(radial?onClose:undefined));
  useLayoutEffect(() => {
    const node = root.current; if (!node || !position) return;
    node.setAttribute("popover", "manual"); node.showPopover();
    return () => { node.hidePopover(); node.removeAttribute("popover"); };
  }, [!!position]);
  useLayoutEffect(() => {
    const node = root.current; if (!node || !position) return;
    const fit = () => {
      const bounds = node.getBoundingClientRect();
      node.style.left = `${radial?position.x-bounds.width/2:Math.max(8,Math.min(position.x,innerWidth-bounds.width-8))}px`;
      node.style.top = `${radial?position.y-bounds.height/2:Math.max(8,Math.min(position.y,innerHeight-bounds.height-8))}px`;
    };
    const observer = new ResizeObserver(fit); observer.observe(node); fit();
    window.addEventListener("resize", fit);
    return () => { observer.disconnect(); window.removeEventListener("resize", fit); };
  }, [position?.x, position?.y, radial]);
  useEffect(() => {
    const node = root.current; if (!node) return;
    const preventScroll = (event: globalThis.WheelEvent) => {
      if (onWheel || event.target instanceof Element && event.target.closest("[data-scroll-configuration]")) event.preventDefault();
    };
    node.addEventListener("wheel", preventScroll, { passive: false });
    return () => node.removeEventListener("wheel", preventScroll);
  }, [!!position, !!onWheel]);
  return position && createPortal(<div ref={root} className={`contextual-master-controller ui-frame-search-popup${radial?' contextual-master-controller-radial':''}`} data-context-controller data-ui-search data-ui-name-ignore
    onPointerDownCapture={() => { openingPress.current = false; }}
    onContextMenuCapture={event => {
      // A popup opened on pointerdown must not interpret that same press
      // again when the browser dispatches contextmenu at its new contents.
      if (openingPress.current) { event.preventDefault(); event.stopPropagation(); }
    }}
    onContextMenu={event=>{event.preventDefault();event.stopPropagation();}}
    role="dialog" aria-label={`Master controller — ${title}`} onWheel={onWheel}
    style={{left:radial?position.x:Math.max(8,Math.min(position.x,innerWidth-252)),top:radial?position.y:Math.max(8,Math.min(position.y,innerHeight-240))}}>
    {!radial&&<><strong title={`Master controller · ${title}`}>{title}</strong>{hint && <p>{hint}</p>}</>}{children}
  </div>, document.body);
}
