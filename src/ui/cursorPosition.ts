import type {PopupRect} from './popupPlacement';
import { useLayoutEffect } from "react";

let cursor: { x: number; y: number } | undefined;
let target:EventTarget|null=null;
let invocation:{button:PopupRect|null;boundary:Element|null}|null=null;
export const popupInvocation=()=>invocation;
const observers=new Set<(point:{x:number;y:number;target:EventTarget|null})=>void>();
export const cursorSample=()=>({...cursorPosition(),target});
export function observeCursor(listener:(point:{x:number;y:number;target:EventTarget|null})=>void){observers.add(listener);listener(cursorSample());return()=>{observers.delete(listener);};}
const notify=()=>{const point=cursorSample();observers.forEach(listener=>listener(point));};
export const cursorPosition = () => cursor ?? { x: innerWidth / 2, y: innerHeight / 3 };

/** Track without React state so pointer motion never rerenders the workspace. */
export function useCursorTracking() {
  useLayoutEffect(() => {
    const track = (event: MouseEvent) => { if(event.type!=='click'||event.detail>0)cursor = { x: event.clientX, y: event.clientY };target=event.target;
      if(event.type==='pointerdown'||event.type==='contextmenu'||event.type==='click'){
        const element=target instanceof Element?target:null,button=element?.closest('button,[role="button"]'),box=button?.getBoundingClientRect();
        invocation={button:box?{x:box.left,y:box.top,width:box.width,height:box.height}:null,boundary:element?.closest('[data-ui-popup-boundary]')??null};
      }else if(event.type==='pointermove')invocation=null;
      notify(); };
    const leave=(event:PointerEvent)=>{if(!event.relatedTarget){target=null;invocation=null;notify();}};
    const blur=()=>{target=null;invocation=null;notify();};
    window.addEventListener("pointerover",track,true);window.addEventListener("pointerout",leave,true);window.addEventListener("blur",blur);
    window.addEventListener("pointermove", track, true);
    window.addEventListener("pointerdown", track, true);
    window.addEventListener("contextmenu", track, true);
    window.addEventListener("click", track, true);
    return () => {
      window.removeEventListener("pointerover",track,true);window.removeEventListener("pointerout",leave,true);window.removeEventListener("blur",blur);
      window.removeEventListener("pointermove", track, true);
      window.removeEventListener("pointerdown", track, true);
      window.removeEventListener("contextmenu", track, true);
      window.removeEventListener("click", track, true);
    };
  }, []);
}
