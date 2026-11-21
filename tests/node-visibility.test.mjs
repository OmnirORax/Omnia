import test from 'node:test';import assert from 'node:assert/strict';
import {nodeVisible} from '../src/world/nodeVisibility.ts';
import {emptyWorld,addStructure} from '../src/core/model.ts';
import {address} from '../src/core/lattice.ts';
import {createHierarchyIsolation} from '../src/core/hierarchy.ts';
function fixture(){const world=emptyWorld(),root=addStructure(world,[0,0,0],1),child=addStructure(world,[2,0,0],2),other=addStructure(world,[4,0,0],3);child.parent=root.origin;const byId=new Map(world.nodes.map(n=>[address(n.origin),n]));return {world,root,child,other,context:{parent:id=>byId.get(address(id)),variants:new Set(),reveal:false}};}
test('movement reveals hidden, collapsed, isolated and filtered nodes without altering the saved world',()=>{
 const {world,root,child,other,context}=fixture();root.collapsed=true;other.hidden=true;const before=structuredClone(world),isolation=createHierarchyIsolation();isolation.toggle([root.origin]);
 const limited={...context,filter:new Set([address(root.origin)]),isolation:isolation.visible(world)};
 assert.deepEqual(world.nodes.map(n=>nodeVisible(n,limited)),[true,false,false]);
 assert.deepEqual(world.nodes.map(n=>nodeVisible(n,{...limited,reveal:true})),[true,true,true]);
 assert.deepEqual(world.nodes.map(n=>nodeVisible(n,limited)),[true,false,false]);assert.deepEqual(world,before);
});
test('temporary movement reveal leaves hide-all active for restoration',()=>{
 const {world,context}=fixture(),isolation=createHierarchyIsolation();isolation.toggle([]);const hidden={...context,isolation:isolation.visible(world)};assert.ok(world.nodes.every(n=>!nodeVisible(n,hidden)));assert.ok(world.nodes.every(n=>nodeVisible(n,{...hidden,reveal:true})));assert.ok(world.nodes.every(n=>!nodeVisible(n,{...hidden,reveal:false})));assert.equal(isolation.active,true);
});
test('movement preserves the current viewpoint and explicitly selected variant representation',()=>{const {root,child,context}=fixture();assert.equal(nodeVisible(root,{...context,reveal:true,pointOfView:root.origin}),false);child.variantOf=root.origin;assert.equal(nodeVisible(child,{...context,reveal:true}),false);assert.equal(nodeVisible(child,{...context,reveal:true,variants:new Set([address(root.origin)])}),true);});
