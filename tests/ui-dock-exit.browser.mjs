import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { emptyUILayout } from "../src/ui/layout.ts";

const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1050 },
    reducedMotion: "reduce",
  });
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript((layout) => {
    localStorage.setItem("omnium.ui.layout.v1", JSON.stringify(layout));
  }, {
    ...emptyUILayout(),
    frames: [
      { id: "Dock", name: "Dock", x: 420, y: 180, width: 300, cellSize: 96, collapsed: false, pinned: false, members: [] },
      { id: "Tall", name: "Tall", x: 960, y: 180, width: 300, cellSize: 96, collapsed: false, pinned: false, members: [
        { kind: "function", id: "focus", position: { x: 12, y: 12 }, size: { width: 100, height: 40 } },
        { kind: "function", id: "fitLocal", position: { x: 12, y: 340 }, size: { width: 100, height: 40 } },
      ] },
    ],
  });
  await page.goto(process.env.ATLAS_URL || "http://127.0.0.1:5173/");
  const handle = page.locator('[data-ui-drag="frame:Tall"]');
  await handle.waitFor();
  const zone = page.locator('[data-ui-drop-zone="frame:Dock"]');
  const target = await zone.boundingBox();
  const source = await handle.boundingBox();
  const saved = await page.evaluate(() => localStorage.getItem("omnium.ui.layout.v1"));
  await page.mouse.move(source.x + 8, source.y + 10);
  await page.mouse.down();
  await page.mouse.move(source.x + 22, source.y + 12);
  const enter = async () => {
    await page.mouse.move(target.x + 45, target.y + 20, { steps: 3 });
    await zone.locator(".ui-drop-ghost").waitFor();
  };
  const leave = async () => {
    // Outside the original dock, still inside the large ghost's inflated area.
    await page.mouse.move(target.x + 65, target.y + target.height + 125, { steps: 3 });
    await zone.locator(".ui-drop-ghost").waitFor({ state: "detached" });
    await page.locator(".ui-placement-preview").waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem("omnium.ui.layout.v1")), saved);
  };
  await enter();
  await leave();
  await enter();
  await leave();
  await page.mouse.up();
  const result = await page.evaluate(() => JSON.parse(localStorage.getItem("omnium.ui.layout.v1")));
  assert.deepEqual(result.frames.find((frame) => frame.id === "Dock").members, []);
  assert.notEqual(result.frames.find((frame) => frame.id === "Tall").y, 180);
  assert.deepEqual(errors, []);
  console.log("Entering/leaving/re-entering an inflated dock stays reversible until the floating release.");
} finally {
  await browser.close();
}
