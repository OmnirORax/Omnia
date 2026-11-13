import {PerspectiveCamera,Plane,Raycaster,Vector2,Vector3} from 'three';
type Point={x:number;y:number};
/** A drag keeps its initial camera and depth plane through release. */
export function pointerPlane(camera:PerspectiveCamera,viewport:{left:number;top:number;width:number;height:number},anchor:Vector3){
 camera.updateWorldMatrix(true,false);
 const snapshot=camera.clone();snapshot.matrixWorld.copy(camera.matrixWorld);
 const plane=new Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new Vector3()),anchor),ray=new Raycaster(),pointer=new Vector2();
 return (point:Point)=>{pointer.set((point.x-viewport.left)/viewport.width*2-1,1-(point.y-viewport.top)/viewport.height*2);ray.setFromCamera(pointer,snapshot);return ray.ray.intersectPlane(plane,new Vector3())??anchor.clone();};
}
