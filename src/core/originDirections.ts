import * as T from 'three';
import {radialSlotCapacity} from '../properties/mathematicalDial.ts';
import {activeWorldAxes,axisCenter,axisCoordinates,plus,times,type AxisFrame} from './axes.ts';
import type {Vec3,World} from './model.ts';
export const DIRECTION_PLANES={XY:[0,1],XZ:[0,2],YZ:[1,2]} as const;
export type DirectionPlane=keyof typeof DIRECTION_PLANES;
export type OriginDirections={mode:'axis'|'unit';halves:number;rings:number;disabled:string[];symmetry:boolean;planes?:DirectionPlane[]};
export const DEFAULT_ORIGIN_DIRECTIONS:OriginDirections={mode:'axis',halves:0,rings:1,disabled:[],symmetry:false};
export function directionPlane(active:readonly number[]):DirectionPlane{return (Object.keys(DIRECTION_PLANES) as DirectionPlane[]).find(key=>active.length===2&&DIRECTION_PLANES[key].every(i=>active.includes(i)))??(active.includes(2)?'XZ':'XY');}
export function directionCount(settings:OriginDirections,ring=1){return settings.mode==='axis'?4*2**settings.halves:radialSlotCapacity(ring,1);}
export function directionSlots(settings:OriginDirections,ring=1){const count=directionCount(settings,ring);return Array.from({length:count},(_,i)=>{const turn=i/count*Math.PI*2;return {key:`${settings.mode==='axis'?0:ring-1}:${i}`,x:Math.cos(turn),y:Math.sin(turn)};});}
export function validateOriginDirections(value:OriginDirections){if(!value||!['axis','unit'].includes(value.mode)||!Number.isInteger(value.halves)||value.halves<0||value.halves>6||!Number.isInteger(value.rings)||value.rings<1||value.rings>4||!Array.isArray(value.disabled)||value.disabled.length>1024||new Set(value.disabled).size!==value.disabled.length||value.disabled.some(key=>!/^(?:(XY|XZ|YZ):)?\d{1,6}:\d{1,4}$/.test(key))||typeof value.symmetry!=='boolean'||value.planes!==undefined&&(!Array.isArray(value.planes)||value.planes.length>3||new Set(value.planes).size!==value.planes.length||value.planes.some(plane=>!Object.hasOwn(DIRECTION_PLANES,plane))))throw Error('Invalid origin directions.');}
const choiceCaches=new WeakMap<OriginDirections,Map<string,ReturnType<typeof directionSlots>>>();
function selectedSlots(settings:OriginDirections,ring:number,plane:DirectionPlane,drawPlane:DirectionPlane){
 let cache=choiceCaches.get(settings);if(!cache){cache=new Map();choiceCaches.set(settings,cache);}
 const order=settings.mode==='axis'?1:ring,key=`${drawPlane}:${plane}:${order}`;let slots=cache.get(key);
 if(!slots){const disabled=new Set(settings.disabled);slots=directionSlots(settings,order).filter(slot=>!disabled.has(`${plane}:${slot.key}`)&&!(plane===drawPlane&&disabled.has(slot.key)));cache.set(key,slots);}return slots;
}
function lineSigns(settings:OriginDirections,active:readonly number[],ring=1){const plane=directionPlane(active),order=settings.mode==='axis'?0:ring-1;return [1,-1].filter((_,i)=>!settings.disabled.includes(`${order}:${i}`)&&!settings.disabled.includes(`${plane}:${order}:${i}`));}
/** Output planes do not alter the mouse projection plane or camera positioning. */
export function spatialDirectionSlots(settings:OriginDirections,active:readonly number[],ring=1){
 const drawPlane=directionPlane(active),planes=settings.planes??[drawPlane],slots=new Map<string,{key:string;direction:Vec3}>();
 if(active.length===1&&!settings.planes){for(const sign of lineSigns(settings,active,ring)){const direction:Vec3=[0,0,0];direction[active[0]]=sign;const key=`${settings.mode==='axis'?0:ring-1}:${sign===1?0:1}`;slots.set(key,{key,direction});}return [...slots.values()];}
 for(const plane of planes){const [a,b]=DIRECTION_PLANES[plane];for(const slot of selectedSlots(settings,ring,plane,drawPlane)){const direction:Vec3=[0,0,0];direction[a]=slot.x;direction[b]=slot.y;const key=direction.map(n=>Math.round(n*1e7)).join(',');if(!slots.has(key))slots.set(key,{key:`${plane}:${slot.key}`,direction});}}
 return [...slots.values()];
}
export function hasOriginDirections(frame:AxisFrame){
 const active=activeWorldAxes(frame),settings=frame.directions;if(!active.length)return false;if(!settings)return true;
 if(settings.symmetry)return Array.from({length:settings.mode==='axis'?1:settings.rings},(_,i)=>spatialDirectionSlots(settings,active,i+1)).some(slots=>slots.length>0);
 if(active.length===1)return Array.from({length:settings.mode==='axis'?1:settings.rings},(_,i)=>lineSigns(settings,active,i+1)).some(signs=>signs.length>0);
 return Array.from({length:settings.mode==='axis'?1:settings.rings},(_,i)=>selectedSlots(settings,i+1,directionPlane(active),directionPlane(active))).some(slots=>slots.length>0);
}
/** One directional placement plan is shared by previews, painting and relocation. */
export function prepareOriginDirections(world:World,frame:AxisFrame){
 const settings=frame.directions;if(!settings)return undefined;
 const active=activeWorldAxes(frame),center=axisCenter(world,frame),basis=[frame.x,frame.y,frame.z],drawPlane=directionPlane(active);
 const worldVector=(direction:Vec3)=>new T.Vector3(...basis[0]).multiplyScalar(direction[0]).addScaledVector(new T.Vector3(...basis[1]),direction[1]).addScaledVector(new T.Vector3(...basis[2]),direction[2]);
 return (position:Vec3,offsets:readonly Vec3[])=>{
  if(!active.length)return {anchor:position,stamp:[] as Vec3[]};
  const coordinates=axisCoordinates(world,frame,position),[a,b]=active;let anchor:Vec3,ring=1;
  if(b===undefined){
   const magnitudes=settings.mode==='unit'?Array.from({length:settings.rings},(_,i)=>i+1):[Math.round(Math.abs(coordinates[a]))],values=magnitudes.flatMap(magnitude=>(settings.symmetry&&settings.planes?[1,-1]:lineSigns(settings,active,magnitude)).map(sign=>sign*magnitude));if(!values.length)return {anchor:position,stamp:[] as Vec3[]};const value=Math.abs(coordinates[a])<.5?0:values.reduce((best,value)=>Math.abs(value-coordinates[a])<Math.abs(best-coordinates[a])?value:best,values[0]);anchor=plus(center,times(basis[a],value));ring=Math.max(1,Math.round(Math.abs(value)));
  }else{
   const x=coordinates[a],y=coordinates[b],radius=Math.hypot(x,y);ring=Math.max(1,Math.min(settings.mode==='unit'?settings.rings:Infinity,Math.round(radius)));
   let best:{x:number;y:number}|undefined,nearest=Infinity;const candidates=settings.mode==='unit'?Array.from({length:settings.rings},(_,i)=>i+1):[ring];
   for(const r of new Set(candidates)){
    const marked=selectedSlots(settings,r,drawPlane,drawPlane),slots=settings.symmetry&&(!marked.length||settings.planes&&!settings.planes.includes(drawPlane))?directionSlots(settings,r):marked;
    for(const slot of slots){const distance=settings.mode==='unit'?r:Math.max(0,Math.round(x*slot.x+y*slot.y)),sx=slot.x*distance,sy=slot.y*distance,error=(sx-x)**2+(sy-y)**2;if(error<nearest){nearest=error;best={x:sx,y:sy};}}
   }
   if(!best)return {anchor:position,stamp:[] as Vec3[]};if(radius<.5)best={x:0,y:0};anchor=plus(center,plus(times(basis[a],best.x),times(basis[b],best.y)));ring=Math.max(1,Math.round(Math.hypot(best.x,best.y)));
  }
  const source=new T.Vector3(...anchor).sub(new T.Vector3(...center)),distance=source.length(),directions=settings.symmetry?spatialDirectionSlots(settings,active,ring).map(slot=>worldVector(slot.direction)):[source.clone().normalize()];
  if(directions.length*offsets.length>4000)return {anchor,stamp:[] as Vec3[]};
  const from=distance?source.clone().normalize():new T.Vector3(...basis[a]),stamp=directions.flatMap(direction=>{const normal=b===undefined?undefined:new T.Vector3(...basis[a]).cross(new T.Vector3(...basis[b])).normalize(),rotation=normal&&Math.abs(direction.dot(normal))<1e-7?new T.Quaternion().setFromAxisAngle(normal,Math.atan2(normal.dot(from.clone().cross(direction)),from.dot(direction))):new T.Quaternion().setFromUnitVectors(from,distance?direction:from),target=new T.Vector3(...center).addScaledVector(direction,distance);return offsets.map(offset=>new T.Vector3(...offset).applyQuaternion(rotation).add(target).toArray() as Vec3);});
  return {anchor,stamp};
 };
}
