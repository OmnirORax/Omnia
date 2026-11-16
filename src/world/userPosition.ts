import * as T from 'three';
import {activeWorldAxes,type AxisFrame} from '../core/axes.ts';
import {frontOnPose} from '../navigation/model.ts';
export function userPositionPlan(frame:AxisFrame,center:T.Vector3,user:T.Vector3,bounds:T.Box3,camera:T.PerspectiveCamera){
 const active=activeWorldAxes(frame);if(!active.length)throw Error('Choose an active axis.');
 const basis=[frame.x,frame.y,frame.z],index=active.length===1?active[0]:[0,1,2].find(i=>!active.includes(i))!,back=new T.Vector3(...basis[index]);if(user.clone().sub(center).dot(back)<0)back.negate();
 const up=new T.Vector3(...basis[[0,1,2].find(i=>i!==index&&i===1)??[0,1,2].find(i=>i!==index)!]),right=new T.Vector3().crossVectors(up,back).normalize();up.crossVectors(back,right).normalize();
 const orientation=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(right,up,back));
 return (distance?:number)=>{if(distance!==undefined){if(!Number.isFinite(distance)||distance<=0||distance>1e7)throw Error('Use a positive distance.');return {position:center.clone().addScaledVector(back,distance),target:center.clone(),up:up.clone()};}return frontOnPose(camera,center,orientation,bounds,{min:camera.near*2,max:1e7});};
}
