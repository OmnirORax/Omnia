import {inkBounds,inkFullyInside,visibleInkTouches} from '../appearance/geometryRelations.ts';
import {intersectRegionClips,mapRegionShape,readRegionShape,regionDiscBounds,type RegionDisc,type ShapePoint} from '../properties/regionShape.ts';
import type {StructuralNode,Evaluation} from './evaluate.ts';
import {componentIndex} from './componentTargets.ts';
import type {Recipe} from './model.ts';
export type RegionFrame={x:number;y:number;angle:number;scale:number};
export type LegacyRegionAttachment={owner:string;shape:RegionDisc[]};
export function nodeRegionBounds(node:StructuralNode){
 if(node.clip)return regionDiscBounds({x:node.x,y:node.y,radius:node.radius,clip:node.clip});
 const r=node.radius+node.thickness/2;return {left:Math.min(node.x-r,(node.x2??node.x)-node.thickness/2),right:Math.max(node.x+r,(node.x2??node.x)+node.thickness/2),top:Math.min(node.y-r,(node.y2??node.y)-node.thickness/2),bottom:Math.max(node.y+r,(node.y2??node.y)+node.thickness/2)};
}
export function regionFrame(root:StructuralNode,nodes:readonly StructuralNode[]):RegionFrame|undefined{
 const angle=root.orientation??0,origin={x:root.x,y:root.y},local=(p:ShapePoint)=>{const a=-angle*Math.PI/180,x=p.x-origin.x,y=p.y-origin.y;return {x:x*Math.cos(a)-y*Math.sin(a),y:x*Math.sin(a)+y*Math.cos(a)};};
 const boxes=nodes.filter(n=>!n.regionAttachment&&n.kind!=='group').flatMap(n=>{
  const center=local(n),box=n.kind==='line'?inkBounds({ink:[{outer:{kind:'capsule',a:center,b:local({x:n.x2??n.x,y:n.y2??n.y}),radius:0}}]}):n.clip?regionDiscBounds({...center,radius:n.radius,clip:n.clip.map(local)}):{left:center.x-n.radius,right:center.x+n.radius,top:center.y-n.radius,bottom:center.y+n.radius};return box?[box]:[];
 });
 if(!boxes.length)return;
 const scale=Math.max(Math.max(...boxes.map(b=>b.right))-Math.min(...boxes.map(b=>b.left)),Math.max(...boxes.map(b=>b.bottom))-Math.min(...boxes.map(b=>b.top)));
 return scale>0?{...origin,angle,scale}:undefined;
}
export function regionShapeInFrame(units:readonly RegionDisc[],frame:RegionFrame,inverse=false){
 const angle=(inverse?-frame.angle:frame.angle)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),scale=inverse?1/frame.scale:frame.scale;
 return mapRegionShape(units,p=>{const x=inverse?p.x-frame.x:p.x*scale,y=inverse?p.y-frame.y:p.y*scale;return inverse?{x:(x*c-y*s)*scale,y:(x*s+y*c)*scale}:{x:frame.x+x*c-y*s,y:frame.y+x*s+y*c};},scale);
}
/** Snapshot actual area intersections, never the region's bounding rectangle. */
export function filledRegionShape(nodes:readonly StructuralNode[],points:readonly ShapePoint[]):RegionDisc[]{
 const discs=nodes.filter(n=>n.kind==='dot'||n.kind==='ring').flatMap(n=>{
  const clip=n.clip?intersectRegionClips(points,n.clip):points.map(p=>({...p}));if(clip.length<3)return [];
  const disc={x:n.x,y:n.y,radius:n.radius,clip,color:n.color,opacity:n.opacity},bounds=regionDiscBounds(disc);
  return bounds&&bounds.right-bounds.left>1e-9&&bounds.bottom-bounds.top>1e-9?[disc]:[];
 });
 const contained=(a:RegionDisc,b:RegionDisc)=>{const geometry={ink:[{outer:{kind:'circle' as const,center:{x:a.x,y:a.y},radius:a.radius,clip:a.clip}}]};return inkFullyInside(geometry,{kind:'circle',center:{x:b.x,y:b.y},radius:b.radius})&&inkFullyInside(geometry,{kind:'polygon',points:b.clip});};
 return discs.filter((a,i)=>!discs.some((b,j)=>i!==j&&a.color===b.color&&a.opacity===b.opacity&&contained(a,b)&&(!contained(b,a)||j<i)));
}
/** One compatibility step at the recipe owner: preserve old clipped paint in the
 * owner's frame BEFORE an edit moves its geometry. Originals remain in history.
 * Multiple legacy targets retain their existing per-owner paint provenance. */
export function preserveLegacyRegionFills(before:Recipe,next:Recipe,evaluation:Evaluation):Recipe{
 if(!evaluation.legacyRegionAttachments)return next;
 const old=new Map(before.operations.filter(op=>op.operator==='fill'&&op.params.clipped&&!op.params.attachment).map(op=>[op.id,op]));
 if(!old.size)return next;
 const used=new Set([...next.operations.map(o=>o.id),...componentIndex(next).keys(),...next.frames.map(f=>f.id)]);
 const operations=next.operations.flatMap(op=>{
  const prior=old.get(op.id),attachments=evaluation.legacyRegionAttachments?.[op.id];
  if(!prior||!attachments?.length||JSON.stringify(prior.params)!==JSON.stringify(op.params)||JSON.stringify(prior.targets)!==JSON.stringify(op.targets))return [op];
  return attachments.map((attachment,i)=>{let id=op.id;if(i){let n=i;do{id=`${op.id.slice(0,150)}:region:${n++}`;}while(used.has(id));used.add(id);}
   const shape=readRegionShape(JSON.stringify(attachment.shape));return {...op,id,targets:[attachment.owner],params:{...op.params,fill:true,attachment:true,shape:JSON.stringify(shape)}};
  });
 });
 return operations.some((op,i)=>op!==next.operations[i])||operations.length!==next.operations.length?{...next,operations}:next;
}

export type FillMode='continuous'|'object';
export function prepareRegionFill(snapshot:Evaluation,nodes:readonly StructuralNode[],points:readonly ShapePoint[],owner?:string){
 const units=filledRegionShape(nodes,points);if(!units.length)throw Error('The region does not intersect a closed target.');
 if(owner){const root=snapshot.nodes.find(node=>node.id===owner&&node.kind==='group');if(!root)throw Error('Choose an attachment owner.');
  const byId=new Map(snapshot.nodes.map(n=>[n.id,n])),inside=(node:StructuralNode)=>{let current:StructuralNode|undefined=node;for(let depth=0;current&&depth<64;depth++){if(current.id===root.id)return true;current=current.parent?byId.get(current.parent):undefined;}return false;};
  const frame=regionFrame(root,snapshot.nodes.filter(inside));if(!frame)throw Error('No attachment frame.');
  return {shape:regionShapeInFrame(units.map(unit=>({...unit,opacity:Math.min(1,unit.opacity/(root.opacity||1))})),frame,true),owner};
 }
 const boxes=units.map(unit=>regionDiscBounds(unit)!),x=(Math.min(...boxes.map(b=>b.left))+Math.max(...boxes.map(b=>b.right)))/2,y=(Math.min(...boxes.map(b=>b.top))+Math.max(...boxes.map(b=>b.bottom)))/2;
 return {shape:mapRegionShape(units,p=>({x:p.x-x,y:p.y-y})),x,y};
}

/** Multiple contributors never imply a merge owner. The selector continuation
 * supplies the explicit choice; a sole contributor is unambiguous. */
export function resolveFillAttachment(ids:readonly string[],chosen?:string){const unique=[...new Set(ids)];return unique.length===1?unique[0]:chosen&&unique.includes(chosen)?chosen:undefined;}

/** Model adapter into the same contact kernel used by MS. Ownership remains a
 * separate decision: it is never inferred from containment or matching paint. */
export function structuralRegionInk(node:StructuralNode):import('../appearance/geometryRelations.ts').RelationGeometry{
 if(node.opacity<=0||node.kind==='group')return {ink:[]};
 if(node.kind==='line'){
  const a={x:node.x,y:node.y},b={x:node.x2??node.x,y:node.y2??node.y},radius=node.thickness/2;
  if(radius<=0)return {ink:[]};
  if(node.cap!=='butt')return {ink:[{outer:{kind:'capsule',a,b,radius}}]};
  const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);if(!length)return {ink:[]};
  const nx=-dy/length*radius,ny=dx/length*radius;
  return {ink:[{outer:{kind:'polygon',points:[{x:a.x+nx,y:a.y+ny},{x:b.x+nx,y:b.y+ny},{x:b.x-nx,y:b.y-ny},{x:a.x-nx,y:a.y-ny}]}}]};
 }
 const center={x:node.x,y:node.y},stroke=node.thickness/2,ink:import('../appearance/geometryRelations.ts').InkPiece[]=[];
 if(node.fill||stroke>0)ink.push({outer:{kind:'circle',center,radius:node.radius+stroke,...(node.clip?{clip:node.clip}:{})},...(!node.fill&&node.radius>stroke?{hole:{center,radius:node.radius-stroke}}:{})});
 for(const region of node.fillRegions??[])if(region.opacity>0)ink.push({outer:{kind:'circle',center,radius:node.radius,clip:region.points}});
 return {ink,...(node.radius>stroke?{enclosure:{kind:'circle' as const,center,radius:node.radius-stroke,...(node.clip?{clip:node.clip}:{})}}:{})};
}
export function regionAttachmentCandidates(snapshot:Evaluation,owners:ReadonlyMap<string,string>,ids:readonly string[],shape:readonly RegionDisc[]){
 const area={ink:shape.map(unit=>({outer:{kind:'circle' as const,center:{x:unit.x,y:unit.y},radius:unit.radius,clip:unit.clip}}))},eligible=new Set(ids),touched=new Set<string>();
 for(const node of snapshot.nodes){const owner=owners.get(node.id);if(!owner||!eligible.has(owner)||touched.has(owner))continue;if(visibleInkTouches(area,structuralRegionInk(node)))touched.add(owner);}
 return ids.filter(id=>touched.has(id));
}
