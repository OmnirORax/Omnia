import test from "node:test";
import assert from "node:assert/strict";
import { snapPosition } from "../src/ui/positioning.ts";
import { emptyUILayout, validateUILayout } from "../src/ui/layout.ts";
import { startHistory, recordHistory, undoHistory, redoHistory } from "../src/ui/history.ts";
const grid = { anchor: "function:a", origin: { x: 31, y: 47 }, pitch: { x: 52, y: 52 } };
test("occupied anchor cells never insert between adjacent icons or move their neighbors", () => {
  const occupied = [
    { x: 31, y: 47, width: 40, height: 40 },
    { x: 83, y: 47, width: 40, height: 40 },
  ];
  const original = structuredClone(occupied);
  const result = snapPosition({ x: 57, y: 47 }, { width: 40, height: 40 }, grid, occupied);
  assert.ok((result.x - 31) % 52 === 0);
  assert.ok((result.y - 47) % 52 === 0);
  assert.notDeepEqual(result, { x: 31, y: 47 });
  assert.notDeepEqual(result, { x: 83, y: 47 });
  assert.deepEqual(occupied, original);
  assert.deepEqual(
    result,
    snapPosition({ x: 57, y: 47 }, { width: 40, height: 40 }, grid, occupied),
  );
});
test("wide fields reserve multiple cells and grids work on both sides of the anchor", () => {
  const occupied = [{ x: 31, y: 47, width: 144, height: 40 }];
  assert.notDeepEqual(snapPosition({ x: 135, y: 47 }, { width: 40, height: 40 }, grid, occupied), {
    x: 135,
    y: 47,
  });
  assert.deepEqual(snapPosition({ x: -21, y: -5 }, { width: 40, height: 40 }, grid, occupied), {
    x: -21,
    y: -5,
  });
});
test("positions, workspace/local grids, body offsets and control icons survive save and undo", () => {
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
