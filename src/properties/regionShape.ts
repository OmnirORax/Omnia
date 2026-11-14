import {circleClipVertices,convexPolygon,inConvexPolygon,inkBounds,type ConvexInk} from '../appearance/geometryRelations.ts';
export type ShapePoint={x:number;y:number};
export type RegionDisc={x:number;y:number;radius:number;clip:ShapePoint[];color:string;opacity:number};
export const REGION_SHAPE_LIMITS={units:128,points:32,text:65536,extent:1000000};
const validClip=(points:ShapePoint[])=>{const origin=points[0],scale=Math.max(...points.map(p=>Math.hypot(p.x-origin.x,p.y-origin.y)));return scale>0&&convexPolygon(points.map(p=>({x:(p.x-origin.x)/scale,y:(p.y-origin.y)/scale})));};
export function readRegionShape(text:string):RegionDisc[]{
 if(text.length>REGION_SHAPE_LIMITS.text)throw Error('Region shape budget exceeded.');
 const value:unknown=JSON.parse(text);if(!Array.isArray(value)||value.length>REGION_SHAPE_LIMITS.units)throw Error('Invalid region shape.');
 const finite=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=REGION_SHAPE_LIMITS.extent;
 return value.map(raw=>{
  if(!raw||typeof raw!=='object'||Object.keys(raw).some(k=>!['x','y','radius','clip','color','opacity'].includes(k))||!finite(raw.x)||!finite(raw.y)||!finite(raw.radius)||raw.radius<=0||!/^#[\da-f]{6}$/i.test(raw.color)||typeof raw.opacity!=='number'||raw.opacity<0||raw.opacity>1||!Array.isArray(raw.clip)||raw.clip.length<3||raw.clip.length>REGION_SHAPE_LIMITS.points||raw.clip.some((p:unknown)=>!p||typeof p!=='object'||Object.keys(p).some(k=>k!=='x'&&k!=='y')||!finite((p as ShapePoint).x)||!finite((p as ShapePoint).y))||!validClip(raw.clip))throw Error('Invalid region shape.');
  return {x:raw.x,y:raw.y,radius:raw.radius,clip:raw.clip.map((p:ShapePoint)=>({...p})),color:raw.color,opacity:raw.opacity};
 });
}
export function regionDiscBounds(disc:Pick<RegionDisc,'x'|'y'|'radius'|'clip'>){return inkBounds({ink:[{outer:{kind:'circle',center:{x:disc.x,y:disc.y},radius:disc.radius,clip:disc.clip}}]});}
export function intersectRegionClips(subject:readonly ShapePoint[],boundary:readonly ShapePoint[]):ShapePoint[]{
 if(!subject.length||!boundary.length)return [];
 const sign=Math.sign(boundary.reduce((sum,p,i)=>{const q=boundary[(i+1)%boundary.length];return sum+p.x*q.y-p.y*q.x;},0));
 let output=subject.map(p=>({...p}));
 for(let i=0;i<boundary.length;i++){
  const a=boundary[i],b=boundary[(i+1)%boundary.length],distance=(p:ShapePoint)=>sign*((b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x)),input=output;output=[];
  for(let j=0;j<input.length;j++){const p=input[j],q=input[(j+1)%input.length],dp=distance(p),dq=distance(q),insideP=dp>=-1e-9,insideQ=dq>=-1e-9;
   if(insideP)output.push(p);if(insideP!==insideQ){const t=dp/(dp-dq);output.push({x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t});}
  }
  if(output.length>REGION_SHAPE_LIMITS.points)throw Error('Region boundary budget exceeded.');
 }
 return output.filter((p,i)=>!output.slice(0,i).some(q=>Math.hypot(q.x-p.x,q.y-p.y)<1e-9));
}
/** Exact arc-and-line contour of a disc/convex-region intersection. The rectangle
 * is a constraint, never a substitute for the accepted curved shape. */
export function regionDiscPath(disc:Pick<RegionDisc,'x'|'y'|'radius'|'clip'>):string{
 const circle:Extract<ConvexInk,{kind:'circle'}>={kind:'circle',center:{x:disc.x,y:disc.y},radius:disc.radius,clip:disc.clip};
 const candidates=[...circleClipVertices(circle),...Array.from({length:4},(_,i)=>({x:disc.x+Math.cos(i*Math.PI/2)*disc.radius,y:disc.y+Math.sin(i*Math.PI/2)*disc.radius})).filter(p=>inConvexPolygon(disc.clip,p))];
 const points=candidates.filter((p,i)=>!candidates.slice(0,i).some(q=>Math.hypot(q.x-p.x,q.y-p.y)<1e-8));if(points.length<2)return '';
 const center={x:points.reduce((sum,p)=>sum+p.x,0)/points.length,y:points.reduce((sum,p)=>sum+p.y,0)/points.length};points.sort((a,b)=>Math.atan2(a.y-center.y,a.x-center.x)-Math.atan2(b.y-center.y,b.x-center.x));
 const n=(value:number)=>String(Number(value.toPrecision(15))),coordinate=(p:ShapePoint)=>`${n(p.x)} ${n(p.y)}`;
 let path=`M ${coordinate(points[0])}`;
 for(let i=0;i<points.length;i++){
  const a=points[i],b=points[(i+1)%points.length],onCircle=(p:ShapePoint)=>Math.abs(Math.hypot(p.x-disc.x,p.y-disc.y)-disc.radius)<1e-7*Math.max(1,disc.radius);
  const start=Math.atan2(a.y-disc.y,a.x-disc.x),end=Math.atan2(b.y-disc.y,b.x-disc.x),turn=((end-start)%(Math.PI*2)+Math.PI*2)%(Math.PI*2),mid={x:disc.x+Math.cos(start+turn/2)*disc.radius,y:disc.y+Math.sin(start+turn/2)*disc.radius};
  path+=onCircle(a)&&onCircle(b)&&turn>1e-12&&inConvexPolygon(disc.clip,mid)?` A ${n(disc.radius)} ${n(disc.radius)} 0 ${turn>Math.PI?1:0} 1 ${coordinate(b)}`:` L ${coordinate(b)}`;
 }
 return path+' Z';
}
export function mapRegionShape(units:readonly RegionDisc[],map:(point:ShapePoint)=>ShapePoint,radiusScale=1):RegionDisc[]{return units.map(unit=>({...unit,...map(unit),radius:unit.radius*radiusScale,clip:unit.clip.map(map)}));}
