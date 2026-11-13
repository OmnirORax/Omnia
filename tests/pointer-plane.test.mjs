import test from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera,Vector3} from 'three';
import {pointerPlane} from '../src/navigation/pointerPlane.ts';
import {emptyWorld,addStructure} from '../src/core/model.ts';
import {prepareTranslation} from '../src/core/lattice.ts';
import {translate} from '../src/core/capabilities.ts';

const close=(a,b)=>assert.ok(a.distanceTo(b)<1e-8,`${a.toArray()} != ${b.toArray()}`);
const viewport={left:120,top:75,width:900,height:600};
function setup(scale){const camera=new PerspectiveCamera(45,viewport.width/viewport.height,.001,10000);camera.position.set(12,8,40).multiplyScalar(scale);camera.lookAt(0,0,0);camera.updateMatrixWorld();return camera;}
function screen(camera,point){const p=point.clone().project(camera);return {x:viewport.left+(p.x+1)*viewport.width/2,y:viewport.top+(1-p.y)*viewport.height/2};}

test('drag projection preserves the grab offset and final lattice landing at different render scales',()=>{
 for(const scale of [.1,1,15]){
  const camera=setup(scale),world=emptyWorld(),node=addStructure(world,[0,0,0],1),anchor=new Vector3(),project=pointerPlane(camera,viewport,anchor),start={x:590,y:366},end={x:730,y:259};
  const delta=project(end).sub(project(start)).divideScalar(scale),preview=prepareTranslation(world,[node.origin])(delta.toArray());
  translate(world,[node.origin],delta.toArray());assert.deepEqual(node.position,preview.get(JSON.stringify(node.origin)));
  const grabbed=project(start),expected=grabbed.clone().add(delta.clone().multiplyScalar(scale));
  close(project(end),expected);const result=screen(camera,expected);assert.ok(Math.abs(result.x-end.x)<1e-8&&Math.abs(result.y-end.y)<1e-8);
 }
});

test('a drag retains its depth and camera frame, and reversing reaches the original point',()=>{
 const camera=setup(1),anchor=new Vector3(2,3,-10),project=pointerPlane(camera,viewport,anchor),start={x:450,y:280},end={x:640,y:420},before=project(start),release=project(end);
 camera.position.set(20,5,100);camera.lookAt(20,5,0);camera.updateMatrixWorld();
 close(project(end),release);close(project(start),before);
 const forward=release.clone().sub(before),back=project(start).sub(release);close(forward.add(back),new Vector3());
});
