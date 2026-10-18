import test from "node:test";
import assert from "node:assert/strict";
import { emptyAtlas, parseAtlas, descendants, removeNode, reparent } from "../src/graph/model.ts";
import { projectAtlas } from "../src/graph/projection.ts";
import { projectSpatial } from "../src/graph/spatial.ts";
const node = (id, parentId = null, collapsed = false) => ({
  id,
  label: id,
  notes: "",
  parentId,
  collapsed,
  position: parentId ? { x: 28, y: 104 } : { x: 0, y: 0 },
});
const fixture = () => ({
  ...emptyAtlas(),
  nodes: [node("a"), node("b", "a"), node("c", "b"), node("d")],
  relationships: [
    { id: "r", source: "c", target: "d", label: "depends on" },
    { id: "inner", source: "b", target: "c", label: "" },
  ],
});
const parse = (a) => parseAtlas(JSON.stringify(a));
test("versioned JSON round trip preserves identity, hierarchy, layout and relationships", () =>
  assert.deepEqual(parse(fixture()), fixture()));
test("rejects unknown formats and future versions", () => {
  assert.throws(() => parse({ ...fixture(), version: 2 }), /version/);
  assert.throws(() => parse({ ...fixture(), format: "other" }), /version/);
});
test("rejects duplicate IDs, missing parents and dangling relationships", () => {
  const a = fixture();
  a.nodes.push(node("a"));
  assert.throws(() => parse(a), /Duplicate/);
  const b = fixture();
  b.nodes[1].parentId = "missing";
  assert.throws(() => parse(b), /missing/);
  const c = fixture();
  c.relationships[0].target = "missing";
  assert.throws(() => parse(c), /endpoint/);
});
test("rejects cycles and unsafe position data", () => {
  const a = fixture();
  a.nodes[0].parentId = "c";
  a.nodes[0].position = { x: 28, y: 104 };
  assert.throws(() => parse(a), /cycle/);
  const b = fixture();
  b.nodes[0].position.x = Infinity;
  assert.throws(() => parse(b), /position/);
  const c = fixture();
  c.nodes[1].position.y = -10;
  assert.throws(() => parse(c), /header/);
});
test("rejects excessive nesting before recursive projection", () => {
  const a = emptyAtlas();
  for (let i = 0; i < 51; i++) a.nodes.push(node(String(i), i ? String(i - 1) : null));
  assert.throws(() => parse(a), /depth/);
});
test("reparenting prevents cycles while preserving stable IDs and relationships", () => {
  const a = fixture();
  assert.throws(() => reparent(a, "a", "c"), /ancestor/);
  const b = reparent(a, "b", "d");
  assert.equal(b.nodes[1].parentId, "d");
  assert.deepEqual(b.relationships, a.relationships);
  assert.deepEqual(a, fixture());
});
test("subtree deletion removes only affected nodes and relationships", () => {
  const a = fixture();
  assert.deepEqual([...descendants(a, "a")], ["b", "c"]);
  const b = removeNode(a, "b");
  assert.deepEqual(
    b.nodes.map((n) => n.id),
    ["a", "d"],
  );
  assert.equal(b.relationships.length, 0);
  assert.equal(a.nodes.length, 4);
});
test("projection orders parents first and sizes nested containers", () => {
  const a = fixture();
  a.nodes.reverse();
  const p = projectAtlas(a);
  assert.ok(p.nodes.findIndex((n) => n.id === "a") < p.nodes.findIndex((n) => n.id === "b"));
  const parent = p.nodes.find((n) => n.id === "a"),
    child = p.nodes.find((n) => n.id === "b");
  assert.ok(parent.width > child.width);
  assert.ok(parent.height > child.height);
});
test("collapse projects external endpoints, hides internal edges, and never mutates data", () => {
  const a = fixture();
  a.nodes[0].collapsed = true;
  const before = JSON.stringify(a);
  const p = projectAtlas(a);
  assert.deepEqual(
    p.nodes.map((n) => n.id),
    ["a", "d"],
  );
  assert.deepEqual(p.relationships, [{ ...a.relationships[0], source: "a", projected: true }]);
  assert.equal(JSON.stringify(a), before);
  a.nodes[0].collapsed = false;
  assert.equal(projectAtlas(a).relationships[0].source, "c");
});
test("outermost collapse wins; parallel external relationships remain distinct", () => {
  const a = fixture();
  a.nodes[0].collapsed = a.nodes[1].collapsed = true;
  a.relationships.push({ id: "r2", source: "b", target: "d", label: "second" });
  const p = projectAtlas(a);
  assert.equal(p.relationships.length, 2);
  assert.ok(p.relationships.every((r) => r.source === "a"));
});
test("self relationships and directed cycles are permitted independently of containment", () => {
  const a = fixture();
  a.relationships.push(
    { id: "self", source: "a", target: "a", label: "" },
    { id: "back", source: "d", target: "c", label: "" },
  );
  assert.equal(parse(a).relationships.length, 4);
  assert.equal(projectAtlas(a).relationships.length, 4);
});
test("a hidden self-relationship is internal to its collapsed branch", () => {
  const a = fixture();
  a.nodes[0].collapsed = true;
  a.relationships.push({ id: "hidden-self", source: "c", target: "c", label: "" });
  assert.deepEqual(
    projectAtlas(a).relationships.map((r) => r.id),
    ["r"],
  );
});
test("old 2D documents derive XYZ without changing 2D data", () => {
  const atlas = fixture();
  const original = JSON.stringify(atlas);
  const projected = projectSpatial(parse(atlas));
  assert.deepEqual(projected.nodes.find((n) => n.id === "a").world, { x: 0, y: 0, z: 0 });
  assert.deepEqual(projected.nodes.find((n) => n.id === "b").world, { x: 0.28, y: -2, z: 1.04 });
  assert.equal(JSON.stringify(atlas), original);
  assert.equal(parse(atlas).nodes[0].spatialPosition, undefined);
});
test("authored XYZ round trips without altering 2D positions or graph references", () => {
  const atlas = fixture();
  atlas.nodes[1].spatialPosition = { x: 4, y: 1.5, z: -3 };
  const loaded = parse(atlas);
  assert.deepEqual(loaded.nodes[1].spatialPosition, atlas.nodes[1].spatialPosition);
  assert.deepEqual(loaded.nodes[1].position, atlas.nodes[1].position);
  assert.deepEqual(loaded.relationships, atlas.relationships);
  assert.deepEqual(projectSpatial(loaded).nodes.find((n) => n.id === "b").world, {
    x: 4,
    y: 1.5,
    z: -3,
  });
});
test("3D projection preserves original endpoints across collapsed nesting", () => {
  const atlas = fixture();
  atlas.nodes[0].collapsed = true;
  const projection = projectSpatial(atlas);
  assert.deepEqual(
    projection.nodes.filter((n) => n.visible).map((n) => n.id),
    ["a", "d"],
  );
  assert.deepEqual(
    projection.relationships.map((r) => [r.source, r.target]),
    [["a", "d"]],
  );
  assert.equal(atlas.relationships[0].source, "c");
});
test("reparenting an authored XYZ node preserves its world position", () => {
  const atlas = fixture();
  atlas.nodes[1].spatialPosition = { x: 4, y: 1, z: 2 };
  const before = projectSpatial(atlas).nodes.find((n) => n.id === "b").world;
  const moved = reparent(atlas, "b", "d");
  assert.deepEqual(projectSpatial(moved).nodes.find((n) => n.id === "b").world, before);
});
test("invalid XYZ is rejected without altering existing 2D data", () => {
  const atlas = fixture();
  atlas.nodes[0].spatialPosition = { x: 0, y: 0, z: Infinity };
  assert.throws(() => parse(atlas), /3D/);
});
