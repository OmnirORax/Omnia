import test from 'node:test';
import assert from 'node:assert/strict';
import {createActionHistory} from '../src/composer/runtime/ui/actionHistory.ts';
import {cameraHistoryMatches} from '../src/world/cameraHistory.ts';
const options={mode:'recent',categories:['camera'],steps:1,limit:10,minimum:1};
test('100 retained camera actions remain traversable despite coordinate reconstruction noise',()=>{
 const history=createActionHistory(options);let state={position:[0,0,10],target:[0,0,0],up:[0,1,0]};
 history.register('world.camera',{read:()=>state,matches:cameraHistoryMatches,write:value=>{state=structuredClone(value);state.position[0]+=1e-12;}});
 for(let i=1;i<=100;i++){const before=state;state={...state,position:[i*.37,i*.19,10]};history.record('world.camera',before,state,['camera'],['omnium']);}
 assert.equal(history.candidates('undo').length,100);
 for(let i=0;i<100;i++)assert.equal(history.travel('undo'),1,history.message);
 for(let i=0;i<100;i++)assert.equal(history.travel('redo'),1,history.message);
 assert.ok(Math.abs(state.position[0]-37)<1e-8);
});
test('substantive camera changes remain conflicts and identify their owner',()=>{
 const history=createActionHistory(options);let state={position:[0,0,10]};history.register('world.camera',{read:()=>state,matches:cameraHistoryMatches,write:value=>state=value});const before=state;state={position:[2,0,10]};history.record('world.camera',before,state,['camera'],['omnium']);state={position:[3,0,10]};assert.equal(history.travel('undo'),0);assert.match(history.message,/world.camera/);assert.deepEqual(state.position,[3,0,10]);
});
test('camera tolerance never weakens identity or non-camera overlap checks',()=>{
 assert.equal(cameraHistoryMatches(['pov','born'],100,100.000000001),false);assert.equal(cameraHistoryMatches(['pov','at'],[1,0,0],[1+1e-12,0,0]),false);
 const history=createActionHistory(options);let state={position:[1,0,0]};history.register('workspace',{read:()=>state,write:value=>state=value});history.record('workspace',{position:[0,0,0]},state,['camera'],['omnium']);state={position:[1+1e-12,0,0]};assert.equal(history.travel('undo'),0);
});

test('real OrbitControls rebinding causes false conflicts under exact matching, but not pose matching',async()=>{
 const T=await import('three'),{OrbitControls}=await import('three/addons/controls/OrbitControls.js'),{rebindOrbitControls}=await import('../src/navigation/orbit.ts');
 const run=matches=>{const root={addEventListener(){},removeEventListener(){}},canvas={style:{},ownerDocument:root,getRootNode:()=>root,addEventListener(){},removeEventListener(){}};
 const camera=new T.PerspectiveCamera();camera.position.set(3.13,4.27,8.29);let controls=new OrbitControls(camera,canvas);controls.target.set(.23,.17,.37);controls.update();const history=createActionHistory(options),read=()=>({position:camera.position.toArray(),target:controls.target.toArray(),up:camera.up.toArray()});
 history.register('world.camera',{read,matches,write:value=>{camera.position.fromArray(value.position);camera.up.fromArray(value.up);controls.target.fromArray(value.target);controls=rebindOrbitControls(camera,canvas,controls);}});
 for(let i=1;i<=20;i++){const before=read();camera.position.set(3.13+i*.37,4.27+i*.19,8.29+i*.11);controls.update();history.record('world.camera',before,read(),['camera'],['omnium']);}
 let count=0;while(history.travel('undo'))count++;controls.dispose();return count;};
 assert.ok(run(undefined)<20,'exact matching reproduces a blocked undo chain');assert.equal(run(cameraHistoryMatches),20);
});
