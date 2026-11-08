import * as THREE from 'three';
/** Transient construction cursor. Its explicit frame is supplied by the camera adapter, independently of
 * graph selection. No entity, placement or persisted coordinate owner. */
export function createWorldNavigator(){
 const position=new THREE.Vector3(),orientation=new THREE.Quaternion();let initialized=false;
 const normal=()=>new THREE.Vector3(0,0,1).applyQuaternion(orientation);
 const valid=(p:THREE.Vector3)=>[p.x,p.y,p.z].every(Number.isFinite);
 return {position,orientation,normal,forward:()=>normal().negate(),get initialized(){return initialized;},
  reset(){initialized=false;orientation.identity();position.set(0,0,0);},
  initialize(point:THREE.Vector3){if(initialized)return;position.copy(point);initialized=true;},
  plane(){return new THREE.Plane().setFromNormalAndCoplanarPoint(normal(),position);},
  project(ray:THREE.Ray){if(Math.abs(ray.direction.dot(normal()))<1e-9)return undefined;const point=ray.intersectPlane(this.plane(),new THREE.Vector3());return point&&valid(point)?point:undefined;},
  aim(ray:THREE.Ray){const point=this.project(ray);if(!point)return false;position.copy(point);return true;},
  depth(distance:number){if(!initialized||!Number.isFinite(distance))return false;const next=position.clone().addScaledVector(normal(),distance);if(!valid(next))return false;position.copy(next);return true;},
  /** Render-scale changes keep the same logical cursor address. */
  rescale(ratio:number){if(Number.isFinite(ratio)&&ratio>0)position.multiplyScalar(ratio);},
 };
}
