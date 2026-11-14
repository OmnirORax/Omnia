import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorld,addStructure} from '../src/core/model.ts';
import {createStore} from '../src/core/store.ts';
import {translate} from '../src/core/capabilities.ts';
import {adoptNodes} from '../src/core/nodeOperations.ts';
import {lattice,address} from '../src/core/lattice.ts';

test('renderer lattice agrees with a committed translation that indexed the draft before mutation',()=>{
 const store=createStore({getItem:()=>null,setItem:()=>{}});store.change(w=>addStructure(w,[0,0,0],1));
 const origin=store.world.nodes[0].origin;
 for(const delta of [[6,-4,-1],[-2,3,0]]){
  store.change(w=>translate(w,[origin],delta));
  assert.deepEqual(Object.values(lattice(store.world).cells.get(address(origin))),store.world.nodes[0].position);
 }
 store.undo();assert.deepEqual(Object.values(lattice(store.world).cells.get(address(origin))),store.world.nodes[0].position);
 store.redo();assert.deepEqual(Object.values(lattice(store.world).cells.get(address(origin))),store.world.nodes[0].position);
});

test('lattice preparation follows in-place edits, node membership and reparenting',()=>{
 const w=emptyWorld(),a=addStructure(w,[0,0,0],1),b=addStructure(w,[8,0,0],2),before=lattice(w);a.color='#ff0000';assert.deepEqual([...lattice(w).cells],[...before.cells]);
 a.position[0]=2;assert.equal(lattice(w).cells.get(address(a.origin)).x,2);
 const moved=lattice(w);adoptNodes(w,[a.origin],b.origin,[1,2,0]);assert.notEqual(lattice(w),moved);assert.deepEqual(Object.values(lattice(w).cells.get(address(a.origin))),a.position);
 const c=addStructure(w,[20,0,0],3);assert.ok(lattice(w).cells.has(address(c.origin)));w.nodes.splice(w.nodes.indexOf(c),1);assert.equal(lattice(w).cells.has(address(c.origin)),false);
});
