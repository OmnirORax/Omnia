import {type Origin,type Vec3,type World} from './model.ts';
import {address} from './lattice.ts';
import {createOccupancy} from '../graph/occupancy.ts';
import {activeWorldAxes,axisPoint,operationSlot,minus,plus,times,dot} from './axes.ts';
export function groupTargets(world:World,ids:readonly Origin[],origin:Vec3,destination:Vec3){
 const frame=world.axes?.find(f=>f.id===world.activeAxis),landing=frame?axisPoint(world,frame,operationSlot(world,frame,destination)):destination,delta=minus(landing,origin);
 const selected=new Set(ids.map(address));return {origin:landing,targets:new Map(world.nodes.filter(n=>selected.has(address(n.origin))).map(n=>[address(n.origin),plus(n.position,delta)]))};
}
export function alignmentTargets(world:World,ids:readonly Origin[],origin:Vec3,direction:Vec3,order:Vec3,interval=1){
 if(!Number.isInteger(interval)||interval<1||interval>10000)throw Error('Use a whole interval of at least 1.');
 const frame=world.axes?.find(f=>f.id===world.activeAxis);if(frame){const bases=[frame.x,frame.y,frame.z];direction=activeWorldAxes(frame).reduce((v,i)=>plus(v,times(bases[i],dot(direction,bases[i]))),[0,0,0] as Vec3);}
 const length=Math.hypot(...direction);if(length<1e-8)throw Error('Choose an alignment direction.');const axis=times(direction,1/length);
 const nodes=new Map(world.nodes.map(n=>[address(n.origin),n]));const sorted=ids.map((id,index)=>({id,index,projection:dot(nodes.get(address(id))!.position,order)})).sort((a,b)=>a.projection-b.projection||a.index-b.index);
 return new Map(sorted.map(({id},i)=>[address(id),plus(origin,times(axis,(i-Math.floor(sorted.length/2))*interval))]));
}
export function validGroupTargets(world:World,targets:ReadonlyMap<string,Vec3>){
 const occupied=createOccupancy(world.nodes.filter(n=>!targets.has(address(n.origin))).map(n=>[address(n.origin),{x:n.position[0],y:n.position[1],z:n.position[2]}] as const));
 for(const [id,p]of targets){if(!p.every(n=>Number.isFinite(n)&&Math.abs(n)<=1e7)||!occupied.free({x:p[0],y:p[1],z:p[2]}))return false;occupied.add(id,{x:p[0],y:p[1],z:p[2]});}return true;
}
export function applyGroupTargets(world:World,targets:ReadonlyMap<string,Vec3>){if(!validGroupTargets(world,targets))throw Error('The group overlaps another node.');for(const n of world.nodes){const p=targets.get(address(n.origin));if(p)n.position=[...p];}}
export function insideSelectionBox(position:Vec3,center:Vec3,right:Vec3,up:Vec3,forward:Vec3,a:Vec3,b:Vec3,depth:number){const p=minus(position,center),x=dot(p,right),y=dot(p,up);return x>=Math.min(a[0],b[0])-1e-7&&x<=Math.max(a[0],b[0])+1e-7&&y>=Math.min(a[1],b[1])-1e-7&&y<=Math.max(a[1],b[1])+1e-7&&Math.abs(dot(p,forward))<=depth/2+1e-7;}

export function selectionCenter(world:World,ids:readonly Origin[]):Vec3{
 const selected=new Set(ids.map(address)),sum:Vec3=[0,0,0];let count=0;
 for(const node of world.nodes)if(selected.has(address(node.origin))){count++;for(let i=0;i<3;i++)sum[i]+=node.position[i];}
 if(!count)throw Error('Select a node first.');return times(sum,1/count);
}
