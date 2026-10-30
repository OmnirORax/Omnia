import {rangeValue,sequenceAt,sequenceIndex} from './rangeMath.ts';
export const DEFAULT_VALUE_SCRUB_SPAN=136;
type Point={x:number;y:number};
type ScrubConfiguration={origin:Point;width?:number;value:number;min:number;max:number;step:number;values?:readonly number[]};
/** A scalar slider grabbed in free space. Initial motion chooses its axis;
 * every later sample projects onto that same axis, independent of geometry. */
export function createValueScrub(config:ScrubConfiguration){
 const {min,max,step}=config;
 const origin={...config.origin},width=Math.max(1,config.width??DEFAULT_VALUE_SCRUB_SPAN),values=config.values?[...config.values]:undefined;
 const start=values?values.length<2?.5:sequenceIndex(values,config.value)/(values.length-1):max===min?.5:(config.value-min)/(max-min);
 let axis:Point|undefined;
 return {sample(point:Point){
  const dx=point.x-origin.x,dy=point.y-origin.y;if(!Number.isFinite(dx)||!Number.isFinite(dy))return;
  if(!axis){const length=Math.hypot(dx,dy);if(length<3)return;axis={x:dx/length,y:dy/length};}
  const fraction=start+(dx*axis.x+dy*axis.y)/width;
  return values?sequenceAt(values,fraction):rangeValue(min+fraction*(max-min),min,max,step);
 }};
}
export type ValueScrub=ReturnType<typeof createValueScrub>;
