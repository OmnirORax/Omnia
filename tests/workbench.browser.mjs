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
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const read = () => page.evaluate(() => JSON.parse(localStorage.getItem("omnium.atlas.v2")));
  const saved = (predicate, arg) => page.waitForFunction(predicate, arg);
  await page.goto(process.env.ATLAS_URL || "http://127.0.0.1:5173/");
  assert.equal(await page.getByRole("button", { name: "2D", exact: true }).count(), 0);
  await page.getByRole("button", { name: "+ Add first node" }).click();
  await page.getByLabel("Node name", { exact: true }).fill("System");
  await page.getByRole("button", { name: "+ Child node" }).click();
  await page.getByLabel("Node name", { exact: true }).fill("Subsystem");
  await page.getByRole("button", { name: "+ Child node" }).click();
  await page.getByLabel("Node name", { exact: true }).fill("Part");
  await page.getByRole("button", { name: "+ Node", exact: true }).click();
  await page.getByLabel("Node name", { exact: true }).fill("Neighbor");
  await saved(() => JSON.parse(localStorage.getItem("omnium.atlas.v2"))?.entities.length === 4);
  const initial = await read();
  const entity = (name) => initial.entities.find((e) => e.label === name).id;
  const placement = (name) => initial.placements.find((p) => p.entityId === entity(name)).id;
  assert.deepEqual(
    initial.compositions.map((c) => [c.parentId, c.childId]),
    [
      [entity("System"), entity("Subsystem")],
      [entity("Subsystem"), entity("Part")],
    ],
  );
  await page.getByLabel("Find existing identity").fill("Subsystem");
  await page.getByRole("button", { name: /Insert Subsystem/ }).click();
  await saved(() => JSON.parse(localStorage.getItem("omnium.atlas.v2"))?.placements.length === 5);
  assert.equal((await read()).entities.length, 4);
  await page.getByRole("button", { name: "Expand structural contents" }).click();
  await saved(() => JSON.parse(localStorage.getItem("omnium.atlas.v2"))?.placements.length === 6);
  assert.equal((await read()).entities.filter((e) => e.id === entity("Part")).length, 1);
  await page.getByRole("button", { name: "Remove this placement" }).click();
  await saved(() => JSON.parse(localStorage.getItem("omnium.atlas.v2"))?.placements.length === 5);
  assert.equal((await read()).entities.length, 4);
  page.once("dialog", (dialog) => dialog.accept("Dependency"));
  await page.getByRole("button", { name: "+ Define type" }).click();
  await saved(
    () => JSON.parse(localStorage.getItem("omnium.atlas.v2"))?.relationshipTypes.length === 2,
  );
  const typeId = (await read()).relationshipTypes.find((t) => t.name === "Dependency").id;
  await page.getByLabel(`Type symbol ${typeId}`).fill("⇢");
  await page.getByLabel("New relationship source").selectOption(placement("Subsystem"));
  await page.getByLabel("New relationship target").selectOption(placement("Neighbor"));
  await page.getByRole("button", { name: "Add relationship", exact: true }).click();
  await page.getByLabel("Relationship type").selectOption(typeId);
  await saved(
    ({ typeId }) =>
      JSON.parse(localStorage.getItem("omnium.atlas.v2"))?.relationships[0]?.typeId === typeId,
    { typeId },
  );
  assert.deepEqual(
    (await read()).relationships[0].participants.map((p) => p.entityId),
    [entity("Subsystem"), entity("Neighbor")],
  );
  await page
    .getByRole("navigation", { name: "Node hierarchy" })
    .getByRole("button", { name: "Subsystem", exact: true })
    .click();
  await page.getByLabel("Frame question").fill("How does subsystem relate to neighbor?");
  await page.getByRole("button", { name: "Start frame" }).click();
  await saved(() => JSON.parse(localStorage.getItem("omnium.atlas.v2"))?.frames.length === 1);
  await page.getByLabel("Find frame identity").fill("Neighbor");
  await page.getByRole("button", { name: "Include Neighbor" }).click();
  assert.deepEqual(
    new Set((await read()).frames[0].scope.entityIds),
    new Set([entity("Subsystem"), entity("Neighbor")]),
  );
  await page.getByRole("button", { name: "Promote as reusable boundary" }).click();
  assert.equal((await read()).frames[0].promoted, true);
  await page.getByRole("button", { name: "Discard frame" }).click();
  assert.equal((await read()).frames[0].discarded, true);
  await page.getByRole("button", { name: /Recover discarded frame:/ }).click();
  assert.equal((await read()).frames[0].discarded, false);
  await page.getByRole("button", { name: "Close frame" }).click();
  const beforeProposal = await read();
  const proposal = {
    format: "omnium-changeset",
    version: 1,
    id: "browser-proposal",
    baseRevision: beforeProposal.revision,
    operations: [
      {
        op: "addPlacement",
        placement: {
          id: "ai-reference",
          entityId: entity("Subsystem"),
          parentId: null,
          position: { x: 400, y: 400 },
          spatialPosition: { x: 4, y: 0, z: 4 },
          collapsed: true,
          hidden: false,
        },
      },
    ],
  };
  await page.getByLabel("Change set JSON").fill(JSON.stringify(proposal));
  await page.getByRole("button", { name: "Validate and preview" }).click();
  assert.equal((await read()).placements.length, beforeProposal.placements.length);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Approve and apply atomically" }).click();
  await saved(() =>
    JSON.parse(localStorage.getItem("omnium.atlas.v2"))?.placements.some(
      (p) => p.id === "ai-reference",
    ),
  );
  assert.equal((await read()).entities.length, 4);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  assert.equal(
    (await read()).placements.some((p) => p.id === "ai-reference"),
    false,
  );
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  assert.equal(
    (await read()).placements.some((p) => p.id === "ai-reference"),
    true,
  );
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  const stream = await (await downloadPromise).createReadStream();
  let exported = "";
  for await (const chunk of stream) exported += chunk;
  assert.deepEqual(JSON.parse(exported), await read());
  await page.reload();
  assert.deepEqual(await read(), JSON.parse(exported));
  const migrationPage = await browser.newPage({ viewport: { width: 1100, height: 700 } });
  await migrationPage.goto(process.env.ATLAS_URL || "http://127.0.0.1:5173/");
  const oldSave = {
    format: "omnium-atlas",
    version: 1,
    nodes: [
      {
        id: "legacy-root",
        label: "Legacy root",
        notes: "",
        parentId: null,
        position: { x: 80, y: 90 },
        collapsed: false,
      },
    ],
    relationships: [],
  };
  await migrationPage.evaluate(
    (save) => localStorage.setItem("omnium.atlas.v1", JSON.stringify(save)),
    oldSave,
  );
  await migrationPage.reload();
  await migrationPage
    .getByRole("navigation", { name: "Node hierarchy" })
    .getByRole("button", { name: "Legacy root" })
    .click();
  assert.deepEqual(
    await migrationPage.evaluate(() => JSON.parse(localStorage.getItem("omnium.atlas.v1"))),
    oldSave,
  );
  await migrationPage.getByLabel("Node name", { exact: true }).fill("Migrated root");
  await migrationPage.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("omnium.atlas.v2"))?.entities[0]?.label === "Migrated root",
  );
  assert.deepEqual(
    await migrationPage.evaluate(() => JSON.parse(localStorage.getItem("omnium.atlas.v1"))),
    oldSave,
  );
  await migrationPage.close();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: 3D identity reuse, typed relation, frame, AI review, undo/redo, export and reload.",
  );
} finally {
  await browser.close();
}
