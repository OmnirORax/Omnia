import * as T from 'three';
import type {AxisFrame} from '../core/axes.ts';
import type {Vec3} from '../core/model.ts';
export const AXIS_COLORS=['#ff5566','#66ee99','#66aaff'] as const;
/** Coordinate markers inherit the same frame and camera projection as the axes. */
export function axisReadoutAngles(frame:AxisFrame,camera:T.Camera,origin:Vec3,scale:number){
 const start=new T.Vector3(...origin).multiplyScalar(scale),projected=start.clone().project(camera);
 return [frame.x,frame.y,frame.z].map(direction=>{const end=start.clone().addScaledVector(new T.Vector3(...direction),scale).project(camera),dx=(end.x-projected.x)*(camera.projectionMatrix.elements[5]/camera.projectionMatrix.elements[0]),dy=-(end.y-projected.y);return Math.hypot(dx,dy)<1e-9?0:Math.atan2(dy,dx)-Math.PI/2;});
}
