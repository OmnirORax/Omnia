import assert from "node:assert/strict";
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
try {
  const doc = emptyDocument();
  doc.entities = ["System", "Part", "Existing variant", "Deep part"].map((label, i) => ({
    id: `entity-${i}`,
    label,
    aliases: [],
    notes: "",
  }));
  doc.placements = [
    {
      id: "root",
      entityId: "entity-0",
      parentId: null,
      position: { x: 0, y: 0 },
      spatialPosition: { x: 0, y: 0, z: 0 },
      collapsed: true,
      hidden: false,
    },
    {
      id: "part",
      entityId: "entity-1",
      parentId: "root",
      position: { x: 28, y: 104 },
      spatialPosition: { x: 0, y: -3, z: 0 },
      collapsed: true,
      hidden: false,
    },
  ];
  doc.compositions = [
    { id: "contains", parentId: "entity-0", childId: "entity-1" },
    { id: "deep", parentId: "entity-1", childId: "entity-3" },
  ];
  doc.variants = [{ id: "existing-variant", ownerId: "entity-0", entityId: "entity-2" }];
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript((seed) => {
    if (!localStorage.getItem("omnium.atlas.v2"))
      localStorage.setItem("omnium.atlas.v2", JSON.stringify(seed));
  }, doc);
  await page.goto(process.env.ATLAS_URL || "http://127.0.0.1:5173/");
  const read = () => page.evaluate(() => JSON.parse(localStorage.getItem("omnium.atlas.v2")));
  const canvas = page.locator(".spatial-workspace canvas");
  await canvas.waitFor();
  await page.waitForTimeout(450);
  const focusRoot = async () => {
    await page
      .getByRole("navigation", { name: "Node hierarchy" })
      .getByRole("button", { name: "System", exact: true })
      .click();
    await page.waitForTimeout(450);
    const box = await canvas.boundingBox();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };
  assert.equal(await page.getByRole("toolbar", { name: "Node options" }).count(), 0);
  assert.equal(
    await page.getByRole("button", { name: /Add variant for/ }).count(),
    0,
    "variants are hidden by default",
  );
  let center = await focusRoot();
  const initialRevision = (await read()).revision;
  await page.mouse.click(center.x, center.y);
  const toolbar = page.getByRole("toolbar", { name: "Node options" });
  await toolbar.waitFor();
  await page.getByRole("button", { name: "Add variant for System", exact: true }).waitFor();
  assert.equal(await toolbar.getByRole("button").count(), 1);
  assert.equal(
    await toolbar
      .getByRole("button", { name: "Variants", exact: true })
      .getAttribute("aria-expanded"),
    "true",
  );
  assert.equal(
    (await read()).placements[0].collapsed,
    true,
    "single-click does not expand structure",
  );
  assert.equal((await read()).revision, initialRevision, "single-click is display-only");
  await page.getByRole("button", { name: "Add variant for System", exact: true }).click();
  await page.getByLabel("Variant name", { exact: true }).fill("New alternative");
  const added = await read();
  assert.equal(added.variants.length, 2);
  assert.equal(added.entities.length, 5);
  assert.deepEqual(added.compositions, doc.compositions);
  assert.deepEqual(added.placements, doc.placements);
  await page.screenshot({ path: "/tmp/omnium-variants.png" });
  await page.getByRole("button", { name: "Focus selected", exact: true }).click();
  await page.waitForTimeout(450);
  const variantBox = await canvas.boundingBox();
  await page.mouse.move(variantBox.x + variantBox.width / 2, variantBox.y + variantBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    variantBox.x + variantBox.width / 2 + 180,
    variantBox.y + variantBox.height / 2 + 30,
    { steps: 8 },
  );
  await page.mouse.up();
  const newVariantId = added.variants.at(-1).id;
  await page.waitForFunction(
    (id) =>
      !!JSON.parse(localStorage.getItem("omnium.atlas.v2")).variants.find((v) => v.id === id)
        .position,
    newVariantId,
  );
  assert.deepEqual(
    (await read()).placements,
    doc.placements,
    "moving a variant never reparents or moves structural contents",
  );
  assert.deepEqual((await read()).compositions, doc.compositions);
  await page.getByRole("button", { name: "Remove variant from owner", exact: true }).click();
  assert.equal((await read()).variants.length, 1);
  assert.equal(
    (await read()).entities.length,
    5,
    "removing ownership preserves canonical knowledge",
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  assert.equal((await read()).variants.length, 2);

  center = await focusRoot();
  const beforeDouble = (await read()).revision;
  await page.mouse.dblclick(center.x, center.y);
  await page.waitForFunction(
    () => JSON.parse(localStorage.getItem("omnium.atlas.v2")).placements[0].collapsed === false,
  );
  await page.waitForTimeout(400);
  assert.equal(await toolbar.count(), 0, "double-click does not open single-click options");
  assert.equal(await page.getByRole("button", { name: /Add variant for/ }).count(), 0);
  assert.equal((await read()).revision, beforeDouble + 1, "double-click toggles once");
  center = await focusRoot();
  await page.mouse.dblclick(center.x, center.y);
  await page.waitForFunction(
    () => JSON.parse(localStorage.getItem("omnium.atlas.v2")).placements[0].collapsed === true,
  );
  await page.reload();
  await canvas.waitFor();
  await page.waitForTimeout(450);
  assert.equal((await read()).variants.length, 2, "variants persist after reload");
  assert.equal(
    await page.getByRole("button", { name: /Add variant for/ }).count(),
    0,
    "reloaded variants stay hidden",
  );
  center = await focusRoot();
  await page.mouse.click(center.x, center.y);
  await toolbar.waitFor();
  const variantsButton = toolbar.getByRole("button", { name: "Variants", exact: true });
  await variantsButton.click();
  assert.equal(await page.getByRole("button", { name: /Add variant for/ }).count(), 0);
  assert.equal((await read()).placements[0].collapsed, true);
  await variantsButton.click();
  await page.getByRole("button", { name: "Add variant for System", exact: true }).waitFor();
  center = await focusRoot();
  const beforeFull = await read();
  await page.keyboard.down("Shift");
  await page.mouse.click(center.x, center.y);
  await page.keyboard.up("Shift");
  await page.waitForFunction(
    () => JSON.parse(localStorage.getItem("omnium.atlas.v2")).placements.length === 3,
  );
  const expanded = await read();
  assert.ok(expanded.placements.every((p) => !p.collapsed));
  assert.equal(expanded.revision, beforeFull.revision + 1);
  assert.deepEqual(expanded.compositions, doc.compositions);
  assert.equal(expanded.variants.length, 2);
  assert.equal(await toolbar.count(), 0, "Shift-click does not execute single-click options");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  assert.deepEqual(
    (await read()).placements,
    beforeFull.placements,
    "full expansion is one undo operation",
  );
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  center = await focusRoot();
  await page.keyboard.down("Shift");
  await page.mouse.click(center.x, center.y);
  await page.keyboard.up("Shift");
  await page.waitForFunction(() =>
    JSON.parse(localStorage.getItem("omnium.atlas.v2")).placements.every((p) => p.collapsed),
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: variant options/add/edit/move/undo, independent double-click expansion, hidden reload state, and atomic Shift-click full subtree expansion/collapse.",
  );
} finally {
  await browser.close();
}
