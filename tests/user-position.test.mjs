import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {userPositionPlan} from '../src/world/userPosition.ts';
const frame={x:[1,0,0],y:[0,1,0],z:[0,0,1],activeAxes:[0,2]},center=new T.Vector3(3,4,5),camera=new T.PerspectiveCamera(60,1.5,.1,1000),bounds=new T.Box3().setFromCenterAndSize(center,new T.Vector3(10,2,6));
test('P preserves plane sidedness and manual distance overrides fit from the same center',()=>{
 const plan=userPositionPlan(frame,center,new T.Vector3(3,-10,5),bounds,camera),fit=plan(),manual=plan(20);assert.ok(fit.position.y<4);assert.deepEqual(manual.position.toArray(),[3,-16,5]);assert.deepEqual(manual.target.toArray(),center.toArray());assert.ok(fit.position.distanceTo(center)>0);assert.throws(()=>plan(0));
});
test('one axis positions User along that axis, rather than perpendicular to it',()=>{
 for(const index of [0,1,2]){const user=center.clone().addScaledVector(new T.Vector3(...[frame.x,frame.y,frame.z][index]),-30),pose=userPositionPlan({...frame,activeAxes:[index]},center,user,bounds,camera)(20),delta=pose.position.clone().sub(center);assert.ok(delta.distanceTo(new T.Vector3(...[frame.x,frame.y,frame.z][index]).multiplyScalar(-20))<1e-7);assert.ok(Math.abs(pose.up.dot(delta))<1e-7);}
});
