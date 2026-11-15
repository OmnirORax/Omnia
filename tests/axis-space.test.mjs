import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {emptyWorld,addStructure,validateWorld,locate} from '../src/core/model.ts';
import {creationCell,prepareTranslation,lattice,geometry,address} from '../src/core/lattice.ts';
import {createAxis,planAxis,axisCenter,axisCoordinates,axisPoint,slotNode,originSlots,setAxisOrigin,focusNodeFrame,endpointView} from '../src/core/axes.ts';
import {translate} from '../src/core/capabilities.ts';
import {removeNodes,paintNodes} from '../src/core/nodeOperations.ts';
import {createStore} from '../src/core/store.ts';
import {brushShape,parseBrush} from '../src/core/brush.ts';
import {createPaintSession} from '../src/core/painting.ts';
import {prepareLatticeTransform,latticeMove,latticeCreatePoint,reconcileLattice} from '../src/graph/lattice.ts';
import {worldPositions} from '../src/graph/coordinates.ts';
import {axisPose} from '../src/world/axisPose.ts';
import {transformNodes} from '../src/core/navigation.ts';
const close=(a,b)=>assert.ok(Math.hypot(...a.map((n,i)=>n-b[i]))<1e-7,`${a} != ${b}`);
const basis=[[1,0,0],[0,1,0],[0,0,1]];
function pair(b=[5.3,0,0]){const world=emptyWorld(),a=addStructure(world,[0,0,0],1),second=addStructure(world,b,2);return {world,a,b:second};}

test('free placement, renderer positions and movement preserve fractional coordinates',()=>{
 const world=emptyWorld(),a=addStructure(world,[.25,1.3,-.7],1);
 close(a.position,[.25,1.3,-.7]);close(Object.values(lattice(world).cells.get(address(a.origin))),a.position);
 translate(world,[a.origin],[.12,-.24,.03]);close(a.position,[.37,1.06,-.67]);
 const plan=prepareLatticeTransform(geometry(world),[address(a.origin)]),target={x:1.25,y:2.75,z:.33};
 assert.deepEqual(plan(new Map([[address(a.origin),target]])).get(address(a.origin)),target);
});
test('shared drive/create/reconciliation adapters preserve free coordinates and physical occupancy',()=>{
 const {world,a}=pair([4.4,2,0]),doc=geometry(world),id=address(a.origin),desired={x:.23,y:1.37,z:-.6};
 assert.deepEqual(worldPositions(latticeMove(doc,id,desired,1,true)).get(id),desired);
 assert.deepEqual(latticeCreatePoint(doc,desired),desired);
 assert.throws(()=>latticeMove(doc,id,{x:4.4,y:1.5,z:0},1,true),/occupied/);
 const edited={...doc,placements:doc.placements.map(p=>p.id===id?{...p,spatialPosition:desired}:p)};
 assert.deepEqual(worldPositions(reconcileLattice(doc,edited)).get(id),desired);
});
test('hidden physical occupancy blocks in-between placement, without reserving a global grid',()=>{
 const {world,a,b}=pair([1,0,0]);a.hidden=true;b.hidden=true;
 assert.notDeepEqual(creationCell(world,[.5,0,0]),[.5,0,0]);
 assert.deepEqual(creationCell(world,[.5,1.17,0]),[.5,1.17,0]);
 const node=addStructure(world,[8.4,0,0],3);assert.equal(prepareTranslation(world,[node.origin])([-7.9,0,0]),undefined);
});
test('axis preview is pure; commit rounds 5.3 to 5 and fixes the first endpoint',()=>{
 const {world,a,b}=pair(),before=structuredClone(world),plan=planAxis(world,a.origin,b.origin,[0,1,0]);
 assert.deepEqual(world,before);assert.equal(plan.length,5);close(plan.targets.get(address(b.origin)),[5,0,0]);
 const frame=createAxis(world,a.origin,b.origin,[0,1,0]);close(a.position,[0,0,0]);close(b.position,[5,0,0]);close(axisCenter(world,frame),[5,0,0]);
 close(axisCoordinates(world,frame,a.position),[0,0,-5]);close(axisCoordinates(world,frame,b.position),[0,0,0]);validateWorld(world);
});
test('axis snaps in its actual diagonal direction rather than projecting to world integers',()=>{
 const {world,a,b}=pair([3.18,4.24,0]),frame=createAxis(world,a.origin,b.origin,[0,0,1]);
 close(b.position,[3,4,0]);close(axisPoint(world,frame,[0,0,-3]),[1.2,1.6,0]);validateWorld(world);
});
test('occupied rounded endpoint chooses the nearest valid integer separation',()=>{
 const {world,a,b}=pair();addStructure(world,[4.3,0,0],3); // Existing nodes touch at distance 1, but rounding to 5 would overlap.
 const plan=planAxis(world,a.origin,b.origin,[0,1,0]);assert.equal(plan.length,6);
 createAxis(world,a.origin,b.origin,[0,1,0]);close(b.position,[6,0,0]);validateWorld(world);
});
test('sharing frames does not couple movement',()=>{
 const {world,a,b}=pair(),c=addStructure(world,[5.3,3,0],3);createAxis(world,b.origin,c.origin,[1,0,0]);createAxis(world,a.origin,b.origin,[0,1,0]);
 close(c.position,[5.3,3,0]);const targets=prepareTranslation(world,[a.origin])([0,0,2]);assert.equal(targets.size,1);translate(world,[a.origin],[0,0,2]);close(b.position,[5,0,0]);validateWorld(world);
});
test('drag slotting moves to a free axis slot and joins the existing constraint component',()=>{
 const {world,a,b}=pair([4,0,0]),frame=createAxis(world,a.origin,b.origin,[0,1,0]),node=addStructure(world,[2,3,0],3);
 slotNode(world,node.origin,frame.id,[2.15,.05,0]);close(node.position,[2,0,0]);
 const targets=prepareTranslation(world,[a.origin])([0,0,2]);assert.equal(targets.size,1);validateWorld(world);
});
test('partial layout rotation keeps the shared frame orientation fixed',()=>{
 const {world,a,b}=pair([4,0,0]),frame=createAxis(world,a.origin,b.origin,[0,1,0]),before=structuredClone(frame),rotation={x:0,y:0,z:Math.SQRT1_2,w:Math.SQRT1_2};
 transformNodes(world,[b.origin],rotation,{x:0,y:0,z:0},true);close(b.position,[0,4,0]);assert.deepEqual(frame,before);validateWorld(world);
});
test('object focus establishes its actual position as origin without moving any node',()=>{
 const {world,a}=pair([3.4,2.7,0]);a.position=[.25,-.75,2.5];const before=structuredClone(world.nodes);
 const frame=focusNodeFrame(world,a.origin,[1,0,0],[0,1,0]);close(axisCenter(world,frame),a.position);close(axisCoordinates(world,frame,a.position),[0,0,0]);
 assert.deepEqual(world.nodes,before);assert.equal(focusNodeFrame(world,a.origin,[1,0,0],[0,1,0]).id,frame.id);validateWorld(world);
});
test('F alignment targets the chosen origin with directed Z depth',()=>{
 const {world,a,b}=pair([3,4,0]),frame=createAxis(world,a.origin,b.origin,[0,0,1]),camera=new T.PerspectiveCamera(50,1.6,.01,10000),pose=axisPose(world,frame,1,camera,{min:.01,max:10000});close(pose.target.toArray(),b.position);
});
test('frames survive save/reload and undo; deleting an endpoint releases only its frames',()=>{
 const values=new Map(),store=createStore({getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)});let first,second;
 store.change(world=>{first=addStructure(world,[0,0,0],1).origin;second=addStructure(world,[5.3,0,0],2).origin;});
 store.change(world=>createAxis(world,first,second,[0,1,0]));
 assert.equal(createStore({getItem:key=>values.get(key)??null,setItem:()=>{}}).world.axes.length,1);
 store.undo();assert.equal(store.world.axes,undefined);close(locate(store.world,second).position,[5.3,0,0]);
 store.redo();validateWorld(store.world);store.change(world=>removeNodes(world,[first]));assert.equal(store.world.axes.length,0);assert.equal(store.world.activeAxis,undefined);validateWorld(store.world);
});
test('brush composition produces the discrete net of the previous unit',()=>{
 const cube=parseBrush('2x2x2'),macro=parseBrush('2',cube),shape=brushShape(macro);
 assert.equal(shape.points.length,64);assert.deepEqual(shape.pitch,[4,4,4]);assert.equal(new Set(shape.points.map(p=>p.join(','))).size,64);
 assert.equal(brushShape(parseBrush('sphere 2')).points.length,33);
 assert.equal(brushShape(cube).points.length,8);cube.size[0]=3;assert.equal(brushShape(cube).points.length,12,'cache must not accept stale mutable definitions');
 assert.throws(()=>parseBrush('64x64x64'),/4,000/);assert.throws(()=>parseBrush('sphere 33'),/radius/);let nested=parseBrush('1');for(let i=0;i<14;i++)nested={kind:'cube',size:[1,1,1],unit:nested};assert.throws(()=>brushShape(nested),/nesting/);
});
test('axis painting is discrete, plane painting follows origin depth, and stamps match the preview',()=>{
 const {world,a,b}=pair([4,0,0]),frame=createAxis(world,a.origin,b.origin,[0,1,0]);
 const axis=createPaintSession(world,[0,0,0],[frame.x,frame.y,frame.z],frame,2,false);
 assert.ok(axis.add([2,.1,0]));close(axis.points[0],[2,0,0]);assert.ok(axis.add([2.1,0,0]));assert.equal(axis.points.length,1);
 const plane=createPaintSession(world,[0,0,0],[frame.x,frame.y,frame.z],frame,2,true),candidate=plane.candidate([2,2,9]);assert.ok(candidate.valid);close(candidate.anchor,[4,2,9]);
 plane.add([2,2,9]);paintNodes(world,plane.points,undefined,frame.id);close(world.nodes.at(-1).position,candidate.stamp[0]);validateWorld(world);
 const focused=focusNodeFrame(world,b.origin,[1,0,0],[0,1,0]);const brush=createPaintSession(world,b.position,basis,focused,2,true);close(brush.candidate([7,3,8]).anchor,[7,3,0]);
});
test('a blocked stamp rejects the whole geometry, including when only one member collides',()=>{
 const world=emptyWorld();world.brush=parseBrush('2');addStructure(world,[0,0,0],1);
 const paint=createPaintSession(world,[0,0,0],basis);assert.equal(paint.add([0,0,0]),false);assert.equal(paint.points.length,0);
 const before=structuredClone(world);assert.throws(()=>paintNodes(world,[[3,0,0],[0,0,0]]),/overlaps/);assert.deepEqual(world,before);
 assert.ok(paint.add([4,0,0]));assert.equal(paint.points.length,8);paintNodes(world,paint.points);assert.equal(world.nodes.length,9);validateWorld(world);
});
test('invalid or broken frame definitions cannot enter persistence',()=>{
 const {world,a,b}=pair([4,0,0]);createAxis(world,a.origin,b.origin,[0,1,0]);
 for(const change of [w=>w.axes[0].x=[2,0,0],w=>w.axes[0].members=[],w=>w.axes[0].members.push(w.axes[0].members[0]),w=>w.axes[0].origin=[NaN,0,0],w=>w.activeAxis='missing']){const next=structuredClone(world);change(next);assert.throws(()=>validateWorld(next));}
});

test('either endpoint can own the camera, with the other endpoint straight ahead in depth',()=>{
 const {world,a,b}=pair([3.18,4.24,0]),relation=createAxis(world,a.origin,b.origin,[0,0,1]);
 for(const [source,target]of [[a,b],[b,a]]){
  const view=endpointView(world,relation,source.origin),camera=new T.PerspectiveCamera(50,1.6,.01,1000);
  close(view.position,source.position);close(view.target,target.position);
  camera.position.set(...view.position);camera.up.set(...view.up);camera.lookAt(new T.Vector3(...view.target));camera.updateMatrixWorld();
  const projected=new T.Vector3(...target.position).project(camera);assert.ok(Math.abs(projected.x)+Math.abs(projected.y)<1e-7);
  close(new T.Vector3(1,0,0).applyQuaternion(camera.quaternion).toArray(),view.right);
  const frame=focusNodeFrame(world,source.origin,view.right,view.up,true);close(axisCoordinates(world,frame,source.position),[0,0,0]);close(axisCoordinates(world,frame,target.position),[0,0,-5]);
  const session=createPaintSession(world,source.position,[frame.x,frame.y,frame.z],frame,2,true,-5),candidate=session.candidate(target.position.map((n,i)=>n+view.right[i]*2));
  close(axisCoordinates(world,frame,candidate.anchor),[2,0,-5]);assert.ok(candidate.valid);paintNodes(world,candidate.stamp,undefined,frame.id);validateWorld(world);
 }
});

test('changing node perspective does not rotate an already painted constrained arrangement',()=>{
 const {world,a,b}=pair([4,0,0]);const relation=createAxis(world,a.origin,b.origin,[0,1,0]),frame=focusNodeFrame(world,a.origin,[1,0,0],[0,1,0]);
 const session=createPaintSession(world,a.position,basis,frame,2,true);session.add([0,2,0]);paintNodes(world,session.points,undefined,frame.id);
 const before=structuredClone(world.nodes),view=endpointView(world,relation,a.origin),next=focusNodeFrame(world,a.origin,view.right,view.up,true);
 assert.notEqual(next.id,frame.id);assert.deepEqual(world.nodes,before);validateWorld(world);
});

test('coordinate preview uses focused depth, whole brush spacing and the exact committed points',()=>{
 const world=emptyWorld(),node=addStructure(world,[.25,-.75,2.5],1),frame=focusNodeFrame(world,node.origin,[1,0,0],[0,1,0]);world.brush=parseBrush('2x2x2');
 const session=createPaintSession(world,node.position,basis,frame,2,true),candidate=session.candidate([6.42,3.02,99]);
 assert.ok(candidate.valid);close(axisCoordinates(world,frame,candidate.anchor),[6,4,0]);
 paintNodes(world,candidate.stamp,undefined,frame.id);
 assert.deepEqual(world.nodes.slice(1).map(node=>node.position),candidate.stamp);validateWorld(world);
});

test('O origin slots include both nodes and empty units, persist and leave nodes unchanged',()=>{
 const {world,a,b}=pair([5,0,0]),frame=createAxis(world,a.origin,b.origin,[0,1,0]),before=structuredClone(world.nodes),slots=originSlots(world,frame);assert.equal(slots.length,6);close(slots[0],a.position);close(slots[5],b.position);
 setAxisOrigin(world,frame.id,slots[2]);close(axisCoordinates(world,frame,slots[2]),[0,0,0]);assert.deepEqual(world.nodes,before);validateWorld(JSON.parse(JSON.stringify(world)));assert.throws(()=>setAxisOrigin(world,frame.id,[2.5,0,0]),/discrete/);
});
test('hover-mounted camera uses the node position and chosen origin with a stable up direction',async()=>{
 const {nodeOriginView}=await import('../src/core/axes.ts');
 for(const [eye,target]of [[[2,3,4],[0,0,0]],[[0,5,0],[0,0,0]]]){
  const pose=nodeOriginView(eye,target,[0,1,0]),camera=new T.PerspectiveCamera();camera.position.set(...pose.position);camera.up.set(...pose.up);camera.lookAt(new T.Vector3(...pose.target));camera.updateMatrixWorld();
  close(pose.position,eye);close(pose.target,target);close(camera.getWorldDirection(new T.Vector3()).toArray(),new T.Vector3(...target).sub(new T.Vector3(...eye)).normalize().toArray());assert.ok(pose.up.every(Number.isFinite));
 }
 assert.throws(()=>nodeOriginView([0,0,0],[0,0,0],[0,1,0]),/already/);
});
