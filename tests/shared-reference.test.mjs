import test from 'node:test';
import assert from 'node:assert/strict';
import {createSharedReference,USER_REFERENCE} from '../src/core/sharedReference.ts';
import {emptyWorld,addStructure,validateWorld} from '../src/core/model.ts';
import {axisCenter,setSpatialOrigin,operationSlot,axisPoint} from '../src/core/axes.ts';
import {createPaintSession} from '../src/core/painting.ts';
import {prepareTranslation,address} from '../src/core/lattice.ts';
import {groupTargets} from '../src/core/groupPlacement.ts';
test('User is the sole fallback until O establishes an explicit origin',()=>{
 const w=emptyWorld();let origin=[2,3,4];const ref=createSharedReference(()=>w,()=>({origin,x:[1,0,0],y:[0,1,0],z:[0,0,1]}));const before=structuredClone(w);
 assert.equal(ref.read().id,USER_REFERENCE);assert.deepEqual(axisCenter(w,ref.read()),origin);origin=[3,4,5];assert.deepEqual(ref.read().origin,origin);assert.deepEqual(w,before);
 const set=setSpatialOrigin(w,undefined,[8,9,10],[1,0,0],[0,1,0]);origin=[100,100,100];assert.equal(ref.read(),set);assert.deepEqual(axisCenter(w,ref.read()),[8,9,10]);validateWorld(w);assert.deepEqual(set.activeAxes,[0,1]);assert.deepEqual(axisPoint(w,set,operationSlot(w,set,[10.3,11.8,90])),[10,12,10]);
});
test('painting, movement and group movement resolve through the same reference without authoring another origin',()=>{
 const w=emptyWorld(),a=addStructure(w,[0,0,0],1),b=addStructure(w,[2,0,0],2),ref=createSharedReference(()=>w,()=>({origin:[0,3,0],x:[1,0,0],y:[0,1,0],z:[0,0,1]})),frame=ref.read();ref.toggle(1);ref.toggle(2);const effective=ref.world(w,ref.read()),point=[4.2,9.7,5.8];
 const snapped=axisPoint(effective,ref.read(),operationSlot(effective,ref.read(),point));assert.deepEqual(snapped,[4,3,6]);
 assert.deepEqual(createPaintSession(effective,[0,0,0],[frame.x,frame.y,frame.z],ref.read()).candidate(point).anchor,snapped);
 assert.deepEqual(prepareTranslation(effective,[a.origin])(point).get(address(a.origin)),snapped);
 assert.deepEqual(groupTargets(effective,[a.origin,b.origin],[0,0,0],point).origin,snapped);assert.equal(w.activeAxis,undefined);assert.equal(w.axes,undefined);
 ref.toggle(1);assert.deepEqual(ref.read().activeAxes,[1]);ref.toggle(0);assert.deepEqual(ref.read().activeAxes,[0,1]);
});
