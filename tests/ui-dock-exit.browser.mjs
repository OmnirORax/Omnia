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
    windows: { theme: { x: 1000, y: 180, width: 350, height: 600, collapsed: true, pinned: false } },
    frames: [
      { id: "Dock", name: "Dock", x: 420, y: 180, width: 300, cellSize: 96, collapsed: false, pinned: false, members: [] },
      { id: "Tall", name: "Tall", x: 960, y: 180, width: 300, cellSize: 96, collapsed: false, pinned: false, members: [
        { kind: "function", id: "focus", position: { x: 12, y: 12 }, size: { width: 100, height: 40 } },
        { kind: "function", id: "fitLocal", position: { x: 12, y: 340 }, size: { width: 100, height: 40 } },
      ] },
      { id: "Edge", name: "Edge", x: 1400, y: 180, width: 350, cellSize: 96, collapsed: false, pinned: false, members: [
        { kind: "window", id: "theme" }, { kind: "function", id: "zoom100" },
      ] },
    ],
  });
  await page.goto(process.env.ATLAS_URL || "http://127.0.0.1:5173/");
  const handle = page.locator('[data-ui-drag="frame:Tall"]');
  await handle.waitFor();
  const zone = page.locator('[data-ui-drop-zone="frame:Dock"]');
  const ghost = page.locator('[data-ui-preview-target="frame:Dock"]');
  const target = await zone.boundingBox();
  const source = await handle.boundingBox();
  const saved = await page.evaluate(() => localStorage.getItem("omnium.ui.layout.v1"));
  await page.mouse.move(source.x + 8, source.y + 10);
  await page.mouse.down();
  await page.mouse.move(source.x + 22, source.y + 12);
  const enter = async () => {
    await page.mouse.move(target.x + 45, target.y + 20, { steps: 3 });
    await ghost.waitFor();
  };
  const leave = async () => {
    // Outside the original dock, still inside the large ghost's inflated area.
    await page.mouse.move(target.x + 65, target.y + target.height + 125, { steps: 3 });
    await ghost.waitFor({ state: "detached" });
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
  // Source and owning frame must remain visible and stationary while the
  // pointer enters/leaves docking regions, particularly near viewport clamping.
  const theme = page.locator('[data-ui-drag="window:theme"]');
  const edge = page.locator('[data-ui-drag="frame:Edge"]');
  const themeBefore = await theme.boundingBox(), edgeBefore = await edge.boundingBox();
  const beforeDrag = await page.evaluate(() => localStorage.getItem("omnium.ui.layout.v1"));
  await page.mouse.move(themeBefore.x + 8, themeBefore.y + 10);
  await page.mouse.down();
  await page.mouse.move(themeBefore.x + 22, themeBefore.y + 12);
  for (const [x, y] of [[1570, 310], [1550, 320], [1500, 340], [1580, 370], [800, 500], [1570, 310], [800, 700]]) {
    await page.mouse.move(x, y, { steps: 2 });
    await page.waitForTimeout(50);
    assert.deepEqual(await theme.boundingBox(), themeBefore, "held source must not jump");
    assert.deepEqual(await edge.boundingBox(), edgeBefore, "owning frame must not jump");
    assert.equal(await theme.isVisible(), true);
    assert.equal(await page.evaluate(() => localStorage.getItem("omnium.ui.layout.v1")), beforeDrag);
  }
  await page.mouse.up();
  await page.waitForFunction(() => !JSON.parse(localStorage.getItem("omnium.ui.layout.v1")).frames.find(frame => frame.id === "Edge").members.some(member => member.id === "theme"));
  const floated = await theme.boundingBox();
  assert.ok(floated.x < 900, "release commits the actual floating destination");
  await page.mouse.move(floated.x + 8, floated.y + 10);
  await page.mouse.down();
  await page.mouse.move(floated.x + 22, floated.y + 12);
  await page.mouse.move(target.x + 45, target.y + 20, { steps: 3 });
  await ghost.waitFor();
  const expected = await ghost.boundingBox();
  await page.mouse.up();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("omnium.ui.layout.v1")).frames.find(frame => frame.id === "Dock").members.some(member => member.id === "theme"));
  const actual = await page.locator('[data-ui-slot-key="window:theme"]').boundingBox();
  assert.ok(Math.abs(actual.x - expected.x) < 2 && Math.abs(actual.y - expected.y) < 2, "overlay and committed dock position agree");
  assert.deepEqual(errors, []);
  console.log("Dock entry/exit is reversible; live source/parent stay stationary at the screen edge; release commits the matching destination.");
} finally {
  await browser.close();
}
