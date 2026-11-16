import test from 'node:test';
import assert from 'node:assert/strict';
import {releaseRange} from '../src/world/rangeSelection.ts';
import {createSelection} from '../src/core/selection.ts';
function harness(){const selection=createSelection((a,b)=>a===b);selection.set(['clicked']);let finished=false,consumed=0;return {selection,get finished(){return finished;},get consumed(){return consumed;},event:{pointerId:1,button:0,preventDefault(){consumed++;},stopImmediatePropagation(){consumed++;}},actions:{candidates:()=>['a','b'],finish(){finished=true;},range:(ids,extend)=>selection.set(extend?[...selection.committed,...ids]:ids),pick:id=>selection.pick(id,true,true)}};}
test('rectangle release commits the preview, consumes the event and survives subsequent hover',()=>{const h=harness();assert.equal(releaseRange({mode:'range',pointer:1,button:0,dragged:true},h.event,h.actions),true);assert.deepEqual(h.selection.values,['clicked','a','b']);assert.equal(h.finished,true);assert.equal(h.consumed,2);h.selection.hover('a');assert.deepEqual(h.selection.values,['a']);h.selection.hover(undefined);assert.deepEqual(h.selection.values,['clicked','a','b']);});
test('depth-box release replaces selection; Ctrl-click toggles without generic hit fallthrough',()=>{const h=harness();releaseRange({mode:'range',pointer:1,button:0,dragged:true,volume:{}},h.event,h.actions);assert.deepEqual(h.selection.values,['a','b']);releaseRange({mode:'range',pointer:1,button:0,dragged:false,origin:'a'},h.event,h.actions);assert.deepEqual(h.selection.values,['b']);});
test('another button or pointer cannot complete the selection gesture',()=>{const h=harness(),g={mode:'range',pointer:1,button:0,dragged:true};assert.equal(releaseRange(g,{...h.event,button:2},h.actions),false);assert.equal(releaseRange(g,{...h.event,pointerId:2},h.actions),false);assert.equal(h.finished,false);assert.deepEqual(h.selection.values,['clicked']);});
test('hover replaces only the current target and preserves the last clicked group through committed-state filtering',()=>{const s=createSelection((a,b)=>a===b);s.set(['a','b']);s.hover('c');assert.deepEqual(s.values,['c']);assert.equal(s.has('a'),false);s.retain(Boolean);s.hover(undefined);assert.deepEqual(s.values,['a','b']);s.hover('b');assert.deepEqual(s.values,['b']);s.pick('c',true);s.hover(undefined);assert.deepEqual(s.values,['a','b','c']);});

test('removing a hovered target restores valid clicked selections instead of leaving a stale current target',()=>{const s=createSelection((a,b)=>a===b);s.set(['a','b']);s.hover('c');s.retain(value=>value!=='c'&&value!=='b');assert.deepEqual(s.values,['a']);assert.deepEqual(s.committed,['a']);});

test('selection activation releases picked-up nodes and previews before starting the box',async()=>{
 const {beginRange}=await import('../src/world/rangeSelection.ts');
 const selection=createSelection((a,b)=>a===b);selection.set(['a','b']);let driving=true,rotation=true,cancelled=0;
 const stop=()=>{driving=false;rotation=false;cancelled++;};
 assert.equal(beginRange({button:2,ctrlKey:true,metaKey:false},stop),false);assert.equal(driving,true);
 assert.equal(beginRange({button:0,ctrlKey:true,metaKey:false},stop),true);assert.equal(driving,false);assert.equal(rotation,false);assert.equal(cancelled,1);assert.deepEqual(selection.committed,['a','b']);
 const h=harness();releaseRange({mode:'range',pointer:1,button:0,dragged:true,volume:{}},h.event,h.actions);assert.deepEqual(h.selection.values,['a','b']);
});

test('plain rectangles include visible nodes away from the origin plane and remain independent of movement axes',async()=>{
 const {PerspectiveCamera,Vector3}=await import('three');const {insideScreenSelection}=await import('../src/world/rangeSelection.ts');const {insideActivePlane}=await import('../src/core/axes.ts');const {emptyWorld}=await import('../src/core/model.ts');
 const camera=new PerspectiveCamera(45,1,.1,100);camera.position.z=20;camera.lookAt(0,0,0);camera.updateMatrixWorld();
 const rect={left:20,top:40,width:400,height:400},start={x:150,y:150},end={x:300,y:300},world=emptyWorld();
 for(const activeAxes of [[],[0],[0,1],[0,2]]){const frame={id:'origin',ends:[],members:[],origin:[0,10,10],x:[1,0,0],y:[0,1,0],z:[0,0,1],activeAxes};const position=[0,0,3];assert.equal(insideActivePlane(world,frame,position),false);const projected=new Vector3(...position).project(camera);assert.equal(insideScreenSelection(projected,rect,start,end),true);assert.equal(insideScreenSelection(projected,rect,end,start),true);}
 assert.equal(insideScreenSelection(new Vector3(0,0,2),rect,start,end),false);
});
