import test from "node:test";
import assert from "node:assert/strict";
import { emptyDocument } from "../src/graph/structural.ts";
import { DEFAULT_SPATIAL_SETTINGS as settings, createPlacement, movePlacement, reparentStructure, reparentVisual, compactLayout, siblingCollisions, worldPositions } from "../src/graph/layout3d.ts";

const entity = (id) => ({ id, label: id, aliases: [], notes: "" });
test("compaction contracts the authored arrangement proportionally, independent of a coarse drag grid", () => {
  const doc = emptyDocument();
  for(let i=0;i<12;i++) {
    const id=`n${i}`; doc.entities.push(entity(id));
    doc.placements.push({id,entityId:id,parentId:null,position:{x:i*1000,y:0},spatialPosition:{x:i*100,y:i*50,z:i*30},hidden:false,collapsed:false});
  }
  const packed=compactLayout(doc,{kind:"all"},{...settings,spacing:5});
  assert.equal(siblingCollisions(packed,settings).length,0);
  assert.deepEqual(compactLayout(packed,{kind:"all"},{...settings,spacing:5}),packed);
  assert.deepEqual(compactLayout(doc,{kind:"all"},{...settings,spacing:0}),packed);
  const scale=(packed.placements[1].spatialPosition.x-packed.placements[0].spatialPosition.x)/100;
  assert.ok(scale>0 && scale<1);
  for(let i=1;i<packed.placements.length;i++) for(const axis of ["x","y","z"])
    assert.ok(Math.abs((packed.placements[i].spatialPosition[axis]-packed.placements[0].spatialPosition[axis])-(doc.placements[i].spatialPosition[axis]-doc.placements[0].spatialPosition[axis])*scale)<1e-8,"relative directions and distance ratios stay authored");
  assert.deepEqual(packed.entities,doc.entities); assert.deepEqual(packed.relationships,doc.relationships);
  assert.deepEqual(packed.placements.map(p=>p.position),doc.placements.map(p=>p.position));
});
test("selection compaction preserves fixed placements and contracts around the selected center", () => {
  const {doc,root,child,other}=fixture();
  doc.placements.find(p=>p.id===child).spatialPosition={x:400,y:0,z:0};
  doc.placements.find(p=>p.id===other).spatialPosition={x:800,y:0,z:0};
  const selected=compactLayout(doc,{kind:"selection",placementIds:[child,other]},settings);
  assert.deepEqual(selected.placements.find(p=>p.id===root),doc.placements.find(p=>p.id===root));
  assert.equal(siblingCollisions(selected,settings).length,0);
  const positions=selected.placements.filter(p=>[child,other].includes(p.id)).map(p=>p.spatialPosition);
  assert.ok(Math.abs((positions[0].x+positions[1].x)/2-600)<1e-8);
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
  assert.equal(position.x,2);
  assert.equal(position.y, 0); assert.equal(position.z, 0);
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
test('default children leave only footprint clearance with snapping off and never occupy their parent label',()=>{
  const doc=emptyDocument();doc.entities=[entity('root'),entity('child')];
  const root=createPlacement(doc,'root',null,{...settings,spacing:0},{x:0,y:0,z:0});
  const child=createPlacement(root.next,'child',root.placementId,{...settings,spacing:0});
  const p=child.next.placements.find(p=>p.id===child.placementId).spatialPosition;
  assert.ok(p.x>1 && p.x<2.5);assert.equal(p.y,0);assert.equal(p.z,0);
  const moved=movePlacement(child.next,child.placementId,{x:0,y:0,z:0},settings);
  assert.notDeepEqual(moved.placements.find(p=>p.id===child.placementId).spatialPosition,{x:0,y:0,z:0});
});
test('wide labels choose a nearer clear direction instead of forcing a long horizontal binder',()=>{
  const doc=emptyDocument();doc.entities=[{...entity('root'),label:'A long system name with many details'},entity('child')];
  const root=createPlacement(doc,'root',null,settings,{x:0,y:0,z:0});
  const child=createPlacement(root.next,'child',root.placementId,settings);
  const p=child.next.placements.find(p=>p.id===child.placementId).spatialPosition;
  assert.equal(Math.hypot(p.x,p.y,p.z),2);
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
