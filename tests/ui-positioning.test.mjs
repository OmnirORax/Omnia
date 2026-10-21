import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyUILayout,
  validateUILayout,
  orderNativeFunction,
  floatResident,
  dockResident,
  canDock,
} from "../src/ui/layout.ts";
import { startHistory, recordHistory, undoHistory, redoHistory } from "../src/ui/history.ts";
const grid = { anchor: "function:a", origin: { x: 31, y: 47 }, pitch: { x: 52, y: 52 } };
test("context actions share arrangement but cannot leave their entity-owned menu", () => {
  const layout = emptyUILayout();
  const state = {
    x: 0,
    y: 0,
    width: 230,
    height: 300,
    collapsed: false,
    pinned: false,
    members: [],
  };
  layout.windows["context:node"] = {
    ...state,
    members: [{ kind: "function", id: "context:node:focus" }],
  };
  layout.windows.other = { ...state };
  assert.ok(canDock(layout, "function:context:node:focus", "window:context:node"));
  assert.ok(!canDock(layout, "function:context:node:focus", "window:other"));
  assert.ok(!canDock(layout, "function:focus", "window:context:node"));
  assert.deepEqual(floatResident(layout, "function:context:node:focus", 500, 500), layout);
  assert.deepEqual(
    orderNativeFunction(layout, "context:node:focus", "workspace|focus", "focus", "focus", false),
    layout,
  );
  assert.deepEqual(validateUILayout(JSON.parse(JSON.stringify(layout))), layout);
  const invalid = structuredClone(layout);
  invalid.windows.other.members = invalid.windows["context:node"].members;
  invalid.windows["context:node"].members = [];
  assert.throws(() => validateUILayout(invalid), /owning menu/);
});
test("legacy grids remain readable while positions, body offsets and control icons survive save and undo", () => {
  const old = emptyUILayout();
  const next = {
    ...old,
    arrangement: { mode: "snap", grid },
    frames: [
      {
        id: "f",
        name: "tools",
        x: 200,
        y: 200,
        cellSize: 96,
        collapsed: false,
        pinned: false,
        arrangement: { mode: "snap", grid },
        bodyOffset: { x: 15, y: -27 },
        chrome: { controlStyles: { pin: { mode: "icon", geometry: "circle", character: "P" } } },
        members: [
          {
            kind: "function",
            id: "a",
            position: { x: -50.5, y: 10 },
            size: { width: 40, height: 40 },
          },
        ],
      },
    ],
  };
  const saved = validateUILayout(JSON.parse(JSON.stringify(next)));
  assert.deepEqual(saved, next);
  const before = startHistory({ layout: old, settings: {} }),
    after = recordHistory(before, { layout: saved, settings: {} });
  assert.deepEqual(undoHistory(after).present.layout, old);
  assert.deepEqual(redoHistory(undoHistory(after)).present.layout, next);
  assert.throws(() =>
    validateUILayout({
      ...saved,
      arrangement: { mode: "snap", grid: { ...grid, pitch: { x: 0, y: 52 } } },
    }),
  );
  assert.throws(
    () => validateUILayout({ ...saved, frames: [{ ...saved.frames[0], members: [null] }] }),
    /Invalid frame member/,
  );
});
test("native fields reorder as siblings, round-trip, undo, and release their anchors when floated/docked", () => {
  const original = emptyUILayout(),
    anchor = "window:panel:inspector|name";
  const next = orderNativeFunction(original, "color", anchor, "name", "name", false);
  assert.deepEqual(next.nativeOrders[anchor], ["color", "name"]);
  assert.equal(next.items.color.anchorId, anchor);
  assert.equal(next.frames.length, 0);
  const reordered = orderNativeFunction(next, "color", anchor, "name", "name", true);
  assert.deepEqual(reordered.nativeOrders[anchor], ["name", "color"]);
  assert.deepEqual(validateUILayout(JSON.parse(JSON.stringify(reordered))), reordered);
  assert.equal(
    floatResident(reordered, "function:color", 400, 300).items.color.anchorId,
    undefined,
  );
  const withFrame = {
    ...reordered,
    frames: [
      {
        id: "f",
        name: "f",
        x: 100,
        y: 100,
        cellSize: 96,
        collapsed: false,
        pinned: false,
        members: [],
      },
    ],
  };
  const docked = dockResident(withFrame, "function:color", "frame:f", 0);
  assert.equal(docked.items.color.anchorId, undefined);
  assert.equal(docked.frames[0].members[0].id, "color");
  assert.throws(
    () =>
      validateUILayout({
        ...docked,
        items: { color: { ...docked.items.color, anchorId: anchor } },
      }),
    /anchored and frame-owned/,
  );
  const h = recordHistory(startHistory(original), reordered);
  assert.deepEqual(undoHistory(h).present, original);
});
