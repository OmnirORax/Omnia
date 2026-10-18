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
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(process.env.ATLAS_URL || "http://127.0.0.1:5173/");
  await page.getByRole("button", { name: "+ Add first node", exact: true }).click();
  await page.getByLabel("Node name", { exact: true }).fill("System");
  await page.getByRole("button", { name: "+ Child node", exact: true }).click();
  await page.getByLabel("Node name", { exact: true }).fill("Part");
  await page.getByRole("button", { name: "+ Node", exact: true }).click();
  await page.getByLabel("Node name", { exact: true }).fill("Neighbor");
  const atlas = await page.evaluate(() => JSON.parse(localStorage.getItem("omnium.atlas.v1")));
  const byName = (name) => atlas.nodes.find((node) => node.label === name).id;
  await page.getByLabel("New relationship source").selectOption(byName("Part"));
  await page.getByLabel("New relationship target").selectOption(byName("Neighbor"));
  await page.getByRole("button", { name: "Add relationship", exact: true }).click();
  await page.getByRole("button", { name: "3D", exact: true }).click();
  const canvas = page.locator(".spatial-canvas canvas");
  await canvas.waitFor();
  assert.equal(await canvas.evaluate((element) => !!element.getContext("webgl2")), true);
  assert.equal(await page.locator(".spatial-error").count(), 0);
  const box = await canvas.boundingBox();
  assert.ok(box.width > 500 && box.height > 500);

  // Camera rotation, pan and zoom produce distinct rendered frames.
  const frame = await canvas.screenshot();
  const x = box.x + box.width * 0.8,
    y = box.y + box.height * 0.3;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 90, y + 35, { steps: 8 });
  await page.mouse.up();
  assert.notDeepEqual(await canvas.screenshot(), frame, "rotation should change the view");
  const rotated = await canvas.screenshot();
  await page.mouse.move(x, y);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(x + 50, y + 30, { steps: 8 });
  await page.mouse.up({ button: "right" });
  assert.notDeepEqual(await canvas.screenshot(), rotated, "panning should change the view");
  const panned = await canvas.screenshot();
  await page.mouse.wheel(0, -250);
  assert.notDeepEqual(await canvas.screenshot(), panned, "zooming should change the view");
  await page.getByRole("button", { name: "Fit 3D view" }).click();

  // Authoring XYZ persists without changing the 2D coordinates or graph references.
  await page
    .getByRole("navigation", { name: "Node hierarchy" })
    .getByRole("button", { name: "Part", exact: true })
    .click();
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem("omnium.atlas.v1")));
  await page.getByLabel("3D Y position").fill("2.5");
  await page.waitForFunction(
    (id) =>
      JSON.parse(localStorage.getItem("omnium.atlas.v1")).nodes.find((node) => node.id === id)
        .spatialPosition?.y === 2.5,
    byName("Part"),
  );
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem("omnium.atlas.v1")));
  assert.deepEqual(
    after.nodes.find((node) => node.id === byName("Part")).position,
    before.nodes.find((node) => node.id === byName("Part")).position,
  );
  assert.deepEqual(after.relationships, before.relationships);
  await page.getByRole("button", { name: "2D", exact: true }).click();
  await page.locator(`.react-flow__node[data-id="${byName("Part")}"]`).waitFor();
  await page.reload();
  assert.deepEqual(
    await page.evaluate(() => JSON.parse(localStorage.getItem("omnium.atlas.v1"))),
    after,
  );
  await page.getByRole("button", { name: "3D", exact: true }).click();
  await canvas.waitFor();
  assert.deepEqual(errors, []);
  const dragContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const dragPage = await dragContext.newPage();
  await dragPage.goto(process.env.ATLAS_URL || "http://127.0.0.1:5173/");
  await dragPage.getByRole("button", { name: "+ Add first node", exact: true }).click();
  const initialNode = await dragPage.evaluate(
    () => JSON.parse(localStorage.getItem("omnium.atlas.v1")).nodes[0],
  );
  await dragPage.getByRole("button", { name: "3D", exact: true }).click();
  const dragCanvas = dragPage.locator(".spatial-canvas canvas");
  await dragCanvas.waitFor();
  const dragBox = await dragCanvas.boundingBox();
  const centerX = dragBox.x + dragBox.width / 2,
    centerY = dragBox.y + dragBox.height / 2;
  await dragPage.mouse.move(centerX, centerY);
  await dragPage.mouse.down();
  await dragPage.mouse.move(centerX + 80, centerY + 20, { steps: 12 });
  await dragPage.mouse.up();
  await dragPage.waitForFunction(
    () => !!JSON.parse(localStorage.getItem("omnium.atlas.v1")).nodes[0].spatialPosition,
  );
  const draggedNode = await dragPage.evaluate(
    () => JSON.parse(localStorage.getItem("omnium.atlas.v1")).nodes[0],
  );
  assert.deepEqual(draggedNode.position, initialNode.position);
  assert.notDeepEqual(draggedNode.spatialPosition, { x: 0.6, y: 0, z: 0.6 });
  await dragContext.close();
  console.log(
    "PASS: nested 3D graph with relationships renders; rotation, pan, zoom, node dragging, XYZ persistence, and 2D compatibility work.",
  );
} finally {
  await browser.close();
}
