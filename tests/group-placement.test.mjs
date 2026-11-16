import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorld,addStructure} from '../src/core/model.ts';
import {focusNodeFrame} from '../src/core/axes.ts';
import {address} from '../src/core/lattice.ts';
import {selectionCenter,groupTargets,alignmentTargets,validGroupTargets,applyGroupTargets,insideSelectionBox} from '../src/core/groupPlacement.ts';
test('bounded selection includes depth and rejects nodes beyond its chosen depth',()=>{
 const inside=p=>insideSelectionBox(p,[0,0,0],[1,0,0],[0,1,0],[0,0,1],[-2,-2,0],[2,2,0],8);
 assert.equal(inside([1,1,3]),true);assert.equal(inside([1,1,4]),true);assert.equal(inside([1,1,5]),false);assert.equal(inside([3,0,0]),false);
});
test('group drops move its shared origin through the active plane without changing relative positions',()=>{
 const w=emptyWorld(),a=addStructure(w,[2,2,0],1),b=addStructure(w,[5,4,0],2);focusNodeFrame(w,a.origin,[1,0,0],[0,1,0]);
 const before=structuredClone(w),plan=groupTargets(w,[a.origin,b.origin],[2,2,0],[7.1,99,3.2]);assert.deepEqual(w,before);assert.deepEqual(plan.origin,[7,2,3]);
 assert.deepEqual(plan.targets.get(address(a.origin)),[7,2,3]);assert.deepEqual(plan.targets.get(address(b.origin)),[10,4,3]);assert.equal(validGroupTargets(w,plan.targets),true);applyGroupTargets(w,plan.targets);assert.deepEqual(b.position.map((n,i)=>n-a.position[i]),[3,2,0]);
});
test('alignment preserves left-to-right order and uses adjacent slots for zero gap',()=>{
 const w=emptyWorld(),right=addStructure(w,[8,0,0],1),left=addStructure(w,[-3,0,0],2),middle=addStructure(w,[2,0,0],3),ids=[right.origin,left.origin,middle.origin];
 const p=alignmentTargets(w,ids,[0,5,0],[0,1,0],[1,0,0],1);assert.deepEqual(p.get(address(left.origin)),[0,4,0]);assert.deepEqual(p.get(address(middle.origin)),[0,5,0]);assert.deepEqual(p.get(address(right.origin)),[0,6,0]);
 const gap=alignmentTargets(w,ids,[0,5,0],[0,1,0],[1,0,0],4);assert.deepEqual(gap.get(address(right.origin)),[0,9,0]);
 addStructure(w,[0,5,0],4);const before=structuredClone(w);assert.equal(validGroupTargets(w,p),false);assert.throws(()=>applyGroupTargets(w,p),/overlaps/);assert.deepEqual(w,before);
});

test('shared selection origin includes every selected node and ignores a distant world origin',()=>{
 const w=emptyWorld(),a=addStructure(w,[10,2,0],1),b=addStructure(w,[14,2,0],2),c=addStructure(w,[12,8,0],3),old=addStructure(w,[-50,0,0],4);focusNodeFrame(w,old.origin,[1,0,0],[0,1,0]);
 assert.deepEqual(selectionCenter(w,[a.origin,b.origin]),[12,2,0]);assert.deepEqual(selectionCenter(w,[a.origin,b.origin,c.origin]),[12,4,0]);
 const targets=alignmentTargets(w,[a.origin,b.origin],selectionCenter(w,[a.origin,b.origin]),[1,0,0],[1,0,0]);assert.deepEqual(targets.get(address(a.origin)),[11,2,0]);assert.deepEqual(targets.get(address(b.origin)),[12,2,0]);
});
