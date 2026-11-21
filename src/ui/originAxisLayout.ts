import {directionSlots,originSides,originDirectionAllowed,originAreaMask,planarOriginDirections,type OriginDirections} from '../core/originDirections.ts';
import {AXIS_COLORS} from '../world/axisReadout.ts';
import type {AxisDialRay} from '../properties/axisDial.ts';
export type OriginAxisTarget={axis:number;sign:1|-1}|{key:string};
/** Signed planar parameters adapt to the common axis/rotation drawing. */
export function originAxisLayout(active:readonly number[],settings:OriginDirections){
 const directions=planarOriginDirections(settings,active),sides=originSides(directions,active),targets=new Map<string,OriginAxisTarget>();
 const points=[{x:1,y:0},{x:-1,y:0},{x:0,y:-1},{x:0,y:1}];
 const rays:AxisDialRay[]=points.map((point,side)=>{const axis=Math.floor(side/2),sign=side%2===0?1:-1,id=`side:${side}`;targets.set(id,{axis,sign});return {id,kind:'axis',oneSided:true,point,color:AXIS_COLORS[axis],selected:sides.includes(side),label:sign===1?'+':'−'};});
 if(directions.mode==='axis'&&directions.halves&&sides.length){
  const slots=directionSlots(directions),quarter=slots.length/4;
  for(const [index,slot]of slots.entries()){if(index%quarter===0||!originDirectionAllowed(directions,slot.x,slot.y))continue;const id=`direction:${slot.key}`;targets.set(id,{key:slot.key});rays.push({id,kind:'direction',point:{x:slot.x,y:-slot.y},selected:!directions.disabled.includes(slot.key)});}
 }
 return {rays,targets,areas:directions.mode==='area'?originAreaMask(directions,active):[]};
}
