import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
try {
  const p = await browser.newPage({
    viewport: { width: 1500, height: 1050 },
    reducedMotion: "reduce",
  });
  p.setDefaultTimeout(10000);
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(process.env.ATLAS_URL || "http://127.0.0.1:5173/");
  const handle = () => p.locator('[data-ui-drag="window:property:master:lighting"]');
  await handle().waitFor();
  await p.evaluate(() =>
    window.addEventListener("pointerdown", (e) => (window.dragPointer = e.pointerId), true),
  );
  const before = await p.evaluate(() => localStorage.getItem("omnium.ui.layout.v1"));
  const b = await handle().boundingBox();
  await p.mouse.move(b.x + 8, b.y + 8);
  await p.mouse.down();
  await p.mouse.move(b.x + 25, b.y + 12);
  await p.waitForFunction(() => document.documentElement.hasPointerCapture(window.dragPointer));
  await p.mouse.move(650, 750, { steps: 7 });
  await p.waitForFunction(() => document.querySelector(".ui-placement-preview"));
  assert.equal(
    await p.evaluate(() => localStorage.getItem("omnium.ui.layout.v1")),
    before,
    "moving is not a release",
  );
  await p.evaluate(() => {
    document.querySelector('[data-ui-drag="window:property:master:lighting"]').style.transform =
      "translateX(30px)";
    window.dispatchEvent(
      new PointerEvent("pointerup", {
        pointerId: window.dragPointer,
        button: 2,
        buttons: 1,
        bubbles: true,
      }),
    );
    window.dispatchEvent(new DragEvent("dragend", { bubbles: true }));
  });
  assert.equal(
    await p.evaluate(() => document.documentElement.hasPointerCapture(window.dragPointer)),
    true,
  );
  await p.mouse.move(720, 780, { steps: 4 });
  assert.equal(await p.evaluate(() => localStorage.getItem("omnium.ui.layout.v1")), before);
  await p.mouse.up();
  await p.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("omnium.ui.layout.v1")).windows["property:master:lighting"]
        ?.inline?.detached,
  );
  assert.equal(
    await p.evaluate(() => document.documentElement.hasPointerCapture(window.dragPointer)),
    false,
  );
  const committed = await p.evaluate(() => localStorage.getItem("omnium.ui.layout.v1"));
  const b2 = await handle().boundingBox();
  await p.mouse.move(b2.x + 8, b2.y + 8);
  await p.mouse.down();
  await p.mouse.move(900, 700, { steps: 5 });
  await p.waitForFunction(() => document.documentElement.hasPointerCapture(window.dragPointer));
  await p.keyboard.press("Escape");
  await p.mouse.up();
  assert.equal(
    await p.evaluate(() => localStorage.getItem("omnium.ui.layout.v1")),
    committed,
    "Esc must not commit",
  );
  assert.equal(
    await p.evaluate(() => document.documentElement.hasPointerCapture(window.dragPointer)),
    false,
  );
  assert.deepEqual(errors, []);
  console.log(
    "Leaving source bounds/reflow, unrelated releases/native dragend, actual left release, and Esc capture cleanup pass.",
  );
} finally {
  await browser.close();
}
