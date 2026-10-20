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
  const camera = () => p.locator('[data-camera="position"]').first().textContent();
  await p.waitForFunction(() => document.querySelector('[data-camera="position"]')?.textContent);
  assert.equal(await p.evaluate(() => document.elementFromPoint(650, 650)?.tagName), "CANVAS");
  const initialCamera = await camera();
  await p.mouse.move(650, 650);
  await p.mouse.down();
  await p.mouse.move(690, 670, { steps: 3 });
  await p.waitForFunction((before) => document.querySelector('[data-camera="position"]').textContent !== before, initialCamera);
  // Model a canvas gesture interrupted by another capture owner, with its
  // release consumed by that owner. OrbitControls' document listeners must die.
  await p.evaluate(() => {
    document.documentElement.setPointerCapture(window.dragPointer);
    window.addEventListener("pointerup", (e) => e.stopImmediatePropagation(), { capture: true, once: true });
  });
  await p.mouse.move(700, 680);
  await p.mouse.up();
  const interruptedCamera = await camera();
  await p.mouse.move(750, 730, { steps: 4 });
  await p.waitForTimeout(80);
  assert.equal(await camera(), interruptedCamera, "interrupted camera must not follow idle/UI movement");
  // A fresh deliberate background gesture still pans normally.
  await p.mouse.down();
  await p.mouse.move(790, 750, { steps: 3 });
  await p.mouse.up();
  await p.waitForFunction((before) => document.querySelector('[data-camera="position"]').textContent !== before, interruptedCamera);
  const uiCamera = await camera();
  const before = await p.evaluate(() => localStorage.getItem("omnium.ui.layout.v1"));
  const b = await handle().boundingBox();
  await p.mouse.move(b.x + 8, b.y + 8);
  await p.mouse.down();
  await p.mouse.move(b.x + 25, b.y + 12);
  await p.waitForFunction(() => document.documentElement.hasPointerCapture(window.dragPointer));
  await p.mouse.move(650, 750, { steps: 7 });
  await p.waitForFunction(() => document.querySelector(".ui-placement-preview"));
  // Losing capture while the mouse stays down must not end the logical drag.
  await p.evaluate(() => document.documentElement.releasePointerCapture(window.dragPointer));
  await p.mouse.move(670, 760, { steps: 2 });
  await p.waitForFunction(() => document.documentElement.hasPointerCapture(window.dragPointer));
  await p.evaluate(() => document.querySelector("canvas").setPointerCapture(window.dragPointer));
  await p.mouse.move(680, 765, { steps: 2 });
  await p.waitForFunction(() => document.documentElement.hasPointerCapture(window.dragPointer));
  assert.ok(await p.locator(".ui-placement-preview").count(), "capture loss/theft must retain the drag");
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
  assert.equal(await camera(), uiCamera, "UI dragging across canvas must not pan the camera");
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
  await p.mouse.move(600, 600, { steps: 4 });
  assert.equal(await camera(), uiCamera, "Esc must not hand a still-held UI press to the camera");
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
  // A cancelled mouse pointer stream may discard its preview, but must not
  // grant the same still-held physical press to a new camera pointer sequence.
  const b3 = await handle().boundingBox();
  await p.mouse.move(b3.x + 8, b3.y + 8);
  await p.mouse.down();
  await p.mouse.move(850, 700, { steps: 3 });
  await p.waitForFunction(() => document.documentElement.hasPointerCapture(window.dragPointer));
  await p.evaluate(() => {
    window.dispatchEvent(new PointerEvent("pointercancel", {
      pointerId: window.dragPointer, pointerType: "mouse", buttons: 1, bubbles: true,
    }));
    window.dispatchEvent(new Event("blur"));
    document.querySelector("canvas").dispatchEvent(new PointerEvent("pointerdown", {
      pointerId: window.dragPointer, pointerType: "mouse", button: 0, buttons: 1,
      clientX: 850, clientY: 700, bubbles: true, cancelable: true,
    }));
  });
  await p.mouse.move(650, 600, { steps: 3 });
  assert.equal(await camera(), uiCamera, "cancel/blur must not hand a held UI press to the camera");
  assert.equal(await p.evaluate(() => localStorage.getItem("omnium.ui.layout.v1")), committed);
  await p.mouse.up();
  await p.mouse.move(650, 650);
  await p.mouse.down();
  await p.mouse.move(690, 670, { steps: 3 });
  await p.mouse.up();
  await p.waitForFunction((before) => document.querySelector('[data-camera="position"]').textContent !== before, uiCamera);
  assert.deepEqual(errors, []);
  console.log(
    "Capture loss/theft retain the UI drag; Esc/cancel/blur isolate a held press from the camera; real release restores navigation.",
  );
} finally {
  await browser.close();
}
