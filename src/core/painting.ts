import {createOccupancy} from '../graph/occupancy.ts';
import {brushShape,SINGLE_BRUSH} from './brush.ts';
import {activeWorldAxes,axisAnchor,axisCenter,minus,plus,times,dot,type AxisFrame} from './axes.ts';
import {address,point} from './lattice.ts';
import type {Vec3,World} from './model.ts';
export function createPaintSession(world:World,origin:Vec3,basis:[Vec3,Vec3,Vec3],frame?:AxisFrame,plane=2,_planes=false,planeDepth?:number,index?:ReturnType<typeof createOccupancy>){
 const shape=brushShape(world.brush??SINGLE_BRUSH),occupied=index??createOccupancy(world.nodes.map(node=>[address(node.origin),point(node.position)] as const)),pending=createOccupancy([]),seen=new Set<string>(),points:Vec3[]=[];
 const start=frame?(frame.directed||frame.origin?axisCenter(world,frame):axisAnchor(world,frame)):origin,center=frame?axisCenter(world,frame):origin;
 const selected=frame?activeWorldAxes(frame):undefined;
 const offsets=shape.points.filter(p=>!selected||p.every((n,i)=>selected.includes(i)||n===0)).map(p=>plus(times(basis[0],p[0]),plus(times(basis[1],p[1]),times(basis[2],p[2]))));
 const pointKey=(p:Vec3)=>p.map(n=>Math.round(n*1e7)).join(','),indices=new Map<string,number>();
 function candidate(position:Vec3){
  const d=minus(position,start),coordinates=basis.map(v=>dot(d,v)),slot=coordinates.map((n,i)=>Math.round(n/shape.pitch[i])*shape.pitch[i]);
  if(frame){const middle=basis.map(v=>dot(minus(center,start),v));for(let i=0;i<3;i++)if(!selected!.includes(i))slot[i]=middle[i];}
  else slot[plane]=planeDepth??dot(minus(center,start),basis[plane]);
  const anchor=plus(start,plus(times(basis[0],slot[0]),plus(times(basis[1],slot[1]),times(basis[2],slot[2])))),stamp=offsets.map(offset=>plus(anchor,offset));
  const fresh=stamp.filter(p=>!seen.has(pointKey(p)));
  const valid=(!selected||selected.length>0)&&stamp.length>0&&world.nodes.length+points.length+fresh.length<=4000&&stamp.every(p=>occupied.free(point(p))&&(seen.has(pointKey(p))||pending.free(point(p))));
  return {anchor,stamp,fresh,valid};
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
