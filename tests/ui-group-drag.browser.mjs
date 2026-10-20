import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
try {
  const p = await browser.newPage({ viewport: { width: 1700, height: 1150 } });
  p.setDefaultTimeout(12000);
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.route("**/src/appearance/propertyTree.ts*", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body:
        (await response.text()) +
        '\nPROPERTY_TREE.unshift({id:"futureGroup",label:"Future feature group",children:[{id:"futureChild",label:"Future child"}]});\n',
    });
  });
  await p.goto(process.env.ATLAS_URL || "http://127.0.0.1:5173/", {
    waitUntil: "domcontentloaded",
    timeout: 20000,
  });
  await p.getByRole("region", { name: "Master appearance controller" }).waitFor();
  const root = (id) => p.locator(`[data-ui-inline-group="window:property:master:${id}"]`);
  const handle = (id) => root(id).locator(":scope > .property-node-heading > button");
  await handle("futureGroup").waitFor();
  for (const id of ["opacity", "blur"]) {
    await handle(id).dragTo(handle("lighting"));
    await p.waitForFunction(
      (id) =>
        JSON.parse(localStorage.getItem("omnium.ui.layout.v1")).windows[
          "property:master:lighting"
        ].members?.some((m) => m.kind === "window" && m.id === "property:master:" + id),
      id,
    );
    assert.equal(
      await root("lighting")
        .locator(`[data-ui-inline-group="window:property:master:${id}"]`)
        .count(),
      1,
    );
    await handle(id).click();
    await root(id).locator('input[type="range"]').first().waitFor({ state: "visible" });
  }
  const movedLayout = await p.evaluate(() =>
    JSON.parse(localStorage.getItem("omnium.ui.layout.v1")),
  );
  assert.equal(movedLayout.windows["property:master:lighting"].members.length, 2);
  assert.equal(await handle("opacity").count(), 1);
  assert.equal(await handle("blur").count(), 1);
  // Collapse a parent: the group remains mounted; reopen restores the actual nested payload.
  await handle("lighting").click();
  assert.equal(await handle("opacity").isVisible(), false);
  await handle("lighting").click();
  assert.equal(await handle("opacity").isVisible(), true);
  // Parent into descendant must reject atomically.
  const saved = await p.evaluate(() => localStorage.getItem("omnium.ui.layout.v1"));
  await handle("lighting").dragTo(handle("opacity"));
  assert.equal(await p.evaluate(() => localStorage.getItem("omnium.ui.layout.v1")), saved);
  // A future group uses the same resident contract with no named-case drop handler.
  await handle("futureGroup").scrollIntoViewIfNeeded();
  await handle("opacity").dragTo(handle("futureGroup"));
  await p.waitForFunction(() =>
    JSON.parse(localStorage.getItem("omnium.ui.layout.v1")).windows[
      "property:master:futureGroup"
    ].members?.some((m) => m.id === "property:master:opacity"),
  );
  assert.equal(
    await root("futureGroup")
      .locator('[data-ui-inline-group="window:property:master:opacity"]')
      .count(),
    1,
  );
  await p.evaluate(() =>
    window.dispatchEvent(
      new PointerEvent("pointerdown", {
        button: 3,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      }),
    ),
  );
  assert.equal(
    await root("lighting")
      .locator('[data-ui-inline-group="window:property:master:opacity"]')
      .count(),
    1,
  );
  await p.evaluate(() =>
    window.dispatchEvent(
      new PointerEvent("pointerdown", {
        button: 4,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      }),
    ),
  );
  assert.equal(
    await root("futureGroup")
      .locator('[data-ui-inline-group="window:property:master:opacity"]')
      .count(),
    1,
  );
  await handle("futureGroup").click({ modifiers: ["Shift"] });
  assert.equal(await handle("opacity").isVisible(), false);
  await handle("futureGroup").click({ modifiers: ["Shift"] });
  assert.equal(await root("opacity").locator('input[type="range"]').first().isVisible(), true);
  await p.reload();
  await p.getByRole("region", { name: "Master appearance controller" }).waitFor();
  assert.equal(
    await root("futureGroup")
      .locator('[data-ui-inline-group="window:property:master:opacity"]')
      .count(),
    1,
  );
  assert.equal(
    await root("lighting").locator('[data-ui-inline-group="window:property:master:blur"]').count(),
    1,
  );
  assert.deepEqual(errors, []);
  console.log(
    "Opacity and Blur move with their editors into Lighting; collapse/reopen and reload preserve contents; self-descendant docking rejects unchanged.",
  );
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await browser.close();
}
