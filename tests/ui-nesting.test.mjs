import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyUILayout,
  validateUILayout,
  dockResident,
  floatResident,
  ownerOf,
  canDock,
  resetContainer,
  collapseResidentBranch,
} from "../src/ui/layout.ts";
import { startHistory, recordHistory, undoHistory, redoHistory } from "../src/ui/history.ts";
import { defaultSettings, normalizeSettings } from "../src/workspaceActions.ts";
import { magnetActive } from "../src/ui/drag.ts";
const frame = (id) => ({
  id,
  name: id,
  x: 100,
  y: 160,
  width: 300,
  cellSize: 96,
  collapsed: false,
  pinned: false,
  members: [],
});
const windowState = () => ({
  x: 700,
  y: 150,
  width: 360,
  height: 450,
  collapsed: false,
  pinned: false,
});
test("v1 UI migration preserves row arrangement, appearance, windows and menus without changing its source", () => {
  const old = {
    ...emptyUILayout(),
    version: 1,
    frames: [frame("tools")],
    items: {
      a: {
        x: 0,
        y: 0,
        frameId: "tools",
        cell: { x: 0, y: 0 },
        style: { mode: "icon", geometry: "triangle", character: "A" },
      },
      b: { x: 0, y: 0, frameId: "tools", cell: { x: 1, y: 0 } },
      c: { x: 0, y: 0, frameId: "tools", cell: { x: 0, y: 1 } },
    },
    windows: { shortcuts: windowState() },
    menus: { node: { focus: { x: 0, y: 0 } } },
  };
  const original = structuredClone(old),
    migrated = validateUILayout(old);
  assert.equal(migrated.version, 2);
  assert.deepEqual(old, original);
  assert.deepEqual(
    migrated.frames[0].members.map((m) => [m.id, m.breakBefore]),
    [
      ["a", false],
      ["b", false],
      ["c", true],
    ],
  );
  assert.equal(migrated.items.a.style.character, "A");
  assert.equal(migrated.items.a.frameId, undefined);
  assert.deepEqual(migrated.windows, old.windows);
  assert.deepEqual(migrated.menus, old.menus);
  assert.deepEqual(validateUILayout(JSON.parse(JSON.stringify(migrated))), migrated);
});
test("nested frames and windows retain contents, insert between siblings, and reject cycles and multiple owners", () => {
  let layout = {
    ...emptyUILayout(),
    frames: [frame("parent"), frame("left"), frame("right"), frame("middle")],
    windows: { settings: windowState() },
  };
  for (const id of ["left", "right"])
    layout = dockResident(layout, `frame:${id}`, "frame:parent", 99);
  layout = dockResident(layout, "frame:middle", "frame:parent", 1);
  assert.deepEqual(
    layout.frames[0].members.map((m) => m.id),
    ["left", "middle", "right"],
  );
  layout = dockResident(layout, "window:settings", "frame:middle", 0);
  assert.equal(ownerOf(layout, "window:settings"), "frame:middle");
  assert.equal(canDock(layout, "frame:parent", "window:settings"), false);
  assert.equal(dockResident(layout, "frame:parent", "frame:left", 0), layout);
  const bad = structuredClone(layout);
  bad.frames[1].members.push({ kind: "frame", id: "parent" });
  assert.throws(() => validateUILayout(bad), /Circular/);
  const duplicate = structuredClone(layout);
  duplicate.frames[1].members.push({ kind: "window", id: "settings" });
  assert.throws(() => validateUILayout(duplicate), /two frames/);
  const floated = floatResident(layout, "frame:middle", 500, 300);
  assert.equal(ownerOf(floated, "frame:middle"), undefined);
  assert.equal(ownerOf(floated, "window:settings"), "frame:middle");
  assert.deepEqual(
    layout.frames[0].members.map((m) => m.id),
    ["left", "middle", "right"],
  );
});
test("ancestor pinning protects descendants and local reset retains nested content", () => {
  let layout = {
    ...emptyUILayout(),
    frames: [
      {
        ...frame("p"),
        chrome: { controls: { close: { x: -20, y: 80 } } },
        members: [
          { kind: "function", id: "a", breakBefore: true },
          { kind: "frame", id: "child" },
        ],
      },
      frame("child"),
    ],
  };
  layout.frames[0].pinned = true;
  assert.equal(floatResident(layout, "frame:child", 0, 0), layout);
  assert.equal(resetContainer(layout, "frame:p"), layout);
  layout.frames[0].pinned = false;
  const reset = resetContainer(layout, "frame:p");
  assert.equal(reset.frames[0].chrome, undefined);
  assert.equal(reset.frames[0].members.length, 2);
  assert.equal(ownerOf(reset, "frame:child"), "frame:p");
  assert.equal(layout.frames[0].chrome.controls.close.x, -20);
});
test("bad frame controls and invalid nested window references reject the whole import", () => {
  const layout = { ...emptyUILayout(), frames: [frame("p")] },
    original = structuredClone(layout);
  assert.throws(
    () =>
      validateUILayout({
        ...layout,
        frames: [{ ...frame("p"), members: [{ kind: "window", id: "missing" }] }],
      }),
    /Missing nested/,
  );
  assert.throws(
    () =>
      validateUILayout({
        ...layout,
        frames: [{ ...frame("p"), chrome: { style: { mode: "icon", geometry: "bad" } } }],
      }),
    /appearance/,
  );
  assert.throws(
    () =>
      validateUILayout({
        ...layout,
        frames: [{ ...frame("p"), chrome: { controls: { close: { x: NaN, y: 0 } } } }],
      }),
    /control position/,
  );
  assert.deepEqual(layout, original);
});
test("UI undo/redo restores settings and arrangement together, coalesces typing, and clears abandoned redo branches", () => {
  const original = { layout: emptyUILayout(), settings: defaultSettings() };
  let h = startHistory(original);
  h = recordHistory(h, { ...original, layout: { ...original.layout, frames: [frame("a")] } });
  const created = h.present;
  h = recordHistory(
    h,
    {
      ...created,
      layout: { ...created.layout, frames: [{ ...created.layout.frames[0], name: "A" }] },
    },
    "name:a",
    1000,
  );
  h = recordHistory(
    h,
    {
      ...h.present,
      layout: { ...created.layout, frames: [{ ...created.layout.frames[0], name: "Atlas" }] },
    },
    "name:a",
    1200,
  );
  assert.equal(h.past.length, 2);
  h = undoHistory(h);
  assert.deepEqual(h.present, created);
  h = redoHistory(h);
  assert.equal(h.present.layout.frames[0].name, "Atlas");
  h = recordHistory(h, {
    ...h.present,
    settings: { ...h.present.settings, spatial: { ...h.present.settings.spatial, spacing: 5 } },
  });
  h = undoHistory(h);
  assert.equal(h.present.settings.spatial.spacing, 2);
  h = recordHistory(h, { ...h.present, layout: emptyUILayout() });
  assert.equal(h.future.length, 0);
  assert.deepEqual(original.layout.frames, []);
});
test("existing mouse settings gain separate Shift MB4/MB5 UI undo/redo defaults", () => {
  const settings = normalizeSettings({ mouse: { backButton: "undo", forwardButton: "redo" } });
  assert.equal(settings.mouse.shiftBackButton, "ui:undo");
  assert.equal(settings.mouse.shiftForwardButton, "ui:redo");
  assert.equal(settings.mouse.backButton, "undo");
  assert.equal(settings.mouse.forwardButton, "redo");
});
test("category magnetism is proximity-limited and releases with distance or its frame toggle", () => {
  const rect = { x: 100, y: 100, width: 80, height: 30 };
  assert.equal(magnetActive(185, 115, rect, true, true), true);
  assert.equal(magnetActive(205, 115, rect, true, true), false);
  assert.equal(magnetActive(185, 115, rect, true, false), false);
  assert.equal(magnetActive(185, 115, rect, false, true), false);
});

test("embedded groups share window ownership, reject containment cycles and preserve complete groups through undo/save", () => {
  const layout = emptyUILayout();
  const window = (parent, collapsed = false) => ({
    x: 50,
    y: 60,
    width: 220,
    height: 140,
    collapsed,
    pinned: false,
    inline: { parent },
  });
  layout.windows.host = { x: 0, y: 0, width: 500, height: 500, collapsed: false, pinned: false };
  layout.windows.lighting = window("window:host");
  layout.windows.glow = window("window:lighting");
  layout.windows.opacity = window("window:host", true);
  const original = validateUILayout(layout);
  assert.equal(ownerOf(original, "window:glow"), "window:lighting");
  assert.equal(canDock(original, "window:lighting", "window:glow"), false);
  const moved = dockResident(original, "window:opacity", "window:lighting", 0);
  assert.equal(ownerOf(moved, "window:opacity"), "window:lighting");
  assert.equal(moved.windows.opacity.inline.detached, true);
  assert.equal(moved.windows.lighting.members[0].kind, "window");
  assert.deepEqual(validateUILayout(JSON.parse(JSON.stringify(moved))), moved);
  assert.equal(ownerOf(original, "window:opacity"), "window:host");
  const collapsed = collapseResidentBranch(moved, "window:lighting", true);
  assert.equal(collapsed.windows.opacity.collapsed, true);
  assert.equal(collapsed.windows.glow.collapsed, true);
  const reopened = collapseResidentBranch(collapsed, "window:lighting", false);
  assert.equal(reopened.windows.opacity.collapsed, false);
  const history = recordHistory(startHistory(original), moved);
  assert.deepEqual(undoHistory(history).present, original);
  assert.deepEqual(redoHistory(undoHistory(history)).present, moved);
  const bad = structuredClone(original);
  bad.windows.lighting.inline.parent = "window:glow";
  assert.throws(() => validateUILayout(bad), /Circular/);
  const pinned = structuredClone(original);
  pinned.windows.lighting.pinned = true;
  assert.equal(canDock(pinned, "window:glow", "window:host"), false);
});

test("future embedded groups in entity-owned menus inherit the same fixed scope", () => {
  const layout = emptyUILayout();
  const window = (parent) => ({
    x: 20,
    y: 30,
    width: 240,
    height: 180,
    collapsed: false,
    pinned: false,
    ...(parent ? { inline: { parent } } : {}),
  });
  layout.windows["context:node"] = window();
  layout.windows.settings = window();
  layout.windows.future = window("window:context:node");
  layout.windows.child = window("window:future");
  validateUILayout(layout);
  assert.equal(canDock(layout, "window:child", "window:context:node"), true);
  assert.equal(canDock(layout, "window:child", "window:settings"), false);
  assert.equal(floatResident(layout, "window:child", 600, 500), layout);
  assert.equal(canDock(layout, "function:context:node:createChild", "window:future"), true);
  assert.equal(canDock(layout, "function:outside", "window:future"), false);
});
