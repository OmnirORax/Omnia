import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const key = "omnium.atlas.v1";
const read = () => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), key);
const nodeElement = (id) => page.locator(`.react-flow__node[data-id="${id}"]`);
async function check(fn, arg) {
  await page.waitForFunction(fn, arg, { timeout: 10000 });
}
async function name(value) {
  await page.getByLabel("Node name", { exact: true }).fill(value);
  await check(
    ({ key, value }) => JSON.parse(localStorage.getItem(key)).nodes.some((n) => n.label === value),
    { key, value },
  );
}
async function count(n) {
  await check(({ key, n }) => JSON.parse(localStorage.getItem(key)).nodes.length === n, { key, n });
}
async function outline(label) {
  await page
    .getByRole("navigation", { name: "Node hierarchy" })
    .getByRole("button", { name: label, exact: true })
    .click();
}
try {
  await page.goto(process.env.ATLAS_URL || "http://127.0.0.1:5173/");
  await page.getByRole("button", { name: "+ Add first node", exact: true }).click();
  await name("Omnia");
  await page.getByRole("button", { name: "+ Child node", exact: true }).click();
  await name("Knowledge");
  await page.getByRole("button", { name: "+ Child node", exact: true }).click();
  await name("Concept");
  await page.getByLabel("Node notes").fill("Canonical identity stays independent of rendering.");
  await page.getByRole("button", { name: "+ Node", exact: true }).click();
  await name("Experience");
  await count(4);
  const initial = await read();
  const id = (label) => initial.nodes.find((n) => n.label === label).id;
  await page.getByLabel("New relationship source").selectOption(id("Concept"));
  await page.getByLabel("New relationship target").selectOption(id("Experience"));
  await page.getByRole("button", { name: "Add relationship", exact: true }).click();
  await page.getByLabel("Relationship label").fill("informs");
  await check(
    (key) => JSON.parse(localStorage.getItem(key)).relationships[0]?.label === "informs",
    key,
  );
  await outline("Knowledge");
  await page.getByRole("button", { name: "Collapse children", exact: true }).click();
  await nodeElement(id("Concept")).waitFor({ state: "detached" });
  assert.equal(await page.locator(".react-flow__edge").count(), 1);
  assert.match(await page.locator(".react-flow__edge").getAttribute("data-id"), /.+/);
  assert.equal((await read()).relationships[0].source, id("Concept"));
  await page.getByRole("button", { name: "Expand children", exact: true }).click();
  await nodeElement(id("Concept")).waitFor();
  await outline("Concept");
  assert.equal(
    await page
      .getByLabel("Node parent")
      .locator(`option[value="${id("Omnia")}"]`)
      .count(),
    1,
  );
  await page.getByLabel("Node parent").selectOption(id("Experience"));
  await check(
    ({ key, id, parent }) =>
      JSON.parse(localStorage.getItem(key)).nodes.find((n) => n.id === id).parentId === parent,
    { key, id: id("Concept"), parent: id("Experience") },
  );
  await outline("Experience");
  assert.equal(
    await page
      .getByLabel("Node parent")
      .locator(`option[value="${id("Concept")}"]`)
      .count(),
    0,
  );
  const beforeReload = await read();
  await page.reload();
  await nodeElement(id("Concept")).waitFor();
  assert.deepEqual(await read(), beforeReload);
  // Mouse dragging persists a renderer-independent root position.
  const heading = nodeElement(id("Experience")).locator(".node-heading");
  await heading.scrollIntoViewIfNeeded();
  const box = await heading.boundingBox();
  const oldPosition = (await read()).nodes.find((n) => n.id === id("Experience")).position;
  await page.mouse.move(box.x + box.width / 2, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 70, box.y + 70, { steps: 12 });
  await page.mouse.up();
  await check(
    ({ key, id, oldX }) =>
      JSON.parse(localStorage.getItem(key)).nodes.find((n) => n.id === id).position.x !== oldX,
    { key, id: id("Experience"), oldX: oldPosition.x },
  );
  // Native handle gesture creates a cross-branch connection.
  const from = await nodeElement(id("Knowledge"))
    .locator(".react-flow__handle-right")
    .boundingBox();
  const to = await nodeElement(id("Concept")).locator(".react-flow__handle-left").boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 });
  await page.mouse.up();
  await check((key) => JSON.parse(localStorage.getItem(key)).relationships.length === 2, key);
  await page.getByLabel("Relationship label").fill("requires");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON", exact: true }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  let exported = "";
  for await (const chunk of stream) exported += chunk;
  assert.deepEqual(JSON.parse(exported), await read());
  const beforeBadImport = await read();
  await page
    .locator("input[type=file]").first()
    .setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"format":"omnium-atlas","version":99}'),
    });
  await page.getByRole("alert").waitFor();
  assert.deepEqual(await read(), beforeBadImport);
  page.on("dialog", (dialog) => dialog.accept());
  await page
    .locator("input[type=file]").first()
    .setInputFiles({
      name: "empty.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({ format: "omnium-atlas", version: 1, nodes: [], relationships: [] }),
      ),
    });
  await count(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await count(4);
  assert.deepEqual(await read(), beforeBadImport);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await count(0);
  await page
    .locator("input[type=file]").first()
    .setInputFiles({
      name: "atlas.json",
      mimeType: "application/json",
      buffer: Buffer.from(exported),
    });
  await count(4);
  assert.deepEqual(await read(), JSON.parse(exported));
  await outline("Experience");
  await page.getByRole("button", { name: "Delete node", exact: true }).click();
  await count(2);
  assert.equal((await read()).relationships.length, 0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await count(4);
  assert.equal((await read()).relationships.length, 2);
  await page.screenshot({ path: "/tmp/omnium-workbench.png", fullPage: true });
  // Unreadable saves remain untouched even when the user starts a new in-memory graph.
  await page.evaluate((key) => localStorage.setItem(key, "unreadable"), key);
  await page.reload();
  await page.getByRole("alert").waitFor();
  await page.getByRole("button", { name: "+ Add first node", exact: true }).click();
  await page.getByLabel("Node name", { exact: true }).fill("Recovery draft");
  assert.equal(await page.evaluate((key) => localStorage.getItem(key), key), "unreadable");
  await page.getByRole("button", { name: "Replace local save", exact: true }).click();
  await count(1);
  assert.equal((await read()).nodes[0].label, "Recovery draft");
  assert.deepEqual(errors, []);
  console.log(
    "PASS: editing, nesting, collapse, cross-branch edges (form + handles), reparenting, drag persistence, reload, JSON round trip, invalid import protection, undo/redo, subtree deletion, and corrupt-save recovery. No browser errors.",
  );
} finally {
  await browser.close();
}
