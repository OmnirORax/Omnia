import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { emptyUILayout } from "../src/ui/layout.ts";
const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox", "--disable-dev-shm-usage"] });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1050 }, reducedMotion: "reduce" });
  page.setDefaultTimeout(10000);
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(layout => { if (!sessionStorage.getItem("dock-test-seeded")) { localStorage.setItem("omnium.ui.layout.v1", JSON.stringify(layout)); sessionStorage.setItem("dock-test-seeded", "true"); } }, {
    ...emptyUILayout(), panels: { "@settings": true, "@theme": true },
    windows: {
      theme: { x: 950, y: 160, width: 350, height: 600, collapsed: false, pinned: false },
      settings: { x: 360, y: 160, width: 500, height: 600, collapsed: false, pinned: false },
    },
    frames: [{ id: "Tools", name: "Tools", x: 1150, y: 820, width: 260, cellSize: 96, collapsed: false, pinned: false, members: [{ kind: "function", id: "zoom100" }] }],
  });
  await page.goto(process.env.ATLAS_URL || "http://127.0.0.1:5181/");
  const state = () => page.evaluate(() => JSON.parse(localStorage.getItem("omnium.ui.layout.v1")));
  const drag = async (selector, x, y) => {
    const box = await page.locator(selector).boundingBox(); assert.ok(box, selector);
    await page.mouse.move(box.x + 12, box.y + 12); await page.mouse.down();
    await page.mouse.move(box.x + 24, box.y + 14); await page.mouse.move(x, y, { steps: 5 });
    await page.waitForTimeout(100);
  };
  await page.locator('[data-ui-drag="window:theme"]').waitFor();
  const settings = await page.locator('[data-ui-resident-root="window:settings"]').boundingBox();
  await drag('[data-ui-drag="window:theme"]', settings.x + settings.width - 8, settings.y + 180);
  assert.match(await page.locator('.ui-snap-preview').innerText(), /Dock right/);
  await page.mouse.up();
  await page.locator('.ui-dock-split').waitFor();
  let layout = await state(), group = layout.frames.find(frame => frame.dockGroup);
  assert.equal(group.dockLayout.axis, "horizontal");
  const panes = page.locator('.ui-dock-pane');
  const a = await panes.nth(0).boundingBox(), b = await panes.nth(1).boundingBox();
  assert.ok(a.width > 150 && b.width > 150 && Math.abs(a.height-b.height) < 2);
  assert.ok(await page.locator('[role="dialog"][aria-label="Theme / aesthetics"]').isVisible());
  assert.ok(await page.locator('[role="dialog"][aria-label="Workspace settings"]').isVisible());
  await drag('[data-ui-drag="frame:Tools"]', b.x + b.width/2, b.y + 15);
  assert.match(await page.locator('.ui-snap-preview').innerText(), /Group as tabs/);
  await page.mouse.up();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('omnium.ui.layout.v1')).frames.find(frame => frame.dockGroup)?.dockLayout.second.keys?.length === 2);
  assert.equal(await page.locator('[role="tab"][data-ui-drag="frame:Tools"]').getAttribute('aria-selected'), 'true');
  await page.locator('[role="tab"][data-ui-drag="window:theme"]').click();
  await page.locator('[role="dialog"][aria-label="Theme / aesthetics"]').waitFor();
  const divider = page.locator('.ui-dock-divider'), dividerBefore = await divider.boundingBox();
  await page.mouse.move(dividerBefore.x+3, dividerBefore.y+100); await page.mouse.down();
  await page.mouse.move(dividerBefore.x-65, dividerBefore.y+100, {steps: 4}); await page.mouse.up();
  layout = await state(); group = layout.frames.find(frame => frame.dockGroup);
  assert.ok(group.dockLayout.ratio < .45);
  // One gesture is one UI undo step; graph history is separate.
  await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointerdown', { button: 3, shiftKey: true, bubbles: true, cancelable: true })));
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('omnium.ui.layout.v1')).frames.find(frame => frame.dockGroup)?.dockLayout.ratio === .5);
  await drag('[role="tab"][data-ui-drag="frame:Tools"]', 1180, 780);
  await page.mouse.up();
  await page.waitForFunction(() => !JSON.parse(localStorage.getItem('omnium.ui.layout.v1')).frames.find(frame => frame.dockGroup)?.members.some(member => member.id === 'Tools'));
  // Viewport docking retains the same live panel, and search can reveal its tab.
  await drag('[role="tab"][data-ui-drag="window:theme"]', 10, 700);
  await page.mouse.up();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('omnium.ui.layout.v1')).frames.some(frame => frame.dockEdge === 'left'));
  const saved = await state();
  await page.reload(); await page.locator('.ui-dock-split, .ui-dock-pane').first().waitFor();
  assert.deepEqual((await state()).frames, saved.frames);
  assert.ok(await page.locator('[role="dialog"][aria-label="Theme / aesthetics"]').isVisible());
  // Edge docks reserve space rather than covering native panels, the canvas, or floats.
  await page.waitForFunction(() => {
    const layout = JSON.parse(localStorage.getItem('omnium.ui.layout.v1'));
    const edge = layout.frames.find(frame => frame.dockEdge === 'left');
    const dock = document.querySelector(`[data-ui-resident-root="frame:${edge.id}"]`), sidebar = document.querySelector('.sidebar');
    return sidebar.getBoundingClientRect().left >= dock.getBoundingClientRect().right-1;
  });
  await drag('[data-ui-drag="frame:Tools"]', 1590, 700);
  await page.mouse.up();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('omnium.ui.layout.v1')).frames.some(frame => frame.dockEdge === 'right'));
  const allocation = await page.evaluate(() => {
    const layout = JSON.parse(localStorage.getItem('omnium.ui.layout.v1'));
    const box = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { x:r.x, right:r.right, y:r.y, bottom:r.bottom, width:r.width }; };
    const dock = edge => box(`[data-ui-resident-root="frame:${layout.frames.find(frame => frame.dockEdge === edge).id}"]`);
    return { left:dock('left'), right:dock('right'), sidebar:box('.sidebar'), canvas:box('.canvas') };
  });
  assert.ok(allocation.sidebar.x >= allocation.left.right-1);
  assert.ok(allocation.canvas.right <= allocation.right.x+1);
  assert.ok(allocation.canvas.width > 100);
  const reuse = await page.locator('[data-ui-resident-root="window:panel:reuse"]').boundingBox();
  await drag('[role="tab"][data-ui-drag="window:settings"]', reuse.x+reuse.width-8, reuse.y+reuse.height/2);
  await page.mouse.up();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('omnium.ui.layout.v1')).windows['native:@sidebar']?.members?.some(member => member.kind === 'frame'));
  assert.ok(await page.locator('.sidebar .ui-structured-frame').isVisible(), 'split stays in the sidebar flow');
  assert.deepEqual(errors, []);
  console.log('Docking: splits/tabs, undo, drag-out/reload, shared edge allocation and adaptive native sidebar passed.');
} finally { await browser.close(); }
