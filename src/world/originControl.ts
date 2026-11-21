import * as T from 'three';
import {createOriginGizmo,orientOriginGizmo} from './originGizmo.ts';

const SIZE=112;
/** The original gizmo, presented through a fixed diagonal camera for picking. */
export function createOriginControlView(enabled:readonly number[]){
 const scene=new T.Scene(),camera=new T.OrthographicCamera(-.48,.48,.48,-.48,.1,10),gizmo=createOriginGizmo(1,true,enabled);
 camera.position.set(2,2,2);camera.lookAt(0,0,0);camera.updateMatrixWorld();scene.add(gizmo);orientOriginGizmo(gizmo,camera,{height:SIZE});
 return {scene,camera,gizmo};
}
/** Hit regions inherit their endpoints from the rendered shafts. */
export function originControlSegments(gizmo:T.Group,camera:T.Camera){
 return gizmo.children.filter(child=>child.userData.originShaft).map(shaft=>({axis:shaft.userData.axisIndex as number,points:(shaft.userData.axisSegment as number[][]).map(point=>new T.Vector3(...point as [number,number,number]).applyMatrix4(shaft.matrixWorld).project(camera)).map(point=>({x:point.x*SIZE/2,y:-point.y*SIZE/2}))}));
}

/** Subdivision drawing projects the existing placement directions into the same fixed view. */
export function projectOriginControlDirection(camera:T.Camera,direction:readonly number[]){
 const point=new T.Vector3(direction[0],direction[1],direction[2]).project(camera),length=Math.hypot(point.x,point.y);
 return {x:point.x/length*.94,y:-point.y/length*.94};
}
