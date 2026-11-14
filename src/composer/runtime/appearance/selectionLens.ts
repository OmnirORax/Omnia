import type {PatternMode,SelectionRegion} from './selectionGeometry.ts';
import type {Box,Point} from './selectionGeometry.ts';
export const DEFAULT_LENS_RADIUS=18;
export function resizeSelectionLens(radius:number,delta:number){return Math.max(4,Math.min(160,radius*Math.exp(-Math.max(-120,Math.min(120,delta))*.003)));}
export type NativeSelectionShape={tag:string;attributes:Record<string,string>;transform:string;points:Point[];stroke:number;strokeWidth:number;vectorEffect:string;linecap:string;linejoin:string;fillRule:string;fill:boolean;closed:boolean};
const attributes=['d','cx','cy','r','rx','ry','x','y','x1','y1','x2','y2','width','height','points'];
/** Read native geometry once per visual snapshot, never on pointer motion. */
export function nativeSelectionShape(element:Element,sampleOutline=true):NativeSelectionShape|null{
 const geometry=element as SVGGeometryElement;
 if(!['path','circle','ellipse','line','polyline','polygon','rect'].includes(element.localName)||typeof geometry.getTotalLength!=='function')return null;
 const matrix=geometry.getScreenCTM();if(!matrix)return null;
 try{
  const style=getComputedStyle(element),length=sampleOutline?geometry.getTotalLength():0,scale=Math.max(Math.hypot(matrix.a,matrix.b),Math.hypot(matrix.c,matrix.d));
  const count=Math.max(2,Math.min(512,Math.ceil(length*scale/3))),points=sampleOutline?Array.from({length:count+1},(_,i)=>{const p=geometry.getPointAtLength(length*i/count);return{x:matrix.a*p.x+matrix.c*p.y+matrix.e,y:matrix.b*p.x+matrix.d*p.y+matrix.f};}):[];
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

/** A renderer's direct ink hit remains selectable even deep inside a filled
 * shape. The lens reaches nearby boundaries only when no eligible ink was hit. */
export function selectionLensTarget<T>(candidates:readonly T[],point:Point,radius:number,geometry:(candidate:T)=>{box:Box;shape:NativeSelectionShape|null},pointed?:T):T|undefined{
 return pointed!==undefined&&candidates.includes(pointed)?pointed:nearestLensBoundary(candidates,point,radius,geometry);
}

/** Surfaces opt into spatial lens picking; ordinary MS retains its existing modes. */
export function selectionDetectionMode(config:{pattern:PatternMode;contour:boolean;region:SelectionRegion|null},hasScope:boolean,declared:boolean,lens:boolean):PatternMode{
 if(config.pattern==='item'||config.pattern==='continuity')return config.pattern;
 const scalar=config.pattern==='pattern';
 if(lens)return scalar&&!hasScope?'boundary':config.pattern;
 return scalar&&(declared||!hasScope&&!config.contour&&!config.region)?'boundary':config.pattern;
}

/** Geometry edits invalidate the shared snapshot; selection pulse variables do
 * not. Renderer adapters using indirect custom-property geometry may explicitly
 * bump data-selection-geometry-revision instead of measuring during motion. */
export const SELECTION_GEOMETRY_ATTRIBUTES=['d','cx','cy','r','rx','ry','x','y','x1','y1','x2','y2','width','height','points','transform','viewBox','stroke','stroke-width','stroke-linecap','stroke-linejoin','vector-effect','fill','fill-rule','opacity','fill-opacity','stroke-opacity','clip-path','data-selection-geometry-revision','data-selection-disc'] as const;
const geometryStyles=new Set(['transform','translate','scale','rotate','display','visibility','position','left','right','top','bottom','width','height','padding','margin','stroke','stroke-width','stroke-linecap','stroke-linejoin','vector-effect','fill','fill-rule','opacity','fill-opacity','stroke-opacity','clip-path']);
export function selectionGeometryStyleChanged(before:string,after:string){
 const signature=(style:string)=>[...style.matchAll(/(?:^|;)\s*([\w-]+)\s*:\s*([^;]*)/g)].filter(match=>geometryStyles.has(match[1])).map(match=>`${match[1]}:${match[2].trim()}`).sort().join(';');
 return signature(before)!==signature(after);
}
