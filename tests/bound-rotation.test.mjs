import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {emptyWorld,addStructure} from '../src/core/model.ts';
import {address} from '../src/core/lattice.ts';
import {focusNodeFrame} from '../src/core/axes.ts';
import {createBoundRotation} from '../src/world/boundRotation.ts';
function harness(){
 class Element{style={};dataset={};children=[];hidden=false;append(...children){this.children.push(...children);}replaceChildren(...children){this.children=children;}closest(){return null;}}
 const old={document:globalThis.document,window:globalThis.window,Element:globalThis.Element,requestAnimationFrame:globalThis.requestAnimationFrame};const handlers=new Map(),frames=[];
 Object.assign(globalThis,{Element,document:{createElement:()=>new Element()},window:{addEventListener:(key,fn)=>handlers.set(key,fn)},requestAnimationFrame:fn=>{frames.push(fn);return frames.length;}});
 const world=emptyWorld(),a=addStructure(world,[0,0,0],1),b=addStructure(world,[0,0,2],2),c=addStructure(world,[0,2,0],3),frame=focusNodeFrame(world,a.origin,[1,0,0],[0,1,0]);
 const camera=new T.PerspectiveCamera();camera.position.set(0,0,10);camera.lookAt(0,0,0);camera.updateMatrixWorld();const scene=new T.Scene(),canvas={focus(){},getBoundingClientRect:()=>({left:0,top:0,width:100,height:100})},host=new Element(),visuals=new Map(world.nodes.map(n=>{const group=new T.Group();group.position.set(...n.position);return [address(n.origin),{group}];}));let commits=[],enabled=true,selection=[];
 const env={scene,camera,canvas,host,read:()=>world,scale:()=>1,hit:p=>p.x===1?{origin:a.origin}:p.x===2?{origin:b.origin}:p.x===3?{origin:c.origin}:p.x===4?{axis:frame.id}:{},selected:()=>selection,reference:()=>frame,user:()=>({position:[0,0,10],target:[0,0,0],up:[0,1,0]}),visual:id=>visuals.get(id),commit:(nodes,f)=>commits.push({nodes,f}),enabled:v=>{enabled=v;},frameVisibility(){},request(){},feedback(){}};
 const controller=createBoundRotation(env);controller.render();const event=(x,y=100,ctrlKey=false)=>({button:2,clientX:x,clientY:y,ctrlKey,preventDefault(){},stopImmediatePropagation(){}});
 return {world,a,b,c,frame,controller,host,visuals,commits,get enabled(){return enabled;},select:ids=>{selection=ids;},down:(x,y,ctrl,origin)=>controller.down(event(x,y,ctrl),origin),move:y=>{controller.move({clientY:y});while(frames.length)frames.shift()();},restore:()=>Object.assign(globalThis,old)};
}
test('own-origin rotation previews without authoring; right-empty confirms once and Escape cancels',()=>{
 const h=harness();try{const before=structuredClone(h.world);h.down(1);assert.equal(h.enabled,false);h.move(76);assert.deepEqual(h.world,before);assert.notEqual(h.visuals.get(address(h.a.origin)).group.quaternion.y,0);h.down(99);assert.equal(h.commits.length,1);assert.deepEqual(h.commits[0].nodes.get(address(h.a.origin)).position,[0,0,0]);assert.equal(h.controller.active,false);assert.equal(h.enabled,true);
 h.down(1);h.move(52);h.controller.cancel();assert.equal(h.commits.length,1);assert.deepEqual(h.visuals.get(address(h.a.origin)).group.quaternion.toArray(),[0,0,0,1]);}finally{h.restore();}
});
test('rotation uses the shared frame and target clicks do not establish private references',()=>{
 const h=harness();try{h.down(1);h.down(2);h.down(3);h.move(76);h.down(99);const q=h.commits[0].nodes.get(address(h.a.origin)).orientation,expected=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),Math.PI/2);assert.ok(new T.Quaternion(q.x,q.y,q.z,q.w).angleTo(expected)<1e-7);assert.deepEqual(h.frame.origin,undefined);}finally{h.restore();}
});
test('Ctrl-right orbit changes position; spatial-frame rotation never authors object transforms',()=>{
 const h=harness();try{h.frame.origin=[0,0,5];h.down(1,100,true);h.move(76);h.down(99);assert.notDeepEqual(h.commits[0].nodes.get(address(h.a.origin)).position,[0,0,0]);h.down(4);h.move(76);h.down(99);assert.equal(h.commits[1].nodes.size,0);assert.equal(h.commits[1].f.id,h.frame.id);assert.deepEqual(h.commits[1].f.state.origin,[0,0,5]);}finally{h.restore();}
});

test('the shared active plane determines the rotation axis',()=>{
 const h=harness();try{h.frame.activeAxes=[0,1];h.down(1);h.move(76);h.down(99);const q=h.commits[0].nodes.get(address(h.a.origin)).orientation,expected=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),Math.PI/2);assert.ok(new T.Quaternion(q.x,q.y,q.z,q.w).angleTo(expected)<1e-7);}finally{h.restore();}
});

for(const axis of [0,1,2])test(`one active ${'XYZ'[axis]} axis supports rotation, orbit and frame previews`,()=>{
 const h=harness();try{
  h.frame.activeAxes=[axis];h.frame.origin=[3,4,5];const before=structuredClone(h.world),direction=new T.Vector3(...[h.frame.x,h.frame.y,h.frame.z][axis]),expected=new T.Quaternion().setFromAxisAngle(direction,Math.PI/2);
  h.down(1);assert.equal(h.controller.active,true);h.move(76);assert.deepEqual(h.world,before);assert.ok(h.visuals.get(address(h.a.origin)).group.quaternion.angleTo(expected)<1e-7);h.down(99);
  const own=h.commits[0].nodes.get(address(h.a.origin));assert.deepEqual(own.position,[0,0,0]);assert.ok(new T.Quaternion(own.orientation.x,own.orientation.y,own.orientation.z,own.orientation.w).angleTo(expected)<1e-7);
  h.down(1,100,true);h.move(76);h.down(99);const orbit=h.commits[1].nodes.get(address(h.a.origin)),position=new T.Vector3(-3,-4,-5).applyQuaternion(expected).add(new T.Vector3(3,4,5));assert.ok(new T.Vector3(...orbit.position).distanceTo(position)<1e-7);assert.deepEqual(orbit.orientation,{x:0,y:0,z:0,w:1});
  h.down(4);h.move(76);h.down(99);assert.equal(h.commits[2].nodes.size,0);assert.deepEqual(h.commits[2].f.state.origin,[3,4,5]);assert.ok(new T.Vector3(...h.commits[2].f.state.x).distanceTo(new T.Vector3(...h.frame.x).applyQuaternion(expected))<1e-7);
 }finally{h.restore();}
});

test('rotation controls retain their click targets and halve/double without a numeric box',()=>{
 const h=harness();try{h.down(1);const tools=h.host.children[0],buttons=[...tools.children];assert.deepEqual(buttons.map(b=>b.textContent),['Unit','Axis','/2','x2']);h.move(76);assert.deepEqual(tools.children,buttons);
 buttons[2].onclick();const half=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),Math.PI/4);assert.ok(h.visuals.get(address(h.a.origin)).group.quaternion.angleTo(half)<1e-7);
 buttons[3].onclick();const full=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),Math.PI/2);assert.ok(h.visuals.get(address(h.a.origin)).group.quaternion.angleTo(full)<1e-7);
 buttons[0].onclick();assert.equal(buttons[0].dataset.active,'true');assert.equal(buttons[1].dataset.active,'false');assert.deepEqual(tools.children,buttons);
 }finally{h.restore();}
});

test('rotation operates on the selected group without a hovered target',()=>{const h=harness();try{h.select([h.a.origin,h.b.origin]);h.down(99,100,false,h.a.origin);assert.equal(h.controller.active,true);h.move(76);h.down(99);assert.equal(h.commits[0].nodes.size,2);assert.deepEqual(h.commits[0].nodes.get(address(h.a.origin)).position,h.a.position);assert.deepEqual(h.commits[0].nodes.get(address(h.b.origin)).position,h.b.position);}finally{h.restore();}});
