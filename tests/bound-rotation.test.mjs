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
 const camera=new T.PerspectiveCamera();camera.position.set(0,0,10);camera.lookAt(0,0,0);camera.updateMatrixWorld();const scene=new T.Scene(),canvas={focus(){},getBoundingClientRect:()=>({left:0,top:0,width:100,height:100})},host=new Element(),visuals=new Map(world.nodes.map(n=>{const group=new T.Group();group.position.set(...n.position);return [address(n.origin),{group}];}));const target=new T.Vector3();let cameraCommits=0,commits=[],enabled=true,selection=[],mathView,mathDisposed=0,cursorPoint={x:0,y:0};
 const env={cursorPoint:()=>cursorPoint,mountMathDial:(_host,number,close,choices)=>{mathView={number,close,choices};return()=>{number.restore();mathDisposed++;};},scene,camera,cameraTarget:()=>target,cameraCommit:()=>cameraCommits++,canvas,host,read:()=>world,scale:()=>1,hit:p=>p.x===1?{origin:a.origin}:p.x===2?{origin:b.origin}:p.x===3?{origin:c.origin}:p.x===4?{axis:frame.id}:{},selected:()=>selection,reference:()=>frame,user:()=>({position:[0,0,10],target:[0,0,0],up:[0,1,0]}),visual:id=>visuals.get(id),commit:(nodes,f)=>commits.push({nodes,f}),enabled:v=>{enabled=v;},frameVisibility(){},request(){},feedback(){}};
 const controller=createBoundRotation(env);controller.render();const event=(x,y=100,ctrlKey=false)=>({button:2,clientX:x,clientY:y,ctrlKey,preventDefault(){},stopImmediatePropagation(){}});
 return {get mathView(){return mathView;},get mathDisposed(){return mathDisposed;},key:(key)=>{const event={key,ctrlKey:false,metaKey:false,altKey:false,repeat:false,preventDefault(){},stopImmediatePropagation(){}};handlers.get('keydown')?.(event);handlers.get('keyup')?.(event);},world,a,b,c,frame,camera,target,get cameraCommits(){return cameraCommits;},controller,host,visuals,commits,get enabled(){return enabled;},select:ids=>{selection=ids;},down:(x,y,ctrl,origin)=>{cursorPoint={x,y:y??100};return controller.down(event(x,y,ctrl),origin);},move:y=>{cursorPoint={x:cursorPoint.x,y};controller.move({clientY:y});while(frames.length)frames.shift()();},restore:()=>Object.assign(globalThis,old)};
}
test('rotation about the active own-origin previews without authoring; right-empty confirms once and Escape cancels',()=>{
 const h=harness();try{const before=structuredClone(h.world);h.down(1);assert.equal(h.enabled,false);h.move(76);assert.deepEqual(h.world,before);assert.notEqual(h.visuals.get(address(h.a.origin)).group.quaternion.y,0);h.down(99);assert.equal(h.commits.length,1);assert.deepEqual(h.commits[0].nodes.get(address(h.a.origin)).position,[0,0,0]);assert.equal(h.controller.active,false);assert.equal(h.enabled,true);
 h.down(1);h.move(52);h.controller.cancel();assert.equal(h.commits.length,1);assert.deepEqual(h.visuals.get(address(h.a.origin)).group.quaternion.toArray(),[0,0,0,1]);}finally{h.restore();}
});
test('the next right click confirms the shared-frame preview even over another node',()=>{
 const h=harness();try{h.down(1);h.move(76);h.down(2);assert.equal(h.commits.length,1);assert.equal(h.controller.active,false);const q=h.commits[0].nodes.get(address(h.a.origin)).orientation,expected=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),Math.PI/2);assert.ok(new T.Quaternion(q.x,q.y,q.z,q.w).angleTo(expected)<1e-7);assert.equal(h.commits[0].nodes.has(address(h.b.origin)),false);assert.deepEqual(h.frame.origin,undefined);}finally{h.restore();}
});
test('plain rotation uses the active remote origin; spatial-frame rotation never authors object transforms',()=>{
 const h=harness();try{h.frame.origin=[0,0,5];h.down(1,100,false);h.move(76);h.down(99);assert.notDeepEqual(h.commits[0].nodes.get(address(h.a.origin)).position,[0,0,0]);h.down(4);h.move(76);h.down(99);assert.equal(h.commits[1].nodes.size,0);assert.equal(h.commits[1].f.id,h.frame.id);assert.deepEqual(h.commits[1].f.state.origin,[0,0,5]);}finally{h.restore();}
});

test('the shared active plane determines the rotation axis',()=>{
 const h=harness();try{h.frame.activeAxes=[0,1];h.down(1);h.move(76);h.down(99);const q=h.commits[0].nodes.get(address(h.a.origin)).orientation,expected=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),Math.PI/2);assert.ok(new T.Quaternion(q.x,q.y,q.z,q.w).angleTo(expected)<1e-7);}finally{h.restore();}
});

for(const axis of [0,1,2])test(`one active ${'XYZ'[axis]} axis supports rotation, orbit and frame previews`,()=>{
 const h=harness();try{
  h.frame.activeAxes=[axis];h.frame.origin=[3,4,5];const before=structuredClone(h.world),direction=new T.Vector3(...[h.frame.x,h.frame.y,h.frame.z][axis]),expected=new T.Quaternion().setFromAxisAngle(direction,Math.PI/2);
  h.down(1);assert.equal(h.controller.active,true);h.move(76);assert.deepEqual(h.world,before);assert.ok(h.visuals.get(address(h.a.origin)).group.quaternion.angleTo(expected)<1e-7);h.down(99);
  const position=new T.Vector3(-3,-4,-5).applyQuaternion(expected).add(new T.Vector3(3,4,5)),own=h.commits[0].nodes.get(address(h.a.origin));assert.ok(new T.Vector3(...own.position).distanceTo(position)<1e-7);assert.ok(new T.Quaternion(own.orientation.x,own.orientation.y,own.orientation.z,own.orientation.w).angleTo(expected)<1e-7);
  h.down(1,100,true);h.move(76);h.down(99);const orbit=h.commits[1].nodes.get(address(h.a.origin));assert.ok(new T.Vector3(...orbit.position).distanceTo(position)<1e-7);assert.ok(new T.Quaternion(orbit.orientation.x,orbit.orientation.y,orbit.orientation.z,orbit.orientation.w).angleTo(expected)<1e-7);
  h.down(4);h.move(76);h.down(99);assert.equal(h.commits[2].nodes.size,0);assert.deepEqual(h.commits[2].f.state.origin,[3,4,5]);assert.ok(new T.Vector3(...h.commits[2].f.state.x).distanceTo(new T.Vector3(...h.frame.x).applyQuaternion(expected))<1e-7);
 }finally{h.restore();}
});

test('Shift after rotation opens the canonical parameter, with no local half/double buttons',async()=>{
 const h=harness();try{h.key('Shift');assert.equal(h.controller.mathDialOpen,false);h.down(1);const tools=h.host.children[0];assert.equal(tools.hidden,true);assert.equal(tools.children.length,0);h.move(76);const quarter=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),Math.PI/2);assert.ok(h.visuals.get(address(h.a.origin)).group.quaternion.angleTo(quarter)<1e-7);
 h.key('Shift');await Promise.resolve();assert.equal(h.controller.mathDialOpen,true);assert.equal(tools.hidden,false);assert.equal(h.mathView.number.value,1);h.move(300);assert.ok(h.visuals.get(address(h.a.origin)).group.quaternion.angleTo(quarter)<1e-7);
 h.mathView.number.commit(.5,{mode:'halving',anchor:1,count:1,value:.5});const half=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),Math.PI/4);assert.ok(h.visuals.get(address(h.a.origin)).group.quaternion.angleTo(half)<1e-7);h.mathView.close();assert.equal(h.controller.mathDialOpen,false);h.move(300);assert.ok(h.visuals.get(address(h.a.origin)).group.quaternion.angleTo(half)<1e-7);assert.equal(h.commits.length,0);assert.equal(h.mathDisposed,1);
 h.controller.confirm();assert.equal(h.commits.length,1);
 }finally{h.restore();}
});

test('rotation operates on the selected group without a hovered target',()=>{const h=harness();try{h.select([h.a.origin,h.b.origin]);h.down(99,100,false,h.a.origin);assert.equal(h.controller.active,true);h.move(76);h.down(99);assert.equal(h.commits[0].nodes.size,2);assert.ok(new T.Vector3(...h.commits[0].nodes.get(address(h.a.origin)).position).distanceTo(new T.Vector3(-1,0,1))<1e-7);const expected=new T.Vector3(1,0,1);assert.ok(new T.Vector3(...h.commits[0].nodes.get(address(h.b.origin)).position).distanceTo(expected)<1e-7);}finally{h.restore();}});

test('right press arms rotation only after a drag, release latches it, and later motion continues the preview',()=>{
 const h=harness(),press={button:2,clientX:1,clientY:100,preventDefault(){},stopImmediatePropagation(){}};try{
 assert.equal(h.controller.arm(press),true);assert.equal(h.controller.release(),false);assert.equal(h.controller.active,false);assert.equal(h.commits.length,0);
 h.controller.arm(press);h.move(96);assert.equal(h.controller.release(),true);assert.equal(h.controller.active,true);h.move(76);assert.equal(h.commits.length,0);h.down(2);assert.equal(h.commits.length,1);assert.equal(h.controller.active,false);
 h.controller.arm(press);h.controller.cancel();assert.equal(h.controller.active,false);assert.equal(h.enabled,true);
 }finally{h.restore();}
});

test('putting the active origin on a node gives own-center spin without moving that node',()=>{
 const h=harness();try{h.frame.origin=[...h.b.position];h.down(2);h.move(76);h.down(99);const result=h.commits[0].nodes.get(address(h.b.origin));assert.deepEqual(result.position,h.b.position);const q=new T.Quaternion(result.orientation.x,result.orientation.y,result.orientation.z,result.orientation.w);assert.ok(q.angleTo(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),Math.PI/2))<1e-7);}finally{h.restore();}
});

test('middle-click mouse mode keeps its selected group after cursor leaves and commits only on confirmation',()=>{
 const h=harness();try{
 h.select([h.a.origin,h.b.origin]);const press={clientX:1,clientY:100};assert.equal(h.controller.startWheel(press,h.a.origin),true);
 const wheel=deltaY=>h.controller.wheel({clientX:99,clientY:10,deltaY,deltaMode:0,preventDefault(){},stopImmediatePropagation(){}});
 assert.equal(wheel(-100),false);h.move(76);const visual=h.visuals.get(address(h.a.origin)).group,q=visual.quaternion.clone();assert.ok(q.angleTo(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),Math.PI/2))<1e-7);
 h.move(100);assert.ok(visual.quaternion.angleTo(q)>1e-3);h.move(76);assert.equal(h.commits.length,0);assert.equal(h.controller.active,true);
 h.controller.confirm();assert.equal(h.commits.length,1);assert.equal(h.commits[0].nodes.size,2);assert.equal(h.controller.active,false);assert.equal(wheel(100),false);
 }finally{h.restore();}
});
test('mouse rotation cancellation restores original transforms without committing and preserves snap controls',()=>{
 const h=harness();try{
 h.controller.startWheel({clientX:2,clientY:100},h.b.origin);h.controller.snapParameter.commit(.5);
 h.move(76);
 assert.ok(h.visuals.get(address(h.b.origin)).group.quaternion.angleTo(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),Math.PI/4))<1e-7);
 h.controller.cancel();assert.equal(h.commits.length,0);assert.deepEqual(h.visuals.get(address(h.b.origin)).group.position.toArray(),h.b.position);assert.equal(h.controller.active,false);
 }finally{h.restore();}
});
test('mouse rotation uses the selection when activated over empty space',()=>{
 const h=harness();try{h.select([h.a.origin,h.b.origin]);assert.equal(h.controller.startWheel({clientX:99,clientY:100}),true);h.move(76);h.controller.confirm();assert.equal(h.commits[0].nodes.size,2);}finally{h.restore();}
});

test('empty-space mouse camera orbit preserves radius around the origin and never edits selected nodes',()=>{const h=harness();try{h.select([h.a.origin,h.b.origin]);h.frame.origin=[2,0,0];const before=structuredClone(h.world),distance=h.camera.position.distanceTo(new T.Vector3(2,0,0));assert.equal(h.controller.startWheel({clientX:99,clientY:100},undefined,true),true);h.move(76);assert.ok(Math.abs(h.camera.position.distanceTo(new T.Vector3(2,0,0))-distance)<1e-7);assert.deepEqual(h.target.toArray(),[2,0,0]);assert.ok(h.camera.position.distanceTo(new T.Vector3(0,0,10))>1,'wheel must move the camera, not just retarget it');h.controller.confirm();assert.equal(h.cameraCommits,1);assert.equal(h.commits.length,0);assert.deepEqual(h.world,before);}finally{h.restore();}});
test('cancelled camera orbit restores eye, up and original look-at point',()=>{const h=harness();try{h.target.set(1,2,3);const eye=h.camera.position.clone(),up=h.camera.up.clone(),target=h.target.clone();h.controller.startWheel({clientX:99,clientY:100},undefined,true);h.move(124);h.controller.cancel();assert.ok(h.camera.position.equals(eye));assert.ok(h.camera.up.equals(up));assert.ok(h.target.equals(target));assert.equal(h.cameraCommits,0);}finally{h.restore();}});

test('camera looking directly at the orbit origin moves around reference up rather than only rolling',()=>{const h=harness();try{h.frame.origin=[0,0,0];h.frame.activeAxes=[0,1];const eye=h.camera.position.clone();h.controller.startWheel({clientX:99,clientY:100},undefined,true);h.move(76);assert.ok(h.camera.position.distanceTo(eye)>1);assert.ok(Math.abs(h.camera.position.length()-eye.length())<1e-7);assert.ok(h.camera.up.equals(new T.Vector3(0,1,0)));h.controller.cancel();}finally{h.restore();}});

test('MB3 targeting aims the active object without rotating the reference frame or moving the target',()=>{const h=harness();try{const before=structuredClone(h.frame);h.controller.startWheel({clientX:1,clientY:100},h.a.origin);assert.equal(h.controller.aimAt(h.c.origin),true);assert.equal(h.controller.active,false);assert.equal(h.commits.length,1);assert.equal(h.commits[0].f,undefined);const n=h.commits[0].nodes.get(address(h.a.origin)),q=new T.Quaternion(n.orientation.x,n.orientation.y,n.orientation.z,n.orientation.w);assert.ok(new T.Vector3(0,0,1).applyQuaternion(q).distanceTo(new T.Vector3(0,1,0))<1e-7);assert.deepEqual(n.position,h.a.position);assert.deepEqual(h.frame,before);assert.equal(h.commits[0].nodes.has(address(h.c.origin)),false);}finally{h.restore();}});
test('MB3 targeting during origin rotation aims only the origin axes',()=>{const h=harness();try{h.controller.startWheel({clientX:4,clientY:100});assert.equal(h.controller.aimAt(h.c.origin),true);assert.equal(h.commits[0].nodes.size,0);assert.equal(h.commits[0].f.id,h.frame.id);assert.deepEqual(h.commits[0].f.state.origin,[0,0,0]);assert.ok(new T.Vector3(...h.commits[0].f.state.z).distanceTo(new T.Vector3(0,1,0))<1e-7);}finally{h.restore();}});

test('origin mouse rotation starts by frame identity without pointing at the origin',()=>{const h=harness();try{const before=structuredClone(h.world.nodes);assert.equal(h.controller.startFrameWheel({clientX:99,clientY:100},h.frame.id),true);assert.equal(h.controller.active,true);assert.equal(h.controller.frameId,h.frame.id);h.move(124);h.controller.confirm();assert.equal(h.commits.length,1);assert.equal(h.commits[0].nodes.size,0);assert.equal(h.commits[0].f.id,h.frame.id);assert.deepEqual(h.world.nodes,before);}finally{h.restore();}});

for(const axis of [0,1,2])test(`MB3 changes the clicked ${'XYZ'[axis]} axis direction while keeping an orthogonal frame`,()=>{const h=harness();try{h.frame.activeAxes=[];h.frame.origin=[3,4,5];const original=structuredClone(h.world.nodes);assert.equal(h.controller.startFrameWheel({clientX:4,clientY:100},h.frame.id,axis),true);h.move(76);h.controller.confirm();const state=h.commits[0].f.state,basis=[state.x,state.y,state.z].map(v=>new T.Vector3(...v)),before=[h.frame.x,h.frame.y,h.frame.z];assert.deepEqual(state.origin,[3,4,5]);assert.ok(basis[axis].distanceTo(new T.Vector3(...before[axis]))>1);for(const v of basis)assert.ok(Math.abs(v.length()-1)<1e-7);assert.ok(Math.abs(basis[0].dot(basis[1]))<1e-7);assert.ok(basis[0].clone().cross(basis[1]).distanceTo(basis[2])<1e-7);assert.deepEqual(h.world.nodes,original);}finally{h.restore();}});

test('dial choices preview a step from rest, rollback hover, retain clicks and Enter authors once',async()=>{
 const h=harness();try{
  h.down(1);const original=h.visuals.get(address(h.a.origin)).group.quaternion.clone();
  h.key('Shift');await Promise.resolve();h.mathView.number.preview(.5);
  const half=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),Math.PI/4);
  assert.ok(h.visuals.get(address(h.a.origin)).group.quaternion.angleTo(half)<1e-7);assert.equal(h.commits.length,0);
  h.mathView.number.restore();assert.ok(h.visuals.get(address(h.a.origin)).group.quaternion.angleTo(original)<1e-7);
  h.mathView.number.commit(.5);assert.ok(h.visuals.get(address(h.a.origin)).group.quaternion.angleTo(half)<1e-7);
  h.mathView.close();h.move(100);assert.ok(h.visuals.get(address(h.a.origin)).group.quaternion.angleTo(half)<1e-7);assert.equal(h.commits.length,0);
  h.key('Enter');assert.equal(h.commits.length,1);assert.equal(h.controller.active,false);
  const q=h.commits[0].nodes.get(address(h.a.origin)).orientation;assert.ok(new T.Quaternion(q.x,q.y,q.z,q.w).angleTo(half)<1e-7);
 }finally{h.restore();}
});
test('Enter confirms a clicked dial value while open and Escape cancels without authoring',async()=>{
 const h=harness();try{
  h.down(1);h.key('Shift');await Promise.resolve();h.mathView.number.commit(2);h.key('Enter');
  assert.equal(h.commits.length,1);assert.equal(h.controller.mathDialOpen,false);
  h.down(1);h.key('Shift');await Promise.resolve();h.mathView.number.commit(.5);h.controller.cancel();assert.equal(h.commits.length,1);
  assert.deepEqual(h.visuals.get(address(h.a.origin)).group.quaternion.toArray(),[0,0,0,1]);
 }finally{h.restore();}
});
