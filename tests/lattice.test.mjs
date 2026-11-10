import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {emptyDocument,validateDocument} from '../src/graph/structural.ts';
import {worldPositions} from '../src/graph/coordinates.ts';
import {prepareLattice,cellAt,cellPoint,nearestCell,latticeCreatePoint,latticeMove,resolveLatticePoint,reconcileLattice} from '../src/graph/lattice.ts';
import {latticeFrame} from '../src/latticeField.ts';
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

test('shared navigator creation conversion uses projected parent cells and does not mutate legacy coordinates',async()=>{
 const {localLatticePoint,latticeWorld}=await import('../src/graph/lattice.ts');
 const doc=fixture([point(.1),point(.2)]),before=JSON.stringify(doc),world={x:5,y:-2,z:3},parent=latticeWorld(doc,'1');
 const local=localLatticePoint(doc,'1',world);assert.deepEqual(local,{x:world.x-parent.x,y:world.y-parent.y,z:world.z-parent.z});
 assert.deepEqual(localLatticePoint(doc,null,world),world);assert.equal(localLatticePoint(doc,'1',undefined),undefined);assert.throws(()=>localLatticePoint(doc,'missing',world),/parent/);assert.equal(JSON.stringify(doc),before);
});


test('Composer stroke sampling is bounded and includes the endpoint in 2D and 3D',async()=>{
 const {paintSamples}=await import('../src/omnic/paintStroke.ts');
 const samples=paintSamples(point(0),point(10,5,2),1);assert.deepEqual(samples.at(-1),point(10,5,2));assert.equal(paintSamples(point(0),point(10000),1).length,64);
 assert.deepEqual(paintSamples({x:0,y:0},{x:1,y:0},1),[{x:.5,y:0},{x:1,y:0}]);
});
test('painting copies source content independently, skips occupied/repeated cells and commits an immutable batch',async()=>{
 const {paintNodes}=await import('../src/graph/paintNodes.ts');const doc=fixture([point(0),point(3)]);doc.entities[0].notes='template';doc.placements[1].hidden=true;const before=JSON.stringify(doc);
 const next=paintNodes(doc,[point(0),point(1),point(1),point(3),point(2)],'0',null,settings);
 assert.equal(next.placements.length,4);assert.equal(next.entities.length,4);assert.equal(JSON.stringify(doc),before);assert.equal(next.entities.at(-1).notes,'template');assert.notEqual(next.entities.at(-1).id,'0');validateDocument(next);
 assert.equal(paintNodes(doc,[point(0),point(3)],undefined,null,settings),doc);
 const blank=paintNodes(doc,[point(4)],undefined,null,settings);assert.equal(blank.entities.at(-1).label,'');assert.throws(()=>paintNodes(doc,[point(4)],'missing',null,settings));
});

test('paint confirmation retains exact preview cells under an off-grid parent',async()=>{
 const {paintNodes}=await import('../src/graph/paintNodes.ts');const doc=fixture([point(.2),point(.3)]),targets=[point(4),point(5),point(6)];
 const next=reconcileLattice(doc,paintNodes(doc,targets,undefined,'1',settings));const worlds=worldPositions(next);
 assert.deepEqual(next.placements.slice(2).map(p=>worlds.get(p.id)),targets);
});

test('retired empty-cell setting is unavailable while legacy data and lattice behavior survive',async()=>{
 const {SETTINGS_PROPERTY_ADAPTERS}=await import('../src/properties/settingsAdapter.ts');
 const original={spatial:{...DEFAULT_SPATIAL_SETTINGS,showVacantCells:true}};
 const restored=normalizeSettings(original);
 assert.equal(restored.spatial.showVacantCells,true,'legacy value is archived');
 assert.equal(SETTINGS_PROPERTY_ADAPTERS['spatial.placement'].channels['placement.vacantCells'],undefined,'retired property cannot be invoked');
 assert.equal(original.spatial.showVacantCells,true);
 assert.ok(prepareLattice(fixture([point(0)])).occupied.size);
});
