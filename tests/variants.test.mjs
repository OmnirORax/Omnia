import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyDocument,
  editorView,
  parseDocument,
  validateDocument,
} from "../src/graph/structural.ts";
import {
  addVariant,
  projectVariants,
  moveVariant,
  nodeEntityId,
  NODE_OPTIONS,
} from "../src/graph/variants.ts";
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
test("variants are owned canonical references, never structural contents or copied placements", () => {
  const doc = fixture(),
    { next, variant } = addVariant(doc, "owner", "Alternative design");
  assert.equal(variant.ownerId, "owner");
  assert.equal(next.entities.find((e) => e.id === variant.entityId).label, "Alternative design");
  assert.deepEqual(next.placements, doc.placements);
  assert.deepEqual(next.compositions, []);
  assert.deepEqual(next.relationships, []);
  assert.deepEqual(parseDocument(JSON.stringify(next)), next);
  assert.equal(doc.entities.length, 1);
});
test("collapsed owners reveal only real variants in their session mode, without a floating add node", () => {
  const { next } = addVariant(fixture(), "owner");
  const graph = projectSpatial(editorView(next));
  assert.equal(projectVariants(next, graph.nodes, new Set()).nodes.length, 0);
  const open = projectVariants(next, graph.nodes, new Set(["first"]));
  assert.equal([...open.instances.values()].filter((n) => n.kind === "variant").length, 1);
  assert.equal(open.nodes.length, 1);
  assert.ok(open.nodes.every((n) => n.label !== "+"));
  assert.equal(open.binders[0].kind, "variant");
  assert.equal(next.placements[0].collapsed, true);
  assert.equal(
    projectVariants(parseDocument(JSON.stringify(next)), graph.nodes, new Set()).nodes.length,
    0,
  );
  assert.deepEqual(
    NODE_OPTIONS.map((o) => o.id),
    ["variants"],
  );
});
test("multiple owner references share variants while keeping distinct render identities", () => {
  const { next, variant } = addVariant(fixture(), "owner");
  next.placements.push({ ...next.placements[0], id: "second" });
  const graph = projectSpatial(editorView(next));
  const display = projectVariants(next, graph.nodes, new Set(["first", "second"]));
  const instances = [...display.instances].filter(([, item]) => item.kind === "variant");
  assert.equal(instances.length, 2);
  assert.notEqual(instances[0][0], instances[1][0]);
  assert.equal(instances[0][1].variant.entityId, variant.entityId);
  assert.equal(instances[1][1].variant.entityId, variant.entityId);
  const id = instances[0][0];
  const moved = moveVariant(next, id, { x: 10, y: 5, z: 2 }, [...graph.nodes, ...display.nodes], 2);
  assert.deepEqual(moved.variants[0].position, { x: 6, y: 2, z: 0 });
  assert.deepEqual(moved.placements, next.placements);
  assert.deepEqual(moved.compositions, next.compositions);
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
test("variant representation IDs remain distinct from authored IDs and grow linearly with depth", () => {
  let doc = fixture();
  doc.entities.push({ id: "variant-entity", label: "Variant", aliases: [], notes: "" });
  doc.variants = [{ id: "v", ownerId: "owner", entityId: "variant-entity" }];
  doc.placements.push({ ...doc.placements[0], id: 'variant:["first","v"]' });
  let structural = projectSpatial(editorView(doc)).nodes;
  const expanded = new Set(["first"]);
  let display = projectVariants(doc, structural, expanded);
  let node = [...display.instances].find(([, item]) => item.kind === "variant")[0];
  assert.ok(!doc.placements.some((p) => p.id === node));
  assert.equal(nodeEntityId(doc, node), "variant-entity");
  for (let i = 0; i < 20; i++) {
    const added = addVariant(doc, nodeEntityId(doc, node));
    doc = added.next;
    expanded.add(node);
    structural = projectSpatial(editorView(doc)).nodes;
    display = projectVariants(doc, structural, expanded);
    node = [...display.instances].find(
      ([, item]) => item.kind === "variant" && item.variant.id === added.variant.id,
    )[0];
  }
  assert.ok(
    node.length < 2000,
    "nested instance paths do not repeatedly escape the entire parent ID",
  );
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
