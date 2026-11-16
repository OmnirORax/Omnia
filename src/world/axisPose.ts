import * as T from 'three';
import {axisAnchor,axisCenter,type AxisFrame} from '../core/axes.ts';
import {locate,type World} from '../core/model.ts';
import {frontOnPose} from '../navigation/model.ts';
export function axisPose(world:World,axis:AxisFrame,scale:number,camera:T.PerspectiveCamera,limits:{min:number;max:number}){
 const center=new T.Vector3(...axisCenter(world,axis)).multiplyScalar(scale),a=new T.Vector3(...axisAnchor(world,axis)).multiplyScalar(scale),b=new T.Vector3(...(axis.ends.length?locate(world,axis.ends[1]??axis.ends[0])!.position:axisCenter(world,axis))).multiplyScalar(scale),bounds=new T.Box3().setFromPoints([a,b]).expandByScalar(scale);
 const basis=new T.Matrix4().makeBasis(new T.Vector3(...axis.x),new T.Vector3(...axis.y),new T.Vector3(...axis.z));
 return frontOnPose(camera,center,new T.Quaternion().setFromRotationMatrix(basis),bounds,limits);
}
