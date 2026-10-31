import {rangeValue,sequenceAt,sequenceIndex} from './rangeMath.ts';
type Point={x:number;y:number};
type ScrubConfiguration={origin:Point;width:number;value:number;min:number;max:number;step:number;values?:readonly number[]};
/** A scalar slider grabbed in free space. Initial motion chooses its axis;
 * every later sample projects onto that same axis, independent of geometry. */
export function createValueScrub(config:ScrubConfiguration){
 const {min,max,step}=config;
 const origin={...config.origin},width=Math.max(1,config.width),values=config.values?[...config.values]:undefined;
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

/** Whole-count dragging over the same first-motion axis as other scalar grabs. */
export function createCountScrub(origin:Point,unit:number,max:number,initialCount=unit){
 if(!Number.isInteger(unit)||unit<1||!Number.isInteger(max)||max<unit)throw Error('Invalid count drag domain.');
 const levels=Math.floor(max/unit),scrub=createValueScrub({origin,width:Math.max(12,(levels-1)*12),value:initialCount/unit,min:1,max:levels,step:1});
 return {sample(point:Point){const count=scrub.sample(point);return count===undefined?undefined:count*unit;}};
}

/** Existing axis nodes combine angular heading and radial count, without modes. */
export function createPolarCountDrag(config:{origin:Point;center:Point;initialAngle:number;initialCount:number;unit:number;levels:number;stepPixels:number;angles:readonly number[];period?:number}){
 const radius=(p:Point)=>Math.hypot(p.x-config.center.x,p.y-config.center.y),angle=(p:Point)=>Math.atan2(p.x-config.center.x,config.center.y-p.y);
 const initialRadius=radius(config.origin),initialPointer=angle(config.origin),period=config.period??360;
 const wrap=(n:number)=>((n%period)+period)%period;
 return {sample(point:Point){
  if(!Number.isFinite(point.x)||!Number.isFinite(point.y)||Math.hypot(point.x-config.origin.x,point.y-config.origin.y)<3)return;
  const target=radius(point)<1e-6?config.initialAngle:config.initialAngle+(angle(point)-initialPointer)/(Math.PI*2)*period;
  const heading=config.angles.reduce((best,a)=>Math.abs(wrap(a-target+period/2)-period/2)<Math.abs(wrap(best-target+period/2)-period/2)?a:best,config.initialAngle);
  const increments=Math.round((radius(point)-initialRadius)/Math.max(1e-6,config.stepPixels));
  return {angle:heading,count:Math.max(1,Math.min(config.levels*config.unit,config.initialCount+increments*config.unit))};
 }};
}
