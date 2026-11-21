import test from 'node:test';import assert from 'node:assert/strict';
import {createSharedReference,USER_REFERENCE} from '../src/core/sharedReference.ts';
import {emptyWorld,addStructure,validateWorld} from '../src/core/model.ts';
import {axisCenter,setSpatialOrigin,operationSlot,axisPoint} from '../src/core/axes.ts';
import {planarOriginDirections,toggleOriginSide} from '../src/core/originDirections.ts';
import {createPaintSession} from '../src/core/painting.ts';
import {prepareTranslation,address} from '../src/core/lattice.ts';
import {groupTargets} from '../src/core/groupPlacement.ts';
const rounded=p=>p.map(n=>Math.round(n*1e7)/1e7);
test('User is the sole planar fallback until X establishes an explicit origin; resolving does not mutate saved frames',()=>{
 const w=emptyWorld();let origin=[2,3,4];const ref=createSharedReference(()=>w,()=>({origin,x:[1,0,0],y:[0,1,0],z:[0,0,1]})),before=structuredClone(w);
 assert.equal(ref.read().id,USER_REFERENCE);assert.deepEqual(axisCenter(w,ref.read()),origin);origin=[3,4,5];assert.deepEqual(ref.read().origin,origin);assert.deepEqual(w,before);
 const set=setSpatialOrigin(w,undefined,[8,9,10],[1,0,0],[0,1,0]);origin=[100,100,100];const frame=ref.read();assert.equal(frame.id,set.id);assert.deepEqual(frame.activeAxes,[0,1]);assert.deepEqual(frame.directions.sides,[0,1,2,3]);assert.deepEqual(axisCenter(w,frame),[8,9,10]);assert.equal(set.directions,undefined);validateWorld(w);
});
test('painting, movement and group movement share signed planar placement without authoring another origin',()=>{
 const w=emptyWorld(),a=addStructure(w,[0,0,0],1),b=addStructure(w,[2,0,0],2),ref=createSharedReference(()=>w,()=>({origin:[0,3,0],x:[1,0,0],y:[0,1,0],z:[0,0,1]}));
 w.userDirections=toggleOriginSide(planarOriginDirections(undefined),[0,1],1);
 const frame=ref.read(),effective=ref.world(w,frame),p=[4.2,9.7,5.8],snapped=axisPoint(effective,frame,operationSlot(effective,frame,p));assert.deepEqual(rounded(snapped),[4,3,0]);
 assert.deepEqual(createPaintSession(effective,[0,0,0],[frame.x,frame.y,frame.z],frame).candidate(p).anchor,snapped);
 assert.deepEqual(prepareTranslation(effective,[a.origin])(p).get(address(a.origin)),snapped);
 assert.deepEqual(groupTargets(effective,[a.origin,b.origin],[0,0,0],p).origin,snapped);assert.equal(w.activeAxis,undefined);assert.equal(w.axes,undefined);
});
test('legacy Z-active placement resolves to XY while preserving the authored frame and its orientation',()=>{
 const w=emptyWorld(),f=setSpatialOrigin(w,undefined,[0,0,0],[1,0,0],[0,1,0]);f.packing='hex';f.activeAxes=[0,1,2];const ref=createSharedReference(()=>w,()=>({origin:[0,0,0],x:[1,0,0],y:[0,1,0],z:[0,0,1]})),before=structuredClone(w),frame=ref.read();
 assert.equal(frame.packing,undefined);assert.deepEqual(frame.activeAxes,[0,1]);assert.deepEqual(frame.z,[0,0,1]);assert.equal(ref.world(w,frame).axes[0].packing,undefined);assert.deepEqual(w,before);
 f.directions={mode:'unit',halves:0,rings:1,disabled:[],symmetry:true};const next=ref.read(),candidate=createPaintSession(w,[0,0,0],[next.x,next.y,next.z],next).candidate([1,0,0]);assert.equal(candidate.stamp.length,6);assert.equal(candidate.valid,true);
});
