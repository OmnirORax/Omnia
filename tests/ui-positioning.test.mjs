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

test("an expanded frame's interior accepts drops beyond its content allocation", async () => {
  const { frameInteriorDrop } = await import("../src/ui/dropSurface.ts");
  const layout = emptyUILayout();
  const state = { x: 0, y: 0, width: 400, height: 300, collapsed: false, pinned: false, members: [] };
  layout.windows.source = { ...state };
  layout.windows.destination = { ...state };
  // The pointer hits the outer frame, even though its content zone isn't hit.
  assert.equal(frameInteriorDrop(layout, ["window:source"], "window:destination", true), "dock");
  const moved = dockResident(layout, "window:source", "window:destination", 0);
  assert.ok(moved.windows.destination.members.some(member => member.kind === "window" && member.id === "source"));
  assert.equal(frameInteriorDrop(layout, ["window:source"], undefined, false), undefined, "the workspace retains free placement");
});

test("incompatible frame interiors block accidental detachment for single and multi drops", async () => {
  const { frameInteriorDrop } = await import("../src/ui/dropSurface.ts");
  const layout = emptyUILayout();
  const state = { x: 0, y: 0, width: 400, height: 300, collapsed: false, pinned: false, members: [] };
  layout.windows.parent = { ...state, members: [{ kind: "window", id: "child" }] };
  layout.windows.child = { ...state };
  layout.windows.pinned = { ...state, pinned: true };
  layout.windows.closed = { ...state, collapsed: true };
  assert.equal(frameInteriorDrop(layout, ["window:parent"], "window:child", true), "blocked", "ownership cycles reject in place");
  assert.equal(frameInteriorDrop(layout, ["window:child"], "window:pinned", true), "blocked");
  assert.equal(frameInteriorDrop(layout, ["window:child"], "window:parent", false), "blocked", "a visible unsupported interior does not become a free drop");
  assert.equal(frameInteriorDrop(layout, ["window:child", "window:parent"], "window:parent", true), "blocked", "one incompatible member rejects the whole selection");
  assert.equal(frameInteriorDrop(layout, ["window:child"], "window:closed", false), undefined, "collapsed handles keep their separate rules");
});

test("resize levels expand to progressively wider detected edges, ending at the viewport", async () => {
  const { resizeLevels } = await import("../src/ui/resizeGeometry.ts");
  const viewport = { x: 8, y: 8, width: 1000, height: 800 }, current = { x: 300, y: 250, width: 200, height: 150 };
  const levels = resizeLevels(current, [{ x: 200, y: 150, width: 400, height: 350 }, { x: 100, y: 50, width: 600, height: 600 }], viewport);
  assert.deepEqual(levels[0], { x: 200, y: 150, width: 400, height: 350 });
  assert.deepEqual(levels.at(-1), viewport); assert.ok(levels.length <= 10);
  for (let i = 1; i < levels.length; i++) {
    assert.ok(levels[i].x <= levels[i - 1].x && levels[i].y <= levels[i - 1].y);
    assert.ok(levels[i].x + levels[i].width >= levels[i - 1].x + levels[i - 1].width);
    assert.ok(levels[i].y + levels[i].height >= levels[i - 1].y + levels[i - 1].height);
  }
  assert.deepEqual(resizeLevels(current, [], viewport), [viewport]);
});

test("viewport resize serializes and undoes without detaching the original frame", () => {
  const layout = emptyUILayout(), state = { x: 20, y: 30, width: 240, height: 180, collapsed: false, pinned: false };
  layout.windows.parent = { ...state, members: [{ kind: "window", id: "child" }] };
  layout.windows.child = { ...state };
  const resized = { ...layout, windows: { ...layout.windows, child: { ...state, viewport: { x: 8, y: 8, width: 900, height: 700 } } } };
  assert.deepEqual(validateUILayout(JSON.parse(JSON.stringify(resized))), resized);
  const history = recordHistory(startHistory(layout), resized);
  assert.deepEqual(undoHistory(history).present, layout);
  assert.deepEqual(redoHistory(undoHistory(history)).present.windows.parent.members, layout.windows.parent.members);
  assert.throws(() => validateUILayout({ ...resized, windows: { ...resized.windows, child: { ...resized.windows.child, viewport: { x: 0, y: 0, width: -1, height: 20 } } } }), /viewport/);
});

test('nested popup placement separates actual parent bounds across shapes and levels',async()=>{
 const {separatePopup}=await import('../src/ui/popupPlacement.ts');
 const parent={x:100,y:100,width:180,height:36},child={width:100,height:100};
 const outside=(p,c,pos)=>Math.abs(pos.x-(p.x+p.width/2))>=(p.width+c.width)/2||Math.abs(pos.y-(p.y+p.height/2))>=(p.height+c.height)/2;
 for(const requested of [{x:190,y:118},{x:260,y:120},{x:140,y:105},{x:192,y:103}]){
  const placed=separatePopup(parent,child,requested);assert.ok(outside(parent,child,placed));
  const nextParent={x:placed.x-50,y:placed.y-50,width:100,height:100};
  const next=separatePopup(nextParent,{width:80,height:80},placed);assert.ok(outside(nextParent,{width:80,height:80},next),'each nest level gets the same separation');
 }
 const point={x:500,y:500};assert.equal(separatePopup(parent,child,point),point,'already separated invocations retain their position');
 const placed=separatePopup(parent,child,{x:190,y:118});assert.deepEqual(placed,{x:190,y:190},'centered invocation opens just below the strip');
});

test('child popup placement also avoids older ancestors rather than moving back over them',async()=>{
 const {placePopup}=await import('../src/ui/popupPlacement.ts');
 const parents=[{x:220,y:100,width:80,height:80},{x:100,y:90,width:116,height:100}];
 const size={width:100,height:100},placed=placePopup(parents,size,{x:225,y:140});
 for(const p of parents)assert.ok(Math.abs(placed.x-p.x-p.width/2)>=(p.width+size.width)/2||Math.abs(placed.y-p.y-p.height/2)>=(p.height+size.height)/2);
});
