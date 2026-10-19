import test from "node:test";
import assert from "node:assert/strict";
import { emptyDocument } from "../src/graph/structural.ts";
import { DEFAULT_SPATIAL_SETTINGS as settings, createPlacement, movePlacement, reparentStructure, reparentVisual, compactLayout, siblingCollisions, worldPositions } from "../src/graph/layout3d.ts";

const entity = (id) => ({ id, label: id, aliases: [], notes: "" });
const fixture = () => {
  const doc = emptyDocument(); doc.entities.push(entity("system"), entity("part"), entity("other"));
  const root = createPlacement(doc, "system", null, settings, { x: 0, y: 0, z: 0 });
  const child = createPlacement(root.next, "part", root.placementId, settings);
  const other = createPlacement(child.next, "other", root.placementId, settings);
  return { doc: other.next, root: root.placementId, child: child.placementId, other: other.placementId };
};
test("new children leave a readable binder run near the parent and avoid sibling footprints", () => {
  const { doc, child, other } = fixture();
  const position = doc.placements.find((p) => p.id === child).spatialPosition;
  assert.ok(position.x >= 6 && position.x <= 12);
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
  assert.ok(Math.max(...rootPositions.map((p) => Math.abs(p.x))) < 100);
  assert.equal(siblingCollisions(compact, settings).length, 0);
  assert.equal(JSON.stringify({ entities: compact.entities, compositions: compact.compositions, relationships: compact.relationships }), originalKnowledge);
  assert.equal(doc.placements[1].spatialPosition.x, 0);
});
