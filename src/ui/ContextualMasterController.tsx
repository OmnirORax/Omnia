import {contextNavigationAction,confirmContextStage} from './contextNavigation';
import {SelectionOpenContext} from './SelectionOpenContext';
import {cursorSample,popupInvocation} from './cursorPosition';
import {placePopup,popupBelowButton,type PopupRect} from './popupPlacement';
import { createContext, useContext, useMemo, useEffect, useLayoutEffect, useRef, useCallback, useState, type ReactNode, type WheelEvent, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useActiveLayer } from "./ActiveContext";
import { ContextStage, ContextNavigationRegistry, type ContextNavigation, usePopupAnchor } from './ContextStage';
import { claimUIPress, ownsPointerSurface } from "./pointerOwnership";

const PopupParents=createContext<readonly RefObject<HTMLDivElement|null>[]>([]);

/** Transient contextual projection: reuse the caller's controls, never open or
 * persist unrelated controller categories just to invoke a common operation. */
export function ContextualMasterController({ title, hint, position, onClose, onDismiss, onAdvance, onConfirm, onWheel, children, stage, radial = false, anchored = false, dismissOutside=false }: {
  title: string; hint?: string; position: { x: number; y: number } | null;
  onClose: () => void; onAdvance?:()=>void;onConfirm?:()=>void; onDismiss?:()=>void; onWheel?: (event: WheelEvent) => void; children: ReactNode;stage?:string|number; radial?: boolean; anchored?:boolean; dismissOutside?:boolean;
}) {
  const root = useRef<HTMLDivElement>(null),parents=useContext(PopupParents),selectionOwner=useContext(SelectionOpenContext);
  const ancestry=useMemo(()=>[root,...parents],[parents]);
  const invocation=useRef<Element|null>(null),buttonAnchor=useRef<PopupRect|null>(null);
  useLayoutEffect(()=>{if(!position){invocation.current=null;buttonAnchor.current=null;return;}const captured=popupInvocation(),target=cursorSample().target;buttonAnchor.current=captured?.button??null;if(target instanceof Node&&root.current?.contains(target))return;invocation.current=captured?.boundary??(target instanceof Element?target.closest('[data-ui-popup-boundary]'):null);},[!!position,position?.x,position?.y,stage]);
  const navigation=useRef(new Map<symbol,ContextNavigation>());const [,refreshNavigation]=useState(0);
  const registerNavigation=useCallback((value:ContextNavigation)=>{const key=Symbol();navigation.current.set(key,value);refreshNavigation(n=>n+1);return()=>{navigation.current.delete(key);refreshNavigation(n=>n+1);};},[]);
  const navigate=(action:'cancel'|'back'|'advance'|'confirm')=>contextNavigationAction(navigation.current.values(),action);

  const popup=usePopupAnchor(position,stage??title);
  const anchor=anchored?position:popup.anchor,nextStage=anchored?null:popup.nextStage;
  const owns=(target:EventTarget|null)=>ownsPointerSurface(root.current,target instanceof Element?target:null,'[data-context-controller]');
  const offset=useRef({x:0,y:0}),drag=useRef<{id:number;x:number;y:number;before:{x:number;y:number};handle:HTMLElement;moved:boolean}|null>(null),suppressClick=useRef(false);
  const cancelDrag=()=>{const active=drag.current;if(!active)return;offset.current=active.before;if(root.current)root.current.style.translate=`${offset.current.x}px ${offset.current.y}px`;drag.current=null;};
  const closeLayer=()=>{if(drag.current)cancelDrag();else (navigate('back')??onClose)();};
  useLayoutEffect(()=>{offset.current={x:0,y:0};drag.current=null;if(root.current)root.current.style.translate='';},[anchor?.x,anchor?.y,stage,!!position]);
  useActiveLayer(!!position, root, closeLayer,undefined,onDismiss??(radial?onClose:undefined),{ancestors:parents,dismissOutside,cancel:navigate('cancel'),advance:navigate('advance')??onAdvance,confirm:()=>confirmContextStage(navigate('confirm'),onConfirm??onAdvance??onDismiss??onClose)});
  useLayoutEffect(() => {
    const node = root.current; if (!node || !position) return;
    node.setAttribute("popover", "manual"); node.showPopover();
    return () => { node.hidePopover(); node.removeAttribute("popover"); };
  }, [!!position]);
  useLayoutEffect(() => {
    const node = root.current; if (!node || !position) return;
    const fit = () => {
      const bounds = node.getBoundingClientRect();
      const requested={x:radial?anchor!.x:anchor!.x+bounds.width/2,y:radial?anchor!.y:anchor!.y+bounds.height/2};
      const owners=anchored?[]:[invocation.current,...parents.map(p=>p.current)].filter((owner):owner is Element=>!!owner&&owner.isConnected&&!node.contains(owner));
      const parentBounds=owners.map(owner=>{const b=owner.getBoundingClientRect();return {x:b.left,y:b.top,width:b.width,height:b.height};}).filter(b=>b.width>0&&b.height>0);
      const center=!anchored&&buttonAnchor.current?popupBelowButton(buttonAnchor.current,bounds,parentBounds):placePopup(parentBounds,bounds,requested);
      node.style.left = `${center.x-bounds.width/2}px`;
      node.style.top = `${center.y-bounds.height/2}px`;
    };
    const observer = new ResizeObserver(fit); observer.observe(node);if(!anchored){for(const p of parents)if(p.current)observer.observe(p.current);if(invocation.current)observer.observe(invocation.current);}fit();
    window.addEventListener("resize", fit);
    return () => { observer.disconnect(); window.removeEventListener("resize", fit); };
  }, [anchor?.x,anchor?.y,radial,anchored,parents,stage]);
  useEffect(() => {
    const node = root.current; if (!node) return;
    const preventScroll = (event: globalThis.WheelEvent) => {
      if (onWheel || event.target instanceof Element && event.target.closest("[data-scroll-configuration]")) event.preventDefault();
    };
    node.addEventListener("wheel", preventScroll, { passive: false });
    return () => node.removeEventListener("wheel", preventScroll);
  }, [!!position, !!onWheel]);
  return position && createPortal(<div ref={root} className={`contextual-master-controller ${radial?'contextual-master-controller-radial':'ui-frame-search-popup'}`} data-context-controller data-selection-context-owner={selectionOwner} data-ui-gesture-owner="content" data-ui-search data-ui-name-ignore
    onPointerDownCapture={event => {
      if(!owns(event.target))return;
      suppressClick.current=false;
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
    onPointerUpCapture={event=>{if(!owns(event.target))return;const active=drag.current;if(!active||active.id!==event.pointerId)return;
      event.stopPropagation();drag.current=null;
      if(!active.moved&&active.handle.tagName==='BUTTON')active.handle.click();
      suppressClick.current=true;
      if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
    }}
    onPointerCancel={cancelDrag}
    onLostPointerCapture={()=>{if(drag.current)cancelDrag();}}
    onClickCapture={event=>{if(!owns(event.target))return;if(suppressClick.current){suppressClick.current=false;event.preventDefault();event.stopPropagation();}}}
    onContextMenu={event=>{event.preventDefault();event.stopPropagation();}}
    role="dialog" aria-label={`Master controller — ${title}`} onWheel={onWheel}
    style={{left:anchor!.x,top:anchor!.y}}>
    {!radial&&<><strong title={`Master controller · ${title}`}>{title}</strong>{hint && <p>{hint}</p>}</>}<ContextStage.Provider value={nextStage}><ContextNavigationRegistry.Provider value={registerNavigation}><PopupParents.Provider value={ancestry}>{children}</PopupParents.Provider></ContextNavigationRegistry.Provider></ContextStage.Provider>
  </div>, document.body);
}
