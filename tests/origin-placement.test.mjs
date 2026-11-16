import test from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera,Raycaster,Vector2,Vector3} from 'three';
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
