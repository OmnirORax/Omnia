import test from 'node:test';
import assert from 'node:assert/strict';
import {compile,evaluate,result,reference,tick,logic} from '../src/simulation/circuit.ts';
import {starterCircuit} from '../src/simulation/starter.ts';
import {resolveCircuit,writeCircuit,hasAlu} from '../src/simulation/design.ts';
import {emptyWorld,addStructure,validateWorld} from '../src/core/model.ts';
import {childNode,copyNode,detachNode,removeNodes} from '../src/core/nodeOperations.ts';
import {createStore} from '../src/core/store.ts';

test('textbook gate circuit matches independent 8-bit arithmetic and all flags',()=>{
 const c=starterCircuit(),p=compile(c),edge=[0,1,2,7,127,128,129,254,255];
 for(let op=0;op<7;op++)for(const a of edge)for(const b of edge){const s={a,b,op};assert.deepEqual(result(c,evaluate(p,s)),reference(s),JSON.stringify(s));}
 let seed=123;for(let i=0;i<600;i++){seed=(seed*1664525+1013904223)>>>0;const s={a:seed&255,b:seed>>>8&255,op:i%7};assert.deepEqual(result(c,evaluate(p,s)),reference(s));}
 assert.ok(p.components>100);assert.ok(p.delay>8);assert.equal(p.unused,0);
});
test('step propagation settles to the same signal state; disconnected inputs propagate X',()=>{
 const c=starterCircuit(),p=compile(c),s={a:255,b:1,op:0};let values=new Map();for(let i=0;i<p.delay;i++)values=tick(p,s,values);
 assert.deepEqual(result(c,values),reference(s));const out=c.gates.find(g=>g.label==='R0');out.inputs=[null];assert.equal(result(c,evaluate(compile(c),s)).value,null);
 assert.equal(logic('AND',[0,null]),0);assert.equal(logic('OR',[1,null]),1);assert.equal(logic('MUX',[1,1,null]),1);
});
test('topology rejects cycles and invalid wires with bounded evaluation',()=>{
 const c={version:1,gates:[{id:'x',kind:'NOT',inputs:['x'],x:0,y:0,group:'Control',label:'x'}]};assert.throws(()=>compile(c),/loop/);c.gates[0].inputs=['absent'];assert.throws(()=>compile(c),/missing/);
 c.gates[0].inputs=[null];compile(c);c.gates[0].x=Infinity;assert.throws(()=>compile(c),/Invalid/);
});
test('branches store deltas, inherit later parent edits and materialize on copy/detach/delete',()=>{
 const world=emptyWorld(),base=addStructure(world,[0,0,0],1);base.label='alus';assert.equal(hasAlu(base,world),true);assert.throws(()=>writeCircuit(base,world,starterCircuit()),/Branch/);
 const branch=childNode(world,base.origin,true);branch.alu={version:1,deltas:{}};
 let c=resolveCircuit(branch,world);c.gates.find(g=>g.id==='a0').x=900;writeCircuit(branch,world,c);assert.deepEqual(Object.keys(branch.alu.deltas),['a0']);assert.deepEqual(branch.alu.deltas.a0,{id:'a0',x:900});assert.notEqual(resolveCircuit(base,world).gates.find(g=>g.id==='a0').x,900);
 const child=childNode(world,branch.origin,true);child.alu={version:1,deltas:{}};assert.equal(resolveCircuit(child,world).gates.find(g=>g.id==='a0').x,900);
 c=resolveCircuit(branch,world);c.gates.find(g=>g.id==='a1').x=700;c.gates.find(g=>g.id==='a0').label='A7';writeCircuit(branch,world,c);assert.equal(resolveCircuit(child,world).gates.find(g=>g.id==='a1').x,700);assert.equal(resolveCircuit(child,world).gates.find(g=>g.id==='a0').label,'A7');
 let local=resolveCircuit(child,world);local.gates.find(g=>g.id==='decode0a').inputs[0]='zero';writeCircuit(child,world,local);c=resolveCircuit(branch,world);c.gates.find(g=>g.id==='decode0a').inputs[1]='a1';writeCircuit(branch,world,c);assert.deepEqual(resolveCircuit(child,world).gates.find(g=>g.id==='decode0a').inputs,['zero','a1']);
 const copied=copyNode(world,child,[4,0,0]);assert.deepEqual(resolveCircuit(copied,world),resolveCircuit(child,world));detachNode(world,child.origin);removeNodes(world,[base.origin,branch.origin]);assert.equal(resolveCircuit(child,world).gates.find(g=>g.id==='a0').x,900);validateWorld(JSON.parse(JSON.stringify(world)));
});
test('circuit edits survive save/undo/redo and malformed design imports are rejected',()=>{
 let saved;const store=createStore({getItem:()=>null,setItem:(_key,value)=>saved=value});let origin;
 store.change(w=>{const n=addStructure(w,[0,0,0],1);n.label='alus';n.alu={version:1,deltas:{}};origin=n.origin;});
 store.change(w=>{const n=w.nodes[0],c=resolveCircuit(n,w);c.gates.find(g=>g.id==='r0').inputs=[null];writeCircuit(n,w,c);});
 assert.equal(result(resolveCircuit(store.world.nodes[0],store.world),evaluate(compile(resolveCircuit(store.world.nodes[0],store.world)),{a:1,b:1,op:0})).value,null);
 const reloaded=createStore({getItem:()=>saved,setItem(){}});assert.deepEqual(reloaded.world.nodes[0].alu,store.world.nodes[0].alu);store.undo();assert.deepEqual(store.world.nodes[0].alu.deltas,{});store.redo();assert.ok(store.world.nodes[0].alu.deltas.r0);
 const invalid=emptyWorld(),n=addStructure(invalid,[0,0,0],1);n.alu={version:1,deltas:{a:{id:'a',kind:'BOGUS',inputs:[],x:0,y:0,group:'x',label:'x'}}};assert.throws(()=>validateWorld(invalid),/Invalid/);n.alu={version:1,deltas:{a:{id:'a',kind:'NOT',inputs:[42],x:0,y:0,group:'x',label:'x'}}};assert.throws(()=>validateWorld(invalid),/Invalid/);
});
