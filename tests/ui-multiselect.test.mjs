import test from "node:test";
import assert from "node:assert/strict";
import { emptyUILayout, validateUILayout } from "../src/ui/layout.ts";
import { startHistory, recordHistory, undoHistory, redoHistory } from "../src/ui/history.ts";
import { arrangeButtons, buttonBounds, compactButtons, intersects, placeButtons } from "../src/ui/selection.ts";
test("five-step UI undo/redo restores exact intermediate ordering and clamps at history ends", () => {
  let h = startHistory(0);
  for (let i = 1; i <= 8; i++) h = recordHistory(h, i);
  h = undoHistory(h, 5);
  assert.equal(h.present, 3);
  assert.deepEqual(h.future, [4, 5, 6, 7, 8]);
  h = redoHistory(h, 5);
  assert.equal(h.present, 8);
  assert.deepEqual(h.past, [0, 1, 2, 3, 4, 5, 6, 7]);
  h = undoHistory(h, 50);
  assert.equal(h.present, 0);
  assert.equal(h.past.length, 0);
  h = redoHistory(h, 5);
  assert.equal(h.present, 5);
  h = recordHistory(h, 99);
  assert.equal(h.future.length, 0);
});
test("a multi-button move preserves IDs, styles, neighbors and is one recoverable UI operation", () => {
  const layout = emptyUILayout();
  const frame = (id, members) => ({
    id,
    name: id,
    x: 400,
    y: 300,
    cellSize: 96,
    width: 400,
    collapsed: false,
    pinned: false,
    members,
  });
  layout.frames = [
    frame("a", [
      { kind: "function", id: "x" },
      { kind: "function", id: "y" },
    ]),
    frame("b", [
      {
        kind: "function",
        id: "neighbor",
        position: { x: 10, y: 10 },
        size: { width: 60, height: 60 },
      },
    ]),
  ];
  layout.items.x = {
    x: 0,
    y: 0,
    home: false,
    style: { mode: "icon", geometry: "circle", character: "X" },
  };
  const source = structuredClone(layout),
    boxes = [
      { id: "x", x: 80, y: 10, width: 60, height: 60 },
      { id: "y", x: 146, y: 10, width: 60, height: 60 },
    ];
  const moved = placeButtons(layout, boxes, "frame:b");
  assert.deepEqual(moved.items.x, layout.items.x);
  assert.deepEqual(moved.frames[1].members[0], layout.frames[1].members[0]);
  assert.deepEqual(moved.frames[0].members, []);
  assert.equal(moved.frames[1].members.length, 3);
  assert.deepEqual(undoHistory(recordHistory(startHistory(layout), moved)).present, layout);
  const free = placeButtons(moved, boxes);
  assert.deepEqual(free.items.x.size, { width: 60, height: 60 });
  assert.deepEqual(validateUILayout(JSON.parse(JSON.stringify(free))), free);
  const pinned = structuredClone(layout);
  pinned.items.y = { x: 0, y: 0, pinned: true };
  assert.throws(() => placeButtons(pinned, boxes, "frame:b"), /Unpin/);
  assert.deepEqual(layout, source);
  const scoped = [{ id: "context:node:focus", x: 10, y: 10, width: 60, height: 30 }];
  assert.throws(() => placeButtons(layout, scoped), /owning menu/);
});
test("UI compaction packs mixed-size buttons inside the viewport without moving or intersecting neighbors", () => {
  const boxes = [
    { id: "a", x: 10, y: 20, width: 60, height: 60 },
    { id: "b", x: 350, y: 20, width: 130, height: 30 },
    { id: "c", x: 700, y: 20, width: 60, height: 60 },
    { id: "d", x: 1000, y: 20, width: 80, height: 30 },
  ];
  const obstacles = [{ x: 10, y: 20, width: 60, height: 60 }],
    area = { x: 0, y: 0, width: 600, height: 400 };
  const result = compactButtons(boxes, obstacles, area);
  assert.deepEqual(result, compactButtons(boxes, obstacles, area));
  assert.ok(
    buttonBounds(result).width * buttonBounds(result).height <
      buttonBounds(boxes).width * buttonBounds(boxes).height,
  );
  for (const [i, b] of result.entries()) {
    assert.equal(b.width, boxes[i].width);
    assert.equal(b.height, boxes[i].height);
    assert.equal(b.id, boxes[i].id);
    assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.width <= 600 && b.y + b.height <= 400);
    assert.ok(!obstacles.some((o) => intersects(b, o, 6)));
    assert.ok(!result.slice(i + 1).some((o) => intersects(b, o, 6)));
  }
  assert.throws(
    () =>
      validateUILayout({
        ...emptyUILayout(),
        items: { a: { x: 0, y: 0, size: { width: -1, height: 30 } } },
      }),
    /size/,
  );
});
test("grouping buttons, windows and complete nested groups reuses identities and is one undo step", async () => {
  const { groupResidents, ownerOf } = await import('../src/ui/layout.ts');
  const layout = emptyUILayout();
  const window = { x: 100, y: 200, width: 250, height: 220, collapsed: true, pinned: false };
  layout.windows.theme = { ...window };
  layout.windows.color = { ...window, inline: { parent:'window:theme' }, members:[{kind:'function',id:'color-input'}] };
  layout.windows.light = { ...window, inline: { parent:'window:theme' } };
  layout.items.action = { x:10, y:20, style:{mode:'icon',geometry:'circle',character:'+'} };
  const before = structuredClone(layout);
  const grouped = groupResidents(layout, ['window:color','window:light','function:action'], 100, 200);
  const group = grouped.frames[0], key = `frame:${group.id}`;
  assert.deepEqual(group.members, [{kind:'window',id:'color'},{kind:'window',id:'light'},{kind:'function',id:'action'}]);
  assert.equal(ownerOf(grouped,'window:color'),key);
  assert.deepEqual(grouped.windows.color.members,layout.windows.color.members);
  assert.equal(grouped.windows.color.collapsed,true);
  assert.deepEqual(grouped.items.action.style,layout.items.action.style);
  assert.deepEqual(Object.keys(grouped.windows),Object.keys(layout.windows));
  assert.deepEqual(undoHistory(recordHistory(startHistory(layout),grouped)).present,before);
  assert.deepEqual(validateUILayout(JSON.parse(JSON.stringify(grouped))),grouped);
  const pinned = structuredClone(layout); pinned.windows.theme.pinned=true;
  assert.throws(()=>groupResidents(pinned,['window:color','window:light'],0,0),/Unpin/);
  assert.throws(()=>groupResidents(layout,['window:theme','window:color'],0,0),/group or its contents/);
  assert.deepEqual(layout,before);
});
test("bulk grouping retains entity-menu scope through the same frame operation", async () => {
  const { groupResidents, residentContextScope } = await import('../src/ui/layout.ts');
  const layout=emptyUILayout(), menu='window:context:node';
  layout.windows['context:node']={x:100,y:100,width:300,height:300,collapsed:false,pinned:false,members:[{kind:'function',id:'context:node:focus'},{kind:'function',id:'context:node:expand'}]};
  const grouped=groupResidents(layout,['function:context:node:focus','function:context:node:expand'],100,100);
  assert.equal(residentContextScope(grouped,`frame:${grouped.frames[0].id}`),menu);
  assert.throws(()=>groupResidents(layout,['function:context:node:focus','function:other'],100,100),/owning menus/);
});

test("alignment separates colliding mixed-size items while keeping the chosen edge/center and dimensions", () => {
  const boxes = [
    { id: "a", x: 300, y: 150, width: 70, height: 30 },
    { id: "b", x: 300, y: 230, width: 90, height: 55 },
    { id: "c", x: 305, y: 360, width: 50, height: 40 },
  ], original = structuredClone(boxes), target = buttonBounds(boxes);
  const area = { x: 8, y: 8, width: 1000, height: 700 };
  for (const operation of ["top", "bottom", "left", "right", "centerX", "centerY"]) {
    const result = arrangeButtons(boxes, target, operation, { area });
    for (const [i, box] of result.entries()) {
      assert.equal(box.id, boxes[i].id); assert.equal(box.width, boxes[i].width); assert.equal(box.height, boxes[i].height);
      assert.ok(!result.slice(i + 1).some(other => intersects(box, other, 6)), operation);
      const vertical = ["top", "bottom", "centerY"].includes(operation), axis = vertical ? "y" : "x", size = vertical ? "height" : "width";
      const fraction = operation.startsWith("center") ? .5 : ["bottom", "right"].includes(operation) ? 1 : 0;
      assert.equal(box[axis] + box[size] * fraction, target[axis] + target[size] * fraction, operation);
    }
  }
  assert.deepEqual(boxes, original);
});
test("alignment avoids unselected obstacles, distribution expands cramped spacing, and insufficient room never changes inputs", () => {
  const boxes = [0, 1, 2].map(i => ({ id: String(i), x: 300, y: 100 + i * 70, width: 60, height: 30 }));
  const area = { x: 8, y: 8, width: 800, height: 500 }, target = buttonBounds(boxes);
  const obstacle = { x: 270, y: 230, width: 180, height: 60 };
  const result = arrangeButtons(boxes, target, "bottom", { area, obstacles: Object.fromEntries(boxes.map(box => [box.id, [obstacle]])) });
  assert.ok(result.every(box => !intersects(box, obstacle, 6)));
  const spread = arrangeButtons(boxes, target, "distributeX", { area });
  assert.ok(spread[1].x - spread[0].x - spread[0].width >= 6);
  assert.equal(spread[1].x - spread[0].x - spread[0].width, spread[2].x - spread[1].x - spread[1].width);
  const before = structuredClone(boxes);
  assert.throws(() => arrangeButtons(boxes, target, "bottom", { area: { ...area, width: 100 } }), /without overlap/);
  assert.deepEqual(boxes, before);
  assert.throws(() => arrangeButtons(boxes, target, "bottom", { area, bounds: Object.fromEntries(boxes.map(box => [box.id, { ...area, x: 280, width: 100 }])) }), /without overlap/);
  const constrained = arrangeButtons(boxes, target, "distributeX", { area, bounds: Object.fromEntries(boxes.map(box => [box.id, { ...area, x: 290, width: 250 }])) });
  assert.ok(constrained.every(box => box.x >= 290 && box.x + box.width <= 540));
});
