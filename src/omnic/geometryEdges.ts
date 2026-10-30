import type {StructuralNode} from './evaluate.ts';
export const ROTATION_EDGE_PIXELS=8;
type Point={x:number;y:number};
type Box={left:number;top:number;right:number;bottom:number};
type Edge={kind:'line'|'circle';x:number;y:number;x2:number;y2:number;radius:number;stroke:number;fill:boolean;box:Box};
export type GeometryEdges={box:Box;edges?:readonly Edge[];children?:readonly GeometryEdges[]};
/** Snapshot only the selected rendered primitives. Boxes accelerate queries;
 * exact segment/circle distances below determine interaction, never box edges. */
export function prepareGeometryEdges(nodes:readonly StructuralNode[]):GeometryEdges|undefined{
 const edges:Edge[]=nodes.filter(n=>n.kind!=='group'&&n.opacity>0&&(n.thickness>0||n.kind!=='line'&&n.fill&&n.radius>0)).map(n=>{
  const stroke=n.thickness/2,r=n.kind==='line'?stroke:n.radius+stroke,x2=n.x2??n.x,y2=n.y2??n.y;
  return {kind:n.kind==='line'?'line':'circle',x:n.x,y:n.y,x2,y2,radius:n.radius,stroke,fill:n.fill,box:{left:Math.min(n.x,x2)-r,top:Math.min(n.y,y2)-r,right:Math.max(n.x,x2)+r,bottom:Math.max(n.y,y2)+r}};
 });
 const build=(items:Edge[]):GeometryEdges=>{
  const box={left:Math.min(...items.map(e=>e.box.left)),top:Math.min(...items.map(e=>e.box.top)),right:Math.max(...items.map(e=>e.box.right)),bottom:Math.max(...items.map(e=>e.box.bottom))};
  if(items.length<=8)return {box,edges:items};
  const horizontal=box.right-box.left>=box.bottom-box.top;
  items.sort((a,b)=>horizontal?a.x+a.x2-b.x-b.x2:a.y+a.y2-b.y-b.y2);
  const middle=Math.floor(items.length/2);return {box,children:[build(items.slice(0,middle)),build(items.slice(middle))]};
 };
 return edges.length?build(edges):undefined;
}
function distance(point:Point,edge:Edge){
 if(edge.kind==='circle'){
  const d=Math.hypot(point.x-edge.x,point.y-edge.y)-edge.radius;
  return (edge.fill?d:Math.abs(d))-edge.stroke;
 }
 const dx=edge.x2-edge.x,dy=edge.y2-edge.y,length=dx*dx+dy*dy;
 const t=length?Math.max(0,Math.min(1,((point.x-edge.x)*dx+(point.y-edge.y)*dy)/length)):0;
 return Math.hypot(point.x-edge.x-t*dx,point.y-edge.y-t*dy)-edge.stroke;
}
/** Outside visible ink within a constant screen-pixel band. Hollow circle inner
 * edges qualify too. A point inside any selected primitive stays a move grab. */
export function rotationEdgeHit(index:GeometryEdges|undefined,point:Point,scenePerPixel=1):boolean{
 if(!index||!Number.isFinite(scenePerPixel)||scenePerPixel<=0)return false;
 const tolerance=ROTATION_EDGE_PIXELS*scenePerPixel;let near=false,inside=false;
 const visit=(node:GeometryEdges)=>{
  const b=node.box;if(inside||point.x<b.left-tolerance||point.x>b.right+tolerance||point.y<b.top-tolerance||point.y>b.bottom+tolerance)return;
  if(node.children){for(const child of node.children)visit(child);return;}
  for(const edge of node.edges??[]){const d=distance(point,edge);if(d<=0){inside=true;return;}if(d<=tolerance)near=true;}
 };
 visit(index);return near&&!inside;
}
