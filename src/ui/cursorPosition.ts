import { useLayoutEffect } from "react";

let cursor: { x: number; y: number } | undefined;
let target:EventTarget|null=null;
const contextObservers=new Set<(point:{x:number;y:number;target:EventTarget|null})=>void>();
const observers=new Set<(point:{x:number;y:number;target:EventTarget|null})=>void>();
export const cursorSample=()=>({...cursorPosition(),target});
export function observeCursor(listener:(point:{x:number;y:number;target:EventTarget|null})=>void){observers.add(listener);listener(cursorSample());return()=>{observers.delete(listener);};}
export function observeCursorContext(listener:(point:{x:number;y:number;target:EventTarget|null})=>void){contextObservers.add(listener);listener(cursorSample());return()=>{contextObservers.delete(listener);};}
const notifyContext=()=>{const point=cursorSample();contextObservers.forEach(listener=>listener(point));};
const notify=()=>{const point=cursorSample();observers.forEach(listener=>listener(point));};
export const cursorPosition = () => cursor ?? { x: innerWidth / 2, y: innerHeight / 3 };

/** Track without React state so pointer motion never rerenders the workspace. */
export function useCursorTracking() {
  useLayoutEffect(() => {
    const track = (event: MouseEvent) => { cursor = { x: event.clientX, y: event.clientY };target=event.target;notify();if(event.type!=='pointermove')notifyContext(); };
    const leave=(event:PointerEvent)=>{if(!event.relatedTarget){target=null;notifyContext();}};
    const blur=()=>{target=null;notifyContext();};
    window.addEventListener("pointerover",track,true);window.addEventListener("pointerout",leave,true);window.addEventListener("blur",blur);
    window.addEventListener("pointermove", track, true);
    window.addEventListener("pointerdown", track, true);
    window.addEventListener("pointerup",track,true);
    window.addEventListener("contextmenu", track, true);
    return () => {
      window.removeEventListener("pointerover",track,true);window.removeEventListener("pointerout",leave,true);window.removeEventListener("blur",blur);
      window.removeEventListener("pointermove", track, true);
      window.removeEventListener("pointerdown", track, true);
      window.removeEventListener("pointerup",track,true);
      window.removeEventListener("contextmenu", track, true);
    };
  }, []);
}
