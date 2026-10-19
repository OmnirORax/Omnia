import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { emptyDocument } from "../src/graph/structural.ts";
import { emptyUILayout } from "../src/ui/layout.ts";
import { buttonBounds, intersects } from "../src/ui/selection.ts";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--enable-webgl",
    "--use-gl=angle",
    "--use-angle=swiftshader",
  ],
});
const page = await browser.newPage({ viewport: { width: 1800, height: 1100 } });
page.setDefaultTimeout(10000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const graph = emptyDocument();
graph.entities = [{ id: "root", label: "Knowledge", aliases: [], notes: "" }];
graph.placements = [
  {
    id: "root",
    entityId: "root",
    parentId: null,
    position: { x: 0, y: 0 },
    spatialPosition: { x: 0, y: 0, z: 0 },
    collapsed: false,
    hidden: false,
  },
];
const ui = emptyUILayout(),
  names = ["newNode", "fitAll", "settings"];
const icon = (character) => ({ mode: "icon", geometry: "circle", character });
for (const [i, id] of [...names, "focus"].entries())
  ui.items[id] = { x: 0, y: 0, home: false, style: icon(["N", "A", "S", "F"][i]) };
const frame = (id, x, members) => ({
  id,
  name: id,
  x,
  y: 400,
  width: 500,
  cellSize: 96,
  collapsed: false,
  pinned: false,
  chrome: { style: icon(id) },
  members,
});
ui.frames = [
  frame(
    "A",
    550,
    names.map((id, i) => ({
      kind: "function",
      id,
      position: { x: 12 + i * 132, y: 12 },
      size: { width: 60, height: 60 },
    })),
  ),
  {
    ...frame("B", 1100, [
      {
        kind: "function",
        id: "focus",
        position: { x: 12, y: 12 },
        size: { width: 60, height: 60 },
      },
    ]),
    arrangement: {
      mode: "snap",
      grid: { anchor: "function:focus", origin: { x: 12, y: 12 }, pitch: { x: 66, y: 66 } },
    },
  },
];
const layout = () => page.evaluate(() => JSON.parse(localStorage.getItem("omnium.ui.layout.v1")));
const knowledge = () => page.evaluate(() => JSON.parse(localStorage.getItem("omnium.atlas.v2")));
const fn = (id) => page.locator(`button[data-ui-function="${id}"]:not([data-ui-palette])`).first();
const target = () => page.locator('[data-ui-resident-root="frame:B"]');
const box = async (el) => {
  const r = await el.boundingBox();
  assert.ok(r);
  return r;
};
const mouseHistory = (button, shiftKey = false, altKey = false) =>
  page.evaluate(
    ({ button, shiftKey, altKey }) =>
      window.dispatchEvent(
        new PointerEvent("pointerdown", {
          button,
          shiftKey,
          altKey,
          bubbles: true,
          cancelable: true,
        }),
      ),
    { button, shiftKey, altKey },
  );
async function begin(source, x, y) {
  const r = await box(source);
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
  await page.mouse.down();
  await page.mouse.move(r.x + r.width / 2 + 15, r.y + r.height / 2 + 5);
  await page.mouse.move(x, y, { steps: 12 });
  await page.mouse.move(x + 1, y);
}
try {
  await page.addInitScript(
    ({ graph, ui }) => {
      if (!localStorage.getItem("omnium.atlas.v2"))
        localStorage.setItem("omnium.atlas.v2", JSON.stringify(graph));
      if (!localStorage.getItem("omnium.ui.layout.v1"))
        localStorage.setItem("omnium.ui.layout.v1", JSON.stringify(ui));
    },
    { graph, ui },
  );
  await page.goto(process.env.ATLAS_URL || "http://127.0.0.1:5173/");
  await page.locator("canvas").waitFor();
  const original = await knowledge();
  await page.keyboard.down("Control");
  for (const id of names) await fn(id).click();
  await page.keyboard.up("Control");
  assert.equal(await page.locator("button.ui-selected").count(), 3);
  assert.deepEqual(await knowledge(), original, "selecting buttons must not activate them");
  assert.equal(
    await page.getByRole("dialog", { name: "Workspace settings", exact: true }).count(),
    0,
  );
  const before = await layout(),
    handle = await box(target().locator(".ui-frame-handle"));
  await begin(fn("newNode"), handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.waitForFunction(() => document.querySelectorAll(".ui-placement-preview").length === 3);
  const preview = await page.locator(".ui-placement-preview").evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    }),
  );
  await page.mouse.up();
  await page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("omnium.ui.layout.v1")).frames.find((f) => f.id === "B")
        .members.length === 4,
  );
  const moved = await layout();
  assert.equal(moved.frames.find((f) => f.id === "A").members.length, 0);
  for (const [i, id] of names.entries()) {
    const actual = await box(fn(id));
    assert.ok(
      Math.abs(actual.x - preview[i].x) < 3 && Math.abs(actual.y - preview[i].y) < 3,
      "group preview matches the resulting button position",
    );
    const p = moved.frames.find((f) => f.id === "B").members.find((m) => m.id === id).position;
    assert.equal((p.x - 12) % 66, 0);
    assert.equal((p.y - 12) % 66, 0);
  }
  assert.deepEqual(await knowledge(), original);
  await mouseHistory(3, true);
  assert.deepEqual((await layout()).frames, before.frames, "group drag undoes in one UI step");
  await mouseHistory(4, true);
  assert.deepEqual((await layout()).frames, moved.frames);
  await fn("newNode").click({ button: "right" });
  await page
    .getByRole("menu", { name: "Selected UI actions" })
    .getByRole("button", { name: "Compact selected UI", exact: true })
    .click();
  const packed = await layout(),
    members = packed.frames.find((f) => f.id === "B").members,
    selected = members
      .filter((m) => names.includes(m.id))
      .map((m) => ({ id: m.id, ...m.position, ...m.size }));
  const old = moved.frames
    .find((f) => f.id === "B")
    .members.filter((m) => names.includes(m.id))
    .map((m) => ({ ...m.position, ...m.size }));
  assert.ok(
    buttonBounds(selected).width < buttonBounds(old).width,
    "UI compact closes the large authored gaps",
  );
  for (const [i, b] of selected.entries())
    assert.ok(!selected.slice(i + 1).some((other) => intersects(b, other, 6)));
  assert.deepEqual(
    members.find((m) => m.id === "focus"),
    moved.frames.find((f) => f.id === "B").members.find((m) => m.id === "focus"),
  );
  await mouseHistory(3, true);
  assert.deepEqual((await layout()).frames, moved.frames);
  await mouseHistory(4, true);
  assert.deepEqual((await layout()).frames, packed.frames);
  // Free group movement also preserves geometry right up to the viewport edge.
  await begin(fn("newNode"), 1770, 1080);
  await page.waitForFunction(() => document.querySelectorAll(".ui-placement-preview").length === 3);
  const freePreview = await page.locator(".ui-placement-preview").evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y };
    }),
  );
  await page.mouse.up();
  await page.waitForFunction(
    () => !!JSON.parse(localStorage.getItem("omnium.ui.layout.v1")).items.newNode.size,
  );
  for (const [i, id] of names.entries()) {
    const actual = await box(fn(id));
    assert.ok(
      Math.abs(actual.x - freePreview[i].x) < 3 && Math.abs(actual.y - freePreview[i].y) < 3,
      "free-group preview includes actual edge clamping",
    );
  }
  await mouseHistory(3, true);
  assert.deepEqual((await layout()).frames, packed.frames);
  assert.deepEqual((await layout()).items, packed.items);
  await page
    .getByRole("region", { name: "UI selection" })
    .getByRole("button", { name: "Done / clear" })
    .click();
  // A normal native single-button drag also blocks a trailing release click.
  const h = await box(target().locator(".ui-frame-handle"));
  await begin(fn("newNode"), h.x + h.width / 2, h.y + h.height / 2);
  await page.locator(".ui-drop-ghost").waitFor();
  await page.mouse.up();
  await page.waitForFunction(() => !document.querySelector(".ui-drop-ghost"));
  await fn("newNode").dispatchEvent("click", { detail: 1, bubbles: true, cancelable: true });
  assert.deepEqual(await knowledge(), original, "drag-release click cannot create a graph node");
  // The next deliberate press is immediately usable, not blocked by a cooldown.
  for (let i = 0; i < 7; i++) await fn("newNode").click();
  assert.equal((await knowledge()).entities.length, 8);
  const uiBeforeGraph = await layout(),
    graphBeforeUndo = await knowledge();
  await mouseHistory(3, false, true);
  assert.equal((await knowledge()).entities.length, 3);
  await mouseHistory(4, false, true);
  assert.deepEqual((await knowledge()).entities, graphBeforeUndo.entities);
  await mouseHistory(3, false, true);
  await mouseHistory(3, false, true);
  assert.equal((await knowledge()).entities.length, 1, "batch undo clamps at the oldest state");
  await mouseHistory(4, false, true);
  assert.equal((await knowledge()).entities.length, 6);
  await mouseHistory(4, false, true);
  assert.equal((await knowledge()).entities.length, 8);
  assert.deepEqual(await layout(), uiBeforeGraph, "graph history does not change the UI");
  const baseFrames = (await layout()).frames.length;
  for (let i = 0; i < 6; i++) await fn("ui:createFrame").click();
  await mouseHistory(3, true, true);
  assert.equal(
    (await layout()).frames.length,
    baseFrames + 1,
    "Shift+Alt MB4 undoes five UI steps",
  );
  await mouseHistory(4, true, true);
  assert.equal((await layout()).frames.length, baseFrames + 6);
  assert.deepEqual((await knowledge()).entities, graphBeforeUndo.entities);
  // Box selection is a dedicated UI mode; it never selects or modifies graph nodes.
  await fn("ui:select").click();
  await page.waitForFunction(() => document.body.classList.contains("ui-select-mode"));
  const a = await box(fn("fitAll")),
    s = await box(fn("settings")),
    rect = buttonBounds([a, s]);
  await page.mouse.move(rect.x - 4, rect.y - 4);
  await page.mouse.down();
  await page.mouse.move(rect.x + rect.width + 4, rect.y + rect.height + 4, { steps: 14 });
  await page.mouse.up();
  assert.equal(await page.locator("button.ui-selected").count(), 2);
  await page.keyboard.press("Delete");
  assert.deepEqual(
    (await knowledge()).entities,
    graphBeforeUndo.entities,
    "UI selection must not delete selected graph knowledge",
  );
  const beforeCancel = await layout();
  await begin(fn("fitAll"), 950, 850);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  assert.deepEqual(
    await layout(),
    beforeCancel,
    "Esc cancels group movement without history or layout changes",
  );
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("button.ui-selected").count(), 0);
  const final = await layout();
  await page.reload();
  await page.locator("canvas").waitFor();
  assert.deepEqual(await layout(), final);
  assert.equal(
    await page.locator("button.ui-selected").count(),
    0,
    "selection is transient, not saved",
  );
  assert.deepEqual(errors, []);
  await page.screenshot({ path: "/tmp/omnium-ui-multiselect.png" });
  console.log(
    "PASS: Ctrl/box UI selection, snapped group moves and previews, compact selection and one-step undo, drag-release suppression, five-step graph/UI histories, cancellation and persistence.",
  );
} finally {
  await browser.close();
}
