import type {Box,Point} from './selectionGeometry.ts';
export const DEFAULT_LENS_RADIUS=18;
export function resizeSelectionLens(radius:number,delta:number){return Math.max(4,Math.min(160,radius*Math.exp(-Math.max(-120,Math.min(120,delta))*.003)));}
export type NativeSelectionShape={tag:string;attributes:Record<string,string>;transform:string;points:Point[];stroke:number;strokeWidth:number;vectorEffect:string;linecap:string;linejoin:string;fillRule:string;fill:boolean;closed:boolean};
const attributes=['d','cx','cy','r','rx','ry','x','y','x1','y1','x2','y2','width','height','points'];
/** Read native geometry once per visual snapshot, never on pointer motion. */
export function nativeSelectionShape(element:Element):NativeSelectionShape|null{
 const geometry=element as SVGGeometryElement;
 if(!['path','circle','ellipse','line','polyline','polygon','rect'].includes(element.localName)||typeof geometry.getTotalLength!=='function')return null;
 const matrix=geometry.getScreenCTM();if(!matrix)return null;
 try{
  const style=getComputedStyle(element),length=geometry.getTotalLength(),scale=Math.max(Math.hypot(matrix.a,matrix.b),Math.hypot(matrix.c,matrix.d));
  const count=Math.max(2,Math.min(512,Math.ceil(length*scale/3))),points=Array.from({length:count+1},(_,i)=>{const p=geometry.getPointAtLength(length*i/count);return{x:matrix.a*p.x+matrix.c*p.y+matrix.e,y:matrix.b*p.x+matrix.d*p.y+matrix.f};});
  return {tag:element.localName,attributes:Object.fromEntries(attributes.flatMap(name=>element.hasAttribute(name)?[[name,element.getAttribute(name)!]]:[])),transform:`matrix(${matrix.a} ${matrix.b} ${matrix.c} ${matrix.d} ${matrix.e} ${matrix.f})`,points,strokeWidth:parseFloat(style.strokeWidth||'0'),vectorEffect:style.vectorEffect,linecap:style.strokeLinecap,linejoin:style.strokeLinejoin,fillRule:style.fillRule,stroke:style.stroke==='none'?0:parseFloat(style.strokeWidth||'0')*(style.vectorEffect==='non-scaling-stroke'?1:scale),fill:style.fill!=='none',closed:!['line','polyline'].includes(element.localName)};
 }catch{return null;}
}
const segmentDistance=(p:Point,a:Point,b:Point)=>{const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);};
export function lensBoundaryDistance(point:Point,box:Box,shape:NativeSelectionShape|null){
 if(shape)return Math.max(0,Math.min(...shape.points.slice(1).map((p,i)=>segmentDistance(point,shape.points[i],p)))-shape.stroke/2);
 const dx=Math.max(box.left-point.x,0,point.x-box.right),dy=Math.max(box.top-point.y,0,point.y-box.bottom);
 return dx||dy?Math.hypot(dx,dy):Math.min(point.x-box.left,box.right-point.x,point.y-box.top,box.bottom-point.y);
}
export function nearestLensBoundary<T>(candidates:readonly T[],point:Point,radius:number,geometry:(candidate:T)=>{box:Box;shape:NativeSelectionShape|null}):T|undefined{
 let nearest:T|undefined,distance=radius;
 for(const candidate of candidates){const {box,shape}=geometry(candidate),reach=radius+(shape?.stroke??0)/2;if(point.x<box.left-reach||point.x>box.right+reach||point.y<box.top-reach||point.y>box.bottom+reach)continue;const next=lensBoundaryDistance(point,box,shape);if(next<=distance){if(next<distance||!nearest){nearest=candidate;distance=next;}}}
 return nearest;
}
