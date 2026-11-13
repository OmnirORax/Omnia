import test from 'node:test';
import assert from 'node:assert/strict';
import {createDraftSync,signature} from '../src/cloud/sync.ts';
import {emptyWorld,addStructure} from '../src/core/model.ts';
const pending=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
function fixture(options={}){
 let world=emptyWorld(),remote=structuredClone(world),revision=1,marker=null,phase,error,saves=0;
 remote.scene.vfx.pulseAmount=.2;
 const state={get world(){return world;},get remote(){return remote;},get phase(){return phase;},get error(){return error;},get marker(){return marker;},get saves(){return saves;},change(edit){world=structuredClone(world);edit(world);sync.changed();},setMarker(value){marker=value;},advanceRemote(edit){remote=structuredClone(remote);edit(remote);revision++;}};
 const sync=createDraftSync({read:()=>world,replace:async next=>{world=structuredClone(next);sync.changed();},load:async()=>({world:structuredClone(remote),revision}),save:async(next,expected)=>{assert.equal(expected,revision);remote=structuredClone(next);saves++;return ++revision;},marker:()=>marker,remember:value=>{marker=value;},hasLocal:false,autoLoad:true,status:(value,detail)=>{phase=value;error=detail;},...options});
 return{state,sync};
}
test('a fresh preview loads the same complete draft and acknowledged edits survive another build',async()=>{
 const {state,sync}=fixture();await sync.load();assert.equal(state.phase,'Saved');assert.deepEqual(state.world,state.remote);
 state.change(world=>{world.scene.vfx.pulseAmount=.8;addStructure(world,[1,2,3],100);});await sync.save();assert.equal(state.phase,'Saved');assert.equal(state.saves,1);assert.deepEqual(state.world,state.remote);assert.equal(state.marker.signature,await signature(state.world));sync.dispose();
 const second=fixture({load:async()=>({world:structuredClone(state.remote),revision:state.marker.revision})});await second.sync.load();assert.deepEqual(second.state.world,state.remote);second.sync.dispose();
});
test('unrecognized local work and remote conflicts require a choice instead of silent replacement',async()=>{
 const {state,sync}=fixture({hasLocal:true});const before=state.world;await sync.load();assert.equal(state.phase,'Conflict');assert.equal(state.world,before);await sync.load('local');await sync.save();assert.deepEqual(state.remote,before);sync.dispose();
});
test('published production state stays published until the user chooses a draft',async()=>{
 const {state,sync}=fixture({hasLocal:true,autoLoad:false});const before=state.world;await sync.load();assert.equal(state.phase,'Published');assert.equal(state.world,before);state.change(world=>{world.scene.vfx.pulseAmount=.7;});assert.equal(state.phase,'Conflict');await sync.load('remote');assert.deepEqual(state.world,state.remote);sync.dispose();
});
test('a known unchanged local copy takes the newest remote revision',async()=>{
 const {state,sync}=fixture({hasLocal:true});state.setMarker({revision:0,signature:await signature(state.world)});await sync.load();assert.equal(state.phase,'Saved');assert.deepEqual(state.world,state.remote);sync.dispose();
});
test('editing during loading preserves the new local work',async()=>{
 const load=pending(),{state,sync}=fixture({load:()=>load.promise});const running=sync.load();state.change(world=>{world.scene.vfx.pulseAmount=.9;});load.resolve({world:state.remote,revision:3});await running;assert.equal(state.phase,'Conflict');assert.equal(state.world.scene.vfx.pulseAmount,.9);sync.dispose();
});
test('failed saves never report Saved and revision conflicts stop subsequent automatic writes',async()=>{
 for(const message of ['Offline','Conflict']){const {state,sync}=fixture({save:async()=>{throw Error(message);}});await sync.load();state.change(world=>{world.scene.vfx.pulseAmount=.3;});await sync.save();assert.equal(state.phase,message==='Conflict'?'Conflict':'Failed');assert.equal(state.world.scene.vfx.pulseAmount,.3);assert.equal(state.error,message);sync.dispose();}
});
test('edits while saving are queued and cannot change the in-flight snapshot',async()=>{
 const wait=pending();let captured;const {state,sync}=fixture({save:async world=>{captured=world;return wait.promise;}});await sync.load();state.change(world=>{world.scene.vfx.pulseAmount=.6;});const saving=sync.save();state.change(world=>{world.scene.vfx.pulseAmount=.7;});assert.equal(captured.scene.vfx.pulseAmount,.6);wait.resolve(2);await saving;assert.equal(state.phase,'Saving');assert.equal(state.world.scene.vfx.pulseAmount,.7);sync.dispose();
});
test('a preview that started fresh must preserve unsent work after its first load',async()=>{
 const {state,sync}=fixture({save:async()=>{throw Error('Offline');}});await sync.load();state.change(world=>{world.scene.vfx.pulseAmount=.9;});await sync.save();
 state.advanceRemote(world=>{world.scene.vfx.pulseAmount=.3;});await sync.load();assert.equal(state.phase,'Conflict');assert.equal(state.world.scene.vfx.pulseAmount,.9);sync.dispose();
});
test('database object-key ordering does not manufacture a draft conflict',async()=>{
 const world=emptyWorld(),reorder=value=>Array.isArray(value)?value.map(reorder):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).reverse().map(([key,value])=>[key,reorder(value)])):value;
 assert.equal(await signature(world),await signature(reorder(world)));
});
