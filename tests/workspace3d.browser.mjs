import assert from "node:assert/strict";
import { chromium } from "playwright-core";
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
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.ATLAS_URL || "http://127.0.0.1:5173/");
  await page.getByRole("button", { name: "+ Add first node" }).click();
  await page.getByLabel("Node name", { exact: true }).fill("System");
  await page.getByRole("button", { name: "+ Child node" }).click();
  await page.getByLabel("Node name", { exact: true }).fill("Part");
  await page.getByRole("button", { name: "+ Node", exact: true }).click();
  await page.getByLabel("Node name", { exact: true }).fill("Neighbor");
  const atlas = await page.evaluate(() => JSON.parse(localStorage.getItem("omnium.atlas.v2")));
  const id = (name) => {
    const entityId = atlas.entities.find((e) => e.label === name).id;
    return atlas.placements.find((p) => p.entityId === entityId).id;
  };
  await page.getByLabel("New relationship source").selectOption(id("Part"));
  await page.getByLabel("New relationship target").selectOption(id("Neighbor"));
  await page.getByRole("button", { name: "Add relationship", exact: true }).click();
  const canvas = page.locator(".spatial-workspace canvas");
  await canvas.waitFor();
  assert.equal(await canvas.evaluate((el) => !!el.getContext("webgl2")), true);
  assert.equal(await page.locator(".spatial-error").count(), 0);
  const box = await canvas.boundingBox();
  assert.ok(box.width > 500 && box.height > 500);
  const frame = await canvas.screenshot();
  const x = box.x + box.width * 0.8,
    y = box.y + box.height * 0.3;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 90, y + 35, { steps: 8 });
  await page.mouse.up();
  assert.notDeepEqual(await canvas.screenshot(), frame, "panning changes the view");
  const panned = await canvas.screenshot();
  await page.mouse.move(x, y);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(x + 50, y + 30, { steps: 8 });
  await page.mouse.up({ button: "right" });
  assert.notDeepEqual(await canvas.screenshot(), panned, "rotation changes the view");
  const rotated = await canvas.screenshot();
  await page.mouse.wheel(0, -250);
  assert.notDeepEqual(await canvas.screenshot(), rotated, "zooming changes the view");
  await page.getByRole("button", { name: "Fit entire atlas" }).click();
  await page
    .getByRole("navigation", { name: "Node hierarchy" })
    .getByRole("button", { name: "Part", exact: true })
    .click();
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem("omnium.atlas.v2")));
  await page.getByLabel("3D X position").fill("0");
  await page.waitForFunction((id) => JSON.parse(localStorage.getItem("omnium.atlas.v2")).placements.find((p) => p.id === id).spatialPosition?.x === 0, id("Part"));
  await page.getByLabel("3D Y position").fill("2");
  await page.waitForFunction(
    (id) =>
      JSON.parse(localStorage.getItem("omnium.atlas.v2")).placements.find((p) => p.id === id)
        .spatialPosition?.y === 2,
    id("Part"),
  );
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem("omnium.atlas.v2")));
  assert.deepEqual(
    after.placements.find((p) => p.id === id("Part")).position,
    before.placements.find((p) => p.id === id("Part")).position,
  );
  assert.deepEqual(after.relationships, before.relationships);
  await page.reload();
  await canvas.waitFor();
  assert.deepEqual(
    await page.evaluate(() => JSON.parse(localStorage.getItem("omnium.atlas.v2"))),
    after,
  );
  await page.getByRole("navigation", { name: "Node hierarchy" }).getByRole("button", { name: "Part", exact: true }).click();
  await page.waitForTimeout(450);
  const focused = await canvas.boundingBox();
  await page.mouse.click(focused.x + focused.width / 2, focused.y + focused.height / 2, { button: "right" });
  assert.equal(await page.getByRole("menuitem", { name: "Create child" }).count(), 1);
  await page.getByRole("menuitem", { name: "Create child" }).click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("omnium.atlas.v2")).entities.length === 4);
  await page.getByRole("navigation", { name: "Node hierarchy" }).getByRole("button", { name: "Neighbor", exact: true }).click();
  await page.waitForTimeout(450);
  const beforeDrag = await page.evaluate(() => JSON.parse(localStorage.getItem("omnium.atlas.v2")));
  const draggedId = id("Neighbor");
  await page.mouse.move(focused.x + focused.width / 2, focused.y + focused.height / 2);
  await page.mouse.down();
  await page.mouse.move(focused.x + focused.width / 2 + 220, focused.y + focused.height / 2, { steps: 8 });
  await page.mouse.up();
  const originalXYZ = beforeDrag.placements.find((p) => p.id === draggedId).spatialPosition;
  await page.waitForFunction(({ id, originalXYZ }) => JSON.stringify(JSON.parse(localStorage.getItem("omnium.atlas.v2")).placements.find((p) => p.id === id).spatialPosition) !== JSON.stringify(originalXYZ), { id: draggedId, originalXYZ });
  const afterDrag = await page.evaluate(() => JSON.parse(localStorage.getItem("omnium.atlas.v2")));
  assert.deepEqual(afterDrag.compositions, beforeDrag.compositions, "ordinary dragging does not chart a relationship");
  await canvas.click({ position: { x: focused.width - 15, y: focused.height - 15 }, button: "right" });
  await page.getByRole("menuitem", { name: "Workspace settings" }).click();
  await page.getByLabel("Settings snap spacing").selectOption("0.5");
  await page.getByRole("dialog", { name: "Workspace settings" }).getByRole("button", { name: "Close", exact: true }).click();
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("omnium.workspace.settings.v1")).spatial.spacing), 0.5);
  const countBeforeShortcut = (await page.evaluate(() => JSON.parse(localStorage.getItem("omnium.atlas.v2")))).entities.length;
  await page.keyboard.press("n");
  await page.waitForFunction((count) => JSON.parse(localStorage.getItem("omnium.atlas.v2")).entities.length === count + 1, countBeforeShortcut);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: interactive 3D rendering, camera rotation/pan/zoom, nested positions, links, XYZ persistence and reload.",
  );
} finally {
  await browser.close();
}
