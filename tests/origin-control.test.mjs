import test from 'node:test';
import assert from 'node:assert/strict';
import {createOriginControlView,originControlSegments,projectOriginControlDirection} from '../src/world/originControl.ts';
import {disposeOriginGizmo} from '../src/world/originGizmo.ts';

test('the fixed origin control separates all six arm ends regardless of activation',()=>{
 const off=createOriginControlView([]),on=createOriginControlView([0,1,2]);
 try{
  const segments=originControlSegments(off.gizmo,off.camera);
  assert.deepEqual(segments.map(s=>s.axis),[0,1,2]);
  assert.deepEqual(segments,originControlSegments(on.gizmo,on.camera));
  const ends=segments.flatMap(s=>s.points);
  for(let i=0;i<ends.length;i++)for(let j=i+1;j<ends.length;j++)assert.ok(Math.hypot(ends[i].x-ends[j].x,ends[i].y-ends[j].y)>30,'arm ends must remain independently clickable');
 }finally{disposeOriginGizmo(off.gizmo);disposeOriginGizmo(on.gizmo);}
});
test('the control inherits original gizmo geometry and active/inactive materials',()=>{
 const {gizmo}=createOriginControlView([1]);
 try{
  for(let axis=0;axis<3;axis++){
   const shaft=gizmo.children.find(child=>child.userData.originShaft&&child.userData.axisIndex===axis);
   const arrow=gizmo.children.find(child=>child.userData.directionIndicator&&child.userData.axisIndex===axis);
   assert.equal(shaft.geometry.type,'CylinderGeometry');assert.equal(arrow.geometry.type,'ConeGeometry');
   assert.equal(shaft.material,arrow.material);assert.equal(shaft.material.opacity,axis===1?1:.2);
  }
 }finally{disposeOriginGizmo(gizmo);}
});

test('subdivision ray targets use the same choice keys as placement',async()=>{
 const {spatialDirectionSlots,DEFAULT_ORIGIN_DIRECTIONS}=await import('../src/core/originDirections.ts');
 const settings={...DEFAULT_ORIGIN_DIRECTIONS,halves:1},view=createOriginControlView([0,1]);
 try{
  const slots=spatialDirectionSlots(settings,[0,1]);
  const diagonal=slots.find(slot=>slot.choiceKey==='0:1');assert.ok(diagonal);
  const point=projectOriginControlDirection(view.camera,diagonal.direction);assert.ok(Math.abs(Math.hypot(point.x,point.y)-.94)<1e-9);
  assert.ok(!spatialDirectionSlots({...settings,disabled:[diagonal.choiceKey]},[0,1]).some(slot=>slot.choiceKey===diagonal.choiceKey));
 }finally{disposeOriginGizmo(view.gizmo);}
});
