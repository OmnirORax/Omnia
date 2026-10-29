import { useEffect, useLayoutEffect, useRef, type ReactNode, type WheelEvent } from "react";
import { createPortal } from "react-dom";
import { useActiveLayer } from "./ActiveContext";
import { ContextStage, usePopupAnchor } from './ContextStage';
import { claimUIPress, physicalPointerHeld } from "./pointerOwnership";

/** Transient contextual projection: reuse the caller's controls, never open or
 * persist unrelated controller categories just to invoke a common operation. */
export function ContextualMasterController({ title, hint, position, onClose, onDismiss, onWheel, children, stage, radial = false, anchored = false }: {
  title: string; hint?: string; position: { x: number; y: number } | null;
  onClose: () => void; onDismiss?:()=>void; onWheel?: (event: WheelEvent) => void; children: ReactNode;stage?:string|number; radial?: boolean; anchored?:boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const popup=usePopupAnchor(position,stage??title);
  const anchor=anchored?position:popup.anchor,nextStage=anchored?null:popup.nextStage;
  const openingPress = useRef(false);
  const offset=useRef({x:0,y:0}),drag=useRef<{id:number;x:number;y:number;before:{x:number;y:number};handle:HTMLElement;moved:boolean}|null>(null),suppressClick=useRef(false);
  const cancelDrag=()=>{const active=drag.current;if(!active)return;offset.current=active.before;if(root.current)root.current.style.translate=`${offset.current.x}px ${offset.current.y}px`;drag.current=null;};
  const closeLayer=()=>{if(drag.current)cancelDrag();else onClose();};
  useLayoutEffect(()=>{offset.current={x:0,y:0};drag.current=null;if(root.current)root.current.style.translate='';},[anchor?.x,anchor?.y,stage,!!position]);
  useLayoutEffect(() => { openingPress.current = !!position && physicalPointerHeld(); }, [!!position,anchor?.x,anchor?.y,stage]);
  useActiveLayer(!!position, root, closeLayer,undefined,onDismiss??(radial?onClose:undefined));
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
  return position && createPortal(<div ref={root} className={`contextual-master-controller ${radial?'contextual-master-controller-radial':'ui-frame-search-popup'}`} data-context-controller data-ui-gesture-owner="content" data-ui-search data-ui-name-ignore
    onPointerDownCapture={event => {
      openingPress.current = false;suppressClick.current=false;
      if(!radial||event.button!==0||!(event.target instanceof Element)||!event.target.closest('[data-dial-drag]'))return;
      event.preventDefault();event.stopPropagation();claimUIPress(event.pointerId,event.pointerType,event.buttons);
      drag.current={id:event.pointerId,x:event.clientX,y:event.clientY,before:{...offset.current},handle:event.target.closest('[data-dial-drag]') as HTMLElement,moved:false};
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMoveCapture={event=>{const active=drag.current;if(!active||active.id!==event.pointerId)return;
      event.stopPropagation();const dx=event.clientX-active.x,dy=event.clientY-active.y;
      if(!active.moved&&Math.hypot(dx,dy)<3)return;active.moved=true;
      offset.current={x:active.before.x+dx,y:active.before.y+dy};event.currentTarget.style.translate=`${offset.current.x}px ${offset.current.y}px`;
    }}
    onPointerUpCapture={event=>{if(openingPress.current){event.preventDefault();event.stopPropagation();return;}const active=drag.current;if(!active||active.id!==event.pointerId)return;
      event.stopPropagation();drag.current=null;
      if(!active.moved&&active.handle.tagName==='BUTTON')active.handle.click();
      suppressClick.current=true;
      if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
    }}
    onPointerCancel={cancelDrag}
    onLostPointerCapture={()=>{if(drag.current)cancelDrag();}}
    onClickCapture={event=>{if(openingPress.current&&event.detail>0){openingPress.current=false;event.preventDefault();event.stopPropagation();return;}if(suppressClick.current){suppressClick.current=false;event.preventDefault();event.stopPropagation();}}}
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
