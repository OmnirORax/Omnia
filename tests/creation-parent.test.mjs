import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorld,addStructure,sameOrigin,validateWorld} from '../src/core/model.ts';
import {paintNodes} from '../src/core/nodeOperations.ts';
import {createStore} from '../src/core/store.ts';

test('a placement under a selected parent creates blank children and expands that parent',()=>{
 const world=emptyWorld(),parent=addStructure(world,[0,0,0],1);parent.label='Parent';parent.collapsed=true;
 paintNodes(world,[[1,0,0],[2,0,0]],undefined,undefined,parent.origin);
 assert.equal(parent.collapsed,false);assert.equal(parent.parts.length,2);
 for(const child of world.nodes.slice(1)){assert.ok(sameOrigin(child.parent,parent.origin));assert.equal(child.label,'');assert.ok(parent.parts.some(binding=>sameOrigin(binding.origin,child.origin)));}
 validateWorld(world);
});
test('parented placement is one undoable edit; rejection leaves both hierarchy and nodes unchanged',()=>{
 const values=new Map(),store=createStore({getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)});
 store.change(world=>addStructure(world,[0,0,0],1));const parent=store.world.nodes[0].origin,before=structuredClone(store.world);
 store.change(world=>paintNodes(world,[[1,0,0]],undefined,undefined,parent));const after=structuredClone(store.world);store.undo();assert.deepEqual(store.world,before);store.redo();assert.deepEqual(store.world,after);
 assert.throws(()=>store.change(world=>paintNodes(world,[[0,0,0]],undefined,undefined,parent)),/overlap/);assert.deepEqual(store.world,after);
 const missing={born:999,at:[99,99,99]};assert.throws(()=>paintNodes(store.world,[[3,0,0]],undefined,undefined,missing),/parent/);assert.deepEqual(store.world,after);
});
test('placement without a parent remains independent',()=>{
 const world=emptyWorld();paintNodes(world,[[0,0,0]]);assert.equal(world.nodes[0].parent,undefined);validateWorld(world);
});
