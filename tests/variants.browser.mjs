import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { emptyDocument, ensureVariantPlacements } from "../src/graph/structural.ts";
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
  let doc = emptyDocument();
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
  doc = ensureVariantPlacements(doc);
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
  assert.equal(await toolbar.getByRole("button", { name: "Variants", exact: true }).count(), 1);
  assert.equal(await toolbar.getByRole("button").count(), 2, "one category plus its add badge");
  const optionBox = await toolbar.getByRole("button", { name: "Variants", exact: true }).boundingBox();
  const plusBox = await toolbar.getByRole("button", { name: "Add variant for System", exact: true }).boundingBox();
  assert.ok(Math.abs(plusBox.x + plusBox.width / 2 - optionBox.x - optionBox.width) < 15, "plus is on the Variants control");
  assert.ok(Math.abs(plusBox.y + plusBox.height / 2 - optionBox.y) < 15, "plus sits at the top of the Variants control");
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
  await page.getByLabel("Node name", { exact: true }).fill("New alternative");
  const added = await read();
  assert.equal(added.variants.length, 2);
  assert.equal(added.entities.length, 5);
  assert.deepEqual(added.compositions, doc.compositions);
  assert.equal(added.placements.length, doc.placements.length + 1);
  const variantPlacement = added.placements.find((p) => p.entityId === added.variants.at(-1).entityId);
  assert.ok(variantPlacement.variantOwner);
  // The full inspector and ordinary child action apply to variants too.
  await page.getByRole("button", { name: "+ Child node", exact: true }).click();
  await page.getByLabel("Node name", { exact: true }).fill("Variant child");
  let withChildren = await read();
  const childPlacement = withChildren.placements.find((p) => p.entityId === withChildren.entities.find((e) => e.label === "Variant child").id);
  assert.equal(childPlacement.parentId, variantPlacement.id);
  assert.ok(withChildren.compositions.some((c) => c.parentId === variantPlacement.entityId && c.childId === childPlacement.entityId));
  await page.getByRole("button", { name: "+ Child node", exact: true }).click();
  await page.getByLabel("Node name", { exact: true }).fill("Variant grandchild");
  withChildren = await read();
  assert.ok(withChildren.compositions.some((c) => c.parentId === childPlacement.entityId && c.childId === withChildren.entities.find((e) => e.label === "Variant grandchild").id));
  await page.getByLabel("New relationship source").selectOption(variantPlacement.id);
  await page.getByLabel("New relationship target").selectOption(childPlacement.id);
  await page.getByRole("button", { name: "Add relationship", exact: true }).click();
  assert.ok((await read()).relationships.some((r) => r.participants[0].entityId === variantPlacement.entityId && r.participants[1].entityId === childPlacement.entityId));
  const knowledgeBeforeMove = await read();
  await page.getByRole("navigation", { name: "Node hierarchy" }).getByRole("button", { name: "New alternative", exact: true }).click();
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
  await page.waitForFunction(
    ({ id, before }) => JSON.stringify(JSON.parse(localStorage.getItem("omnium.atlas.v2")).placements.find((p) => p.id === id).spatialPosition) !== JSON.stringify(before),
    { id: variantPlacement.id, before: variantPlacement.spatialPosition },
  );
  const afterMove = await read();
  assert.deepEqual(afterMove.compositions, knowledgeBeforeMove.compositions);
  assert.deepEqual(afterMove.relationships, knowledgeBeforeMove.relationships);
  assert.deepEqual(afterMove.variants, knowledgeBeforeMove.variants);
  assert.deepEqual(afterMove.placements.filter((p) => p.id !== variantPlacement.id), knowledgeBeforeMove.placements.filter((p) => p.id !== variantPlacement.id));
  await page.getByRole("button", { name: "Remove this placement", exact: true }).click();
  assert.equal((await read()).placements.some((p) => p.id === variantPlacement.id), false);
  assert.equal((await read()).entities.length, 7, "removing a placement preserves canonical knowledge");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  assert.ok((await read()).placements.some((p) => p.id === variantPlacement.id));
  // Context menus expose the same creation actions on a variant.
  await page.getByRole("navigation", { name: "Node hierarchy" }).getByRole("button", { name: "New alternative", exact: true }).click();
  await page.waitForTimeout(450);
  let box = await canvas.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: "right" });
  await page.getByRole("menuitem", { name: "Create child", exact: true }).click();
  await page.getByLabel("Node name", { exact: true }).fill("Context child");
  const withContextChild = await read();
  assert.equal(withContextChild.placements.at(-1).parentId, variantPlacement.id);
  assert.ok(withContextChild.compositions.some((c) => c.parentId === variantPlacement.entityId && c.childId === withContextChild.placements.at(-1).entityId));
  await page.getByRole("navigation", { name: "Node hierarchy" }).getByRole("button", { name: "New alternative", exact: true }).click();
  await page.waitForTimeout(450);
  box = await canvas.boundingBox();
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForFunction((id) => JSON.parse(localStorage.getItem("omnium.atlas.v2")).placements.find((p) => p.id === id).collapsed, variantPlacement.id);
  assert.equal(await page.getByRole("navigation", { name: "Node hierarchy" }).getByRole("button", { name: "Variant child", exact: true }).count(), 0);
  await page.waitForTimeout(450);
  await page.keyboard.down("Shift");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.keyboard.up("Shift");
  await page.waitForFunction((id) => !JSON.parse(localStorage.getItem("omnium.atlas.v2")).placements.find((p) => p.id === id).collapsed, variantPlacement.id);
  const expandedVariant = await read();
  assert.ok(expandedVariant.placements.filter((p) => p.id === variantPlacement.id || p.parentId === variantPlacement.id || p.parentId === childPlacement.id).every((p) => !p.collapsed));
  center = await focusRoot();
  if (!(await read()).placements[0].collapsed) await page.getByRole("button", { name: "Collapse children", exact: true }).click();

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
  assert.equal(await page.getByRole("button", { name: /Add variant for/ }).count(), 1, "add stays on Variants when its contents are collapsed");
  assert.equal((await read()).placements[0].collapsed, true);
  await variantsButton.click();
  await page.getByRole("button", { name: "Add variant for System", exact: true }).waitFor();
  center = await focusRoot();
  const beforeFull = await read();
  await page.keyboard.down("Shift");
  await page.mouse.click(center.x, center.y);
  await page.keyboard.up("Shift");
  await page.waitForFunction(
    () => JSON.parse(localStorage.getItem("omnium.atlas.v2")).placements.some((p) => p.entityId === "entity-3"),
  ).catch(async (error) => {
    await page.screenshot({ path: "/tmp/omnium-variants-failure.png" });
    console.error("SUBTREE DIAGNOSTIC", await page.evaluate(({ x, y }) => ({ settings: JSON.parse(localStorage.getItem("omnium.workspace.settings.v1")), selected: document.querySelector('[aria-label="Node name"]')?.value, target: document.elementFromPoint(x, y)?.outerHTML.slice(0, 300) }), center));
    throw error;
  });
  const expanded = await read();
  assert.ok(expanded.placements.filter((p) => ["entity-0", "entity-1", "entity-3"].includes(p.entityId)).every((p) => !p.collapsed));
  assert.equal(expanded.revision, beforeFull.revision + 1);
  assert.deepEqual(expanded.compositions, beforeFull.compositions);
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
    JSON.parse(localStorage.getItem("omnium.atlas.v2")).placements.filter((p) => ["entity-0", "entity-1", "entity-3"].includes(p.entityId)).every((p) => p.collapsed),
  );
  await page.getByRole("button", { name: "+ Node", exact: true }).click();
  await page.getByLabel("Node name", { exact: true }).fill("Empty owner");
  await page.waitForTimeout(450);
  const emptyBox = await canvas.boundingBox();
  await page.mouse.click(emptyBox.x + emptyBox.width / 2, emptyBox.y + emptyBox.height / 2);
  const emptyPlus = page.getByRole("button", { name: "Add variant for Empty owner", exact: true });
  await emptyPlus.waitFor();
  assert.equal(await toolbar.locator(".variant-add").count(), 1, "empty owners have the same attached add badge");
  assert.equal(await page.locator(".spatial-workspace > .variant-add").count(), 0, "no detached world-space add button remains");
  await emptyPlus.click();
  await page.getByLabel("Node name", { exact: true }).waitFor();
  const withFirst = await read();
  const emptyOwnerId = withFirst.entities.find((e) => e.label === "Empty owner").id;
  assert.equal(withFirst.variants.filter((v) => v.ownerId === emptyOwnerId).length, 1);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: variants use normal child/grandchild creation, connections, context menus, move/remove/undo, independent double-click expansion, hidden reload state, and atomic Shift-click full subtree expansion/collapse.",
  );
} finally {
  await browser.close();
}
