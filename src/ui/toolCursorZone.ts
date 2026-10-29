import { useLayoutEffect, type RefObject } from 'react';
import { inCursorArea, type CursorArea } from './toolCursorModel';
export type CursorPoint={x:number;y:number;target:EventTarget|null};
type Zone={key:string;allowPopup?:boolean;contains?:(point:CursorPoint)=>boolean};
const zones=new WeakMap<Element,Zone>(),listeners=new Set<()=>void>();
const notify=()=>listeners.forEach(listener=>listener());
export function observeToolZones(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
/** Canvas/3D adapters publish their existing hit-test result; no extra raycast. */
export function setToolCursorZone(element:Element,key:string|undefined,allowPopup=false){
  if(zones.get(element)?.key===key)return;
  if(key)zones.set(element,{key,allowPopup});else zones.delete(element);notify();
}
export function pointerToolZone(point:CursorPoint){
  const target=point.target instanceof Element?point.target:null;
  const blocked=!target||!!target.closest('[data-context-controller],[data-visual-selector]');
  for(let node:Element|null=target;node;node=node.parentElement){
    const zone=zones.get(node);if(zone&&(!blocked||zone.allowPopup)&&!target?.closest('[data-visual-selector]')&&(!zone.contains||zone.contains(point)))return {blocked:false,zone:zone.key};
  }
  return {blocked,zone:undefined};
}
/** Cache geometry on registration/resize/scroll, never on pointer movement. */
export function useToolCursorZone(ref:RefObject<HTMLElement|null>,key:string,circle=false){
  useLayoutEffect(()=>{
    const node=ref.current;if(!node)return;
    let area:CursorArea;
    const measure=()=>{const rect=node.getBoundingClientRect();area={left:rect.left,top:rect.top,width:rect.width,height:rect.height,circle};notify();};
    const zone={key,contains:(point:CursorPoint)=>inCursorArea(point,area)};
    measure();zones.set(node,zone);notify();
    const observer=new ResizeObserver(measure);observer.observe(node);
    node.addEventListener('pointerenter',measure);window.addEventListener('scroll',measure,true);window.addEventListener('resize',measure);
    return()=>{observer.disconnect();node.removeEventListener('pointerenter',measure);window.removeEventListener('scroll',measure,true);window.removeEventListener('resize',measure);if(zones.get(node)===zone){zones.delete(node);notify();}};
  },[ref,key,circle]);
}
