import { useLayoutEffect, type RefObject } from 'react';
import { inCursorArea, projectCursorTarget, type CursorArea } from './toolCursorModel';
export type CursorPoint={x:number;y:number;target:EventTarget|null};
type Zone={key:string;disabled?:boolean;area?:CursorArea;aim?:{tool:string;point:{x:number;y:number};relative:boolean};contains?:(point:CursorPoint)=>boolean};
const zones=new WeakMap<Element,Zone>(),listeners=new Set<()=>void>(),aimListeners=new Set<()=>void>();
const notify=()=>listeners.forEach(listener=>listener());
const notifyAim=()=>aimListeners.forEach(listener=>listener());
export function observeToolAim(listener:()=>void){aimListeners.add(listener);return()=>{aimListeners.delete(listener);};}
export function toolCursorArea(element:Element){return zones.get(element)?.area;}
export function setToolCursorZoneEnabled(element:Element,enabled:boolean){const zone=zones.get(element);if(zone&&zone.disabled===!enabled)return;if(zone){zone.disabled=!enabled;notify();}}
export function observeToolZones(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
/** Canvas/3D adapters publish their existing hit-test result; no extra raycast. */
export function setToolCursorZone(element:Element,key:string|undefined){
  if(zones.get(element)?.key===key)return;
  if(key)zones.set(element,{key});else zones.delete(element);notify();
}
/** Optional operation feedback point, shared by the marker and cursor. */
export function setToolCursorAim(target:EventTarget|null,key:string,tool:string,point:{x:number;y:number}|undefined,relative=false){
  for(let node=target instanceof Element?target:null;node;node=node.parentElement){
    const zone=zones.get(node);if(!zone||zone.key!==key)continue;
    if(relative&&!zone.area)return;
    if(!point){if(zone.aim?.tool===tool){zone.aim=undefined;notifyAim();}return;}
    if(zone.aim?.tool===tool&&zone.aim.relative===relative&&zone.aim.point.x===point.x&&zone.aim.point.y===point.y)return;
    zone.aim={tool,point,relative};notifyAim();return;
  }
}
function readAim(zone:Zone,tool:string){
  const aim=zone.aim;if(aim?.tool!==tool)return;
  if(!aim.relative)return aim.point;
  return zone.area?projectCursorTarget(zone.area,aim.point):undefined;
}
export type ToolCursorScope={blocked:boolean;zone?:string;aim?:(tool:string)=>{x:number;y:number}|undefined};
export function pointerToolZone(point:CursorPoint):ToolCursorScope{
  const target=point.target instanceof Element?point.target:null;
  const blocked=!target||!!target.closest('[data-context-controller],[data-visual-selector]');
  if(blocked)return {blocked:true,zone:undefined};
  for(let node:Element|null=target;node;node=node.parentElement){
    const zone=zones.get(node);if(zone&&!zone.disabled&&(!zone.contains||zone.contains(point)))return {blocked:false,zone:zone.key,aim:tool=>readAim(zone,tool)};
  }
  return {blocked:false,zone:undefined};
}
/** Cache geometry on registration/resize/scroll, never on pointer movement. */
export function useToolCursorZone(ref:RefObject<HTMLElement|null>,key:string,circle=false){
  useLayoutEffect(()=>{
    const node=ref.current;if(!node)return;
    let area:CursorArea;
    const measure=()=>{const rect=node.getBoundingClientRect();area={left:rect.left,top:rect.top,width:rect.width,height:rect.height,circle};zone.area=area;notify();};
    const zone:Zone={key,disabled:false,contains:(point:CursorPoint)=>inCursorArea(point,area)};
    measure();zones.set(node,zone);notify();
    const observer=new ResizeObserver(measure);observer.observe(node);
    const enter=()=>{zone.disabled=false;measure();};
    node.addEventListener('pointerenter',enter);window.addEventListener('scroll',measure,true);window.addEventListener('resize',measure);
    return()=>{observer.disconnect();node.removeEventListener('pointerenter',enter);window.removeEventListener('scroll',measure,true);window.removeEventListener('resize',measure);if(zones.get(node)===zone){zones.delete(node);notify();}};
  },[ref,key,circle]);
}
