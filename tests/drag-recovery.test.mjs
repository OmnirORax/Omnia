import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorld,addStructure} from '../src/core/model.ts';
import {translate} from '../src/core/capabilities.ts';
import {lattice,address} from '../src/core/lattice.ts';
import {createStore} from '../src/core/store.ts';
import {createSecondaryRelease} from '../src/composer/runtime/ui/secondaryRelease.ts';

test('prepared mutable worlds reflect repeated moves, in-place edits and occupancy',()=>{
 const world=emptyWorld(),node=addStructure(world,[0,0,0],1);lattice(world);
 translate(world,[node.origin],[5,0,0]);assert.equal(lattice(world).cells.get(address(node.origin)).x,5);
 translate(world,[node.origin],[2,0,0]);assert.equal(lattice(world).cells.get(address(node.origin)).x,7);
 node.position[0]=10;assert.equal(lattice(world).cells.get(address(node.origin)).x,10);
 const b=addStructure(world,[10,0,0],2);assert.notDeepEqual(b.position,node.position);
});
test('translation prepared inside a store edit renders the committed position through undo/redo',()=>{
 const store=createStore({getItem:()=>null,setItem:()=>{}});let origin;
 store.change(w=>origin=addStructure(w,[0,0,0],1).origin);
 for(const delta of [5,2,-3])store.change(w=>translate(w,[origin],[delta,0,0]));
 assert.equal(lattice(store.world).cells.get(address(origin)).x,4);
 store.undo();assert.equal(lattice(store.world).cells.get(address(origin)).x,7);
 store.redo();assert.equal(lattice(store.world).cells.get(address(origin)).x,4);
});
test('secondary menu opens once after press context/release in either browser order',()=>{
 for(const order of [['context','release'],['release','context']]){
  const gate=createSecondaryRelease();let opened=0;const open=()=>opened++;
  gate.press(open);
  for(const action of order)(action==='release'?gate.release(open):gate.context())?.();
  gate.context()?.();gate.release(open)?.();assert.equal(opened,1);
  gate.press(open);gate.context();gate.cancel();gate.release(open)?.();assert.equal(opened,1);
 }
});
