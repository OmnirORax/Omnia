import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorld,addStructure,locate,validateWorld,sameOrigin} from '../src/core/model.ts';
import {connectNodes,childNode} from '../src/core/nodeOperations.ts';
import {createStore} from '../src/core/store.ts';
import {createAxis} from '../src/core/axes.ts';
const close=(a,b)=>a.forEach((n,i)=>assert.ok(Math.abs(n-b[i])<1e-7));
const midpoint=(a,b)=>a.position.map((n,i)=>(n+b.position[i])/2);
function pair(distance=8){const world=emptyWorld(),a=addStructure(world,[0,0,0],1),b=addStructure(world,[distance,0,0],2);a.label='Dimension';b.label='Relation';return {world,a,b};}
function validSpacing(world){for(let i=0;i<world.nodes.length;i++)for(let j=i+1;j<world.nodes.length;j++)assert.ok(Math.hypot(...world.nodes[i].position.map((n,k)=>n-world.nodes[j].position[k]))>=1-1e-7);validateWorld(world);}
test('both target connections and connector drags create an independent ordered-label midpoint while keeping A→B',()=>{
 for(const drag of [false,true]){
  const {world,a,b}=pair(),before=world.nodes.map(n=>structuredClone(n));
  const origin=drag?connectNodes(world,a.origin,b.origin,b.position):connectNodes(world,a.origin,b.origin),node=locate(world,origin);
  assert.equal(node.label,'Dimension Relation');close(node.position,midpoint(a,b));assert.equal(node.parent,undefined);assert.deepEqual(node.parts,[]);
  assert.equal(world.relationships.length,1);assert.ok(sameOrigin(world.relationships[0].from.origin,a.origin));assert.ok(sameOrigin(world.relationships[0].to.origin,b.origin));
  assert.deepEqual(a,before[0]);assert.deepEqual(b,before[1]);validSpacing(world);
 }
});
test('connection direction determines the combined label',()=>{
 const {world,a,b}=pair();const node=locate(world,connectNodes(world,b.origin,a.origin));assert.equal(node.label,'Relation Dimension');close(node.position,midpoint(a,b));
});
test('an occupied midpoint is cleared without moving endpoints or unrelated nodes',()=>{
 const {world,a,b}=pair(),blocker=addStructure(world,[4,0,0],3),other=addStructure(world,[4,1,0],4),otherBefore=structuredClone(other),origin=structuredClone(blocker.origin);
 const node=locate(world,connectNodes(world,a.origin,b.origin));close(node.position,[4,0,0]);assert.notDeepEqual(blocker.position,node.position);assert.deepEqual(blocker.origin,origin);assert.deepEqual(other,otherBefore);close(a.position,[0,0,0]);close(b.position,[8,0,0]);validSpacing(world);
});
test('adjacent endpoints make room along the original binder and preserve immutable identities',()=>{
 const {world,a,b}=pair(1),beforeA=structuredClone(a.origin),beforeB=structuredClone(b.origin);const node=locate(world,connectNodes(world,a.origin,b.origin));
 close(a.position,[0,0,0]);close(b.position,[2,0,0]);close(node.position,[1,0,0]);assert.deepEqual(a.origin,beforeA);assert.deepEqual(b.origin,beforeB);validSpacing(world);
});
test('midpoint displacements carry collapsed branches through the existing movement mechanism',()=>{
 const {world,a,b}=pair(),blocker=addStructure(world,[4,0,0],3),child=childNode(world,blocker.origin,false,[4,2,0]);blocker.collapsed=true;child.hidden=true;
 const delta=child.position.map((n,i)=>n-blocker.position[i]);const node=locate(world,connectNodes(world,a.origin,b.origin));close(node.position,[4,0,0]);close(child.position,blocker.position.map((n,i)=>n+delta[i]));validSpacing(world);
});
test('near endpoints carry destination children while making room',()=>{
 const {world,a,b}=pair(1),child=childNode(world,b.origin,false,[3,0,0]);b.collapsed=true;
 const offset=child.position.map((n,i)=>n-b.position[i]);const node=locate(world,connectNodes(world,a.origin,b.origin));close(node.position,midpoint(a,b));close(child.position,b.position.map((n,i)=>n+offset[i]));validSpacing(world);
});
test('reference-axis members remain valid when adjacent endpoints need more room',()=>{
 const {world,a,b}=pair(1);createAxis(world,a.origin,b.origin,[0,1,0]);const node=locate(world,connectNodes(world,a.origin,b.origin));close(node.position,midpoint(a,b));validSpacing(world);
});
test('failed preflight leaves nodes and relationships untouched',()=>{
 const {world,a,b}=pair();a.label='a'.repeat(160);b.label='b'.repeat(160);const before=structuredClone(world);assert.throws(()=>connectNodes(world,a.origin,b.origin),/160/);assert.deepEqual(world,before);
});
test('one undo/redo includes both room making and the new relation node',()=>{
 const seed=pair(1),store=createStore({getItem:()=>JSON.stringify(seed.world),setItem(){}}),before=structuredClone(store.world);
 store.change(world=>connectNodes(world,seed.a.origin,seed.b.origin));const after=structuredClone(store.world);assert.equal(after.nodes.length,3);assert.equal(after.relationships.length,1);
 store.undo();assert.deepEqual(store.world,before);store.redo();assert.deepEqual(store.world,after);
});
