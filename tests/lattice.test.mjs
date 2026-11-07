import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {emptyDocument,validateDocument} from '../src/graph/structural.ts';
import {worldPositions} from '../src/graph/coordinates.ts';
import {prepareLattice,cellAt,cellPoint,nearestCell,latticeCreatePoint,latticeMove,resolveLatticePoint,reconcileLattice,vacantCells} from '../src/graph/lattice.ts';
import {createLatticeField,latticeFrame,LATTICE_FIELD_CAPACITY} from '../src/latticeField.ts';
import {createPlacement,DEFAULT_SPATIAL_SETTINGS} from '../src/graph/layout3d.ts';
import {defaultSettings,normalizeSettings} from '../src/workspaceActions.ts';
import {switchLayoutView} from '../src/graph/presentation.ts';
const settings={...DEFAULT_SPATIAL_SETTINGS,latticeScale:1};
const point=(x,y=0,z=0)=>({x,y,z});
const fixture=(points)=>{const doc=emptyDocument();points.forEach((p,i)=>{const id=String(i);doc.entities.push({id,label:id,aliases:[],notes:''});doc.placements.push({id,entityId:id,parentId:null,position:{x:0,y:0},spatialPosition:p,collapsed:true,hidden:false});});return doc;};
test('one sparse global occupancy includes hidden nodes and all parent scopes; loading preserves originals',()=>{
 const doc=fixture([point(0),point(0),point(.1),point(3)]);doc.placements[1].hidden=true;doc.placements[2].parentId='3';
 const before=JSON.stringify(doc),index=prepareLattice(doc);assert.equal(index.cells.size,4);assert.equal(index.occupied.size,4);
 assert.equal(JSON.stringify(doc),before);assert.equal(prepareLattice(doc),index);
 for(const cell of index.cells.values())assert.ok(Object.values(cell).every(Number.isSafeInteger));
 assert.equal(index.cells.get('0').x,0);assert.equal(index.cells.get('3').x,3);
 const free=latticeCreatePoint(doc,point(0));assert.ok(!index.occupied.has(`${free.x},${free.y},${free.z}`));
});
test('nearest free cell minimizes actual click distance, including negative points and occupied shells',()=>{
 const occupied=new Set(['0,0,0','1,0,0','0,1,0']);
 for(const point of [{x:.49,y:.48,z:.1},{x:-.5,y:-.51,z:.1},{x:1.3,y:.1,z:0}]){
  const cell=nearestCell(point,c=>!occupied.has(`${c.x},${c.y},${c.z}`));
  const distance=c=>(c.x-point.x)**2+(c.y-point.y)**2+(c.z-point.z)**2;
  for(let x=-3;x<=3;x++)for(let y=-3;y<=3;y++)for(let z=-3;z<=3;z++)if(!occupied.has(`${x},${y},${z}`))assert.ok(distance(cell)<=distance({x,y,z})+1e-12);
 }
 assert.throws(()=>cellAt(point(Number.MAX_SAFE_INTEGER*2)),/exact integer/);
});
test('creation uses nearest unoccupied cell even for exact legacy calls and hidden foreign-parent nodes',()=>{
 const doc=fixture([point(0),point(1)]);doc.placements[0].hidden=true;
 const result=createPlacement(doc,'1',null,settings,point(.1),'exact');
 const worlds=worldPositions(result.next),world=worlds.get(result.placementId);
 assert.ok(Object.values(world).every(Number.isInteger));assert.notDeepEqual(world,point(0));assert.notDeepEqual(world,point(1));
 assert.deepEqual(result.next.entities,doc.entities);
});
test('whole-subtree movement preserves cell offsets and rejects occupied landings atomically',()=>{
 const doc=fixture([point(0),point(1),point(3)]);doc.placements[1].parentId='0';doc.placements[1].hidden=true;
 const before=JSON.stringify(doc);assert.throws(()=>latticeMove(doc,'0',point(2),1,true),/occupied/);assert.equal(JSON.stringify(doc),before);
 const next=latticeMove(doc,'0',point(5),1,true),worlds=worldPositions(next);
 assert.deepEqual(worlds.get('0'),point(5));assert.deepEqual(worlds.get('1'),point(6));assert.deepEqual(worlds.get('2'),point(3));
 assert.deepEqual(resolveLatticePoint(doc,'0',point(5),1,true),point(5));
 assert.equal(prepareLattice(next).occupied.size,3);
});
test('geometry reconciliation freezes historical occupied cells and retains a protected recovery view',()=>{
 const doc=fixture([point(.1),point(.2)]),before=JSON.stringify(doc),old=prepareLattice(doc);
 const candidate={...doc,placements:doc.placements.map(p=>p.id==='0'?{...p,spatialPosition:point(5)}:p)};
 const next=validateDocument(reconcileLattice(doc,candidate));
 assert.deepEqual(prepareLattice(next).cells.get('1'),old.cells.get('1'),'an unrelated collided legacy carrier stays where it was displayed');
 assert.equal(next.layoutViews.length,2);const recovery=next.layoutViews.find(v=>v.preservePositions);assert.equal(recovery.preservePositions,true);
 assert.deepEqual(recovery.positions.map(p=>p.position),[point(.1),point(.2)]);
 assert.equal(JSON.stringify(doc),before);
 assert.doesNotThrow(()=>switchLayoutView(next,'authored-layout'));
 const restored=switchLayoutView(next,recovery.id),edited={...restored,placements:restored.placements.map(p=>({...p,spatialPosition:point(Number(p.id)+10)}))};
 const viewed=switchLayoutView({...edited,layoutViews:[...edited.layoutViews,{id:'other',name:'Other',rule:'manual',positions:[]}]},'other');
 assert.deepEqual(viewed.layoutViews.find(v=>v.id===recovery.id).positions,recovery.positions);
 const reloaded=validateDocument(JSON.parse(JSON.stringify(next)));assert.deepEqual(prepareLattice(reloaded).cells,prepareLattice(next).cells);
});
test('nongeometry edits do not align or rewrite historical coordinates',()=>{
 const doc=fixture([point(.1),point(.2)]),next={...doc,entities:doc.entities.map(e=>({...e,label:'Renamed'}))};
 assert.equal(reconcileLattice(doc,next),next);assert.equal(next.layoutViews,undefined);
});
test('scale is independent of logical addresses and content; tiny positive scales persist',()=>{
 const base=defaultSettings();
 for(const scale of [1,.1,1e-12,1e-35,2]){const result=normalizeSettings({...base,spatial:{...base.spatial,latticeScale:scale,showVacantCells:true}});assert.equal(result.spatial.latticeScale,scale);assert.equal(result.spatial.showVacantCells,true);}
 for(const value of [0,-1,Infinity,NaN])assert.equal(normalizeSettings({...base,spatial:{...base.spatial,latticeScale:value}}).spatial.latticeScale,1);
 assert.deepEqual(cellPoint(point(100),1e-12),point(1e-10));
});
test('empty field is bounded instanced display data; it omits occupied cells and follows a fixed lattice slice',()=>{
 const doc=fixture([point(0),point(1)]),before=JSON.stringify(doc),field=createLatticeField(doc);
 const camera=new THREE.PerspectiveCamera(60,1,.1,1000);camera.position.z=10;camera.lookAt(0,0,0);field.update(new THREE.Vector3(),camera);
 assert.ok(field.object.isInstancedMesh);assert.ok(field.object.count>0&&field.object.count<=LATTICE_FIELD_CAPACITY);
 assert.equal(vacantCells(doc,point(0)).length,623);assert.equal(JSON.stringify(doc),before);
 const matrix=new THREE.Matrix4();for(let i=0;i<field.object.count;i++){field.object.getMatrixAt(i,matrix);const p=new THREE.Vector3().setFromMatrixPosition(matrix);assert.ok(!(p.x===0&&p.y===0)&&!(p.x===1&&p.y===0));}
 field.dispose();
});
test('camera-relative arrows choose distinct integer world axes and never rotate the lattice',()=>{
 for(const angles of [[.3,.7,.1],[1,2,3],[0,Math.PI/4,0]]){
  const frame=latticeFrame(new THREE.Quaternion().setFromEuler(new THREE.Euler(...angles)));
  const x=new THREE.Vector3(1,0,0).applyQuaternion(frame).round(),y=new THREE.Vector3(0,1,0).applyQuaternion(frame).round();
  assert.equal(x.lengthSq(),1);assert.equal(y.lengthSq(),1);assert.equal(x.dot(y),0);
 }
});


test('tiny-scale held arrows commit a nonzero logical step instead of applying a world epsilon floor',async()=>{
 const {createNudgeGesture}=await import('../src/navigation/nudgeGesture.ts');let committed;
 const gesture=createNudgeGesture({now:()=>0,schedule:()=>1,cancel:()=>{},snapshot:()=>({step:1e-12,frame:new THREE.Quaternion(),preview(){},restore(){},commit:delta=>committed=delta.clone()})});
 gesture.update(['nudgeRight']);gesture.update([]);assert.equal(committed.x,1e-12);
});

test('dense historical overlaps use a sparse shared search frontier, not an allocated lattice volume',()=>{
 const doc=fixture(Array.from({length:500},()=>point(0))),source=JSON.stringify(doc),index=prepareLattice(doc);
 assert.equal(index.occupied.size,500);assert.equal(index.cells.size,500);assert.equal(JSON.stringify(doc),source);
});

test('deleting a historical collision never moves an unrelated projected carrier',()=>{
 const doc=fixture([point(.1),point(.2)]),index=prepareLattice(doc),next=reconcileLattice(doc,{...doc,placements:doc.placements.filter(p=>p.id!=='0')});
 assert.deepEqual(prepareLattice(next).cells.get('1'),index.cells.get('1'));
});


test('recovery metadata roundtrips and an exhausted view budget rejects before source data changes',()=>{
 const doc=fixture([point(.1)]),candidate={...doc,placements:doc.placements.map(p=>({...p,spatialPosition:point(2)}))};
 doc.layoutViews=Array.from({length:100},(_,i)=>({id:`view${i}`,name:`View ${i}`,rule:'manual',positions:[]}));
 const before=JSON.stringify(doc);assert.throws(()=>reconcileLattice(doc,{...candidate,layoutViews:doc.layoutViews}),/layout view/);assert.equal(JSON.stringify(doc),before);
 const bad={...doc,layoutViews:[{id:'bad',name:'Bad',rule:'manual',positions:[],preservePositions:'yes'}]};assert.throws(()=>validateDocument(bad),/recovery/);
});

test('the empty field hides safely outside exact address range and can recover after camera movement',()=>{
 const field=createLatticeField(fixture([]));const q=new THREE.PerspectiveCamera(60,1,.1,1000);q.position.z=10;q.lookAt(0,0,0);field.update(new THREE.Vector3(1e30,0,0),q);assert.equal(field.object.count,0);
 field.update(new THREE.Vector3(),q);assert.ok(field.object.count>0&&field.object.count<=LATTICE_FIELD_CAPACITY);field.dispose();
});

test('layout previews use the same fixed occupancy and reject duplicates and hidden obstacles',async()=>{
 const {prepareLatticeTransform}=await import('../src/graph/lattice.ts');const doc=fixture([point(0),point(1),point(2)]);doc.placements[2].hidden=true;
 const resolve=prepareLatticeTransform(doc,['0','1'],1,.1);
 assert.equal(resolve(new Map([['0',point(.2)],['1',point(.3)]])),undefined);
 assert.equal(resolve(new Map([['0',point(.01)],['1',point(.02)]])),undefined);
 const free=resolve(new Map([['0',point(.51)],['1',point(.62)]]));
 assert.deepEqual(free,new Map([['0',point(.5)],['1',point(.6000000000000001)]]));
});

test('navigation adapts displayed coordinates and prepares layout constraints once per gesture',async()=>{
 const {createNavigationGesture}=await import('../src/navigation/gesture.ts');const {NAV_DEFAULTS}=await import('../src/navigation/options.ts');
 const doc=fixture([point(20)]),camera=new THREE.PerspectiveCamera(),scene=new THREE.Scene(),anchor=new THREE.Vector3(.2,0,0),group=new THREE.Group();
 camera.position.set(0,0,8);camera.lookAt(new THREE.Vector3());let prepared=0,committed=0;
 const gesture=createNavigationGesture({camera,scene,canvas:{setPointerCapture(){},hasPointerCapture(){return false;},releasePointerCapture(){}},target:()=>new THREE.Vector3(),nodes:()=>new Map([['0',{anchor,group}]]),document:()=>doc,coordinates:()=>new Map([['0',point(.2)]]),selection:()=>new Set(['0']),pointed:()=> '0',request(){},enabled(){},rebind(){},feedback(){},remember(){},commit(){committed++;},prepareLayout(){prepared++;return ()=>undefined;}});
 const event={pointerId:1,button:0,clientX:0,clientY:0};assert.equal(gesture.begin(event,{...NAV_DEFAULTS,mode:'layout',pivot:'selection',axis:'z'}),true);
 assert.equal(scene.children[0].position.x,.2);gesture.move({...event,clientX:80});gesture.move({...event,clientX:120});gesture.finish();
 assert.equal(prepared,1);assert.equal(committed,0);assert.equal(anchor.x,.2);gesture.dispose();
});

test('vacant lattice span follows zoom and aspect without changing real cell size',()=>{
 const field=createLatticeField(fixture([])),target=new THREE.Vector3(),camera=new THREE.PerspectiveCamera(60,1,.1,10000),matrix=new THREE.Matrix4();
 const measure=()=>{field.update(target,camera);let x=0,y=0;for(let i=0;i<field.object.count;i++){field.object.getMatrixAt(i,matrix);const p=new THREE.Vector3().setFromMatrixPosition(matrix),scale=new THREE.Vector3().setFromMatrixScale(matrix);assert.ok(Math.abs(scale.x-1)<1e-6);assert.equal(p.x,Math.round(p.x));x=Math.max(x,Math.abs(p.x));y=Math.max(y,Math.abs(p.y));}return {x,y,count:field.object.count};};
 camera.position.z=5;camera.lookAt(target);const near=measure();
 camera.position.z=50;const far=measure();assert.ok(far.x>near.x&&far.y>near.y);assert.ok(far.count>near.count);
 camera.aspect=2;camera.updateProjectionMatrix();const wide=measure();assert.ok(wide.x>far.x);assert.ok(Math.abs(wide.y-far.y)<=1);
 camera.position.z=1000;const overview=measure();assert.ok(overview.x>wide.x);assert.ok(overview.count<=LATTICE_FIELD_CAPACITY);
 camera.position.set(10,12,14);camera.lookAt(target);assert.ok(measure().count>0);field.dispose();
});

test('tilted near-horizon span preserves local coverage instead of spending the budget at the far plane',()=>{
 const camera=new THREE.PerspectiveCamera(55,1.8,.001,100000),field=createLatticeField(fixture([])),matrix=new THREE.Matrix4();
 camera.position.set(14.094298433892122,5.48165164671577,-13.0882484267546);
 camera.up.set(.77983384030233,.44349949855861626,.4417775190042786);camera.lookAt(0,0,0);
 field.update(new THREE.Vector3(),camera);let visible=0,nearby=0;
 for(let i=0;i<field.object.count;i++){field.object.getMatrixAt(i,matrix);const world=new THREE.Vector3().setFromMatrixPosition(matrix),p=world.clone().project(camera);if(Math.abs(p.x)<1&&Math.abs(p.y)<1&&p.z>=-1&&p.z<=1){visible++;if(world.length()<20)nearby++;}}
 assert.ok(visible>100,`${visible} visible markers`);assert.ok(nearby>50,`${nearby} nearby markers`);assert.ok(field.object.count<=LATTICE_FIELD_CAPACITY);field.dispose();
});

test('screen sampling covers both screen axes at oblique zoom without an arbitrary world horizon',()=>{
 const field=createLatticeField(fixture([])),camera=new THREE.PerspectiveCamera(55,1.8,.001,100000),matrix=new THREE.Matrix4();
 camera.position.set(14.094298433892122,5.48165164671577,-13.0882484267546);camera.up.set(.77983384030233,.44349949855861626,.4417775190042786);camera.lookAt(0,0,0);
 field.update(new THREE.Vector3(),camera,1440,800);let minX=1,maxX=-1,minY=1,maxY=-1;
 for(let i=0;i<field.object.count;i++){field.object.getMatrixAt(i,matrix);const p=new THREE.Vector3().setFromMatrixPosition(matrix).project(camera);if(p.z< -1||p.z>1)continue;minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);}
 assert.ok(minX<-.9&&maxX>.9&&minY<-.9&&maxY>.9);assert.ok(field.object.count<=LATTICE_FIELD_CAPACITY);field.dispose();
});

test('shared navigator creation conversion uses projected parent cells and does not mutate legacy coordinates',async()=>{
 const {localLatticePoint,latticeWorld}=await import('../src/graph/lattice.ts');
 const doc=fixture([point(.1),point(.2)]),before=JSON.stringify(doc),world={x:5,y:-2,z:3},parent=latticeWorld(doc,'1');
 const local=localLatticePoint(doc,'1',world);assert.deepEqual(local,{x:world.x-parent.x,y:world.y-parent.y,z:world.z-parent.z});
 assert.deepEqual(localLatticePoint(doc,null,world),world);assert.equal(localLatticePoint(doc,'1',undefined),undefined);assert.throws(()=>localLatticePoint(doc,'missing',world),/parent/);assert.equal(JSON.stringify(doc),before);
});
