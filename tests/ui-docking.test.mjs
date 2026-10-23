import assert from "node:assert/strict";
import test from "node:test";
import { activateDockMember, closeContainer, reopenContainer, emptyUILayout, floatResident, ownerOf, validateUILayout } from "../src/ui/layout.ts";
import { dockFrame, edgeDockRect, fitDockRect, fitDockResidents, workspaceDockRects } from "../src/ui/docking.ts";
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
test("opposing docks allocate disjoint space, retain a usable center, and adapt without changing saved geometry", () => {
  let layout = fixture(); const area = { x: 8, y: 50, width: 1200, height: 800 };
  layout = dockFrame(layout, "window:a", { side: "left", edge: "left", rect });
  layout = dockFrame(layout, "window:b", { side: "right", edge: "right", rect });
  layout = dockFrame(layout, "window:c", { side: "top", edge: "top", rect });
  const saved = JSON.stringify(layout), geometry = workspaceDockRects(layout, area), { docks, center } = geometry;
  assert.ok(center.width >= 480 && center.height >= 240);
  assert.equal(docks.left.x+docks.left.width, center.x);
  assert.equal(docks.right.x, center.x+center.width);
  assert.equal(docks.top.y+docks.top.height, center.y);
  const fitted = fitDockRect(rect, center);
  assert.ok(fitted.x >= center.x && fitted.x+fitted.width <= center.x+center.width);
  const small = workspaceDockRects(layout, { ...area, width: 600, height: 400 });
  assert.ok(small.center.width >= 300 && small.center.height >= 200);
  assert.equal(JSON.stringify(layout), saved);
});
test("a split replacing a native strip panel stays in its home and preserves sibling order", () => {
  const layout = fixture(), home = "window:native:sidebar";
  layout.windows['native:sidebar'] = { ...layout.windows.a, members: [] };
  const docked = dockFrame(layout, "window:b", { target: "window:a", side: "bottom", rect, host: { container: home, order: "sidebar", keys: ["window:c", "window:a"] } });
  const group = docked.frames[0], key = `frame:${group.id}`;
  assert.equal(ownerOf(docked, key), home);
  assert.deepEqual(docked.nativeOrders.sidebar, ["window:c", key, "window:a"]);
  assert.equal(ownerOf(docked, "window:a"), key);
});
test("floating neighbors use gaps or smaller cells instead of overlapping after docking", () => {
  const area = { x: 500, y: 100, width: 700, height: 650 }, before = { large: { x: 0, y: 100, width: 500, height: 600 }, small: { x: 800, y: 400, width: 150, height: 100 } };
  const disjoint = rects => {
    const values = Object.values(rects);
    for (const a of values) {
      assert.ok(a.x >= area.x && a.x+a.width <= area.x+area.width+.01 && a.y >= area.y && a.y+a.height <= area.y+area.height+.01);
      for (const b of values) if (a !== b) assert.ok(a.x+a.width <= b.x || b.x+b.width <= a.x || a.y+a.height <= b.y || b.y+b.height <= a.y);
    }
  };
  const snapshot = JSON.stringify(before);
  disjoint(fitDockResidents(before, area));
  disjoint(fitDockResidents({ ...before, huge: rect }, area));
  assert.equal(JSON.stringify(before), snapshot);
  assert.deepEqual(fitDockResidents(before, area), fitDockResidents(before, area));
});
test("explicit floating overflow preserves size and movement while retaining a reachable handle", async () => {
  const { keepFloatingHandleVisible } = await import('../src/ui/positioning.ts');
  const { fitWindow } = await import('../src/ui/layout.ts');
  const area = { x: 8, y: 8, width: 784, height: 584 }, wide = { x: 320, y: 80, width: 1500, height: 250 };
  assert.deepEqual(keepFloatingHandleVisible(wide, area), wide);
  const rescued = keepFloatingHandleVisible({ ...wide, x: 5000, y: 5000 }, area);
  assert.ok(rescued.x+64 <= 792 && rescued.y+32 <= 592);
  assert.equal(rescued.width, 1500);
  const saved = { ...wide, collapsed: false, pinned: false, floatingOverflow: true };
  assert.equal(fitWindow(saved, 800, 600).x, wide.x);
  assert.equal(fitWindow(saved, 800, 600).width, wide.width);
  const layout = fixture(); layout.windows.a = saved;
  assert.deepEqual(validateUILayout(JSON.parse(JSON.stringify(layout))).windows.a, saved);
});


test("closing a custom dock frame retains its contents and customization through reload and restoration", () => {
  const area = { x: 8, y: 50, width: 1200, height: 800 };
  const docked = dockFrame(fixture(), "window:a", { side: "left", edge: "left", rect });
  const frame = docked.frames[0], key = `frame:${frame.id}`;
  const before = JSON.stringify(docked), closed = closeContainer(docked, key);
  assert.deepEqual(closed.frames[0], { ...frame, closed: true });
  assert.equal(ownerOf(closed, "window:a"), key);
  assert.equal(workspaceDockRects(closed, area).active, false);
  const saved = validateUILayout(JSON.parse(JSON.stringify(closed)));
  const restored = reopenContainer(saved, key);
  assert.deepEqual(restored.frames[0], { ...frame, closed: false, collapsed: false });
  assert.deepEqual(restored.windows, JSON.parse(JSON.stringify(docked.windows)));
  assert.ok(workspaceDockRects(restored, area).docks.left);
  assert.equal(JSON.stringify(docked), before);
  const empty = closeContainer({ ...fixture(), frames: [{ ...frame, members: [], dockLayout: undefined }] }, key);
  assert.equal(empty.frames.length, 1, "a hidden empty group is still recoverable");
  const next = dockFrame(closed, "window:b", { side: "left", edge: "left", rect });
  assert.notEqual(next.frames.find(f => !f.closed).id, frame.id, "new docking does not enter hidden UI");
  assert.equal(reopenContainer(next, key).frames.find(f => f.id === frame.id).dockEdge, undefined, "restore floats when its old edge is occupied");
});

test("window merge guides start only on headers, never body centers or edges", async () => {
  const { initialFrameDockSide, retainHeaderDock, dockGuideAt, dockGuides } = await import("../src/ui/dockGuides.ts");
  const bounds = { x: 100, y: 100, width: 400, height: 300 };
  const viewport = { x: 0, y: 0, width: 1000, height: 800 };
  for (const point of [{ x: 300, y: 250 }, { x: 101, y: 250 }, { x: 499, y: 250 }, { x: 300, y: 399 }])
    assert.equal(initialFrameDockSide(false, false, bounds, viewport, point.x, point.y), undefined);
  assert.equal(initialFrameDockSide(true, false, bounds, viewport, 200, 110), "tab");
  assert.equal(initialFrameDockSide(true, true, bounds, viewport, 200, 110), "tab");
  assert.equal(retainHeaderDock(bounds, viewport, 240, 170, "tab"), true, "the route from header to guides stays active");
  assert.equal(retainHeaderDock(bounds, viewport, 800, 600, "tab"), false, "leaving the target cancels docking");
  // Once opened by a header, all directional guide cells remain selectable.
  for (const guide of dockGuides(bounds, viewport))
    assert.equal(dockGuideAt(bounds, viewport, guide.rect.x + guide.rect.width / 2, guide.rect.y + guide.rect.height / 2, "tab"), guide.side);
});
