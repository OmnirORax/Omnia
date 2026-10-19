import test from "node:test";
import assert from "node:assert/strict";
import { emptyDocument, toggleSubtree } from "../src/graph/structural.ts";
import { defaultSettings, subtreeGesture } from "../src/workspaceActions.ts";
function fixture() {
  const d = emptyDocument();
  d.entities = ["root", "left", "right", "shared", "leaf", "unrelated"].map((id) => ({
    id,
    label: id,
    aliases: [],
    notes: "",
  }));
  d.compositions = [
    ["root", "left"],
    ["root", "right"],
    ["left", "shared"],
    ["right", "shared"],
    ["shared", "leaf"],
  ].map(([parentId, childId], i) => ({ id: `c${i}`, parentId, childId }));
  d.placements = ["root", "unrelated"].map((entityId) => ({
    id: entityId,
    entityId,
    parentId: null,
    position: { x: 0, y: 0 },
    collapsed: true,
    hidden: false,
  }));
  return d;
}
test("full subtree expansion reaches unplaced authored levels and reuses canonical subsystem identities", () => {
  const d = fixture(),
    expanded = toggleSubtree(d, "root");
  assert.equal(expanded.placements.length, 8);
  assert.equal(expanded.placements.filter((p) => p.entityId === "shared").length, 2);
  assert.equal(expanded.entities.filter((e) => e.id === "shared").length, 1);
  assert.ok(expanded.placements.filter((p) => p.id !== "unrelated").every((p) => !p.collapsed));
  assert.deepEqual(expanded.entities, d.entities);
  assert.deepEqual(expanded.compositions, d.compositions);
  assert.deepEqual(
    expanded.placements.find((p) => p.id === "unrelated"),
    d.placements[1],
  );
  assert.equal(d.placements.length, 2);
  const collapsed = toggleSubtree(expanded, "root");
  assert.ok(collapsed.placements.every((p) => p.collapsed));
  const reopened = toggleSubtree(collapsed, "root");
  assert.deepEqual(reopened, expanded, "reopening makes no duplicate placements");
});
test("a partially open subtree expands, hidden placements are respected, leaves are no-ops", () => {
  const d = fixture();
  d.placements[0].collapsed = false;
  d.placements.push({
    id: "hidden-left",
    entityId: "left",
    parentId: "root",
    position: { x: 28, y: 104 },
    collapsed: true,
    hidden: true,
  });
  const expanded = toggleSubtree(d, "root");
  assert.equal(expanded.placements.find((p) => p.id === "hidden-left").hidden, true);
  assert.equal(expanded.placements.filter((p) => p.parentId === "hidden-left").length, 0);
  assert.equal(toggleSubtree(d, "unrelated"), d);
});
test("invalidly deep expansion rejects atomically without losing the original document", () => {
  const d = emptyDocument();
  for (let i = 0; i < 53; i++) {
    d.entities.push({ id: `e${i}`, label: "node", aliases: [], notes: "" });
    if (i) d.compositions.push({ id: `c${i}`, parentId: `e${i - 1}`, childId: `e${i}` });
  }
  d.placements = [
    {
      id: "root",
      entityId: "e0",
      parentId: null,
      position: { x: 0, y: 0 },
      collapsed: true,
      hidden: false,
    },
  ];
  const original = JSON.stringify(d);
  assert.throws(() => toggleSubtree(d, "root"), /depth/);
  assert.equal(JSON.stringify(d), original);
});
test("subtree gesture defaults to Shift and supports the configured modifier", () => {
  const click = { shiftKey: true, altKey: false, ctrlKey: false, metaKey: false };
  assert.equal(defaultSettings().mouse.subtreeModifier, "shift");
  assert.equal(subtreeGesture(click, "shift"), true);
  assert.equal(subtreeGesture(click, "alt"), false);
  assert.equal(subtreeGesture(click, "none"), false);
  assert.equal(subtreeGesture({ ...click, shiftKey: false, metaKey: true }, "ctrl"), true);
});
