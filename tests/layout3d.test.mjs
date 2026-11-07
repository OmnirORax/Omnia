import test from "node:test";
import assert from "node:assert/strict";
import { emptyDocument } from "../src/graph/structural.ts";
import { DEFAULT_SPATIAL_SETTINGS as settings, createPlacement, movePlacement, reparentStructure, reparentVisual, compactLayout, siblingCollisions, worldPositions } from "../src/graph/layout3d.ts";
import { ARROW_LENGTH, BINDER_LENGTH_RATIO } from '../src/graph/binderGeometry.ts';
import { nodeFootprint, visualFootprint } from '../src/graph/assets.ts';
import { placementFootprint, minimumBinderDistance, binderGap } from '../src/graph/binderGeometry.ts';
import { labelSize, defaultNodeOffset } from '../src/graph/labels.ts';

const entity = (id) => ({ id, label: id, aliases: [], notes: "" });
test("compaction preserves authored root directions, independent of a coarse drag grid", () => {
  const doc = emptyDocument();
  for(let i=0;i<12;i++) {
    const id=`n${i}`; doc.entities.push(entity(id));
    doc.placements.push({id,entityId:id,parentId:null,position:{x:i*1000,y:0},spatialPosition:{x:i*100,y:i*50,z:i*30},hidden:false,collapsed:false});
  }
  const packed=compactLayout(doc,{kind:"all"},{...settings,spacing:5});
  assert.equal(siblingCollisions(packed,settings).length,0);
  assert.deepEqual(compactLayout(packed,{kind:"all"},{...settings,spacing:5}),packed);
  assert.deepEqual(compactLayout(doc,{kind:"all"},{...settings,spacing:0}),packed);
  const anchor=packed.placements.find((p,i)=>JSON.stringify(p.spatialPosition)===JSON.stringify(doc.placements[i].spatialPosition));
  assert.ok(anchor);
  for(let i=0;i<packed.placements.length;i++) {
    if(packed.placements[i].id===anchor.id)continue;
    const scale=(packed.placements[i].spatialPosition.x-anchor.spatialPosition.x)/(doc.placements[i].spatialPosition.x-anchor.spatialPosition.x);
    assert.ok(scale>0 && scale<1);
    for(const axis of ["x","y","z"])
      assert.ok(Math.abs((packed.placements[i].spatialPosition[axis]-anchor.spatialPosition[axis])-(doc.placements[i].spatialPosition[axis]-anchor.spatialPosition[axis])*scale)<1e-8,"directions from the root anchor stay authored");
  }
  assert.deepEqual(packed.entities,doc.entities); assert.deepEqual(packed.relationships,doc.relationships);
  assert.deepEqual(packed.placements.map(p=>p.position),doc.placements.map(p=>p.position));
});
test("selection compaction preserves fixed placements and closes individual parent-local gaps", () => {
  const {doc,root,child,other}=fixture();
  doc.placements.find(p=>p.id===child).spatialPosition={x:400,y:0,z:0};
  doc.placements.find(p=>p.id===other).spatialPosition={x:800,y:0,z:0};
  const selected=compactLayout(doc,{kind:"selection",placementIds:[child,other]},settings);
  assert.deepEqual(selected.placements.find(p=>p.id===root),doc.placements.find(p=>p.id===root));
  assert.equal(siblingCollisions(selected,settings).length,0);
  const positions=selected.placements.filter(p=>[child,other].includes(p.id)).map(p=>p.spatialPosition);
  assert.ok(positions[0].x>0 && positions[1].x<10);
  assert.ok(positions[1].x>positions[0].x && positions[1].x-positions[0].x<400);
  assert.ok(positions.every(p=>p.y===0 && p.z===0));
  assert.deepEqual(selected.compositions,doc.compositions);
});
const fixture = () => {
  const doc = emptyDocument(); doc.entities.push(entity("system"), entity("part"), entity("other"));
  const root = createPlacement(doc, "system", null, settings, { x: 0, y: 0, z: 0 });
  const child = createPlacement(root.next, "part", root.placementId, settings);
  const other = createPlacement(child.next, "other", root.placementId, settings);
  return { doc: other.next, root: root.placementId, child: child.placementId, other: other.placementId };
};
test("new children use the nearest clear grid position beside the parent and avoid sibling footprints", () => {
  const { doc, child, other } = fixture();
  const position = doc.placements.find((p) => p.id === child).spatialPosition;
  assert.equal(Math.hypot(position.x,position.y,position.z),settings.spacing);
  assert.equal(position.z, 0);
  const labelExtent = nodeFootprint(settings.nodeCellSize).height;
  assert.ok(Math.abs(position.y)-labelExtent >= BINDER_LENGTH_RATIO*ARROW_LENGTH);
  assert.equal(siblingCollisions(doc, settings).length, 0);
  assert.notDeepEqual(doc.placements.find((p) => p.id === other).spatialPosition, position);
  assert.equal(doc.entities.length, 3);
});
test("snapped movement resolves occupancy without changing charted knowledge", () => {
  const { doc, child, other } = fixture();
  const relations = JSON.stringify(doc.relationships), compositions = JSON.stringify(doc.compositions);
  const occupied = doc.placements.find((p) => p.id === child).spatialPosition;
  const moved = movePlacement(doc, other, { x: occupied.x + 0.1, y: 0.1, z: 0 }, settings);
  assert.notDeepEqual(moved.placements.find((p) => p.id === other).spatialPosition, occupied);
  assert.equal(siblingCollisions(moved, settings).length, 0);
  assert.equal(JSON.stringify(moved.relationships), relations);
  assert.equal(JSON.stringify(moved.compositions), compositions);
  assert.deepEqual(doc.placements.find((p) => p.id === child).spatialPosition, occupied);
});
test('default children leave cell and binder clearance with snapping off',()=>{
  const doc=emptyDocument();doc.entities=[entity('root'),entity('child')];
  const root=createPlacement(doc,'root',null,{...settings,spacing:0},{x:0,y:0,z:0});
  const child=createPlacement(root.next,'child',root.placementId,{...settings,spacing:0});
  const p=child.next.placements.find(p=>p.id===child.placementId).spatialPosition;
  const gap=Math.hypot(p.x,p.y,p.z)-nodeFootprint(settings.nodeCellSize).height;
  assert.ok(gap>=BINDER_LENGTH_RATIO*ARROW_LENGTH);
  assert.equal(Math.hypot(p.x,p.y,p.z),nodeFootprint(settings.nodeCellSize).height+binderGap({label:"visual nesting"},{x:0,y:-1,z:0}));assert.equal(p.x,0);assert.equal(p.z,0);
  const moved=movePlacement(child.next,child.placementId,{x:0,y:0,z:0},settings);
  assert.notDeepEqual(moved.placements.find(p=>p.id===child.placementId).spatialPosition,{x:0,y:0,z:0});
});
test('node labels do not force a long horizontal binder',()=>{
  const doc=emptyDocument();doc.entities=[{...entity('root'),label:'A long system name with many details'},entity('child')];
  const root=createPlacement(doc,'root',null,settings,{x:0,y:0,z:0});
  const child=createPlacement(root.next,'child',root.placementId,settings);
  const p=child.next.placements.find(p=>p.id===child.placementId).spatialPosition;
  assert.equal(Math.hypot(p.x,p.y,p.z),2);
  assert.equal(p.x,0);assert.equal(p.z,0);
});
test('new children still prefer positive X when equally near clear directions fit',()=>{
  const doc=emptyDocument();doc.entities=[{...entity('root'),label:''},{...entity('child'),label:''}];
  doc.compositions=[{id:'contains',parentId:'root',childId:'child',text:''}];
  const root=createPlacement(doc,'root',null,settings,{x:0,y:0,z:0});
  const child=createPlacement(root.next,'child',root.placementId,settings);
  assert.deepEqual(child.next.placements.find(p=>p.id===child.placementId).spatialPosition,{x:2,y:0,z:0});
});
test("shift nesting updates authored composition, avoids cycles and retains identity", () => {
  const { doc, root, child, other } = fixture();
  doc.compositions.push({ id: "old-container", parentId: "system", childId: "other" });
  const nested = reparentStructure(doc, other, child, settings);
  assert.equal(nested.placements.find((p) => p.id === other).parentId, child);
  assert.ok(nested.compositions.some((c) => c.parentId === "part" && c.childId === "other"));
  assert.ok(nested.compositions.some((c) => c.id === "old-container"), "existing canonical containment stays charted");
  assert.equal(nested.entities.length, doc.entities.length);
  assert.equal(siblingCollisions(nested, settings).length, 0);
  assert.throws(() => reparentStructure(nested, root, other, settings), /cycle/);
});
test("visual reparenting leaves charted composition untouched", () => {
  const { doc, child, other } = fixture();
  const moved = reparentVisual(doc, other, child, settings);
  assert.equal(moved.placements.find((p) => p.id === other).parentId, child);
  assert.deepEqual(moved.compositions, doc.compositions);
  assert.equal(siblingCollisions(moved, settings).length, 0);
  assert.throws(() => reparentVisual(moved, child, other, settings), /cycle/);
});
test("explicit compact layout makes a scattered software-like atlas local and collision-free", () => {
  const doc = emptyDocument();
  for (let i = 0; i < 6; i++) {
    doc.entities.push(entity(`system-${i}`));
    doc.placements.push({ id: `root-${i}`, entityId: `system-${i}`, parentId: null,
      position: { x: 80 + i * 50000, y: 80 }, spatialPosition: { x: i * 700, y: 0, z: 0 }, collapsed: false, hidden: false });
    for (let j = 0; j < 8; j++) {
      doc.entities.push(entity(`part-${i}-${j}`));
      doc.placements.push({ id: `child-${i}-${j}`, entityId: `part-${i}-${j}`, parentId: `root-${i}`,
        position: { x: 28, y: 104 + j * 112 }, spatialPosition: { x: j * 70, y: 0, z: 0 }, collapsed: true, hidden: false });
      doc.compositions.push({ id: `composition-${i}-${j}`, parentId: `system-${i}`, childId: `part-${i}-${j}` });
    }
  }
  const originalKnowledge = JSON.stringify({ entities: doc.entities, compositions: doc.compositions, relationships: doc.relationships });
  const compact = compactLayout(doc, { kind: "all" }, settings);
  const worlds = worldPositions(compact);
  const rootPositions = compact.placements.filter((p) => p.parentId === null).map((p) => worlds.get(p.id));
  assert.ok(Math.max(...rootPositions.map(p=>p.x))-Math.min(...rootPositions.map(p=>p.x)) < 3500);
  for(let i=1;i<rootPositions.length;i++)
    assert.ok(rootPositions[i].x>rootPositions[i-1].x && rootPositions[i].y===0 && rootPositions[i].z===0);
  assert.equal(siblingCollisions(compact, settings).length, 0);
  assert.equal(JSON.stringify({ entities: compact.entities, compositions: compact.compositions, relationships: compact.relationships }), originalKnowledge);
  assert.equal(doc.placements[1].spatialPosition.x, 0);
});

test('detaching a placement preserves the whole subtree world position, identity and canonical knowledge',async()=>{
 const {detachPlacement}=await import('../src/graph/layout3d.ts');const {validateDocument}=await import('../src/graph/structural.ts');
 const {doc,root,child,other}=fixture();
 const nested=reparentStructure(doc,other,child,settings),before=worldPositions(nested),original=JSON.stringify(nested);
 const detached=detachPlacement(nested,child),after=worldPositions(detached);
 assert.equal(detached.placements.find(p=>p.id===child).parentId,null);assert.equal(detached.placements.find(p=>p.id===other).parentId,child);
 for(const [id,point] of before)assert.deepEqual(after.get(id),point,'no occurrence moves during detachment');
 assert.deepEqual(detached.entities,nested.entities);assert.deepEqual(detached.compositions,nested.compositions);assert.deepEqual(detached.relationships,nested.relationships);
 assert.equal(JSON.stringify(nested),original);assert.deepEqual(worldPositions(validateDocument(JSON.parse(JSON.stringify(detached)))),after);
 assert.equal(detachPlacement(detached,child),detached,'detaching a root is a no-op');assert.throws(()=>detachPlacement(detached,'missing'),/Missing placement/);
 const legacy=validateDocument({...doc,placements:doc.placements.map(({spatialPosition,...p})=>p)}),legacyAfter=detachPlacement(legacy,child);
 assert.deepEqual(worldPositions(legacyAfter),worldPositions(legacy),'legacy coordinate fallback is made explicit without a visual jump');
});

test('detach connection removes only current containment and preserves saved-view coordinates and descendants',async()=>{
 const {detachNodeConnection}=await import('../src/graph/layout3d.ts');const {validateDocument}=await import('../src/graph/structural.ts');
 const {doc,root,child,other}=fixture();const nested=reparentStructure(doc,other,child,settings);
 const augmented=validateDocument({...nested,compositions:[...nested.compositions,{id:'unrelated',parentId:'system',childId:'other'}],layoutViews:[{id:'saved',name:'Saved',rule:'manual',positions:nested.placements.map((p,i)=>({placementId:p.id,position:{x:i+10,y:i*2,z:i*3}}))}]});
 const savedDoc={...augmented,placements:augmented.placements.map(p=>({...p,spatialPosition:augmented.layoutViews[0].positions.find(entry=>entry.placementId===p.id).position}))},savedWorlds=worldPositions(savedDoc),worlds=worldPositions(augmented);
 const next=detachNodeConnection(augmented,child);assert.deepEqual(worldPositions(next),worlds);
 assert.ok(!next.compositions.some(c=>c.parentId==='system'&&c.childId==='part'));assert.ok(next.compositions.some(c=>c.id==='unrelated'));assert.ok(next.compositions.some(c=>c.parentId==='part'&&c.childId==='other'));
 const nextSaved={...next,placements:next.placements.map(p=>({...p,spatialPosition:next.layoutViews[0].positions.find(entry=>entry.placementId===p.id).position}))};assert.deepEqual(worldPositions(nextSaved),savedWorlds,'switching saved layout does not reinterpret former local coordinates as root coordinates');
 assert.deepEqual(next.entities,augmented.entities);assert.deepEqual(next.relationships,augmented.relationships);assert.deepEqual(next.placements.find(p=>p.id===other),augmented.placements.find(p=>p.id===other));
 assert.deepEqual(validateDocument(JSON.parse(JSON.stringify(next))),next);
});

test('a detached variant occurrence becomes independently visible without deleting its canonical variant',async()=>{
 const {detachPlacement}=await import('../src/graph/layout3d.ts');const {ensureVariantPlacements}=await import('../src/graph/structural.ts');
 const doc=emptyDocument();doc.entities=[entity('owner'),entity('variant')];doc.variants=[{id:'v',ownerId:'owner',entityId:'variant',position:{x:8,y:2,z:4}}];
 const placed=createPlacement(doc,'owner',null,settings),withVariant=ensureVariantPlacements(placed.next),occurrence=withVariant.placements.find(p=>p.variantOwner);
 const next=detachPlacement(withVariant,occurrence.id),detached=next.placements.find(p=>p.id===occurrence.id);
 assert.equal(detached.parentId,null);assert.equal(detached.variantOwner,undefined);assert.deepEqual(next.variants,withVariant.variants);assert.deepEqual(worldPositions(next),worldPositions(withVariant));
});

test('exact cursor placement preserves its requested point despite grid snapping and overlap',()=>{
 const doc=emptyDocument();doc.entities=[entity('a'),entity('b')];
 const point={x:1.234,y:-.765,z:3.456},first=createPlacement(doc,'a',null,{...settings,spacing:5},point,'exact');
 assert.deepEqual(worldPositions(first.next).get(first.placementId),point);
 const overlapping=createPlacement(first.next,'b',null,{...settings,spacing:5},point,'exact');assert.deepEqual(worldPositions(overlapping.next).get(overlapping.placementId),point,'an explicit pointer target cannot be replaced by a nearby packed/grid point');
 assert.throws(()=>createPlacement(doc,'a',null,settings,undefined,'exact'),/requires a position/);
});

test('exact child placement retains its parent and projects back to the requested world point',()=>{
 const doc=emptyDocument();doc.entities=[entity('parent'),entity('child')];
 const parent=createPlacement(doc,'parent',null,settings,{x:10,y:20,z:30},'exact'),world={x:12.125,y:18.75,z:33.5},origin=worldPositions(parent.next).get(parent.placementId);
 const local={x:world.x-origin.x,y:world.y-origin.y,z:world.z-origin.z},child=createPlacement(parent.next,'child',parent.placementId,settings,local,'exact');
 assert.equal(child.next.placements.find(p=>p.id===child.placementId).parentId,parent.placementId);assert.deepEqual(worldPositions(child.next).get(child.placementId),world);
 assert.deepEqual(worldPositions(child.next).get(parent.placementId),origin);
});


test('uniform cell geometry and arrangement ignore content while content sizing remains independent',()=>{
 const {doc,root,child}=fixture(),changed=structuredClone(doc);
 for(const e of changed.entities)e.label='Very long independent content '.repeat(15);
 for(const p of changed.placements)p.visual={character:'Ω',size:5,showText:true};
 const spatial={...settings,spacing:0,nodeCellSize:1.25};
 const cells=d=>d.placements.map(p=>placementFootprint(d,p,spatial.nodeCellSize));
 assert.deepEqual(cells(doc),cells(changed));
 assert.deepEqual(cells(doc)[0],{width:1.25,height:1.25,depth:1.25,sphere:false});
 assert.notDeepEqual(visualFootprint(labelSize(doc.entities[0].label)),visualFootprint(labelSize(changed.entities[0].label),changed.placements[0].visual),'content retains its independent natural envelope');
 const positions=d=>d.placements.map(p=>p.spatialPosition);
 assert.deepEqual(positions(compactLayout(doc,{kind:'all'},spatial)),positions(compactLayout(changed,{kind:'all'},spatial)));
 assert.deepEqual(siblingCollisions(doc,spatial),siblingCollisions(changed,spatial));
 const binding={source:root,target:child,label:'',visual:undefined};
 assert.equal(minimumBinderDistance(doc,binding,{x:1,y:0,z:0},1.25),minimumBinderDistance(changed,binding,{x:1,y:0,z:0},1.25));
 const add=d=>createPlacement(d,'other',root,spatial).next.placements.at(-1).spatialPosition;
 assert.deepEqual(add(doc),add(changed));
 assert.deepEqual(defaultNodeOffset('a','b',2),defaultNodeOffset('long '.repeat(30),'more '.repeat(50),2));
 assert.deepEqual(positions(changed),positions(doc),'reading cell geometry never repositions authored coordinates');
});
