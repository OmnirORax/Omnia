import {readRegionShape} from '../properties/regionShape.ts';
import {nativeSelectionShape,type NativeSelectionShape} from './selectionLens.ts';
import {convexPolygon,inkSupport,type RelationGeometry,type ConvexInk,type InkPiece} from './geometryRelations.ts';
import type {Point} from './selectionGeometry.ts';
const numeric=(value:string|undefined)=>Number(value??0);
function coordinates(value:string){const values=value.trim().split(/[\s,]+/).map(Number);return values.length%2||values.some(n=>!Number.isFinite(n))?[]:Array.from({length:values.length/2},(_,i)=>({x:values[i*2],y:values[i*2+1]}));}
/** Native shape adapters supply geometry only; all relation/selection policy is
 * shared. Unsupported geometry must not silently become a filled bounding box. */
export function geometryFromNative(shape:NativeSelectionShape,clip?:readonly Point[]):RelationGeometry|undefined{
 if(Object.entries(shape.attributes).some(([key,value])=>['cx','cy','r','x','y','x1','y1','x2','y2','width','height','rx','ry'].includes(key)&&!Number.isFinite(Number(value))))return;
 const matrix=shape.transform.match(/^matrix\(([^)]+)\)$/)?.[1].split(/[\s,]+/).map(Number);if(!matrix||matrix.length!==6||matrix.some(n=>!Number.isFinite(n)))return;
 const [a,b,c,d,e,f]=matrix,sx=Math.hypot(a,b),sy=Math.hypot(c,d);
 if(!sx||Math.abs(sx-sy)>1e-7*Math.max(sx,sy)||Math.abs(a*c+b*d)>1e-7*sx*sy)return;
 const point=(p:Point)=>({x:a*p.x+c*p.y+e,y:b*p.x+d*p.y+f}),p=shape.attributes,half=shape.stroke/2;
 if(shape.tag==='circle'){
  const center=point({x:numeric(p.cx),y:numeric(p.cy)}),radius=numeric(p.r)*sx;
  if(radius<=0||!shape.fill&&!half)return;
  const outer:ConvexInk={kind:'circle',center,radius:radius+half,...(clip?{clip:clip.map(point)}:{})};
  if(!inkSupport(outer,{x:1,y:0}))return;
  return {ink:[{outer,...(!shape.fill&&radius>half?{hole:{center,radius:radius-half}}:{})}],enclosure:clip&&shape.fill&&!half?outer:!clip&&radius>half?{kind:'circle',center,radius:radius-half}:undefined};
 }
 if(clip)return;
 if(shape.tag==='line'){
  if(!half)return;const start=point({x:numeric(p.x1),y:numeric(p.y1)}),end=point({x:numeric(p.x2),y:numeric(p.y2)});
  if(shape.linecap==='round')return {ink:[{outer:{kind:'capsule',a:start,b:end,radius:half}}]};
  const dx=end.x-start.x,dy=end.y-start.y,length=Math.hypot(dx,dy);if(!length)return;
  const nx=-dy/length*half,ny=dx/length*half,extension=shape.linecap==='square'?half:0,ex=dx/length*extension,ey=dy/length*extension;
  return {ink:[{outer:{kind:'polygon',points:[{x:start.x-ex+nx,y:start.y-ey+ny},{x:end.x+ex+nx,y:end.y+ey+ny},{x:end.x+ex-nx,y:end.y+ey-ny},{x:start.x-ex-nx,y:start.y-ey-ny}]}}]};
 }
 if(shape.tag==='rect'){
  if(numeric(p.rx)||numeric(p.ry)||!shape.fill&&!half)return;
  const x=numeric(p.x),y=numeric(p.y),width=numeric(p.width),height=numeric(p.height),h=half/sx;if(width<=0||height<=0)return;
  const rectangle=(left:number,top:number,right:number,bottom:number):ConvexInk=>({kind:'polygon',points:[{x:left,y:top},{x:right,y:top},{x:right,y:bottom},{x:left,y:bottom}].map(point)});
  const outer=rectangle(x-h,y-h,x+width+h,y+height+h);
  const ink:InkPiece[]=shape.fill||width<=2*h||height<=2*h?[{outer}]:[{outer:rectangle(x-h,y-h,x+width+h,y+h)},{outer:rectangle(x-h,y+height-h,x+width+h,y+height+h)},{outer:rectangle(x-h,y+h,x+h,y+height-h)},{outer:rectangle(x+width-h,y+h,x+width+h,y+height-h)}];
  return {ink,enclosure:width>2*h&&height>2*h?rectangle(x+h,y+h,x+width-h,y+height-h):undefined};
 }
 if(shape.tag==='polygon'){
  const points=coordinates(p.points??'').map(point);if(points.length>128||!convexPolygon(points)||half&&shape.linejoin!=='round')return;
  const ink:InkPiece[]=shape.fill?[{outer:{kind:'polygon',points}}]:[];
  if(half)for(let i=0;i<points.length;i++)ink.push({outer:{kind:'capsule',a:points[i],b:points[(i+1)%points.length],radius:half}});
  return ink.length?{ink,enclosure:!half?{kind:'polygon',points}:undefined}:undefined;
 }
}
export const selectionPaintVisible=(paint:string)=>paint!=='none'&&paint!=='transparent'&&!/^rgba\([^)]*,\s*0(?:\.0*)?\s*\)$/.test(paint)&&!/\/\s*0(?:\.0*)?%?\s*\)$/.test(paint);
/** Additive ink is declared by the renderer under the same boundary identity.
 * This includes clipped paint without treating its enclosing rectangle as ink. */
export function nativeRelationGeometry(element:Element,shape:(element:Element)=>NativeSelectionShape|null):RelationGeometry|undefined{
 if(!shape(element))return;
 const scope=element.closest('[data-selection-scope]');
 for(let node:Element|null=element;node&&node!==scope;node=node.parentElement)if(Number(getComputedStyle(node).opacity||1)===0)return;
 const read=(node:Element)=>{
  const native=node===element?shape(node):nativeSelectionShape(node,false);if(!native)return;
  const style=getComputedStyle(node),copy={...native,fill:native.fill&&selectionPaintVisible(style.fill)&&Number(style.fillOpacity||1)>0,stroke:!selectionPaintVisible(style.stroke)||Number(style.strokeOpacity||1)===0?0:native.stroke};
  let clip:Point[]|undefined;
  if(style.clipPath&&style.clipPath!=='none'){
   const id=style.clipPath.match(/#([^)'"\s]+)/)?.[1],host=id&&node.ownerDocument.getElementById(id);
   if(!host||host.localName!=='clipPath'||host.getAttribute('clipPathUnits')!=='userSpaceOnUse'||host.children.length!==1||host.children[0].localName!=='polygon'||host.hasAttribute('transform')||host.children[0].hasAttribute('transform'))return;
   clip=coordinates(host.children[0].getAttribute('points')??'');if(!convexPolygon(clip))return;
  }
  const encoded=node.getAttribute('data-selection-disc');
  if(encoded){try{const units=readRegionShape(encoded);if(units.length!==1)return;const disc=units[0];return geometryFromNative({...copy,tag:'circle',attributes:{cx:String(disc.x),cy:String(disc.y),r:String(disc.radius)}},disc.clip);}catch{return;}}
  return geometryFromNative(copy,clip);
 };
 const base=read(element);if(!base)return;
 const owner=element.parentElement;
 if(owner?.hasAttribute('data-selection-boundary')&&owner.getAttribute('data-selection-id')===element.getAttribute('data-selection-id')){
  for(const extra of owner.querySelectorAll('[data-selection-ink]')){
   if(Number(getComputedStyle(extra).opacity||1)===0)continue;const geometry=read(extra);if(!geometry)return;else base.ink=[...base.ink,...geometry.ink];
  }
 }
 return base;
}
