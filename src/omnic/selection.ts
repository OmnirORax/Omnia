import {targetNodes} from './contextGeometry.ts';
import {prepareConnectedInk,inkFullyInside,convexPolygon} from '../appearance/geometryRelations.ts';
import {lineBoxInterval,lineDomain,pathTouchesBox,type PatternMode,type SelectionRegion,type Point,type Box} from '../appearance/selectionGeometry.ts';
import {matchingProperties,rankedPropertyPatterns,type PropertyCriterion,type PatternObject} from '../appearance/propertyPatterns.ts';
import {structuralRegionInk,nodeRegionBounds} from './fillRegion.ts';
import {pickStructuralNode} from './svg.ts';
import type {Evaluation} from './evaluate.ts';
export type GeometrySelection={mode:PatternMode;region:SelectionRegion;contour:boolean;bounded:boolean;rotation:number;criteria:PropertyCriterion[];scope?:readonly string[]};
export const defaultGeometrySelection=():GeometrySelection=>({mode:'item',region:'inside',contour:true,bounded:false,rotation:0,criteria:[]});
/** Same evaluated-ink, connected-set, line, path and property rules as V1.
 * One immutable snapshot per gesture; no DOM discovery or image analysis. */
export function prepareGeometrySelection(evaluation:Evaluation,config:GeometrySelection){
 const allowed=config.scope&&new Set(targetNodes(evaluation,config.scope).map(n=>n.id)),nodes=evaluation.nodes.filter(n=>n.kind!=='group'&&(!allowed||allowed.has(n.id))),byId=new Map(nodes.map(n=>[n.id,n]));
 const objects:PatternObject[]=nodes.map(node=>({id:node.id,values:{kind:node.kind,color:node.color,opacity:node.opacity,radius:node.radius,thickness:node.thickness,fill:node.fill,orientation:node.orientation??0}}));
 const connected=config.mode==='continuity'?prepareConnectedInk(nodes.map(node=>({key:node.id,scope:evaluation,geometry:structuralRegionInk(node)}))):undefined;
 function pick(start:Point,end=start,path:readonly Point[]=[]):Set<string>{
  if(connected&&!connected.complete)throw Error('Connected selection exceeds its geometry budget. Narrow the scope.');
  const hit=pickStructuralNode(nodes,start),samples=['polygon','freehand'].includes(config.mode)&&path.length?path:[start,end],b=({left:Math.min(...samples.map(p=>p.x)),right:Math.max(...samples.map(p=>p.x)),top:Math.min(...samples.map(p=>p.y)),bottom:Math.max(...samples.map(p=>p.y))}),angle=config.rotation*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),finish={x:start.x+(end.x-start.x)*c-(end.y-start.y)*s,y:start.y+(end.x-start.x)*s+(end.y-start.y)*c};
  let matches:string[]=[];
  if(config.mode==='item')matches=hit?[hit.id]:[];
  else if(config.mode==='pattern')matches=matchingProperties(objects,config.criteria);
  else if(config.mode==='continuity')matches=hit?[...(connected!.groups.get(hit.id)??[])]:[];
  else if(config.mode==='boundary'){
   const enclosure=hit&&structuralRegionInk(hit).enclosure;
   matches=nodes.filter(node=>node===hit?config.contour:enclosure&&(config.region==='both'||inkFullyInside(structuralRegionInk(node),enclosure)===(config.region==='inside'))).map(n=>n.id);
  }else if(['axis','direction','position'].includes(config.mode)){
   const domain=lineDomain({mode:config.mode as 'axis'|'direction'|'position',bounded:config.bounded});matches=config.contour?nodes.filter(node=>{const bounds=nodeRegionBounds(node);return bounds&&lineBoxInterval(start,finish,bounds,domain);}).map(n=>n.id):[];
  }else{
   const box:Box={left:b.left,top:b.top,right:b.right,bottom:b.bottom},width=box.right-box.left||1,height=box.bottom-box.top||1;
   const points=config.mode==='rectangle'?[{x:0,y:0},{x:1,y:1}]:config.mode==='ellipse'?[{x:0,y:0},{x:1,y:1}]:path.map(p=>({x:(p.x-box.left)/width,y:(p.y-box.top)/height}));
   const shape={kind:config.mode as 'rectangle'|'ellipse'|'polygon'|'freehand',points,closed:config.mode!=='freehand',rotation:config.rotation};
   const absolute=path.length>=3?path:[];
   matches=nodes.filter(node=>{const bounds=nodeRegionBounds(node);if(!bounds)return false;if(config.mode==='polygon'&&config.region==='inside'&&!config.contour&&convexPolygon(absolute))return inkFullyInside(structuralRegionInk(node),{kind:'polygon',points:absolute});return pathTouchesBox(shape,box,bounds,config.contour,config.region);}).map(n=>n.id);
  }
  if(config.criteria.length&&config.mode!=='pattern'){const matching=new Set(matchingProperties(objects,config.criteria));matches=matches.filter(id=>matching.has(id));}
  return new Set(matches.filter(id=>byId.has(id)));
 }
 return {pick,nodes,patterns:(id:string)=>{const target=objects.find(o=>o.id===id);return target?rankedPropertyPatterns(objects,target):[];}};
}
export function combineGeometrySelection(current:ReadonlySet<string>,incoming:ReadonlySet<string>,mode:'replace'|'include'|'exclude'|'intersect'|'toggle'){
 if(mode==='replace')return new Set(incoming);if(mode==='include')return new Set([...current,...incoming]);if(mode==='exclude')return new Set([...current].filter(id=>!incoming.has(id)));if(mode==='intersect')return new Set([...current].filter(id=>incoming.has(id)));return new Set([...current].filter(id=>!incoming.has(id)).concat([...incoming].filter(id=>!current.has(id))));
}
