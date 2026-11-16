import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorld} from '../src/core/model.ts';
import {createPaintSession} from '../src/core/painting.ts';
const basis=[[1,0,0],[0,1,0],[0,0,1]];
test('pending painting removes retraced slots, ignores repeated samples and frees their occupancy',()=>{
 const world=emptyWorld(),before=structuredClone(world),paint=createPaintSession(world,[0,0,0],basis);
 paint.toggle([0,0,0]);paint.toggle([0,0,0]);assert.equal(paint.points.length,1);
 paint.toggle([1,0,0]);assert.equal(paint.points.length,2);
 paint.toggle([0,0,0]);assert.deepEqual(paint.points,[[1,0,0]]);
 paint.toggle([-1,0,0]);paint.toggle([0,0,0]);assert.equal(paint.points.length,3);
 assert.deepEqual(world,before);
});
test('retracing never removes committed nodes or mutates the world',async()=>{
 const {paintNodes}=await import('../src/core/nodeOperations.ts');const world=emptyWorld();paintNodes(world,[[0,0,0]]);
 const before=structuredClone(world),paint=createPaintSession(world,[0,0,0],basis);
 assert.equal(paint.toggle([0,0,0]),false);assert.equal(paint.points.length,0);
 paint.toggle([2,0,0]);paint.toggle([3,0,0]);paint.toggle([2,0,0]);
 assert.deepEqual(paint.points,[[3,0,0]]);assert.deepEqual(world,before);
});
