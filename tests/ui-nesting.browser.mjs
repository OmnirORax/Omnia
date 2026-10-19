import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { emptyDocument } from "../src/graph/structural.ts";
import { emptyUILayout } from "../src/ui/layout.ts";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--enable-webgl",
    "--use-gl=angle",
    "--use-angle=swiftshader",
  ],
});
const page = await browser.newPage({
  viewport: { width: 1600, height: 1000 },
  acceptDownloads: true,
});
page.setDefaultTimeout(15000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const frame = (id, x, y, width, fn) => ({
  id,
  name: id,
  x,
  y,
  width,
  cellSize: 96,
  collapsed: false,
  pinned: false,
  members: fn ? [{ kind: "function", id: fn }] : [],
});
const initial = {
  ...emptyUILayout(),
  frames: [
    frame("Container", 500, 180, 750),
    frame("A", 30, 180, 200, "focus"),
    frame("B", 30, 350, 200, "fitLocal"),
    frame("C", 30, 520, 200, "expand"),
  ],
};
const graph = emptyDocument();
graph.entities = [{ id: "entity", label: "Original knowledge", aliases: [], notes: "" }];
graph.placements = [
  {
    id: "placement",
    entityId: "entity",
    parentId: null,
    position: { x: 0, y: 0 },
    spatialPosition: { x: 0, y: 0, z: 0 },
    collapsed: true,
    hidden: false,
  },
];
const read = () => page.evaluate(() => JSON.parse(localStorage.getItem("omnium.ui.layout.v1")));
const knowledge = () => page.evaluate(() => JSON.parse(localStorage.getItem("omnium.atlas.v2")));
const f = (id) => page.locator(`[data-ui-resident-root="frame:${id}"]`).first();
const zone = (id) => page.locator(`[data-ui-drop-zone="frame:${id}"]`).first();
const members = async () =>
  (await read()).frames.find((f) => f.id === "Container").members.map((m) => `${m.kind}:${m.id}`);
async function begin(source, x, y) {
  const b = await source.boundingBox();
  assert.ok(b, "drag source must be visible");
  // Text handles retain their editable name; grab the handle edge rather than its input.
  const dx = await source.evaluate(el => el.classList.contains('ui-frame-handle') && el.querySelector('input') ? 3 : Math.min(12, el.clientWidth / 2));
  await page.mouse.move(b.x + dx, b.y + Math.min(14, b.height / 2));
  await page.mouse.down();
  await page.mouse.move(b.x + dx + 12, b.y + Math.min(14, b.height / 2) + 4);
  await page.mouse.move(x, y, { steps: 12 });
  await page.mouse.move(x + 1, y);
}
async function finish() {
  await page.mouse.up();
  await page.waitForFunction(() => !document.querySelector(".ui-drop-ghost"));
}
async function history(button, shiftKey = true) {
  await page.evaluate(
    ({ button, shiftKey }) =>
      window.dispatchEvent(
        new PointerEvent("pointerdown", { button, shiftKey, bubbles: true, cancelable: true }),
      ),
    { button, shiftKey },
  );
}
try {
  await page.addInitScript(
    ({ graph, ui }) => {
      if (!localStorage.getItem("omnium.atlas.v2"))
        localStorage.setItem("omnium.atlas.v2", JSON.stringify(graph));
      if (!localStorage.getItem("omnium.ui.layout.v1"))
        localStorage.setItem("omnium.ui.layout.v1", JSON.stringify(ui));
    },
    { graph, ui: initial },
  );
  await page.goto(process.env.ATLAS_URL || "http://127.0.0.1:5173/");
  await page.locator("canvas").waitFor();
  const original = await knowledge();
  let target = await zone("Container").locator(".empty-ui-slot").boundingBox();
  await begin(f("A").locator(".ui-frame-handle"), target.x + 40, target.y + 20);
  await page.locator(".ui-drop-ghost").waitFor();
  const expectedA = await page.locator(".ui-drop-ghost").boundingBox();
  await finish();
  assert.deepEqual(await members(), ["frame:A"]);
  const actualA = await f("A").boundingBox();
  assert.ok(
    Math.abs(actualA.x - expectedA.x) < 3 && Math.abs(actualA.y - expectedA.y) < 3,
    "blue preview matches actual nested position",
  );
  let a = await f("A").boundingBox();
  await begin(f("B").locator(".ui-frame-handle"), a.x + a.width - 4, a.y + 15);
  await page.locator(".ui-drop-ghost").waitFor();
  await finish();
  assert.deepEqual(await members(), ["frame:A", "frame:B"]);
  a = await f("A").boundingBox();
  await begin(f("C").locator(".ui-frame-handle"), a.x + a.width + 7, a.y + 15);
  await page.locator(".ui-drop-ghost").waitFor();
  const expectedC = await page.locator(".ui-drop-ghost").boundingBox();
  await finish();
  assert.deepEqual(await members(), ["frame:A", "frame:C", "frame:B"]);
  const actualC = await f("C").boundingBox();
  assert.ok(Math.abs(actualC.x - expectedC.x) < 3 && Math.abs(actualC.y - expectedC.y) < 3);
  await history(3);
  assert.deepEqual(await members(), ["frame:A", "frame:B"]);
  await history(4);
  assert.deepEqual(await members(), ["frame:A", "frame:C", "frame:B"]);
  assert.deepEqual(await knowledge(), original);
  a = await f("A").boundingBox();
  await begin(f("B").locator(".ui-frame-handle"), a.x + 4, a.y + 15);
  await page.locator(".ui-drop-ghost").waitFor();
  await finish();
  assert.deepEqual(
    await members(),
    ["frame:B", "frame:A", "frame:C"],
    "an existing nested frame can be reordered without duplication",
  );
  await history(3);
  assert.deepEqual(await members(), ["frame:A", "frame:C", "frame:B"]);
  // A frame cannot be docked into its descendant. Esc also leaves the layout untouched.
  const beforeCycle = await read(),
    child = await zone("A").boundingBox();
  await begin(
    f("Container").locator(":scope > .frame-chrome .ui-frame-handle"),
    child.x + 20,
    child.y + 20,
  );
  assert.match(await page.locator(".ui-snap-preview").textContent(), /Cannot dock/);
  await finish();
  assert.deepEqual(await read(), beforeCycle);
  target = await zone("Container").boundingBox();
  await begin(f("B").locator(".ui-frame-handle"), target.x + 100, target.y + target.height + 20);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  assert.deepEqual(await read(), beforeCycle);
  // Mini controls stay owned by the frame and can be dragged independently.
  const close = f("Container").locator(':scope > .frame-chrome [data-ui-control="close"]'),
    header = await f("Container").locator(":scope > .frame-chrome").boundingBox();
  await begin(close, header.x + 100, header.y + 95);
  await page.locator(".ui-placement-preview").waitFor();
  await finish();
  assert.ok((await read()).frames.find((f) => f.id === "Container").chrome.controls.close.y > 40);
  await history(3);
  assert.equal((await read()).frames.find((f) => f.id === "Container").chrome, undefined);
  await history(4);
  // Frame appearance and placement mode are frame-local presentation settings.
  await f("Container")
    .locator(":scope > .frame-chrome .ui-frame-handle")
    .click({ button: "right" });
  await page.getByRole("button", { name: /^Free-hand mode/ }).click();
  assert.equal((await read()).frames.find((f) => f.id === "Container").arrangement.mode, 'free');
  await f("Container")
    .locator(":scope > .frame-chrome .ui-frame-handle")
    .click({ button: "right" });
  await page.getByRole("button", { name: "Frame handle appearance", exact: true }).click();
  const appearance = page.getByRole("dialog", { name: "Arrange frame handle", exact: true });
  await appearance.getByLabel("Frame handle display", { exact: true }).selectOption("icon");
  await appearance.getByLabel("Frame handle geometry", { exact: true }).selectOption("square");
  await appearance.getByLabel("Frame handle symbol", { exact: true }).fill("▣");
  await appearance.getByRole("button", { name: "Close Arrange frame handle", exact: true }).click();
  assert.equal(await f("Container").locator(":scope > .frame-chrome .icon-handle").count(), 1);
  await f("Container").getByRole("button", { name: "Toggle frame Container", exact: true }).click();
  assert.equal(await zone("Container").count(), 0);
  await f("Container").getByRole("button", { name: "Toggle frame Container", exact: true }).click();
  // Dock an existing settings window, then move one complete live field out of it.
  await page.getByRole("button", { name: "Workspace settings", exact: true }).click();
  const settings = page.getByRole("dialog", { name: "Workspace settings", exact: true });
  a = await f("B").boundingBox();
  await begin(settings.locator(".ui-frame-handle"), a.x + a.width - 5, a.y + 12);
  await page.locator(".ui-drop-ghost").waitFor();
  await finish();
  assert.ok((await members()).includes("window:settings"));
  assert.equal((await settings.locator(".ui-form-control").count()) > 0, true);
  const radiusSource = settings.locator('[data-ui-function="ui:radius"] .ui-field-edge.edge-left');
  const containerBody=await zone('Container').boundingBox();
  // Free-hand deliberately leaves B/C where authored; use empty parent space, not their overlap.
  await begin(radiusSource, containerBody.x + 40, containerBody.y + 220);
  await page.locator(".ui-drop-ghost").waitFor();
  await finish();
  assert.ok((await members()).includes("function:ui:radius"));
  const radius = zone("Container").locator(
    ':scope > .ui-resident-slot > [data-ui-function="ui:radius"]',
  );
  assert.equal(await radius.locator("label input").count(), 1);
  const input = radius.locator("input"),
    previousRadius = await input.inputValue();
  await input.fill("0.4");
  await input.blur();
  assert.equal(
    (await page.evaluate(() => JSON.parse(localStorage.getItem("omnium.workspace.settings.v1"))))
      .spatial.radius,
    0.4,
  );
  await history(3);
  assert.equal(await input.inputValue(), previousRadius);
  await history(4);
  assert.equal(await input.inputValue(), "0.4");
  assert.deepEqual(await knowledge(), original);
  // Graph history stays independent from UI history.
  await page.getByRole("button", { name: "+ Node", exact: true }).click();
  assert.equal((await knowledge()).entities.length, 2);
  const layoutBeforeGraphUndo = await read();
  await history(3, false);
  assert.equal((await knowledge()).entities.length, 1);
  assert.deepEqual(await read(), layoutBeforeGraphUndo);
  await history(4, false);
  assert.equal((await knowledge()).entities.length, 2);
  const saved = await read();
  await page.reload();
  await page.locator("canvas").waitFor();
  assert.deepEqual(await read(), saved);
  assert.ok((await members()).includes("window:settings"));
  assert.equal(
    await page.getByRole("dialog", { name: "Workspace settings", exact: true }).count(),
    1,
  );
  assert.deepEqual(errors, []);
  await page.screenshot({ path: "/tmp/omnium-nested-ui.png" });
  // Anchor/free-hand coverage lives in ui-positioning.browser.mjs.
  console.log(
    "PASS: measured nested frames, exact blue insertion, cycle rejection, Esc cancellation, movable mini controls, icon handles, live fields/windows, free-hand positions, persistence, and separate Shift MB4/5 UI history.",
  );
} catch (e) {
  await page.screenshot({ path: "/tmp/omnium-nested-ui-failure.png" });
  console.error("UI STATE", JSON.stringify(await read()));
  throw e;
} finally {
  await browser.close();
}
