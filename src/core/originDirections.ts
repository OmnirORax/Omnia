import * as T from 'three';
import {snapSlots} from './planePacking.ts';
import {radialSlotCapacity} from '../properties/mathematicalDial.ts';
import {activeWorldAxes,axisCenter,axisCoordinates,plus,times,dot,type AxisFrame} from './axes.ts';
import type {Vec3,World} from './model.ts';
export type OriginDirections={mode:'axis'|'unit'|'area';sides?:number[];invert?:boolean;pattern?:'grid'|'hex';halves:number;rings:number;disabled:string[];symmetry:boolean};
export const DEFAULT_ORIGIN_DIRECTIONS:OriginDirections={mode:'axis',halves:0,rings:1,disabled:[],symmetry:false};
/** Side indices are +X, -X, +Y, -Y; Z is facing-only in planar placement. */
export const sideIndex=(axis:number,sign:1|-1)=>axis*2+(sign===1?0:1);
export function originSides(settings:OriginDirections|undefined,active:readonly number[]=[0,1]){return settings?.sides?[...settings.sides]:active.filter(axis=>axis<2).flatMap(axis=>[axis*2,axis*2+1]);}
export function sideAxes(sides:readonly number[]){return [0,1].filter(axis=>sides.includes(axis*2)||sides.includes(axis*2+1));}
const planarCaches=new WeakMap<OriginDirections,Map<string,OriginDirections>>();
export function planarOriginDirections(settings:OriginDirections|undefined,active:readonly number[]=[0,1]):OriginDirections{
 const value=settings??DEFAULT_ORIGIN_DIRECTIONS;if(value.sides&&value.invert!==undefined&&value.pattern!==undefined)return value;const key=active.join(',');let cache=planarCaches.get(value);if(!cache){cache=new Map();planarCaches.set(value,cache);}const cached=cache.get(key);if(cached)return cached;
 const sides=originSides(value,active);let disabled=[...value.disabled];
 if(value.mode==='axis'){
  const count=directionCount(value),cardinals=new Map([[0,0],[1,count/2],[2,count/4],[3,3*count/4]]);
  if(!value.sides)for(const [side,index]of cardinals)if(disabled.includes(`0:${index}`)){const at=sides.indexOf(side);if(at>=0)sides.splice(at,1);}
  disabled=disabled.filter(key=>![...cardinals.values()].some(index=>key===`0:${index}`));
 }
 const result={...value,sides,disabled,invert:value.invert??false,pattern:value.pattern??'grid'};cache.set(key,result);return result;
}
export function toggleOriginSide(settings:OriginDirections,active:readonly number[],axis:number,sign?:1|-1){
 if(axis!==0&&axis!==1)throw Error('Z is facing-only; placement uses X and Y.');
 const next={...planarOriginDirections(settings,active)},sides=next.sides!,pair=[axis*2,axis*2+1],whole=pair.every(side=>sides.includes(side));
 const clicked=sign===undefined?undefined:sideIndex(axis,sign),enabled=clicked===undefined?(whole?[]:pair):whole?[clicked]:sides.includes(clicked)?[]:pair;
 next.sides=[...sides.filter(side=>!pair.includes(side)),...enabled].sort();return next;
}
const areaCaches=new WeakMap<OriginDirections,Map<string,boolean[]>>();
/** Adjacent enabled rays bound the smaller sectors; opposite rays alone have no area. */
export function originAreaMask(settings:OriginDirections,active:readonly number[]=[0,1]){
 let cache=areaCaches.get(settings);if(!cache){cache=new Map();areaCaches.set(settings,cache);}const key=active.join(',');const cached=cache.get(key);if(cached)return cached;
 const sides=originSides(settings,active),count=4*2**settings.halves,quarter=count/4,cardinals=[0,2,1,3],disabled=new Set(settings.disabled),selected:number[]=[];
 for(let i=0;i<count;i++)if(i%quarter===0?sides.includes(cardinals[i/quarter]):!disabled.has(`0:${i}`))selected.push(i);
 const mask=Array<boolean>(count).fill(false);
 if(selected.length>1)for(let i=0;i<selected.length;i++){const start=selected[i],end=selected[(i+1)%selected.length],gap=(end-start+count)%count;if(gap<count/2)for(let j=0;j<gap;j++)mask[(start+j)%count]=true;}
 const valid=mask.some(Boolean),result=mask.map(enabled=>valid&&(settings.invert?!enabled:enabled));cache.set(key,result);return result;
}
export function originAreaContains(mask:readonly boolean[],x:number,y:number){
 const count=mask.length;if(!count)return false;if(Math.hypot(x,y)<1e-8)return mask.some(Boolean);
 const angle=(Math.atan2(y,x)+Math.PI*2)%(Math.PI*2),slot=angle/(Math.PI*2)*count,index=Math.floor(slot)%count,tolerance=1e-8;
 return !!mask[index]||Math.abs(slot-Math.round(slot))<tolerance&&(!!mask[Math.round(slot)%count]||!!mask[(Math.round(slot)+count-1)%count]);
}
/** Axis and Area share refined direction identities; Unit has its own ring slots. */
export function changeOriginMode(settings:OriginDirections,mode:OriginDirections['mode'],active:readonly number[]=[0,1]):OriginDirections{
 if(mode===settings.mode)return settings;
 const value=planarOriginDirections(settings,active);
 if(mode==='unit'||settings.mode==='unit')return {...value,mode,disabled:[]};
 const disabled=new Set(value.disabled);
 if(mode==='area')for(const [i,slot]of directionSlots(value).entries())if(i%(directionCount(value)/4)!==0&&!originDirectionAllowed(value,slot.x,slot.y))disabled.add(slot.key);
 return {...value,mode,disabled:[...disabled]};
}
export function originDirectionAllowed(settings:OriginDirections,x:number,y:number){const sides=settings.sides;if(!sides)return true;return (Math.abs(x)<1e-8||sides.includes(x>0?0:1))&&(Math.abs(y)<1e-8||sides.includes(y>0?2:3));}
export function directionCount(settings:OriginDirections,ring=1){return settings.mode!=='unit'?4*2**settings.halves:radialSlotCapacity(ring,1);}
export function directionSlots(settings:OriginDirections,ring=1){const count=directionCount(settings,ring);return Array.from({length:count},(_,i)=>{const turn=i/count*Math.PI*2;return {key:`${settings.mode!=='unit'?0:ring-1}:${i}`,x:Math.cos(turn),y:Math.sin(turn)};});}
export function validateOriginDirections(value:OriginDirections){
 if(!value||!['axis','unit','area'].includes(value.mode)||!Number.isInteger(value.halves)||value.halves<0||value.halves>6||!Number.isInteger(value.rings)||value.rings<1||value.rings>4||!Array.isArray(value.disabled)||value.disabled.length>1024||new Set(value.disabled).size!==value.disabled.length||value.disabled.some(key=>!/^(?:(XY|XZ|YZ):)?\d{1,6}:\d{1,4}$/.test(key))||typeof value.symmetry!=='boolean')throw Error('Invalid origin directions.');
 if(value.sides!==undefined&&(!Array.isArray(value.sides)||value.sides.length>4||new Set(value.sides).size!==value.sides.length||value.sides.some(side=>!Number.isInteger(side)||side<0||side>3)))throw Error('Invalid origin sides.');
 if(value.invert!==undefined&&typeof value.invert!=='boolean'||value.pattern!==undefined&&!['grid','hex'].includes(value.pattern))throw Error('Invalid origin area settings.');
 // Retire the former independent plane settings when loading older worlds.
 delete (value as OriginDirections&{planes?:unknown}).planes;
 if(value.disabled.some(key=>key.split(':').length===3))value.disabled=[...new Set(value.disabled.map(key=>key.split(':').slice(-2).join(':')))];
}
const choiceCaches=new WeakMap<OriginDirections,Map<string,ReturnType<typeof directionSlots>>>();
function selectedSlots(settings:OriginDirections,ring:number){
 let cache=choiceCaches.get(settings);if(!cache){cache=new Map();choiceCaches.set(settings,cache);}
 const order=settings.mode==='axis'?1:ring,key=String(order);let slots=cache.get(key);
 if(!slots){const disabled=new Set(settings.disabled);slots=directionSlots(settings,order).filter(slot=>!disabled.has(slot.key)&&originDirectionAllowed(settings,slot.x,slot.y));cache.set(key,slots);}return slots;
}
function lineSigns(settings:OriginDirections,ring=1,axis=0){const order=settings.mode==='axis'?0:ring-1;return [1,-1].filter((sign,i)=>(!settings.sides||settings.sides.includes(sideIndex(axis,sign as 1|-1)))&&(settings.sides&&settings.mode==='axis'||!settings.disabled.includes(`${order}:${i}`)));}
/** Gizmos and placement derive directions solely from the activated axes. */
export function spatialDirectionSlots(settings:OriginDirections,active:readonly number[],ring=1){
 if(settings.mode==='area')return [];
 if(settings.sides)active=sideAxes(settings.sides);
 if(!active.length)return [];
 if(active.length===1)return lineSigns(settings,ring,active[0]).map(sign=>{const direction:Vec3=[0,0,0];direction[active[0]]=sign;return {key:`${settings.mode==='axis'?0:ring-1}:${sign===1?0:1}`,direction};});
 const slots=new Map<string,{key:string;direction:Vec3}>();
 for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++){
  const a=active[i],b=active[j];
  for(const slot of selectedSlots(settings,ring)){const direction:Vec3=[0,0,0];direction[a]=slot.x;direction[b]=slot.y;const key=direction.map(n=>Math.round(n*1e7)).join(',');if(!slots.has(key))slots.set(key,{key,direction});}
 }
 return [...slots.values()];
}
export function hasOriginDirections(frame:AxisFrame){
 const settings=frame.directions,active=settings?.sides?sideAxes(settings.sides):activeWorldAxes(frame);if(settings?.mode==='area')return originAreaMask(settings,active).some(Boolean);if(!active.length)return false;if(!settings)return true;
 return Array.from({length:settings.mode==='axis'?1:settings.rings},(_,i)=>spatialDirectionSlots(settings,active,i+1)).some(slots=>slots.length>0);
}
/** One directional placement plan is shared by previews, painting and relocation. */
export function prepareOriginDirections(world:World,frame:AxisFrame){
 const original=frame.directions;if(!original)return undefined;const settings=original.mode==='area'?planarOriginDirections(original,activeWorldAxes(frame)):original;
 const enabled=settings.mode==='area'?[0,1]:settings.sides?sideAxes(settings.sides):activeWorldAxes(frame),center=axisCenter(world,frame),basis=[frame.x,frame.y,frame.z];
 const worldVector=(direction:Vec3)=>new T.Vector3(...basis[0]).multiplyScalar(direction[0]).addScaledVector(new T.Vector3(...basis[1]),direction[1]).addScaledVector(new T.Vector3(...basis[2]),direction[2]);
 return (position:Vec3,offsets:readonly Vec3[]):{anchor:Vec3;stamp:Vec3[];rejection?:string}=>{
  if(!enabled.length)return {anchor:position,stamp:[],rejection:'Enable a placement direction.'};
  if(settings.mode==='area'){
   const mask=originAreaMask(settings,enabled),coords=axisCoordinates(world,frame,position),slot=snapSlots([coords[0],coords[1],0],[0,1],settings.pattern==='hex'),anchor=plus(center,plus(times(basis[0],slot[0]),times(basis[1],slot[1])));
   if(!mask.some(Boolean))return {anchor,stamp:[],rejection:'The selected area is empty; enable two non-opposite directions or change the invert setting.'};
   if(!originAreaContains(mask,coords[0],coords[1])||!originAreaContains(mask,slot[0],slot[1]))return {anchor,stamp:[],rejection:'Point is outside the active area.'};
   const flips=(settings.symmetry?[[1,1],[-1,1],[1,-1],[-1,-1]]:[[1,1]]).filter(([fx,fy])=>originAreaContains(mask,slot[0]*fx,slot[1]*fy)),stamp:Vec3[]=[];
   if(flips.length*offsets.length>4000)return {anchor,stamp:[],rejection:'The symmetric brush exceeds 4000 positions.'};
   for(const [fx,fy]of flips){const x=slot[0]*fx,y=slot[1]*fy;if(!originAreaContains(mask,x,y))continue;const target=plus(center,plus(times(basis[0],x),times(basis[1],y)));for(const offset of offsets){const reflected=plus(offset,plus(times(basis[0],(fx-1)*dot(offset,basis[0])),times(basis[1],(fy-1)*dot(offset,basis[1]))));const placed=plus(target,reflected),local=axisCoordinates(world,frame,placed);if(!originAreaContains(mask,local[0],local[1]))return {anchor,stamp:[],rejection:'Brush extends outside the active area.'};stamp.push(placed);}}
   return {anchor,stamp};
  }
  const coordinates=axisCoordinates(world,frame,position),active=enabled.length===3?[...enabled].sort((a,b)=>Math.abs(coordinates[b])-Math.abs(coordinates[a])).slice(0,2).sort():enabled,[a,b]=active;let anchor:Vec3,ring=1;
  if(b===undefined){
   const magnitudes=settings.mode==='unit'?Array.from({length:settings.rings},(_,i)=>i+1):[Math.round(Math.abs(coordinates[a]))],values=magnitudes.flatMap(magnitude=>lineSigns(settings,magnitude,a).map(sign=>sign*magnitude));if(!values.length)return {anchor:position,stamp:[] as Vec3[]};const projected=settings.sides&&settings.mode==='axis'?lineSigns(settings,1,a).map(sign=>Math.max(0,Math.round(coordinates[a]*sign))*sign):values;const value=Math.abs(coordinates[a])<.5?0:projected.reduce((best,value)=>Math.abs(value-coordinates[a])<Math.abs(best-coordinates[a])?value:best,projected[0]);if(settings.sides&&settings.mode==='axis'&&value===0&&Math.abs(coordinates[a])>=.5)return {anchor:center,stamp:[],rejection:'Point lies behind the active axis side.'};anchor=plus(center,times(basis[a],value));ring=Math.max(1,Math.round(Math.abs(value)));
  }else{
   const x=coordinates[a],y=coordinates[b],radius=Math.hypot(x,y);ring=Math.max(1,Math.min(settings.mode==='unit'?settings.rings:Infinity,Math.round(radius)));
   let best:{x:number;y:number}|undefined,nearest=Infinity;const candidates=settings.mode==='unit'?Array.from({length:settings.rings},(_,i)=>i+1):[ring];
   for(const r of new Set(candidates)){
    const slots=selectedSlots(settings,r);
    for(const slot of slots){const distance=settings.mode==='unit'?r:Math.max(0,Math.round(x*slot.x+y*slot.y)),sx=slot.x*distance,sy=slot.y*distance,error=(sx-x)**2+(sy-y)**2;if(error<nearest){nearest=error;best={x:sx,y:sy};}}
   }
   if(!best)return {anchor:position,stamp:[],rejection:'Enable a placement direction.'};if(settings.sides&&settings.mode==='axis'&&radius>=.5&&Math.hypot(best.x,best.y)<1e-7)return {anchor:center,stamp:[],rejection:'Point lies behind the active axis sides.'};if(radius<.5)best={x:0,y:0};anchor=plus(center,plus(times(basis[a],best.x),times(basis[b],best.y)));ring=Math.max(1,Math.round(Math.hypot(best.x,best.y)));
  }
  const source=new T.Vector3(...anchor).sub(new T.Vector3(...center)),distance=source.length(),directions=settings.symmetry?spatialDirectionSlots(settings,enabled,ring).map(slot=>worldVector(slot.direction)):[source.clone().normalize()];
  if(directions.length*offsets.length>4000)return {anchor,stamp:[] as Vec3[]};
  const from=distance?source.clone().normalize():new T.Vector3(...basis[a]),stamp=directions.flatMap(direction=>{const normal=b===undefined?undefined:new T.Vector3(...basis[a]).cross(new T.Vector3(...basis[b])).normalize(),rotation=normal&&Math.abs(direction.dot(normal))<1e-7?new T.Quaternion().setFromAxisAngle(normal,Math.atan2(normal.dot(from.clone().cross(direction)),from.dot(direction))):new T.Quaternion().setFromUnitVectors(from,distance?direction:from),target=new T.Vector3(...center).addScaledVector(direction,distance);return offsets.map(offset=>new T.Vector3(...offset).applyQuaternion(rotation).add(target).toArray() as Vec3);});
  return {anchor,stamp};
 };
}
