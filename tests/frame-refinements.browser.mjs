import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { emptyDocument, validateDocument } from "../src/graph/structural.ts";
import { emptyUILayout } from "../src/ui/layout.ts";
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
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.setDefaultTimeout(10000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const graph = emptyDocument();
graph.entities = ["System", "Part A", "Part B"].map((id) => ({
  id,
  label: id,
  aliases: [],
  notes: "",
}));
graph.placements = graph.entities.map((e, i) => ({
  id: e.id,
  entityId: e.id,
  parentId: i === 1 ? "System" : null,
  position: i === 1 ? { x: 28, y: 104 } : { x: 0, y: 0 },
  spatialPosition: { x: i * 400, y: 0, z: 0 },
  collapsed: i === 0,
  hidden: false,
}));
graph.compositions = [{ id: "contains", parentId: "System", childId: "Part A" }];
validateDocument(graph);
const ui = emptyUILayout(),
  icon = { mode: "icon", geometry: "circle", character: "○" };
ui.items.focus = { x: 0, y: 0, home: false, style: icon };
ui.items.fitLocal = { x: 0, y: 0, home: false, style: icon };
ui.frames = [
  {
    id: "tools",
    name: "Tools",
    x: 700,
    y: 340,
    width: 600,
    cellSize: 96,
    collapsed: false,
    pinned: false,
    chrome: { style: icon },
    members: [
      {
        kind: "function",
        id: "focus",
        position: { x: 12, y: 12 },
        size: { width: 60, height: 60 },
      },
      {
        kind: "function",
        id: "fitLocal",
        position: { x: 86, y: 12 },
        size: { width: 60, height: 60 },
      },
    ],
  },
];
const read = () => page.evaluate(() => JSON.parse(localStorage.getItem("omnium.atlas.v2")));
const layout = () => page.evaluate(() => JSON.parse(localStorage.getItem("omnium.ui.layout.v1")));
const root = () => page.locator('[data-ui-resident-root="frame:tools"]');
const physical = (el) =>
  el.evaluate((e) => {
    const r = e.parentElement.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
  });
async function drag(source, x, y) {
  const b = await source.boundingBox();
  assert.ok(b);
  const sx = b.x + b.width / 2,
    sy = b.y + b.height / 2;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx + 14, sy + 4);
  await page.mouse.move(x, y, { steps: 14 });
  await page.mouse.move(x + 1, y);
  await page.locator(".ui-snap-preview").waitFor();
  const message = await page.locator(".ui-snap-preview").textContent();
  await page.mouse.up();
  await page.waitForFunction(() => !document.querySelector(".ui-snap-preview"));
  return message;
}
async function frameMenu(handle, action) {
  await handle.click({ button: "right" });
  await page
    .getByRole("menu", { name: "UI frame settings" })
    .getByRole("button", { name: action, exact: true })
    .click();
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
  await page.waitForTimeout(350);
  assert.equal(await page.locator(".frame-mini-control").count(), 0);
  const original = await read();
  assert.ok(
    (await physical(root())).width < 200,
    "frame bounds follow two icons, not its saved 600px wrapping width",
  );
  await drag(root().locator(".ui-frame-handle"), 1580, 500);
  await page.waitForTimeout(150);
  let box = await physical(root());
  assert.ok(
    box.right <= 1593 && box.right > 1570,
    `small frame reaches right edge: ${JSON.stringify(box)}`,
  );
  await frameMenu(root().locator(".ui-frame-handle"), "Pin frame");
  assert.ok((await layout()).frames[0].pinned);
  await frameMenu(root().locator(".ui-frame-handle"), "Unpin frame");
  await root().getByRole("button", { name: "Toggle frame Tools" }).click();
  await page.waitForTimeout(100);
  assert.ok((await physical(root())).width < 65, "collapsed frame shrinks to its handle");
  await root().getByRole("button", { name: "Toggle frame Tools" }).click();
  await page.keyboard.press("Control+Alt+u");
  const library = page.getByRole("dialog", { name: "UI library" });
  await library.waitFor();
  await library.getByLabel("Find UI function").fill("Export JSON");
  const entry = library.locator(".library-entry > .ui-function").first();
  const row = await entry.boundingBox();
  assert.ok(row.height <= 40, `library entry is a compact row (${row.height})`);
  await frameMenu(library.locator(".ui-frame-handle"), "Close UI library");
  await library.waitFor({ state: "hidden" });
  // Compact all moves only placements, is tight even with distant imported coordinates, and undoes atomically.
  await page.locator('[data-ui-function="compactAll"]').click();
  await page.waitForFunction(
    (revision) => JSON.parse(localStorage.getItem("omnium.atlas.v2")).revision > revision,
    original.revision,
  );
  const compacted = await read();
  assert.deepEqual(compacted.entities, original.entities);
  assert.deepEqual(compacted.compositions, original.compositions);
  assert.ok(
    compacted.placements.every((p) => Math.hypot(...Object.values(p.spatialPosition)) < 10),
    JSON.stringify(compacted.placements),
  );
  await page.keyboard.press("Control+z");
  assert.deepEqual((await read()).placements, original.placements);
  // A selected-only compact leaves the other placements unchanged.
  await page
    .getByRole("navigation", { name: "Node hierarchy" })
    .getByRole("button", { name: "Part B", exact: true })
    .click();
  assert.equal(
    await page.locator('[data-ui-function="compactAll"]').textContent(),
    "Compact selection",
  );
  await page.locator('[data-ui-function="compactAll"]').click();
  const selected = await read();
  for (const id of ["System", "Part A"])
    assert.deepEqual(
      selected.placements.find((p) => p.id === id),
      original.placements.find((p) => p.id === id),
    );
  await page.keyboard.press("Control+z");
  // Focus the collapsed root, then right-click its actual 3D label at the canvas center.
  await page
    .getByRole("navigation", { name: "Node hierarchy" })
    .getByRole("button", { name: "System", exact: true })
    .click();
  await page.waitForTimeout(500);
  const canvas = await page.locator(".spatial-workspace canvas").boundingBox();
  await page.mouse.click(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2, {
    button: "right",
  });
  const menu = page.getByRole("menu", { name: "node actions" });
  await menu.waitFor();
  const zone = menu.locator("[data-ui-drop-zone]"),
    target = await zone.boundingBox();
  const focus = menu.getByRole("menuitem", { name: "Focus", exact: true });
  assert.equal(
    await drag(focus, target.x + Math.min(130, target.width - 15), target.y + 35),
    "Place freely",
  );
  let saved = (await layout()).windows["context:node"];
  assert.ok(saved.members.every((m) => m.position && m.size));
  assert.ok(
    saved.members.find((m) => m.id.endsWith(":focus")).position.x > 60,
    "menu uses free positioning, not the old fixed cells",
  );
  const beforeEscape = await layout();
  assert.match(await drag(focus, canvas.x + 30, canvas.y + 30), /stays in its node menu/);
  assert.deepEqual(await layout(), beforeEscape, "context actions cannot be extracted");
  // Reopen the same presentation for another referent; callbacks must use the current target.
  await menu.getByRole("menuitem", { name: "Create child", exact: true }).click();
  const created = await read();
  assert.equal(created.compositions.at(-1).parentId, "System");
  assert.equal(created.entities.length, original.entities.length + 1);
  await page.screenshot({ path: "/tmp/omnium-frame-refinements.png" });
  assert.deepEqual(errors, []);
  console.log(
    "Frame bounds, compact rows, right-click controls, selection/all compaction with undo, and shared node-menu arrangement passed.",
  );
} finally {
  await browser.close();
}
