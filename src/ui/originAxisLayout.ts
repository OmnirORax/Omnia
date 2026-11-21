import {directionSlots,type OriginDirections} from '../core/originDirections.ts';
import {AXIS_COLORS} from '../world/axisReadout.ts';
import type {AxisDialRay} from '../properties/axisDial.ts';
export type OriginAxisTarget={axis:number}|{key:string};
/** Origin parameters adapt to the shared dial visual; placement remains the owner. */
export function originAxisLayout(active:readonly number[],directions:OriginDirections){
 const targets=new Map<string,OriginAxisTarget>();
 const rays:AxisDialRay[]=AXIS_COLORS.map((color,axis)=>{const id=`axis:${axis}`,angle=axis/3*Math.PI*2;targets.set(id,{axis});return {id,kind:'axis',point:{x:Math.sin(angle),y:-Math.cos(angle)},color,selected:active.includes(axis)};});
 if(directions.mode==='axis'&&active.length){
  const slots=active.length===1?[{key:'0:0',x:1,y:0},{key:'0:1',x:-1,y:0}]:directionSlots(directions);
  for(const [index,slot]of slots.entries()){const id=`direction:${slot.key}`;targets.set(id,{key:slot.key});rays.push({id,kind:'direction',point:{x:slot.x,y:-slot.y},selected:!directions.disabled.includes(slot.key),threshold:slots.length>=4&&index%(slots.length/4)===0});}
 }
 return {rays,targets};
}
