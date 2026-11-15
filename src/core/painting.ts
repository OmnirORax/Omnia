import {createOccupancy} from '../graph/occupancy.ts';
import {brushShape,SINGLE_BRUSH} from './brush.ts';
import {axisAnchor,axisCenter,minus,plus,times,dot,type AxisFrame} from './axes.ts';
import {address,point} from './lattice.ts';
import type {Vec3,World} from './model.ts';
export function createPaintSession(world:World,origin:Vec3,basis:[Vec3,Vec3,Vec3],frame?:AxisFrame,plane=2,planes=false,planeDepth?:number,index?:ReturnType<typeof createOccupancy>){
 const shape=brushShape(world.brush??SINGLE_BRUSH),occupied=index??createOccupancy(world.nodes.map(node=>[address(node.origin),point(node.position)] as const)),pending=createOccupancy([]),seen=new Set<string>(),points:Vec3[]=[];
 const start=frame?axisAnchor(world,frame):origin,center=frame?axisCenter(world,frame):origin;
 const offsets=shape.points.map(p=>plus(times(basis[0],p[0]),plus(times(basis[1],p[1]),times(basis[2],p[2]))));
 function candidate(position:Vec3){
  const d=minus(position,start),coordinates=basis.map(v=>dot(d,v)),slot=coordinates.map((n,i)=>Math.round(n/shape.pitch[i])*shape.pitch[i]);
  if(frame&&!planes){const relative=basis.map(v=>dot(minus(position,center),v)),axis=relative.map(Math.abs).indexOf(Math.max(...relative.map(Math.abs))),middle=basis.map(v=>dot(minus(center,start),v));for(let i=0;i<3;i++)if(i!==axis)slot[i]=middle[i];}
  else slot[plane]=planeDepth??dot(minus(center,start),basis[plane]);
  const anchor=plus(start,plus(times(basis[0],slot[0]),plus(times(basis[1],slot[1]),times(basis[2],slot[2])))),stamp=offsets.map(offset=>plus(anchor,offset));
  const fresh=stamp.filter(p=>!seen.has(p.map(n=>Math.round(n*1e7)).join(',')));
  const valid=world.nodes.length+points.length+fresh.length<=4000&&stamp.every(p=>occupied.free(point(p))&&(seen.has(p.map(n=>Math.round(n*1e7)).join(','))||pending.free(point(p))));
  return {anchor,stamp,fresh,valid};
 }
 return {points,pitch:shape.pitch,candidate,add(position:Vec3){const next=candidate(position);if(!next.valid)return false;for(const p of next.fresh){seen.add(p.map(n=>Math.round(n*1e7)).join(','));points.push(p);pending.add(String(points.length),point(p));}return true;}};
}
