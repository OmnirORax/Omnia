import { useEffect, useLayoutEffect, useRef, type ReactNode, type WheelEvent } from "react";
import { createPortal } from "react-dom";
import { useActiveLayer } from "./ActiveContext";
import { ContextStage, usePopupAnchor } from './ContextStage';
import { uiPointerHeld } from "./pointerOwnership";

/** Transient contextual projection: reuse the caller's controls, never open or
 * persist unrelated controller categories just to invoke a common operation. */
export function ContextualMasterController({ title, hint, position, onClose, onDismiss, onWheel, children, stage, radial = false }: {
  title: string; hint?: string; position: { x: number; y: number } | null;
  onClose: () => void; onDismiss?:()=>void; onWheel?: (event: WheelEvent) => void; children: ReactNode;stage?:string|number; radial?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const {anchor,nextStage}=usePopupAnchor(position,stage??title);
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
      node.style.left = `${radial?anchor!.x-bounds.width/2:anchor!.x}px`;
      node.style.top = `${radial?anchor!.y-bounds.height/2:anchor!.y}px`;
    };
    const observer = new ResizeObserver(fit); observer.observe(node); fit();
    window.addEventListener("resize", fit);
    return () => { observer.disconnect(); window.removeEventListener("resize", fit); };
  }, [anchor?.x,anchor?.y,radial]);
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
    style={{left:anchor!.x,top:anchor!.y}}>
    {!radial&&<><strong title={`Master controller · ${title}`}>{title}</strong>{hint && <p>{hint}</p>}</>}<ContextStage.Provider value={nextStage}>{children}</ContextStage.Provider>
  </div>, document.body);
}
