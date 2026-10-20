import assert from "node:assert/strict";
import test from "node:test";
import { activateDockMember, emptyUILayout, floatResident, ownerOf, validateUILayout } from "../src/ui/layout.ts";
import { dockFrame, edgeDockRect } from "../src/ui/docking.ts";
import { dockKeys, updateDockNode } from "../src/ui/dockTree.ts";
const rect = { x: 100, y: 100, width: 600, height: 450 };
const fixture = () => ({ ...emptyUILayout(), windows: Object.fromEntries(["a", "b", "c"].map(id => [id, {
  x: 100, y: 100, width: 300, height: 400, collapsed: false, pinned: false,
}])) });
test("splits and tabs reuse original frame identities with one owner and portable layout", () => {
  const before = fixture(), snapshot = JSON.stringify(before);
  const split = dockFrame(before, "window:b", { target: "window:a", side: "right", rect });
  const group = split.frames[0];
  assert.equal(group.dockLayout.kind, "split");
  assert.equal(group.dockLayout.axis, "horizontal");
  const tabs = dockFrame(split, "window:c", { target: "window:b", side: "tab", rect });
  assert.deepEqual(tabs.frames[0].dockLayout.second.keys, ["window:b", "window:c"]);
  assert.equal(tabs.frames[0].dockLayout.second.active, "window:c");
  assert.equal(ownerOf(tabs, "window:a"), ownerOf(tabs, "window:c"));
  assert.deepEqual(validateUILayout(JSON.parse(JSON.stringify(tabs))), JSON.parse(JSON.stringify(tabs)));
  assert.equal(JSON.stringify(before), snapshot);
  assert.deepEqual(Object.keys(tabs.windows), ["a", "b", "c"]);
});
test("dragging tabs out prunes empty branches/groups without deleting their contents", () => {
  let layout = dockFrame(fixture(), "window:b", { target: "window:a", side: "bottom", rect });
  layout = dockFrame(layout, "window:c", { target: "window:b", side: "tab", rect });
  layout = floatResident(layout, "window:b", 700, 400);
  assert.deepEqual(dockKeys(layout.frames[0].dockLayout), ["window:a", "window:c"]);
  layout = floatResident(layout, "window:c", 750, 450);
  assert.equal(layout.frames[0].dockLayout.kind, "tabs");
  layout = floatResident(layout, "window:a", 500, 400);
  assert.equal(layout.frames.length, 0);
  assert.deepEqual(Object.keys(layout.windows), ["a", "b", "c"]);
});
test("search activates hidden tabs, and ratio edits retain ownership", () => {
  let layout = dockFrame(fixture(), "window:b", { target: "window:a", side: "tab", rect });
  layout = activateDockMember(layout, "window:a");
  assert.equal(layout.frames[0].dockLayout.active, "window:a");
  layout = dockFrame(layout, "window:c", { target: "window:a", side: "top", rect });
  const tree = updateDockNode(layout.frames[0].dockLayout, [], node => ({ ...node, ratio: 0.3 }));
  assert.equal(tree.ratio, 0.3);
  assert.deepEqual(dockKeys(tree).sort(), ["window:a", "window:b", "window:c"]);
});
test("pinned frames, containment cycles and malformed dock trees reject", () => {
  const layout = fixture(); layout.windows.a.pinned = true;
  assert.equal(dockFrame(layout, "window:b", { target: "window:a", side: "tab", rect }), layout);
  layout.windows.a.pinned = false;
  layout.windows.a.members = [{ kind: "window", id: "b" }];
  assert.equal(dockFrame(layout, "window:a", { target: "window:b", side: "right", rect }), layout);
  delete layout.windows.a.members;
  const docked = dockFrame(layout, "window:b", { target: "window:a", side: "tab", rect });
  const invalid = structuredClone(docked); invalid.frames[0].dockLayout.keys.push("window:a");
  assert.throws(() => validateUILayout(invalid), /duplicate dock member/);
  const missing = structuredClone(docked); missing.frames[0].dockLayout.active = "window:missing";
  assert.throws(() => validateUILayout(missing), /Invalid dock tabs/);
});
test("viewport docking shares the frame model and leaves legacy layouts unchanged", () => {
  const before = fixture(); assert.deepEqual(validateUILayout(structuredClone(before)), before);
  const layout = dockFrame(before, "window:a", { side: "left", edge: "left", rect });
  assert.equal(layout.frames[0].dockEdge, "left");
  assert.equal(ownerOf(layout, "window:a"), `frame:${layout.frames[0].id}`);
  const resized = edgeDockRect(layout, "left", { x: 8, y: 50, width: 1200, height: 800 });
  assert.equal(resized.x, 8); assert.equal(resized.height, 800);
});
