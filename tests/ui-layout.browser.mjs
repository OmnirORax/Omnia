import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright-core";
import { emptyDocument } from "../src/graph/structural.ts";
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
const url = process.env.ATLAS_URL || "http://127.0.0.1:5173/";
function seed(label = "A") {
  const d = emptyDocument();
  d.entities = [label, "B"].map((label, i) => ({ id: `e${i}`, label, aliases: [], notes: "" }));
  d.placements = d.entities.map((e, i) => ({
    id: `p${i}`,
    entityId: e.id,
    parentId: null,
    position: { x: 0, y: 0 },
    spatialPosition: { x: i * 8, y: 0, z: 0 },
    collapsed: true,
    hidden: false,
  }));
  return d;
}
try {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1000 },
    acceptDownloads: true,
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript((doc) => {
    if (!localStorage.getItem("omnium.atlas.v2"))
      localStorage.setItem("omnium.atlas.v2", JSON.stringify(doc));
  }, seed());
  await page.goto(url);
  await page.locator("canvas").waitFor();
  const read = () => page.evaluate(() => JSON.parse(localStorage.getItem("omnium.atlas.v2")));
  const layout = () => page.evaluate(() => JSON.parse(localStorage.getItem("omnium.ui.layout.v1")));
  const unchanged = await read();
  await page.getByRole("button", { name: "Toggle shortcut display", exact: true }).click();
  const shortcuts = page.getByRole("complementary", { name: "Shortcut display" });
  await shortcuts.waitFor();
  const title = shortcuts.locator(".floating-title"),
    before = await shortcuts.boundingBox(),
    tb = await title.boundingBox();
  await page.mouse.move(tb.x + 25, tb.y + 18);
  await page.mouse.down();
  await page.mouse.move(tb.x - 175, tb.y + 98, { steps: 8 });
  await page.mouse.up();
  await page.waitForFunction(
    () => !!JSON.parse(localStorage.getItem("omnium.ui.layout.v1"))?.windows.shortcuts,
  );
  const moved = await shortcuts.boundingBox();
  assert.ok(moved.x < before.x - 100);
  assert.ok(moved.y > before.y + 40);
  await shortcuts.getByRole("button", { name: "Collapse Shortcut display", exact: true }).click();
  assert.ok((await shortcuts.boundingBox()).height < 90);
  assert.equal(
    await shortcuts.getByRole("button", { name: "Rebind Focus selected", exact: true }).isVisible(),
    false,
  );
  await shortcuts.getByRole("button", { name: "Expand Shortcut display", exact: true }).click();
  await shortcuts.getByRole("button", { name: "Pin Shortcut display", exact: true }).click();
  const pinned = await shortcuts.boundingBox(),
    pt = await title.boundingBox();
  await page.mouse.move(pt.x + 25, pt.y + 16);
  await page.mouse.down();
  await page.mouse.move(pt.x - 100, pt.y - 50, { steps: 6 });
  await page.mouse.up();
  assert.equal(Math.round((await shortcuts.boundingBox()).x), Math.round(pinned.x));
  await shortcuts.getByRole("button", { name: "Unpin Shortcut display", exact: true }).click();
  const grip = await page.getByLabel("Resize Shortcut display", { exact: true }).boundingBox();
  await page.mouse.move(grip.x + 5, grip.y + 5);
  await page.mouse.down();
  await page.mouse.move(grip.x - 145, grip.y + 55, { steps: 8 });
  await page.mouse.up();
  const resized = await shortcuts.boundingBox();
  assert.ok(resized.width < moved.width - 80);
  assert.ok(
    await shortcuts.locator(".floating-body").evaluate((e) => e.scrollWidth <= e.clientWidth + 2),
    "narrow window wraps labels and buttons without horizontal clipping",
  );
  await shortcuts.getByRole("button", { name: "Close shortcut display", exact: true }).click();
  // Native dragging must arrange the action without executing it.
  await page
    .locator('[data-ui-function="newNode"]')
    .dragTo(page.locator('[data-ui-function="ui:export"]'));
  await page.waitForFunction(
    () => JSON.parse(localStorage.getItem("omnium.ui.layout.v1")).frames.length === 1,
  );
  let saved = await layout();
  const frameId = saved.frames[0].id;
  assert.equal(saved.frames[0].collapsed, true);
  assert.deepEqual(await read(), unchanged);
  const frame = page.locator(".function-frame");
  await frame.getByLabel("UI frame name", { exact: true }).fill("My tools");
  await frame.getByRole("button", { name: "Expand UI frame My tools", exact: true }).click();
  // Move the group below the toolbar, then attach a third function as an L.
  let header = await frame.locator(".ui-frame-header").boundingBox();
  await page.mouse.move(header.x + 4, header.y + 20);
  await page.mouse.down();
  await page.mouse.move(500, 240, { steps: 8 });
  await page.mouse.up();
  const slots = await frame.locator(".ui-dock-area").boundingBox();
  const settingsSource = await page.locator('[data-ui-function="settings"]').boundingBox();
  await frame.locator(".ui-frame-handle").click({ button: "right" });
  await page.getByRole("menuitemcheckbox", { name: "Category magnetism: On" }).click();
  await page.mouse.move(
    settingsSource.x + settingsSource.width / 2,
    settingsSource.y + settingsSource.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    settingsSource.x + settingsSource.width / 2 + 10,
    settingsSource.y + settingsSource.height / 2 + 8,
  );
  await page.mouse.move(slots.x + 40, slots.y + slots.height + 2, { steps: 12 });
  await page.mouse.move(slots.x + 41, slots.y + slots.height + 2);
  await page.locator(".ui-drop-ghost").waitFor();
  await page.mouse.up();
  await page.waitForFunction(
    (id) =>
      JSON.parse(localStorage.getItem("omnium.ui.layout.v1")).frames.find((f) => f.id === id)
        .members.length === 3,
    frameId,
  );
  saved = await layout();
  assert.equal(
    saved.frames[0].members.some((m) => m.breakBefore),
    true,
  );
  assert.equal(
    await frame.locator(":scope > .ui-frame-root > .ui-dock-area > .ui-resident-slot").count(),
    3,
    "frame sizes its three residents without fixed square cells",
  );
  await frame.locator('[data-ui-function="settings"]').click({ button: "right" });
  const config = page.getByRole("dialog", { name: "Arrange: Workspace settings", exact: true });
  await config.waitFor();
  await config.getByLabel("Function display", { exact: true }).selectOption("icon");
  await config.getByLabel("Function geometry", { exact: true }).selectOption("triangle");
  await config.getByLabel("Function symbol", { exact: true }).fill("⚙");
  await config
    .getByRole("button", { name: "Close Arrange: Workspace settings", exact: true })
    .click();
  assert.ok(
    (await frame.locator('[data-ui-function="settings"]').getAttribute("class")).includes(
      "shape-triangle",
    ),
  );
  assert.match(
    await frame.locator('[data-ui-function="settings"]').getAttribute("title"),
    /Workspace settings/,
  );
  assert.deepEqual(await read(), unchanged);
  // The hierarchy can become an adjustable floating window and dock back again.
  await page.getByRole("button", { name: "Undock hierarchy panel", exact: true }).click();
  const hierarchy = page.getByRole("dialog", { name: "Hierarchy", exact: true });
  await hierarchy.waitFor();
  await hierarchy.getByRole("button", { name: "Dock Hierarchy", exact: true }).click();
  const select = async (name) => {
    await page
      .getByRole("navigation", { name: "Node hierarchy" })
      .getByRole("button", { name, exact: true })
      .click();
    await page.waitForTimeout(450);
  };
  const canvas = page.locator("canvas");
  await select("A");
  let cb = await canvas.boundingBox();
  await page.mouse.click(cb.x + cb.width / 2, cb.y + cb.height / 2, { button: "right" });
  const menu = page.getByRole("menu", { name: "node actions", exact: true });
  await menu.waitFor();
  await menu.getByRole("button", { name: "Arrange menu", exact: true }).click();
  const menuGrid = await menu.locator(".entity-menu-grid").boundingBox();
  await menu
    .getByRole("menuitem", { name: "Create child", exact: true })
    .dragTo(menu.locator(".entity-menu-grid"), { targetPosition: { x: 205, y: 20 } });
  await page.waitForFunction(
    () => !!JSON.parse(localStorage.getItem("omnium.ui.layout.v1")).menus.node,
  );
  assert.deepEqual(await read(), unchanged, "reordering context actions is only UI state");
  await page.mouse.click(cb.x + cb.width - 20, cb.y + cb.height - 30);
  await select("B");
  cb = await canvas.boundingBox();
  await page.mouse.click(cb.x + cb.width / 2, cb.y + cb.height / 2, { button: "right" });
  await page.getByRole("menuitem", { name: "Create child", exact: true }).click();
  const changed = await read();
  assert.equal(
    changed.placements.at(-1).parentId,
    "p1",
    "saved menu order must not retain the previous node target",
  );
  // UI-only templates transfer layout, not the author's knowledge.
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save UI template", exact: true }).click();
  const template = JSON.parse(await readFile(await (await download).path(), "utf8"));
  assert.equal(template.version, 3);
  assert.equal(template.atlas, undefined);
  assert.equal(template.layout.frames[0].name, "My tools");
  const other = await browser.newPage({ viewport: { width: 1200, height: 850 } });
  await other.addInitScript(
    (doc) => localStorage.setItem("omnium.atlas.v2", JSON.stringify(doc)),
    seed("Other knowledge"),
  );
  await other.goto(url);
  await other.locator("canvas").waitFor();
  const own = await other.evaluate(() => JSON.parse(localStorage.getItem("omnium.atlas.v2")));
  await other
    .locator("input[type=file]")
    .nth(1)
    .setInputFiles({
      name: "ui.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(template)),
    });
  await other.waitForFunction(
    () => JSON.parse(localStorage.getItem("omnium.ui.layout.v1"))?.frames[0]?.name === "My tools",
  );
  assert.deepEqual(
    await other.evaluate(() => JSON.parse(localStorage.getItem("omnium.atlas.v2"))),
    own,
  );
  const good = await other.evaluate(() => localStorage.getItem("omnium.ui.layout.v1"));
  const invalid = structuredClone(template);
  invalid.layout.frames[0].members.push({ ...invalid.layout.frames[0].members[0] });
  await other
    .locator("input[type=file]")
    .nth(1)
    .setInputFiles({
      name: "bad-ui.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(invalid)),
    });
  assert.equal(await other.evaluate(() => localStorage.getItem("omnium.ui.layout.v1")), good);
  await page.reload();
  await page.locator(".function-frame").waitFor();
  await page.locator("canvas").waitFor();
  assert.equal((await layout()).frames[0].name, "My tools");
  assert.deepEqual(errors, []);
  await page.screenshot({ path: "/tmp/omnium-ui-layout.png" });
  console.log(
    "PASS: draggable/resizable/collapsible/pinnable windows, wrapping, native function grouping, L-shaped frames, icon geometry, floating/docked panels, constrained context-menu rearrangement with fresh node targets, reload and UI-only template transfer/rejection without changing knowledge.",
  );
} finally {
  await browser.close();
}
