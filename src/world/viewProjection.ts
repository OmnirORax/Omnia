import * as T from 'three';
/** Screen fitting changes child transforms, never the canonical node anchor. */
export function screenUnitsAt(camera:T.PerspectiveCamera,anchor:T.Vector3,height:number){
 return Math.max(.00001,-anchor.clone().applyMatrix4(camera.matrixWorldInverse).z)*2*Math.tan(T.MathUtils.degToRad(camera.fov/2))/Math.max(1,height);
}
export function placeExpandedView(group:T.Object3D,presentation:T.Object3D,camera:T.PerspectiveCamera,from:{x:number;y:number},to:{x:number;y:number;scale:number},unit:number){
 const inverse=group.quaternion.clone().invert(),right=new T.Vector3(1,0,0).applyQuaternion(camera.quaternion),up=new T.Vector3(0,1,0).applyQuaternion(camera.quaternion);
 presentation.position.copy(right).multiplyScalar((to.x-from.x)*unit).addScaledVector(up,(from.y-to.y)*unit).applyQuaternion(inverse);
 presentation.quaternion.copy(inverse).multiply(camera.quaternion);presentation.scale.setScalar(to.scale);
}
