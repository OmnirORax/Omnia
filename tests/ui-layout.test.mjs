import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyUILayout,
  validateUILayout,
  groupFunctions,
  placeInFrame,
  detachFunction,
  frameCells,
  fitWindow,
  nearestSlot,
} from "../src/ui/layout.ts";
test("grouping retains function identity and creates a named, initially collapsed UI frame", () => {
  const original = emptyUILayout(),
    grouped = groupFunctions(original, "focus", "undo", 96, 144);
  assert.equal(grouped.frames.length, 1);
  assert.equal(grouped.frames[0].collapsed, true);
  assert.equal(grouped.items.focus.frameId, grouped.items.undo.frameId);
  assert.deepEqual(original.items, {});
  const more = placeInFrame(grouped, "redo", grouped.frames[0].id, { x: 0, y: 1 });
  assert.deepEqual(
    frameCells(more, grouped.frames[0].id).sort((a, b) => a.y - b.y || a.x - b.x),
    [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ],
  );
  assert.deepEqual(validateUILayout(JSON.parse(JSON.stringify(more))), more);
});
test("snapping is deterministic, chooses empty neighbors and normalizes negative extension", () => {
  assert.deepEqual(nearestSlot([{ x: 0, y: 0 }], { x: 0, y: 0 }), { x: 0, y: -1 });
  const grouped = groupFunctions(emptyUILayout(), "a", "b", 20, 30),
    id = grouped.frames[0].id;
  const left = placeInFrame(grouped, "c", id, { x: -1, y: 0 });
  assert.deepEqual(left.items.c.cell, { x: 0, y: 0 });
  assert.deepEqual(left.items.a.cell, { x: 1, y: 0 });
  assert.equal(
    left.frames[0].x + left.items.a.cell.x * left.frames[0].cellSize,
    grouped.frames[0].x,
  );
  const detached = detachFunction(left, "c", 400, 300);
  assert.deepEqual(detached.items.a.cell, { x: 0, y: 0 });
  assert.equal(detached.frames[0].x, grouped.frames[0].x);
  assert.equal(detached.items.c.frameId, undefined);
  const occupied = Object.values(left.items).map((i) => `${i.cell.x}:${i.cell.y}`);
  assert.equal(new Set(occupied).size, 3);
});
test("pinned functions and frames reject rearrangement", () => {
  let layout = groupFunctions(emptyUILayout(), "a", "b", 20, 30),
    id = layout.frames[0].id;
  layout.frames[0].pinned = true;
  assert.equal(placeInFrame(layout, "c", id, { x: 0, y: 1 }), layout);
  layout.frames[0].pinned = false;
  layout.items.a.pinned = true;
  assert.equal(groupFunctions(layout, "a", "c", 0, 0), layout);
  assert.equal(placeInFrame(layout, "a", id, { x: 1, y: 0 }), layout);
});
test("malformed templates reject missing frames, duplicate cells, invalid assets and unsafe geometry", () => {
  const valid = groupFunctions(emptyUILayout(), "a", "b", 20, 30),
    before = structuredClone(valid);
  assert.throws(() => validateUILayout({ ...valid, frames: [] }), /Missing UI frame/);
  assert.throws(
    () => validateUILayout({ ...valid, items: { ...valid.items, c: { ...valid.items.a } } }),
    /same slot/,
  );
  assert.throws(
    () =>
      validateUILayout({
        ...valid,
        windows: {
          w: { x: Infinity, y: 0, width: 400, height: 500, collapsed: false, pinned: false },
        },
      }),
    /window geometry/,
  );
  assert.throws(
    () =>
      validateUILayout({
        ...valid,
        items: {
          a: { x: 0, y: 0, style: { mode: "icon", geometry: "circle", assetId: "missing" } },
        },
      }),
    /appearance/,
  );
  assert.throws(
    () =>
      validateUILayout({
        ...valid,
        menus: { node: { createChild: { x: 0, y: 0 }, focus: { x: 0, y: 0 } } },
      }),
    /menu layout/,
  );
  assert.deepEqual(valid, before);
});
test("window fitting keeps resized and imported windows reachable without losing collapse or pin state", () => {
  const saved = { x: 1400, y: 900, width: 600, height: 700, pinned: true, collapsed: false };
  const fit = fitWindow(saved, 800, 600);
  assert.ok(fit.x >= 0 && fit.x + fit.width <= 800);
  assert.ok(fit.y >= 0 && fit.y + fit.height <= 600);
  assert.equal(fit.pinned, true);
  assert.equal(saved.width, 600);
  const collapsed = fitWindow({ ...saved, collapsed: true }, 800, 600);
  assert.equal(collapsed.collapsed, true);
  assert.equal(collapsed.height, fit.height);
});
