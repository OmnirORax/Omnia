import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyDocument,
  editorView,
  parseDocument,
  validateDocument,
  ensureVariantPlacements,
  expandPlacement,
  toggleSubtree,
  reconcileEditor,
} from "../src/graph/structural.ts";
import {
  addVariant,
  projectVariants,
  nodeEntityId,
  NODE_OPTIONS,
} from "../src/graph/variants.ts";
import { createPlacement, movePlacement, reparentStructure, DEFAULT_SPATIAL_SETTINGS as settings } from "../src/graph/layout3d.ts";
import { chartedBinders } from "../src/graph/presentation.ts";
import { projectSpatial } from "../src/graph/spatial.ts";
import { validateChangeSet } from "../src/graph/changeset.ts";
import { nodeClicks } from "../src/nodeClicks.ts";
function fixture() {
  const doc = emptyDocument();
  doc.entities.push({ id: "owner", label: "System", aliases: [], notes: "" });
  doc.placements.push({
    id: "first",
    entityId: "owner",
    parentId: null,
    position: { x: 0, y: 0 },
    spatialPosition: { x: 4, y: 3, z: 2 },
    collapsed: true,
    hidden: false,
  });
  return doc;
}
test("variants use ordinary placements, hidden by default, without asserting composition", () => {
  const doc = fixture(), { next, variant } = addVariant(doc, "owner", "Alternative design");
  const placement = next.placements.find((p) => p.entityId === variant.entityId);
  assert.deepEqual(placement.variantOwner, { placementId: "first", variantId: variant.id });
  assert.deepEqual(next.placements[0], doc.placements[0]);
  assert.deepEqual(next.compositions, []);
  assert.equal(editorView(next).nodes.length, 1);
  const open = editorView(next, new Set(["first"])), graph = projectSpatial(open);
  assert.equal(graph.nodes.filter((n) => n.visible).length, 2, "owner collapse does not hide revealed variants");
  assert.equal(projectVariants(next, graph.nodes).instances.get(placement.id).ownerNodeId, "first");
  assert.equal(chartedBinders(next, open).find((b) => b.target === placement.id).kind, "variant");
  assert.deepEqual(parseDocument(JSON.stringify(next)), next);
  assert.equal(doc.entities.length, 1);
  assert.deepEqual(NODE_OPTIONS.map((o) => o.id), ["variants"]);
});
test("legacy variants migrate once, preserving referents, positions, appearance and original knowledge", () => {
  const doc = fixture();
  doc.entities.push({ id: "alternative", label: "Alternative", aliases: ["alias"], notes: "Existing notes" });
  doc.variants = [{ id: "v", ownerId: "owner", entityId: "alternative", position: { x: 8, y: 2, z: 4 }, appearance: { color: "#aa77ff", opacity: 0.6 } }];
  const migrated = parseDocument(JSON.stringify(doc));
  assert.deepEqual(migrated.entities, doc.entities);
  assert.deepEqual(migrated.variants, doc.variants);
  assert.deepEqual(migrated.placements[0], doc.placements[0]);
  assert.deepEqual(migrated.placements[1].spatialPosition, doc.variants[0].position);
  assert.deepEqual(migrated.placements[1].appearance, doc.variants[0].appearance);
  assert.deepEqual(parseDocument(JSON.stringify(migrated)), migrated, "stable placement IDs on reload");
  const removed = { ...migrated, placements: migrated.placements.slice(0, 1) };
  assert.deepEqual(parseDocument(JSON.stringify(removed)), removed, "reload does not undo a placement removal");
  assert.equal(ensureVariantPlacements(removed, "first").placements.length, 2, "explicit reveal can restore a reference");
});
test("variants support ordinary children, deeper expansion, typed connections and reuse", () => {
  const { next, variant } = addVariant(fixture(), "owner");
  const v = next.placements.find((p) => p.entityId === variant.entityId);
  next.entities.push({ id: "child", label: "Child", aliases: [], notes: "" }, { id: "leaf", label: "Leaf", aliases: [], notes: "" });
  next.compositions.push({ id: "vc", parentId: variant.entityId, childId: "child" }, { id: "cl", parentId: "child", childId: "leaf" });
  const expanded = toggleSubtree(next, v.id);
  const child = expanded.placements.find((p) => p.entityId === "child");
  assert.equal(child.parentId, v.id);
  assert.equal(expanded.placements.find((p) => p.entityId === "leaf").parentId, child.id);
  const closed = projectSpatial(editorView(expanded));
  assert.deepEqual(closed.nodes.filter((n) => n.visible).map((n) => n.id), ["first"], "closing owner variants hides the whole variant subtree");
  const open = editorView(expanded, new Set(["first"]));
  assert.equal(projectSpatial(open).nodes.filter((n) => n.visible).length, 4);
  const connected = reconcileEditor(expanded, open, { ...open, relationships: [{ id: "link", source: v.id, target: "first", label: "depends" }] });
  assert.equal(connected.relationships[0].participants[0].entityId, variant.entityId);
  assert.equal(chartedBinders(connected, editorView(connected, new Set(["first"]))).filter((b) => b.kind === "composition").length, 2);
  const reused = createPlacement(connected, variant.entityId, null, settings);
  const contents = expandPlacement(reused.next, reused.placementId);
  assert.equal(contents.entities.length, connected.entities.length, "reusing a variant does not duplicate knowledge");
  assert.ok(contents.placements.some((p) => p.parentId === reused.placementId && p.entityId === "child"));
  const moved = movePlacement(contents, v.id, { x: 10, y: 4, z: 2 }, settings);
  assert.deepEqual(moved.variants, contents.variants);
  assert.deepEqual(moved.compositions, contents.compositions);
  const collapsed = toggleSubtree(expanded, v.id);
  assert.ok(collapsed.placements.filter((p) => p.id !== "first").every((p) => p.collapsed));
});
test("owner references share variant identities with independent ordinary placement coordinates", () => {
  const { next, variant } = addVariant(fixture(), "owner");
  const reused = createPlacement(next, "owner", null, settings);
  const references = reused.next.placements.filter((p) => p.entityId === variant.entityId);
  assert.equal(references.length, 2);
  assert.notEqual(references[0].id, references[1].id);
  const moved = movePlacement(reused.next, references[0].id, { x: 10, y: 4, z: 2 }, settings);
  assert.deepEqual(moved.placements.find((p) => p.id === references[1].id), references[1]);
  assert.equal(editorView(moved, new Set([reused.placementId])).nodes.filter((n) => nodeEntityId(moved, n.id) === variant.entityId).length, 1);
});
test("invalid ownership, dangling references and cycles are rejected", () => {
  const { next, variant } = addVariant(fixture(), "owner");
  assert.throws(
    () => validateDocument({ ...next, variants: [{ ...variant, ownerId: "missing" }] }),
    /variant owner/,
  );
  assert.throws(
    () => validateDocument({ ...next, variants: [{ ...variant, entityId: "owner" }] }),
    /ownership/,
  );
  assert.throws(
    () =>
      validateDocument({
        ...next,
        variants: [...next.variants, { id: "cycle", ownerId: variant.entityId, entityId: "owner" }],
      }),
    /cycle/,
  );
  assert.throws(
    () => validateDocument({ ...next, variants: [...next.variants, { ...variant }] }),
    /Duplicate/,
  );
});
test("ordinary reparenting on variants records composition and rejects visibility cycles atomically", () => {
  const { next, variant } = addVariant(fixture(), "owner");
  const v = next.placements.find((p) => p.entityId === variant.entityId);
  next.entities.push({ id: "other", label: "Other", notes: "", aliases: [] });
  const placed = createPlacement(next, "other", null, settings);
  const nested = reparentStructure(placed.next, placed.placementId, v.id, settings);
  assert.ok(nested.compositions.some((c) => c.parentId === variant.entityId && c.childId === "other"));
  assert.equal(nested.placements.find((p) => p.id === placed.placementId).parentId, v.id);
  assert.throws(() => reparentStructure(nested, "first", placed.placementId, settings), /cycle/i);
  const before = JSON.stringify(nested);
  assert.throws(() => validateDocument({ ...nested, placements: nested.placements.map((p) => p.id === v.id ? { ...p, variantOwner: { placementId: "missing", variantId: variant.id } } : p) }), /reference/);
  assert.equal(JSON.stringify(nested), before);
});
test("AI can propose owned variants with normal review and stale-revision protection", () => {
  const doc = fixture();
  const proposal = {
    format: "omnium-changeset",
    version: 1,
    id: "owned-variant",
    baseRevision: doc.revision,
    operations: [
      {
        op: "createEntity",
        entity: { id: "alternative", label: "Alternative", aliases: [], notes: "" },
      },
      { op: "addVariant", variant: { id: "v", ownerId: "owner", entityId: "alternative" } },
    ],
  };
  const preview = validateChangeSet(doc, proposal);
  assert.equal(doc.variants, undefined);
  assert.equal(preview.next.variants.length, 1);
  assert.match(preview.lines[1], /no structural containment/);
  assert.deepEqual(preview.next.compositions, []);
  assert.throws(() => validateChangeSet({ ...doc, revision: 1 }, proposal), /Stale/);
});
test("single-click options and double-click expansion never fire together", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const events = [],
    clicks = nodeClicks(
      (id) => events.push(["single", id]),
      (id) => events.push(["double", id]),
    );
  clicks.click("first");
  t.mock.timers.tick(100);
  clicks.click("first");
  t.mock.timers.tick(400);
  assert.deepEqual(events, [["double", "first"]]);
  clicks.click("first");
  t.mock.timers.tick(400);
  assert.deepEqual(events.at(-1), ["single", "first"]);
  clicks.click("first");
  clicks.cancel();
  t.mock.timers.tick(400);
  assert.equal(events.length, 2, "drag/cancel cannot open options afterward");
});
