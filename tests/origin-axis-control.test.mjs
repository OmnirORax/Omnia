import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {createOriginControl,ORIGIN_CONTROL_SIZE} from '../src/world/originAxisControl.ts';
import {disposeOriginGizmo} from '../src/world/originGizmo.ts';
import {pickAxisSegment} from '../src/world/axisHit.ts';
import {DEFAULT_ORIGIN_DIRECTIONS} from '../src/core/originDirections.ts';
const rect={left:0,top:0,width:ORIGIN_CONTROL_SIZE,height:ORIGIN_CONTROL_SIZE};
const screen=(object,point,camera)=>{object.updateWorldMatrix(true,false);const p=new T.Vector3(...point).applyMatrix4(object.matrixWorld).project(camera);return {x:(p.x+1)*rect.width/2,y:(1-p.y)*rect.height/2};};

test('the fixed control inherits origin meshes and the scene picker selects all six separated arm ends',()=>{
 const {gizmo,camera}=createOriginControl([0,1],DEFAULT_ORIGIN_DIRECTIONS);
 try{
  const objects=gizmo.children.filter(o=>o.visible),ends=[];
  for(const shaft of objects.filter(o=>o.userData.originShaft))for(const end of shaft.userData.axisSegment){
   const point=screen(shaft,end,camera);ends.push(point);
   assert.equal(pickAxisSegment(point,objects,camera,rect,8).axisIndex,shaft.userData.axisIndex);
   assert.equal(shaft.geometry.type,'CylinderGeometry');
   assert.equal(shaft.material.opacity,shaft.userData.axisIndex===2?.2:1);
  }
  for(let i=0;i<ends.length;i++)for(let j=i+1;j<ends.length;j++)assert.ok(Math.hypot(ends[i].x-ends[j].x,ends[i].y-ends[j].y)>30);
 }finally{disposeOriginGizmo(gizmo);}
});
test('axis refinements are actual shared-gizmo rays, and disabled directions stay visible and selectable',()=>{
 const directions={...DEFAULT_ORIGIN_DIRECTIONS,halves:1,disabled:['0:1']},view=createOriginControl([0,1],directions);
 try{
  const rays=view.gizmo.children.filter(o=>o.userData.directionKey),disabled=rays.find(o=>o.userData.directionKey==='0:1');
  assert.equal(rays.length,4);assert.ok(rays.every(o=>o instanceof T.Line));assert.equal(disabled.material.opacity,.15);
  const positions=disabled.geometry.getAttribute('position'),p=new T.Vector3().fromBufferAttribute(positions,1).multiplyScalar(.95);
  const hit=pickAxisSegment(screen(disabled,p.toArray(),view.camera),view.gizmo.children.filter(o=>o.visible),view.camera,rect,8);
  assert.equal(hit.axisIndex,disabled.userData.axisIndex);
 }finally{disposeOriginGizmo(view.gizmo);}
});
test('Unit mode retains only the base origin visual and releases all control resources',()=>{
 const {gizmo}=createOriginControl([0,1,2],{...DEFAULT_ORIGIN_DIRECTIONS,mode:'unit',rings:3});
 assert.equal(gizmo.children.some(o=>o.userData.directionKey),false);
 const resources=new Map();gizmo.traverse(o=>{for(const resource of [o.geometry,...[o.material].flat()].filter(Boolean))if(!resources.has(resource)){resources.set(resource,0);resource.addEventListener('dispose',()=>resources.set(resource,resources.get(resource)+1));}});
 disposeOriginGizmo(gizmo);assert.ok([...resources.values()].every(n=>n===1));
});
