import {Plane,Vector3,type Ray} from 'three';
import type {Vec3} from '../core/model.ts';
/** Setting a reference moves the plane itself; it cannot be constrained by it. */
export function originPlacement(ray:Ray,forward:Vector3,center:Vec3,scale:number):Vec3{
 const anchor=new Vector3(...center).multiplyScalar(scale);
 const point=ray.intersectPlane(new Plane().setFromNormalAndCoplanarPoint(forward,anchor),new Vector3())??anchor;
 return point.divideScalar(scale).toArray() as Vec3;
}
