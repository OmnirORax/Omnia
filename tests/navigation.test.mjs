import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { frontOnPose, navigateCamera, navigationRotation } from '../src/navigation/model.ts';
import { NAV_DEFAULTS as CONTEXT_DEFAULTS } from '../src/navigation/options.ts';
import { transformTargets, transformPlacements } from '../src/navigation/transforms.ts';
import { constrainDrag, moveTrackball, trackballPoint } from '../src/navigation/trackball.ts';
import { createNavigationGesture } from '../src/navigation/gesture.ts';
import { emptyDocument, parseDocument, validateDocument } from '../src/graph/structural.ts';
import { createActionHistory } from '../src/ui/actionHistory.ts';
import { worldPositions } from '../src/graph/coordinates.ts';
const NAV_DEFAULTS = { ...CONTEXT_DEFAULTS, mode: "orbit" };
const near = (a, b) => assert.ok(Math.abs(a-b) < 1e-7, `${a} ≠ ${b}`);
const vectorNear = (a, b) => ['x','y','z'].forEach(key => near(a[key], b[key]));
const pose = () => ({ position: new THREE.Vector3(0, 2, 8), target: new THREE.Vector3(), up: new THREE.Vector3(0,1,0) });
const fixture = () => {
  const doc = emptyDocument();
  doc.entities = ['a','b'].map(id => ({ id: 'entity-'+id, label: id, notes: '', aliases: [] }));
  doc.placements = ['a','b'].map((id,index) => ({ id, entityId: 'entity-'+id, parentId: index ? 'a' : null,
    position: index ? { x:28, y:104 } : { x:0, y:0 }, spatialPosition: { x:index ? 1 : 2, y:0, z:0 }, collapsed:false, hidden:false }));
  return validateDocument(doc);
};
test('orbit changes camera position around the explicit pivot, preserving radius and input snapshot', () => {
  const before = pose(), pivot = new THREE.Vector3(1,0,0), copy = before.position.clone();
  const after = navigateCamera(before, NAV_DEFAULTS, 120, 25, pivot);
  near(after.position.distanceTo(pivot), before.position.distanceTo(pivot));
  vectorNear(after.target, pivot); vectorNear(before.position, copy);
  assert.ok(after.position.distanceTo(before.position) > 1);
});
test('look rotates at camera origin with transported up and world-axis roll', () => {
  const before = pose();
  const after = navigateCamera(before, { ...NAV_DEFAULTS, mode:'look' }, 0, 30, new THREE.Vector3());
  vectorNear(after.position, before.position);
  near(after.position.distanceTo(after.target), before.position.distanceTo(before.target));
  near(after.up.length(), 1);
  const direction = after.target.clone().sub(after.position).normalize();
  assert.ok(direction.y < before.target.clone().sub(before.position).normalize().y, 'mouse down looks down');
  const roll = navigateCamera(before, { ...NAV_DEFAULTS, mode:'look', axis:'z' }, 100, 0, new THREE.Vector3());
  vectorNear(roll.position, before.position); assert.ok(roll.up.distanceTo(before.up) > .1);
});
test('walk translates position and target together, with explicit ground or vertical-axis constraints', () => {
  const before = pose(), after = navigateCamera(before, { ...NAV_DEFAULTS, mode:'walk' }, 100, -100, new THREE.Vector3());
  vectorNear(after.target.clone().sub(after.position), before.target.clone().sub(before.position));
  near(after.position.y, before.position.y);
  const vertical = navigateCamera(before, { ...NAV_DEFAULTS, mode:'walk', axis:'y' }, 50, -100, new THREE.Vector3());
  near(vertical.position.x, before.position.x); near(vertical.position.z, before.position.z);
  assert.ok(vertical.position.y > before.position.y);
});
test('node orientation round-trips separately from positions, children and knowledge identity', () => {
  const doc = fixture(), before = JSON.stringify(doc), rotation = { x:0, y:Math.SQRT1_2, z:0, w:Math.SQRT1_2 };
  const next = transformPlacements(doc, ['a'], rotation, {x:0,y:0,z:0}, false);
  assert.equal(JSON.stringify(doc), before);
  assert.equal(next.entities, doc.entities);
  assert.equal(next.placements[1], doc.placements[1]);
  vectorNear(next.placements[0].spatialPosition, doc.placements[0].spatialPosition);
  assert.deepEqual(parseDocument(JSON.stringify(next)).placements[0].orientation, rotation);
  assert.throws(() => validateDocument({ ...next, placements: [{ ...next.placements[0], orientation: {x:0,y:0,z:0,w:2} },next.placements[1]] }), /placement/);
});
test('layout rotation honors selected-only versus descendants without double-moving nested children', () => {
  const doc = fixture(), rotation = {x:0,y:Math.SQRT1_2,z:0,w:Math.SQRT1_2}, pivot = {x:0,y:0,z:0};
  const alone = transformPlacements(doc, transformTargets(doc,['a'],false), rotation, pivot, true);
  vectorNear(worldPositions(alone).get('a'), {x:0,y:0,z:-2});
  vectorNear(worldPositions(alone).get('b'), worldPositions(doc).get('b'));
  const tree = transformPlacements(doc, transformTargets(doc,['a','b'],true), rotation, pivot, true);
  vectorNear(worldPositions(tree).get('a'), {x:0,y:0,z:-2});
  vectorNear(worldPositions(tree).get('b'), {x:0,y:0,z:-3});
  assert.equal(tree.entities,doc.entities); assert.equal(tree.compositions,doc.compositions);
  assert.equal(tree.placements[0].orientation,undefined);
  assert.throws(() => transformTargets(doc,['a'],true,1), /at once/);
});
test('rotation gesture previews never persist; cancellation restores and release commits exactly once', () => {
  const doc = fixture(), serialized = JSON.stringify(doc), camera = new THREE.PerspectiveCamera();
  camera.position.set(0,2,8); const target = new THREE.Vector3(); camera.lookAt(target);
  const scene = new THREE.Scene(), group = new THREE.Group(), anchor = new THREE.Vector3(2,0,0);
  const captures = new Set(), selection = new Set(['a']); let commits=0, remembered=0;
  const engine = createNavigationGesture({ camera, scene, canvas: { setPointerCapture:id=>captures.add(id),hasPointerCapture:id=>captures.has(id),releasePointerCapture:id=>captures.delete(id) },
    target:()=>target, nodes:()=>new Map([['a',{group,anchor}]]), document:()=>doc, selection:()=>selection, pointed:()=> 'a',
    request:()=>{}, enabled:()=>{}, rebind:()=>{}, feedback:()=>{}, commit:()=>commits++, remember:()=>remembered++ });
  const down = { pointerId:1, button:2, clientX:100,clientY:100 }, move = {...down,clientX:180};
  assert.equal(engine.begin(down,{...NAV_DEFAULTS,mode:'orient'}),true);
  assert.equal(engine.begin({...down,pointerId:2},NAV_DEFAULTS),false);
  assert.equal(engine.acceptsRelease({...down,button:0}),false);
  engine.move(move); assert.ok(group.quaternion.angleTo(new THREE.Quaternion()) > .1);
  assert.equal(JSON.stringify(doc),serialized); engine.finish(true);
  near(group.quaternion.angleTo(new THREE.Quaternion()),0); assert.equal(commits,0);
  engine.begin(down,{...NAV_DEFAULTS,mode:'orient'}); engine.move(move); engine.move({...move,clientX:190}); engine.finish(); engine.finish();
  assert.equal(commits,1); assert.equal(remembered,0); assert.equal(captures.size,0);
  engine.dispose();
});
test('camera gesture view history is separate from node data and cancels cleanly', () => {
  const doc=fixture(), camera=new THREE.PerspectiveCamera(); camera.position.set(0,2,8); const target=new THREE.Vector3(); camera.lookAt(target);
  const start=camera.position.clone(); let commits=0, views=0;
  const engine=createNavigationGesture({camera,scene:new THREE.Scene(),canvas:{setPointerCapture(){},hasPointerCapture(){return false;},releasePointerCapture(){}},
    target:()=>target,nodes:()=>undefined,document:()=>doc,selection:()=>new Set(),pointed:()=>undefined,request(){},enabled(){},rebind(){},feedback(){},commit(){commits++;},remember(){views++;}});
  const event={pointerId:1,button:2,clientX:0,clientY:0};
  engine.begin(event,NAV_DEFAULTS); engine.move({...event,clientX:100}); engine.finish(true); vectorNear(camera.position,start);
  engine.begin(event,NAV_DEFAULTS); engine.move({...event,clientX:100}); engine.finish();
  assert.equal(views,1); assert.equal(commits,0); engine.dispose();
});

test('pan preserves rolled camera facing while translating in its view plane', () => {
  const before=pose(); before.up.set(1,1,0).normalize();
  const after=navigateCamera(before,{...NAV_DEFAULTS,mode:'pan'},100,50,new THREE.Vector3());
  vectorNear(after.up,before.up);
  vectorNear(after.target.clone().sub(after.position),before.target.clone().sub(before.position));
});
test('legacy pan/off preferences and supported sensitivity survive navigation discovery', async () => {
  const { defaultSettings, normalizeSettings } = await import('../src/workspaceActions.ts');
  const { navigationOptions } = await import('../src/navigation/options.ts');
  const old=defaultSettings(); delete old.bindings['world.navigate']; old.mouse.rightEmpty='pan';
  assert.equal(navigationOptions(normalizeSettings(old)).mode,'pan');
  old.mouse.rightEmpty='none'; assert.equal(normalizeSettings(old).bindings['world.navigate'],'');
  const next=normalizeSettings({...old,functionValues:{'world.navigation':{'navigation.mode':'look','input.sensitivity':99}},bindings:{...old.bindings,'world.navigate':'MB2'}});
  assert.equal(navigationOptions(next).mode,'look'); assert.equal(navigationOptions(next).speed,2);
  assert.equal(next.bindings['world.navigate'],'MB2');
});
test('focus-point camera navigation does not scan the node inventory or raycast', () => {
  const camera=new THREE.PerspectiveCamera(); camera.position.set(0,2,8); const target=new THREE.Vector3(); camera.lookAt(target);
  const doc={get placements(){throw Error('camera-only mode scanned nodes');}};
  const engine=createNavigationGesture({camera,scene:new THREE.Scene(),canvas:{setPointerCapture(){},hasPointerCapture(){return false;},releasePointerCapture(){}},
    target:()=>target,nodes:()=>undefined,document:()=>doc,selection:()=>new Set(),pointed:()=>{throw Error('unneeded raycast');},request(){},enabled(){},rebind(){},feedback(){},commit(){throw Error('camera changed nodes');},remember(){}});
  assert.equal(engine.begin({pointerId:1,button:2,clientX:0,clientY:0},NAV_DEFAULTS),true);
  engine.move({pointerId:1,clientX:20,clientY:0}); engine.finish(); engine.dispose();
});


test('camera poses participate in chronological and selective Camera undo without touching nodes', () => {
  const history=createActionHistory(), camera=new THREE.PerspectiveCamera(); camera.position.set(0,2,8);
  const target=new THREE.Vector3(), start=camera.position.clone(); camera.lookAt(target);
  const snapshot=()=>({position:{...camera.position},target:{...target},up:{...camera.up}});
  history.register('world.camera',{read:snapshot,write:value=>{camera.position.copy(value.position);target.copy(value.target);camera.up.copy(value.up);camera.lookAt(target);}});
  const before=snapshot(), after=navigateCamera(pose(),{...NAV_DEFAULTS,mode:'look'},100,20,new THREE.Vector3());
  camera.position.copy(after.position);target.copy(after.target);camera.up.copy(after.up);
  history.record('world.camera',before,snapshot(),['camera'],['omnium']);
  history.configure({mode:'selective',categories:['camera']});
  assert.equal(history.travel('undo'),1); vectorNear(camera.position,start); vectorNear(target,new THREE.Vector3());
  assert.equal(history.travel('redo'),1); vectorNear(target,after.target);
});


test('vertical orbit and look pass both poles and complete repeated full turns even with old upright settings', () => {
  const start={position:new THREE.Vector3(0,0,8),target:new THREE.Vector3(),up:new THREE.Vector3(0,1,0)};
  for (const mode of ['orbit','look']) for (const angle of [-4*Math.PI,-Math.PI-.1,-Math.PI/2-.01,-Math.PI/2+.01,Math.PI/2-.01,Math.PI/2+.01,Math.PI+.1,4*Math.PI]) {
    const options={...NAV_DEFAULTS,mode,upright:true};
    const next=navigateCamera(start,options,0,angle/.005,new THREE.Vector3());
    const rotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-angle);
    vectorNear(next.up,start.up.clone().applyQuaternion(rotation));
    vectorNear(mode==='orbit'?next.position:next.target.clone().sub(next.position),(mode==='orbit'?start.position:start.target.clone().sub(start.position)).clone().applyQuaternion(rotation));
  }
});
test('diagonal camera drag and its reverse restore the complete frame across gestures', () => {
  for (const mode of ['orbit','look']) {
    const start=pose(), options={...NAV_DEFAULTS,mode};
    const moved=navigateCamera(start,options,740,480,new THREE.Vector3());
    const restored=navigateCamera(moved,options,-740,-480,new THREE.Vector3());
    vectorNear(restored.position,start.position);vectorNear(restored.target,start.target);vectorNear(restored.up,start.up);
  }
});

test('releasing orbit/look beyond a pole preserves the complete view through real control replacement', async () => {
  const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
  const { rebindOrbitControls } = await import('../src/navigation/orbit.ts');
  const root=new EventTarget(), canvas=new EventTarget(); canvas.style={}; canvas.ownerDocument=root; canvas.getRootNode=()=>root;
  for (const mode of ['orbit','look']) for (const angle of [Math.PI/2-.00001,Math.PI/2,Math.PI/2+.00001,Math.PI,3*Math.PI/2,2*Math.PI]) {
    const start={position:new THREE.Vector3(0,0,8),target:new THREE.Vector3(),up:new THREE.Vector3(0,1,0)}, camera=new THREE.PerspectiveCamera();
    camera.position.copy(start.position);camera.lookAt(start.target);
    const old=new OrbitControls(camera,canvas);old.minDistance=1.2;old.maxDistance=100000;
    const expected=navigateCamera(start,{...NAV_DEFAULTS,mode},0,angle/.005,new THREE.Vector3());
    camera.position.copy(expected.position);camera.up.copy(expected.up);old.target.copy(expected.target);
    const controls=rebindOrbitControls(camera,canvas,old);
    vectorNear(camera.position,expected.position);vectorNear(camera.up,expected.up);vectorNear(controls.target,expected.target);
    vectorNear(camera.getWorldDirection(new THREE.Vector3()),expected.target.clone().sub(expected.position).normalize());
    controls.dispose();
  }
});
test('camera history receives the final released pose after control rebinding', () => {
  const camera=new THREE.PerspectiveCamera();camera.position.set(0,2,8);const target=new THREE.Vector3();camera.lookAt(target);
  let rebound=false, remembered=false;
  const engine=createNavigationGesture({camera,scene:new THREE.Scene(),canvas:{setPointerCapture(){},hasPointerCapture(){return false;},releasePointerCapture(){}},
    target:()=>target,nodes:()=>undefined,document:()=>fixture(),selection:()=>new Set(),pointed:()=>undefined,request(){},enabled(){},feedback(){},commit(){},
    rebind(){rebound=true;},remember(){assert.equal(rebound,true);remembered=true;}});
  engine.begin({pointerId:1,button:2,clientX:0,clientY:0},NAV_DEFAULTS);engine.move({pointerId:1,clientX:0,clientY:400});engine.finish();
  assert.equal(remembered,true);engine.dispose();
});

function contextualHarness(selected = [], branch = null, pointed = undefined) {
  const doc = fixture(), camera = new THREE.PerspectiveCamera(50, 1, .01, 1000), target = new THREE.Vector3();
  camera.position.set(0,2,8); camera.lookAt(target);
  const hosts = new Map([...worldPositions(doc)].map(([id, p]) => {
    const group = new THREE.Group(); group.position.copy(p);
    group.add(new THREE.Mesh(new THREE.BoxGeometry(1,1,1), new THREE.MeshBasicMaterial()));
    return [id, {group, anchor: new THREE.Vector3(p.x,p.y,p.z)}];
  }));
  let hit = pointed, commits = [], inventories = 0, measurements = 0;
  const engine = createNavigationGesture({camera, scene:new THREE.Scene(), canvas:{getBoundingClientRect(){measurements++;return {left:0,top:0,width:400,height:400};},setPointerCapture(){},hasPointerCapture(){return false;},releasePointerCapture(){}},
    target:()=>target, nodes:()=>{inventories++;return hosts;}, document:()=>doc, selection:()=>new Set(selected), branch:()=>branch,
    pointed:()=>hit, request(){},enabled(){},rebind(){},feedback(){},commit:(...args)=>commits.push(args),remember(){}});
  const down = {pointerId:1,button:2,clientX:0,clientY:0};
  return {camera,target,hosts,engine,down,commits,setHit:id=>hit=id, inventoryCount:()=>inventories, measurementCount:()=>measurements};
}

test('context rotation turns the pointed object and freezes that target for the drag', () => {
  const h = contextualHarness(['a'], 'a', 'b'), start = h.camera.position.clone();
  assert.equal(h.engine.begin(h.down,CONTEXT_DEFAULTS),true);
  h.setHit('a'); h.engine.move({...h.down,clientX:80}); h.engine.finish();
  assert.deepEqual(h.commits[0][0],['b']); assert.equal(h.commits[0][3],false);
  vectorNear(h.camera.position,start); h.engine.dispose();
});

test('empty-space orbit keeps the active parent or child center rather than averaging selection', () => {
  for (const [branch,x] of [['a',2],['b',3]]) {
    const h = contextualHarness(['a','b'], branch), options = {...CONTEXT_DEFAULTS,actor:'camera'};
    assert.equal(h.engine.begin(h.down,options),true);
    h.engine.move({...h.down,clientX:40}); vectorNear(h.target,new THREE.Vector3(x,0,0));
    const radius=h.camera.position.distanceTo(h.target), scans=h.inventoryCount();
    h.engine.move({...h.down,clientX:80}); near(h.camera.position.distanceTo(h.target),radius);
    assert.equal(h.inventoryCount(),scans,'orbit does not scan object bounds');
    h.engine.finish(); assert.equal(h.commits.length,0); h.engine.dispose();
  }
});

test('empty space without selection looks from camera position; Camera overrides direct object rotation', () => {
  const world = contextualHarness(), start = world.camera.position.clone();
  world.engine.begin(world.down,CONTEXT_DEFAULTS); world.engine.move({...world.down,clientX:80});
  vectorNear(world.camera.position,start); assert.equal(world.inventoryCount(),0); world.engine.finish(); world.engine.dispose();
  const node = contextualHarness(['a'],'a','b'), before = node.camera.position.clone();
  node.engine.begin(node.down,{...CONTEXT_DEFAULTS,actor:'camera'});node.engine.move({...node.down,clientX:80});node.engine.finish();
  vectorNear(node.target,new THREE.Vector3(3,0,0)); assert.ok(node.camera.position.distanceTo(before)>.1);
  assert.equal(node.commits.length,0);node.engine.dispose();
});

test('rotating a selected graph preserves the zoom radius regardless of subtree extent and cancels completely', () => {
  const h=contextualHarness(['a'],'a'), start=h.camera.position.clone();
  h.hosts.get('b').group.position.x=100;
  const initialRadius=h.camera.position.distanceTo(new THREE.Vector3(2,0,0));
  h.engine.begin(h.down,CONTEXT_DEFAULTS); h.engine.move({...h.down,clientX:20});
  vectorNear(h.target,new THREE.Vector3(2,0,0));
  const radius=h.camera.position.distanceTo(h.target); near(radius,initialRadius); assert.equal(h.inventoryCount(),0);
  h.hosts.get('b').group.position.x=500;
  h.engine.move({...h.down,clientX:40});near(h.camera.position.distanceTo(h.target),radius);
  h.engine.finish(true);vectorNear(h.camera.position,start);vectorNear(h.target,new THREE.Vector3());h.engine.dispose();
});

function ball(start) {
  const center={x:0,y:0},radius=100;
  return {center,radius,frame:new THREE.Quaternion(),previous:trackballPoint(center,radius,start),rotation:new THREE.Quaternion()};
}
test('trackball grab position controls tilt versus rim spin and transports through rolled camera frame', () => {
  const center=ball({x:0,y:0}), edge=ball({x:100,y:0});
  const tilt=moveTrackball(center,{x:0,y:-30},1).clone();
  assert.ok(Math.abs(tilt.x)>.1);near(tilt.z,0);
  const spin=moveTrackball(edge,{x:100*Math.cos(.3),y:-100*Math.sin(.3)},1).clone();
  assert.ok(Math.abs(spin.z)>.1);near(spin.x,0);near(spin.y,0);
  const rolled=ball({x:0,y:0});rolled.frame.setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI/2);
  const rotated=moveTrackball(rolled,{x:0,y:-30},1);near(rotated.x,0);near(Math.abs(rotated.y),Math.abs(tilt.x));
});
test('trackball supports repeated full rim turns and reversed drags without a polar limit', () => {
  const state=ball({x:100,y:0});
  for(let i=1;i<=48;i++) moveTrackball(state,{x:100*Math.cos(i*Math.PI/12),y:-100*Math.sin(i*Math.PI/12)},1);
  near(state.rotation.angleTo(new THREE.Quaternion()),0);
  const start=ball({x:20,y:10});moveTrackball(start,{x:60,y:-30},1);moveTrackball(start,{x:20,y:10},1);
  near(start.rotation.angleTo(new THREE.Quaternion()),0);
});

test('object gesture snapshots trackball geometry once and cancellation restores object and camera', () => {
  const h=contextualHarness(['a'],'a','a'), before=h.hosts.get('a').group.quaternion.clone(), camera=h.camera.position.clone();
  h.engine.begin(h.down,CONTEXT_DEFAULTS);assert.equal(h.measurementCount(),1);
  const scans=h.inventoryCount();
  h.engine.move({...h.down,clientX:30});h.engine.move({...h.down,clientX:60,clientY:25});
  assert.ok(h.hosts.get('a').group.quaternion.angleTo(before)>.01);
  assert.equal(h.measurementCount(),1);assert.equal(h.inventoryCount(),scans);
  h.engine.finish(true);near(h.hosts.get('a').group.quaternion.angleTo(before),0);
  vectorNear(h.camera.position,camera);assert.equal(h.commits.length,0);h.engine.dispose();
});

test('trackball vertical motion continues beyond both rims through repeated full turns', () => {
  const state=ball({x:0,y:0});
  for(let i=1;i<=80;i++) {
    moveTrackball(state,{x:0,y:i*10},1);
    if(i===15 || i===25 || i===55) assert.ok(state.rotation.angleTo(new THREE.Quaternion())>.5,'turn continues past the old rim');
  }
  near(state.rotation.angleTo(new THREE.Quaternion()),0);
});
test('Ctrl freezes initial direction despite orthogonal jitter and releases without a jump', () => {
  const state={raw:{x:0,y:0},point:{x:0,y:0}};
  assert.deepEqual(constrainDrag(state,{x:1,y:1},true),{x:0,y:0});
  assert.deepEqual(constrainDrag(state,{x:2,y:10},true),{x:0,y:10});
  assert.deepEqual(constrainDrag(state,{x:40,y:50},true),{x:0,y:50});
  assert.deepEqual(constrainDrag(state,{x:40,y:50},false),{x:0,y:50});
  assert.deepEqual(constrainDrag(state,{x:45,y:55},false),{x:5,y:55});
});
test('Ctrl trackball holds one world axis for an off-center grab and ignores sideways jitter', () => {
  const start={x:30,y:20}, a=ball(start), b=ball(start);
  const dragA={raw:{...start},point:{...start}},dragB={raw:{...start},point:{...start}};
  for(let i=1;i<=60;i++) {
    moveTrackball(a,constrainDrag(dragA,{x:30,y:20+i*5},true),1,true);
    moveTrackball(b,constrainDrag(dragB,{x:30+(i===1?1:40*Math.sin(i)),y:20+i*5},true),1,true);
  }
  near(a.rotation.angleTo(b.rotation),0);
  const qaxis=new THREE.Vector3(a.rotation.x,a.rotation.y,a.rotation.z).normalize();
  near(Math.abs(qaxis.dot(a.lockedAxis)),1);
});
test('Ctrl navigation uses the saved pointer binding and does not revive cleared bindings', async () => {
  const {matchesPointerShortcut}=await import('../src/workspaceActions.ts');
  const event={button:2,ctrlKey:true,metaKey:false,altKey:false,shiftKey:false};
  assert.equal(matchesPointerShortcut('world.navigate',{},event),true);
  assert.equal(matchesPointerShortcut('world.navigate',{'world.navigate':''},event),false);
  assert.equal(matchesPointerShortcut('world.navigate',{'world.navigate':'MB1'},event),false);
  assert.equal(matchesPointerShortcut('world.navigate',{'world.navigate':'MB1'},{...event,button:0}),true);
});

test('front-on framing centers a rotated object, fits it without changing it, and refuses excessive distance', () => {
  const camera=new THREE.PerspectiveCamera(50,1.4,.05,1000), center=new THREE.Vector3(3,-2,5), orientation=new THREE.Quaternion().setFromEuler(new THREE.Euler(.5,.8,.3));
  const box=new THREE.Box3(new THREE.Vector3(-2,-4,0),new THREE.Vector3(8,1,9)), before=orientation.clone();
  const next=frontOnPose(camera,center,orientation,box,{min:1.2,max:100000});
  camera.position.copy(next.position);camera.up.copy(next.up);camera.lookAt(next.target);camera.updateMatrixWorld();
  vectorNear(center.clone().project(camera),new THREE.Vector3(0,0,center.clone().project(camera).z));
  near(camera.quaternion.angleTo(orientation),0);near(orientation.angleTo(before),0);
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]) {
    const p=new THREE.Vector3(x,y,z).project(camera);assert.ok(Math.abs(p.x)<1 && Math.abs(p.y)<1 && p.z<1);
  }
  assert.throws(()=>frontOnPose(camera,center,orientation,box,{min:1.2,max:2}),/distance range/);
});
test('node picking immediately after camera control replacement uses the released view without a render', async () => {
  const {OrbitControls}=await import('three/addons/controls/OrbitControls.js');
  const {rebindOrbitControls}=await import('../src/navigation/orbit.ts');
  const root=new EventTarget(),canvas=new EventTarget();canvas.style={};canvas.ownerDocument=root;canvas.getRootNode=()=>root;
  const camera=new THREE.PerspectiveCamera(50,1,.05,1000);camera.position.set(0,0,8);camera.lookAt(0,0,0);
  const old=new OrbitControls(camera,canvas);old.target.set(3,1,0);camera.position.set(3,1,8);
  const controls=rebindOrbitControls(camera,canvas,old);
  const plane=new THREE.Mesh(new THREE.PlaneGeometry(2,1),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));plane.position.copy(old.target);plane.updateMatrixWorld();
  const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(),camera);
  assert.ok(ray.intersectObject(plane).length>0);controls.dispose();
});
