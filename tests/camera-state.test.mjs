import test from 'node:test';
import assert from 'node:assert/strict';
import {createStore} from '../src/core/store.ts';
import {checkedWorld} from '../src/core/transfer.ts';
import {validateCameraState} from '../src/core/cameraState.ts';
import {createUserReference} from '../src/world/userReference.ts';
const pose=()=>({position:[2,3,8],target:[0,1,0],up:[0,1,0]});
const camera=()=>({observer:pose(),user:pose(),detached:true,fov:55,zoom:1.5,depth:3,returnView:pose(),contentsFaceCamera:true});
function memory(){const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};}
test('explicit view saves persist through draft validation and reload without scene updates or undo records',()=>{
 const storage=memory(),store=createStore(storage);let edits=0,saves=0;store.subscribe(()=>edits++);store.subscribeCamera(()=>saves++);
 const nodes=store.world.nodes,state=camera();store.setCamera(state);assert.equal(store.world.nodes,nodes);assert.equal(edits,0);assert.equal(saves,1);assert.equal(store.canUndo,false);
 state.observer.position[0]=900;assert.equal(store.world.camera.observer.position[0],2);
 assert.deepEqual(checkedWorld(JSON.parse(JSON.stringify(store.world))).camera,camera());assert.deepEqual(createStore(storage).world.camera,camera());
 store.setCamera(camera());assert.equal(saves,1);
});
test('workspace undo and redo preserve the latest explicitly saved view',()=>{
 const store=createStore(memory());store.change(world=>world.settings={...world.settings,latticeScale:2});store.setCamera(camera());store.undo();assert.deepEqual(store.world.camera,camera());store.redo();assert.deepEqual(store.world.camera,camera());
});
test('Pull replacement delivers its saved camera even when equal to previous metadata',()=>{
 const store=createStore(memory());store.setCamera(camera());const incoming=structuredClone(store.world);let restored;store.subscribeReplace(()=>restored=store.world.camera);store.replace(incoming);assert.deepEqual(restored,camera());
});
test('old drafts remain valid and malformed saved poses are rejected',()=>{
 validateCameraState(undefined);
 for(const edit of [s=>s.observer.position=[1,2],s=>s.user.up=[0,0,0],s=>s.observer.target=[...s.observer.position],s=>s.zoom=0,s=>s.fov=180,s=>s.depth=Infinity,s=>s.returnView.target[0]=NaN]){const state=camera();edit(state);assert.throws(()=>validateCameraState(state),/camera/);}
});
test('restoring detached User preserves its pose independently of observer changes',()=>{
 const observer=pose(),user=createUserReference(()=>observer),saved=pose();saved.position=[7,8,9];user.restore(saved,true);saved.position[0]=30;observer.position[0]=50;assert.deepEqual(user.read().position,[7,8,9]);assert.equal(user.detached,true);user.restore(pose(),false);assert.equal(user.read(),observer);
});
