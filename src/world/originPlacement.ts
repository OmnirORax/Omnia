import {Plane,Vector3,type Ray} from 'three';
import type {Vec3} from '../core/model.ts';
/** Setting a reference moves the plane itself; it cannot be constrained by it. */
export function originPlacement(ray:Ray,forward:Vector3,center:Vec3,scale:number):Vec3{
 const anchor=new Vector3(...center).multiplyScalar(scale);
 const point=ray.intersectPlane(new Plane().setFromNormalAndCoplanarPoint(forward,anchor),new Vector3())??anchor;
 return point.divideScalar(scale).toArray() as Vec3;
}

export type OriginSetStart={position:Vec3;anchor?:import('../core/model.ts').Origin;right:Vec3;up:Vec3;screen:{x:number;y:number}};
export type OriginSetPlan=Omit<OriginSetStart,'screen'>&{aim?:Vec3};
/** Capture on press, author exactly once on release; cancellation never edits history. */
export function createOriginSetSession(start:OriginSetStart,commit:(plan:OriginSetPlan)=>void){
 const frozen=structuredClone(start);let active=true;
 return {get active(){return active;},cancel(){active=false;},release(target:Vec3,screen:{x:number;y:number}){
  if(!active)return;active=false;const {screen:pressed,...plan}=frozen;
  const moved=Math.hypot(screen.x-pressed.x,screen.y-pressed.y)>=4,distinct=target.some((n,i)=>Math.abs(n-plan.position[i])>1e-7);
  commit({...plan,...(moved&&distinct?{aim:[...target] as Vec3}:{})});
 }};
}
/** Explicit failure lets callers refuse placement instead of silently using the origin. */
export function intersectDrawingPlane(ray:Ray,normal:Vector3,center:Vector3){
 if(Math.abs(ray.direction.dot(normal))<1e-6)return undefined;
 return ray.intersectPlane(new Plane().setFromNormalAndCoplanarPoint(normal,center),new Vector3())??undefined;
}
