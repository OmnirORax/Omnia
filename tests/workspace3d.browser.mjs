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
  const id = (name) => atlas.entities.find((e) => e.label === name).id;
  await page.getByLabel("New relationship source").selectOption(id("Part"));
  await page.getByLabel("New relationship target").selectOption(id("Neighbor"));
  await page.getByRole("button", { name: "Add relationship", exact: true }).click();
  const canvas = page.locator(".spatial-canvas canvas");
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
  assert.notDeepEqual(await canvas.screenshot(), frame, "rotation changes the view");
  const rotated = await canvas.screenshot();
  await page.mouse.move(x, y);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(x + 50, y + 30, { steps: 8 });
  await page.mouse.up({ button: "right" });
  assert.notDeepEqual(await canvas.screenshot(), rotated, "panning changes the view");
  const panned = await canvas.screenshot();
  await page.mouse.wheel(0, -250);
  assert.notDeepEqual(await canvas.screenshot(), panned, "zooming changes the view");
  await page.getByRole("button", { name: "Fit 3D view" }).click();
  await page
    .getByRole("navigation", { name: "Node hierarchy" })
    .getByRole("button", { name: "Part", exact: true })
    .click();
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem("omnium.atlas.v2")));
  await page.getByLabel("3D Y position").fill("2.5");
  await page.waitForFunction(
    (id) =>
      JSON.parse(localStorage.getItem("omnium.atlas.v2")).placements.find((p) => p.id === id)
        .spatialPosition?.y === 2.5,
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
  assert.deepEqual(errors, []);
  console.log(
    "PASS: interactive 3D rendering, camera rotation/pan/zoom, nested positions, links, XYZ persistence and reload.",
  );
} finally {
  await browser.close();
}
