import test from "node:test";
import assert from "node:assert/strict";
import { emptyDocument, parseDocument, validateDocument } from "../src/graph/structural.ts";
import { labelLines, separateLabels } from "../src/graph/labels.ts";
import {
  createLayoutView,
  hierarchyLayout,
  flowLayout,
  switchLayoutView,
  chartedBinders,
} from "../src/graph/presentation.ts";
import { DEFAULT_SPATIAL_SETTINGS, worldPositions } from "../src/graph/layout3d.ts";

function fixture() {
  const d = emptyDocument();
  for (const id of ["system", "subsystem", "part", "reference"]) {
    d.entities.push({ id, label: id, aliases: [], notes: "" });
    d.placements.push({
      id,
      entityId: id,
      parentId: id === "subsystem" ? "system" : id === "part" ? "subsystem" : null,
      position: { x: 28, y: 104 },
      spatialPosition: { x: id.length * 10, y: 7, z: 30 },
      collapsed: false,
      hidden: false,
    });
  }
  d.compositions.push(
    { id: "c1", parentId: "system", childId: "subsystem" },
    { id: "c2", parentId: "subsystem", childId: "part" },
  );
  d.relationships.push({
    id: "r",
    typeId: "legacy-untyped",
    participants: [
      { roleId: "source", entityId: "part" },
      { roleId: "target", entityId: "reference" },
    ],
    label: "depends on",
    qualifierIds: [],
  });
  return d;
}
test("long names, Unicode and unbroken words retain all characters without ellipses", () => {
  const text = `A complete specification ${"x".repeat(100)} αβγ 水 H₂O`;
  const lines = labelLines(text);
  assert.equal(lines.join("").replace(/\s/g, ""), text.replace(/\s/g, ""));
  assert.ok(lines.every((line) => Array.from(line).length <= 32));
  assert.ok(!lines.join("").includes("…"));
});
test("screen overlap resolution moves labels sideways with an actual gap, deterministically", () => {
  const items = [100, 90, 120, 150].map((width, i) => ({
    id: String(i),
    x: 0,
    y: 0,
    width,
    height: 35,
  }));
  const offsets = separateLabels(items);
  for (const a of items)
    for (const b of items)
      if (a.id !== b.id)
        assert.ok(
          Math.abs(offsets.get(a.id) - offsets.get(b.id)) >= (a.width + b.width) / 2 + 12 - 1e-6,
        );
  assert.deepEqual(separateLabels(items), offsets);
  assert.equal(offsets.get("0"), 0);
});
test("hierarchy layout places systems above their contents without changing facts or nesting", () => {
  const d = fixture(),
    next = hierarchyLayout(d),
    world = worldPositions(next);
  assert.ok(world.get("system").y > world.get("subsystem").y);
  assert.ok(world.get("subsystem").y > world.get("part").y);
  for (const key of ["entities", "compositions", "relationships"])
    assert.deepEqual(next[key], d[key]);
  assert.deepEqual(
    next.placements.map((p) => [p.id, p.parentId, p.position]),
    d.placements.map((p) => [p.id, p.parentId, p.position]),
  );
  assert.deepEqual(hierarchyLayout(d), next);
});
test("saved view switching restores authored coordinates and retains edits in each view", () => {
  const d = fixture(),
    hierarchy = createLayoutView(d, "hierarchy", "Hierarchy", DEFAULT_SPATIAL_SETTINGS);
  const viewId = hierarchy.activeLayoutViewId;
  hierarchy.placements[0].spatialPosition.x += 1;
  const changed = structuredClone(hierarchy.placements[0].spatialPosition);
  const authored = switchLayoutView(hierarchy, "authored-layout");
  assert.deepEqual(authored.placements, d.placements);
  const reopened = switchLayoutView(authored, viewId);
  assert.deepEqual(reopened.placements[0].spatialPosition, changed);
  assert.deepEqual(parseDocument(JSON.stringify(reopened)), reopened);
  reopened.placements = reopened.placements.filter((p) => p.id !== "reference");
  assert.doesNotThrow(() => switchLayoutView(reopened, "authored-layout"));
});
test("binder annotations and colors round trip separately from their typed participants", () => {
  const d = fixture();
  d.relationships[0].operators = [{ id: "op", text: "requires a compatible interface" }];
  d.relationships[0].appearance = { color: "#ffaacc", opacity: 0.4 };
  d.placements[0].appearance = { color: "#ccffaa", opacity: 0.7 };
  const roundTrip = parseDocument(JSON.stringify(d));
  const binders = chartedBinders(roundTrip);
  assert.equal(binders.filter((b) => b.kind === "composition").length, 2);
  assert.equal(binders.find((b) => b.id === "r").color, "#ffaacc");
  assert.match(binders.find((b) => b.id === "r").label, /requires a compatible interface/);
  assert.deepEqual(roundTrip.relationships[0].participants, d.relationships[0].participants);
  roundTrip.relationships[0].appearance.opacity = 2;
  assert.throws(() => validateDocument(roundTrip), /appearance/);
});
test("visual-only nesting remains distinguishable from authored composition", () => {
  const d = fixture();
  d.compositions = [];
  assert.equal(chartedBinders(d).filter((b) => b.kind === "composition").length, 0);
  assert.equal(chartedBinders(d).filter((b) => b.kind === "visual").length, 2);
});
test("directed flow uses chosen roles, and cyclic relationships share a level", () => {
  const doc = fixture();
  const ordering = { typeId: "legacy-untyped", fromRoleId: "source", toRoleId: "target" };
  const arranged = flowLayout(doc, ordering),
    world = worldPositions(arranged);
  assert.ok(world.get("part").y > world.get("reference").y);
  const reversed = worldPositions(
    flowLayout(doc, { ...ordering, fromRoleId: "target", toRoleId: "source" }),
  );
  assert.ok(reversed.get("part").y < reversed.get("reference").y);
  assert.deepEqual(arranged.relationships, doc.relationships);
  assert.deepEqual(arranged.compositions, doc.compositions);
  doc.relationships.push({
    ...doc.relationships[0],
    id: "reverse",
    participants: [...doc.relationships[0].participants]
      .reverse()
      .map((p, i) => ({ ...p, roleId: i ? "target" : "source" })),
  });
  const cyclic = worldPositions(flowLayout(doc, ordering));
  assert.equal(cyclic.get("part").y, cyclic.get("reference").y);
  assert.throws(() => flowLayout(doc, { ...ordering, fromRoleId: "unknown" }), /roles/);
});


test('hierarchy and directed-flow arrangement use cells independently of node content',()=>{
 const doc=fixture(),changed=structuredClone(doc);
 for(const e of changed.entities)e.label='Independent label '.repeat(20);
 for(const p of changed.placements)p.visual={character:'☼',size:5,showText:true};
 const coords=d=>d.placements.map(p=>p.spatialPosition),settings={...DEFAULT_SPATIAL_SETTINGS,nodeCellSize:1.5};
 assert.deepEqual(coords(hierarchyLayout(doc,settings)),coords(hierarchyLayout(changed,settings)));
 const order={typeId:'legacy-untyped',fromRoleId:'source',toRoleId:'target'};
 assert.deepEqual(coords(flowLayout(doc,order,settings)),coords(flowLayout(changed,order,settings)));
 assert.deepEqual(coords(doc),coords(changed));
});

test('atomic content toggles retain independent expansions without changing structure',async()=>{
 const {expansionState,contentExpanded,toggleContent}=await import('../src/graph/nodePresentation.ts');
 const state=expansionState();
 assert.equal(contentExpanded(state,'a',false),false);
 toggleContent(state,'a',false);toggleContent(state,'b',false);
 assert.equal(contentExpanded(state,'a',false),true);assert.equal(contentExpanded(state,'b',false),true);
 toggleContent(state,'a',false);assert.equal(contentExpanded(state,'a',false),false);assert.equal(contentExpanded(state,'b',false),true);
 assert.equal(contentExpanded(state,'parent',true),true);toggleContent(state,'parent',true);assert.equal(contentExpanded(state,'parent',true),false);
 toggleContent(state,'parent',true);assert.equal(contentExpanded(state,'parent',true),true);
});

test('visible expansion layout fits ordinary names without moving source anchors or resizing content',async()=>{
 const {arrangeExpansions}=await import('../src/graph/labels.ts');
 const items=Array.from({length:8},(_,i)=>({id:String(i),x:220,y:160,width:90,height:24})),before=structuredClone(items);
 const placed=arrangeExpansions(items,640,400);
 assert.deepEqual(items,before);
 for(const a of items){const p=placed.get(a.id);assert.ok(p.x>=a.width/2&&p.x<=640-a.width/2);assert.ok(p.y>=a.height/2&&p.y<=400-a.height/2);
 for(const b of items)if(a.id!==b.id){const q=placed.get(b.id);assert.ok(Math.abs(p.x-q.x)>=(a.width+b.width)/2+8||Math.abs(p.y-q.y)>=(a.height+b.height)/2+8);}}
 assert.deepEqual(arrangeExpansions(items,640,400),placed);
});
