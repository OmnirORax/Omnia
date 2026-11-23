import test from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera,Ray,Raycaster,Vector2,Vector3} from 'three';
import {originPlacement} from '../src/world/originPlacement.ts';
import {operationSlot,axisPoint} from '../src/core/axes.ts';
import {emptyWorld} from '../src/core/model.ts';

test('empty-space origin stays beneath the pointer regardless of active axes or lattice snapping',()=>{
 for(const scale of [.1,1,15])for(const activeAxes of [[],[0],[1],[0,2]]){
  const camera=new PerspectiveCamera(45,1.5,.001,10000);camera.position.set(12,8,40).multiplyScalar(scale);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const pointer=new Vector2(.37,-.23),ray=new Raycaster();ray.setFromCamera(pointer,camera);
  const world=emptyWorld(),frame={id:'origin',ends:[],members:[],origin:[0,0,0],x:[1,0,0],y:[0,1,0],z:[0,0,1],activeAxes};
  const point=originPlacement(ray.ray,camera.getWorldDirection(new Vector3()),frame.origin,scale);
  const screen=new Vector3(...point).multiplyScalar(scale).project(camera);
  assert.ok(Math.abs(screen.x-pointer.x)<1e-8&&Math.abs(screen.y-pointer.y)<1e-8);
  if(!activeAxes.length){const old=axisPoint(world,frame,operationSlot(world,frame,point));assert.deepEqual(old,[0,0,0]);assert.notDeepEqual(point,old);}
 }
});

test('hold-origin captures the press position and camera basis, then aims once on release',async()=>{
 const {createOriginSetSession}=await import('../src/world/originPlacement.ts');let plan;
 const start={position:[1,2,3],right:[1,0,0],up:[0,1,0],screen:{x:10,y:10}},session=createOriginSetSession(start,value=>plan=value);start.position[0]=99;session.release([5,2,3],{x:30,y:10});assert.deepEqual(plan.position,[1,2,3]);assert.deepEqual(plan.aim,[5,2,3]);const before=plan;session.release([8,0,0],{x:50,y:10});assert.equal(plan,before);
 let tap;createOriginSetSession({...start,screen:{x:0,y:0}},value=>tap=value).release([3,2,1],{x:1,y:0});assert.equal(tap.aim,undefined);
 let commits=0;const cancelled=createOriginSetSession(start,()=>commits++);cancelled.cancel();cancelled.release([5,0,0],{x:100,y:0});assert.equal(commits,0);
});
test('drawing projection detects edge-on and behind-camera planes',async()=>{
 const {intersectDrawingPlane}=await import('../src/world/originPlacement.ts');const ray=new Ray(new Vector3(0,0,5),new Vector3(0,0,-1));assert.equal(intersectDrawingPlane(ray,new Vector3(1,0,0),new Vector3()),undefined);assert.equal(intersectDrawingPlane(ray,new Vector3(0,0,1),new Vector3(0,0,10)),undefined);assert.deepEqual(intersectDrawingPlane(ray,new Vector3(0,0,1),new Vector3()).toArray(),[0,0,0]);
});
