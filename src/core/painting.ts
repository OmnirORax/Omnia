import {prepareOriginDirections} from './originDirections.ts';
import {snapSlots} from './planePacking.ts';
import {createOccupancy} from '../graph/occupancy.ts';
import {brushShape,SINGLE_BRUSH} from './brush.ts';
import {activeWorldAxes,axisAnchor,axisCenter,minus,plus,times,dot,type AxisFrame} from './axes.ts';
import {address,point} from './lattice.ts';
import type {Vec3,World} from './model.ts';
export function createPaintSession(world:World,origin:Vec3,basis:[Vec3,Vec3,Vec3],frame?:AxisFrame,plane=2,_planes=false,planeDepth?:number,index?:ReturnType<typeof createOccupancy>,projectionValid?:()=>boolean){
 const shape=brushShape(world.brush??SINGLE_BRUSH),occupied=index??createOccupancy(world.nodes.map(node=>[address(node.origin),point(node.position)] as const)),pending=createOccupancy([]),seen=new Set<string>(),points:Vec3[]=[];
 const start=frame?(frame.directed||frame.origin||frame.packing==='hex'?axisCenter(world,frame):axisAnchor(world,frame)):origin,center=frame?axisCenter(world,frame):origin;
 const selected=frame?activeWorldAxes(frame):undefined;
 const offsets=shape.points.filter(p=>!selected||p.every((n,i)=>selected.includes(i)||n===0)).map(p=>plus(times(basis[0],p[0]),plus(times(basis[1],p[1]),times(basis[2],p[2]))));
 const directional=frame&&prepareOriginDirections(world,frame);
 const pointKey=(p:Vec3)=>p.map(n=>Math.round(n*1e7)).join(','),indices=new Map<string,number>();
 function candidate(position:Vec3){
  if(projectionValid&&!projectionValid())return {anchor:center,stamp:[] as Vec3[],fresh:[] as Vec3[],valid:false,rejection:'Cannot project onto the drawing plane. Press P to face it.'};
  const d=minus(position,start),coordinates=basis.map(v=>dot(d,v)),slot=snapSlots(coordinates as Vec3,selected??[0,1,2].filter(i=>i!==plane),frame?.packing==='hex'&&shape.points.length===1,shape.pitch);
  if(frame){const middle=basis.map(v=>dot(minus(center,start),v));for(let i=0;i<3;i++)if(!selected!.includes(i))slot[i]=middle[i];}
  else slot[plane]=planeDepth??dot(minus(center,start),basis[plane]);
  const base=plus(start,plus(times(basis[0],slot[0]),plus(times(basis[1],slot[1]),times(basis[2],slot[2])))),plan=directional?.(position,offsets),anchor=plan?.anchor??base,stamp=[...new Map((plan?.stamp??offsets.map(offset=>plus(anchor,offset))).map(p=>[pointKey(p),p])).values()];
  const fresh=stamp.filter(p=>!seen.has(pointKey(p)));
  const internal=directional?createOccupancy([]):undefined;let fits=true;if(internal)for(const p of stamp){if(!internal.free(point(p))){fits=false;break;}internal.add(pointKey(p),point(p));}
  const valid=fits&&(!selected||selected.length>0)&&stamp.length>0&&world.nodes.length+points.length+fresh.length<=4000&&stamp.every(p=>occupied.free(point(p))&&(seen.has(pointKey(p))||pending.free(point(p))));
  const rejection=valid?undefined:plan?.rejection??(!fits?'Symmetry copies overlap each other.':!stamp.length?'Enable a placement direction.':world.nodes.length+points.length+fresh.length>4000?'The node limit is 4000.':'Placement overlaps an existing node or pending brush position.');
  return {anchor,stamp,fresh,valid,rejection};
 }
 let lastSlot:string|undefined;
 const add=(position:Vec3)=>{const next=candidate(position);if(!next.valid)return false;for(const p of next.fresh){seen.add(pointKey(p));indices.set(pointKey(p),points.length);points.push(p);pending.add(pointKey(p),point(p));}return true;};
 return {points,pitch:shape.pitch,candidate,add,toggle(position:Vec3){
  const next=candidate(position),slot=next.anchor.map(n=>Math.round(n*1e7)).join(',');
  if(slot===lastSlot)return false;lastSlot=slot;
  if(next.stamp.length&&next.stamp.every(p=>seen.has(pointKey(p)))){
   for(const p of next.stamp){const id=pointKey(p),index=indices.get(id)!;pending.remove(id,point(p));seen.delete(id);indices.delete(id);const last=points.pop()!;if(index<points.length){points[index]=last;indices.set(pointKey(last),index);}}
   return true;
  }
  return add(position);
 }};
}
