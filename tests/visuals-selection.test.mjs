import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyDocument,
  ensureVariantPlacements,
  parseDocument,
  validateDocument,
  editorView,
} from "../src/graph/structural.ts";
import { deleteConceptSubtrees, deletionSummary } from "../src/graph/selection.ts";
import {
  createPlacement,
  compactLayout,
  siblingCollisions,
  DEFAULT_SPATIAL_SETTINGS as settings,
} from "../src/graph/layout3d.ts";
import { chartedBinders } from "../src/graph/presentation.ts";
import { defaultSettings, loadSettings, keyConflict } from "../src/workspaceActions.ts";
const entity = (id) => ({ id, label: id, aliases: [], notes: "" });
const image = {
  id: "icon",
  name: "AI icon",
  kind: "image",
  dataUrl: `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0L24 24"/></svg>')}`,
};
function fixture() {
  let d = emptyDocument();
  d.entities = ["arm", "bone", "muscle", "variant", "outside", "unplaced"].map(entity);
  for (const id of ["arm", "outside"]) d = createPlacement(d, id, null, settings).next;
  const arm = d.placements.find((p) => p.entityId === "arm").id;
  d = createPlacement(d, "bone", arm, settings).next;
  d = createPlacement(d, "bone", null, settings).next;
  d.compositions = [
    { id: "a-b", parentId: "arm", childId: "bone" },
    { id: "b-m", parentId: "bone", childId: "muscle" },
  ];
  d.variants = [{ id: "v", ownerId: "arm", entityId: "variant" }];
  d.relationships = [
    {
      id: "external",
      typeId: "legacy-untyped",
      label: "signal",
      qualifierIds: [],
      participants: [
        { roleId: "source", entityId: "bone" },
        { roleId: "target", entityId: "outside" },
      ],
    },
  ];
  return { d: ensureVariantPlacements(d), arm };
}
test("global subtree deletion removes reused identities, unplaced structural contents and variants atomically", () => {
  const { d, arm } = fixture(),
    before = structuredClone(d);
  const summary = deletionSummary(d, [arm]);
  assert.deepEqual([...summary.entities].sort(), ["arm", "bone", "muscle", "variant"]);
  assert.equal(summary.otherReferences, 1);
  assert.equal(summary.crossLinks, 1);
  const next = deleteConceptSubtrees(d, [arm]);
  assert.deepEqual(
    next.entities.map((e) => e.id),
    ["outside", "unplaced"],
  );
  assert.ok(next.placements.every((p) => p.entityId === "outside"));
  assert.equal(next.relationships.length, 0);
  assert.equal(next.compositions.length, 0);
  assert.equal(next.variants.length, 0);
  assert.deepEqual(d, before, "the history snapshot retains everything for undo");
  assert.deepEqual(parseDocument(JSON.stringify(d)), parseDocument(JSON.stringify(before)));
});
test("shared assets and flexible node/binder visuals round trip without changing canonical meaning", () => {
  const { d } = fixture();
  d.assets = [image];
  d.placements[0].visual = { assetId: "icon", showText: false, size: 2 };
  d.compositions[0].visual = { assetId: "icon", showText: true };
  d.compositions[0].text = "is composed of";
  d.relationships[0].visual = { character: "⇆", size: 0.8 };
  const next = parseDocument(JSON.stringify(d));
  assert.deepEqual(next.entities, d.entities);
  assert.deepEqual(next.relationships, d.relationships);
  const binders = chartedBinders(next, editorView(next));
  assert.equal(binders.find((b) => b.id === "external").visual.character, "⇆");
  assert.equal(binders.find((b) => b.id === "a-b").label, "is composed of");
  assert.equal(next.assets.length, 1);
  assert.throws(() => validateDocument({ ...next, assets: [] }), /missing asset/);
});
test("invalid assets and visuals reject the entire document without mutating its original", () => {
  const { d } = fixture(),
    before = structuredClone(d);
  const bad = {
    ...image,
    dataUrl: `data:image/svg+xml;base64,${btoa("<svg><script>alert(1)</script></svg>")}`,
  };
  assert.throws(() => validateDocument({ ...d, assets: [bad] }), /self-contained/);
  assert.throws(
    () =>
      validateDocument({
        ...d,
        assets: [{ ...image, kind: "glb", dataUrl: "data:model/gltf-binary;base64,YWJj" }],
      }),
    /Invalid GLB/,
  );
  assert.throws(
    () =>
      validateDocument({
        ...d,
        assets: [image],
        placements: d.placements.map((p) => ({ ...p, visual: { assetId: "icon", size: -1 } })),
      }),
    /Invalid visual/,
  );
  assert.deepEqual(d, before);
});
test("compact text layout does not treat enormous empty subsystem envelopes as occupied volume", () => {
  let d = emptyDocument();
  d.entities = ["first", "second", "detail"].map(entity);
  const a = createPlacement(d, "first", null, settings);
  d = a.next;
  const b = createPlacement(d, "second", null, settings);
  d = b.next;
  d = createPlacement(d, "detail", a.placementId, settings, { x: 10000, y: 0, z: 0 }).next;
  d.placements[0].collapsed = false;
  const compact = compactLayout(d, { kind: "all" }, settings);
  assert.ok(
    compact.placements.every(
      (p) => Math.hypot(p.spatialPosition.x, p.spatialPosition.y, p.spatialPosition.z) < 30,
    ),
  );
  assert.equal(siblingCollisions(compact, settings).length, 0);
  assert.equal(
    d.placements.at(-1).spatialPosition.x,
    10000,
    "authored data changes only on explicit reflow",
  );
});
test("mouse history and selection defaults survive old settings, and rebinding detects conflicts", () => {
  const settings = defaultSettings();
  assert.equal(settings.mouse.backButton, "undo");
  assert.equal(settings.mouse.forwardButton, "redo");
  assert.equal(settings.mouse.selectionModifier, "ctrl");
  assert.equal(settings.mouse.nestModifier, "shift");
  assert.equal(settings.bindings.deleteSelected, "Delete");
  assert.equal(keyConflict(settings.bindings, "focus", "Ctrl+Z"), "undo");
  globalThis.localStorage = {
    getItem: () => JSON.stringify({ mouse: { subtreeModifier: "alt" }, bindings: { focus: "Q" } }),
  };
  const loaded = loadSettings();
  assert.equal(loaded.bindings.focus, "Q");
  assert.equal(loaded.mouse.subtreeModifier, "alt");
  assert.equal(loaded.mouse.selectionModifier, "ctrl");
  delete globalThis.localStorage;
});

test('temporary MS requests reject unsupported picks and restore selection exactly once',async()=>{
 const {selectionRequest}=await import('../src/appearance/selectionRequest.ts');
 let restores=0,cancels=0;
 const request=selectionRequest(value=>value==='supported',()=>cancels++,()=>restores++);
 assert.equal(request.accept('unsupported'),false);assert.equal(restores,0);
 assert.equal(request.accept('supported'),true);assert.equal(restores,1);
 request.cancel();assert.equal(request.accept('supported'),false);assert.equal(restores,1);assert.equal(cancels,0);
 const cancelled=selectionRequest(()=>true,()=>cancels++,()=>restores++);
 cancelled.cancel();cancelled.cancel();assert.equal(cancelled.accept('supported'),false);
 assert.equal(restores,2);assert.equal(cancels,1);
});
