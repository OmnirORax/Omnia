import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorld,addStructure,bind,validateWorld} from '../src/core/model.ts';
import {childNode,connectNodes,detachNode,toggleSubtree} from '../src/core/nodeOperations.ts';
import {worldConnections} from '../src/core/connections.ts';
import {createStore} from '../src/core/store.ts';

test('new relation binders stay blank while explicit labels remain authored',()=>{
 const world=emptyWorld(),a=addStructure(world,[0,0,0],1),b=addStructure(world,[4,0,0],2);
 connectNodes(world,a.origin,b.origin,b.position);assert.equal(world.relationships[0].label,'');assert.equal([...worldConnections(world)][0].text,'');
 world.relationships[0].label='Custom';assert.equal([...worldConnections(world)][0].text,'Custom');world.relationships[0].label='';world.relationships[0].kind='some type';assert.equal([...worldConnections(world)][0].text,'');
});
test('hierarchy binders derive from parent even when composition parts are empty, without duplicate includes edges',()=>{
 const world=emptyWorld(),parent=addStructure(world,[0,0,0],1),child=childNode(world,parent.origin),grandchild=childNode(world,child.origin);
 assert.equal([...worldConnections(world)].length,2);parent.parts=[];child.parts=[];
 const before=structuredClone(world),edges=[...worldConnections(world)];assert.deepEqual(world,before);assert.equal(edges.length,2);assert.ok(edges.every(edge=>edge.text==='⋔'&&edge.edge.kind==='child'));
 parent.collapsed=true;child.collapsed=true;toggleSubtree(world,parent.origin);assert.equal(parent.collapsed,false);assert.equal(child.collapsed,false);assert.ok([...worldConnections(world)].some(edge=>edge.source===child&&edge.target===grandchild));validateWorld(world);
});
test('composition includes use the child symbol, variant binders retain their separate meaning',()=>{
 const world=emptyWorld(),a=addStructure(world,[0,0,0],1),b=addStructure(world,[4,0,0],2),variant=childNode(world,a.origin,true);a.parts.push(bind(b,'follow',world));
 const edges=[...worldConnections(world)];assert.equal(edges.length,2);assert.equal(edges.find(edge=>edge.target===b).text,'⋔');assert.equal(edges.find(edge=>edge.target===variant).text,'variant');
});
test('removing a hierarchy binder detaches the child and its mirrored part, with undo restoring the edge',()=>{
 const store=createStore({getItem:()=>null,setItem(){}});let parent,child;
 store.change(world=>{parent=addStructure(world,[0,0,0],1).origin;child=childNode(world,parent).origin;});
 const edge=[...worldConnections(store.world)][0].edge;assert.equal(edge.kind,'child');store.change(world=>detachNode(world,edge.child));assert.equal([...worldConnections(store.world)].length,0);
 store.undo();assert.equal([...worldConnections(store.world)].length,1);assert.equal([...worldConnections(store.world)][0].text,'⋔');store.redo();assert.equal([...worldConnections(store.world)].length,0);
});

test('relationship and composition binders reconnect their target without replacing the source',async()=>{const {reconnectBinder}=await import('../src/core/connections.ts');const {emptyWorld,addStructure,bind,resolve}=await import('../src/core/model.ts');const world=emptyWorld(),a=addStructure(world,[0,0,0],1),b=addStructure(world,[2,0,0],2),c=addStructure(world,[4,0,0],3);world.relationships=[{from:bind(a,'follow',world),to:bind(b,'follow',world),label:'test',kind:'relation'}];a.parts.push(bind(b,'follow',world));reconnectBinder(world,{kind:'relationship',index:0},c.origin);reconnectBinder(world,{kind:'part',owner:a.origin,index:0},c.origin);assert.deepEqual(resolve(world.relationships[0].from,world)[0].origin,a.origin);assert.deepEqual(resolve(world.relationships[0].to,world)[0].origin,c.origin);assert.deepEqual(resolve(a.parts[0],world)[0].origin,c.origin);assert.equal(world.relationships[0].label,'test');});

test('child and variant binders can change owner while preserving their node identity',async()=>{const {reconnectBinder}=await import('../src/core/connections.ts');const {emptyWorld,addStructure,validateWorld}=await import('../src/core/model.ts');const {childNode}=await import('../src/core/nodeOperations.ts');const world=emptyWorld(),a=addStructure(world,[0,0,0],1),b=addStructure(world,[5,0,0],2),child=childNode(world,a.origin),variant=childNode(world,a.origin,true),identity=structuredClone(variant.origin);reconnectBinder(world,{kind:'child',owner:a.origin,child:child.origin},b.origin);assert.deepEqual(child.parent,b.origin);reconnectBinder(world,{kind:'variant',owner:variant.origin},b.origin);assert.deepEqual(variant.parent,b.origin);assert.deepEqual(variant.variantOf,b.origin);assert.deepEqual(variant.origin,identity);validateWorld(world);assert.throws(()=>reconnectBinder(world,{kind:'child',owner:b.origin,child:child.origin},child.origin),/own branch/);});
