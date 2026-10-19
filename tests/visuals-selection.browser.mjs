import assert from "node:assert/strict";
import { frameAction } from "./ui-browser-helpers.mjs";
import { chromium } from "playwright-core";
import { emptyDocument, ensureVariantPlacements } from "../src/graph/structural.ts";
function triangleGLB() {
  const json = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    buffers: [{ byteLength: 36 }],
    bufferViews: [{ buffer: 0, byteLength: 36 }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: "VEC3",
        min: [-1, 0, 0],
        max: [1, 1, 0],
      },
    ],
  };
  const text = Buffer.from(JSON.stringify(json)),
    padded = Buffer.alloc(Math.ceil(text.length / 4) * 4, 32);
  text.copy(padded);
  const buffer = Buffer.alloc(12 + 8 + padded.length + 8 + 36);
  buffer.writeUInt32LE(0x46546c67, 0);
  buffer.writeUInt32LE(2, 4);
  buffer.writeUInt32LE(buffer.length, 8);
  buffer.writeUInt32LE(padded.length, 12);
  buffer.writeUInt32LE(0x4e4f534a, 16);
  padded.copy(buffer, 20);
  const offset = 20 + padded.length;
  buffer.writeUInt32LE(36, offset);
  buffer.writeUInt32LE(0x004e4942, offset + 4);
  [-1, 0, 0, 1, 0, 0, 0, 1, 0].forEach((v, i) => buffer.writeFloatLE(v, offset + 8 + i * 4));
  return buffer;
}
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
  doc.entities = ["System", "Child", "Deep", "Neighbor", "Variant", "Unplaced"].map((label, i) => ({
    id: `e${i}`,
    label,
    aliases: [],
    notes: "",
  }));
  doc.placements = [
    ["root", "e0", null, 0, 0],
    ["child", "e1", "root", 8, 0],
    ["deep", "e2", "child", 8, 0],
    ["neighbor", "e3", null, 0, -8],
    ["reuse", "e1", null, 0, 8],
  ].map(([id, entityId, parentId, x, y]) => ({
    id,
    entityId,
    parentId,
    position: parentId ? { x: 28, y: 104 } : { x: 0, y: 0 },
    spatialPosition: { x, y, z: 0 },
    collapsed: false,
    hidden: false,
  }));
  doc.compositions = [
    { id: "contains", parentId: "e0", childId: "e1" },
    { id: "nested", parentId: "e1", childId: "e2" },
  ];
  doc.relationships = [
    {
      id: "link",
      typeId: "legacy-untyped",
      label: "supplies",
      participants: [
        { roleId: "source", entityId: "e1" },
        { roleId: "target", entityId: "e3" },
      ],
      qualifierIds: [],
    },
  ];
  doc.variants = [{ id: "v", ownerId: "e0", entityId: "e4" }];
  doc = ensureVariantPlacements(doc);
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("https://api.iconify.design/**", (route) => route.abort());
  await page.addInitScript((seed) => {
    if (!localStorage.getItem("omnium.atlas.v2"))
      localStorage.setItem("omnium.atlas.v2", JSON.stringify(seed));
  }, doc);
  await page.goto("http://127.0.0.1:5173/");
  const read = () => page.evaluate(() => JSON.parse(localStorage.getItem("omnium.atlas.v2")));
  const canvas = page.locator(".spatial-workspace canvas");
  await canvas.waitFor();
  const select = async (name) => {
    await page
      .getByRole("navigation", { name: "Node hierarchy" })
      .getByRole("button", { name, exact: true })
      .first()
      .click();
    await page.waitForTimeout(450);
  };
  await select("System");
  await page.getByLabel("Node symbol", { exact: true }).fill("◈");
  await page.getByLabel("Node show text", { exact: true }).uncheck();
  assert.equal((await read()).entities.find((e) => e.id === "e0").label, "System");
  await page.getByLabel("Node show text", { exact: true }).check();
  await page.getByRole("button", { name: "Search Iconify for node", exact: true }).click();
  await page.getByLabel("Search Iconify", { exact: true }).fill("droplet");
  await page.getByRole("button", { name: "Use lucide:droplet", exact: true }).click();
  assert.equal((await read()).assets.length, 1);
  await page
    .getByLabel("Node asset file", { exact: true })
    .setInputFiles({ name: "triangle.glb", mimeType: "model/gltf-binary", buffer: triangleGLB() });
  await page.waitForFunction(() =>
    JSON.parse(localStorage.getItem("omnium.atlas.v2")).assets?.some((a) => a.kind === "glb"),
  );
  assert.equal((await read()).assets.length, 2);
  // The GLB is genuinely rendered as geometry, independently of text identity.
  const model = await page.evaluate(async () => {
    const THREE = await import("/node_modules/three/build/three.module.js");
    const { buildTextScene } = await import("/src/textScene.ts");
    const { editorView } = await import("/src/graph/structural.ts");
    const { projectSpatial } = await import("/src/graph/spatial.ts");
    const doc = JSON.parse(localStorage.getItem("omnium.atlas.v2"));
    const built = buildTextScene(
      new THREE.Group(),
      projectSpatial(editorView(doc)).nodes.filter((n) => n.visible),
      [],
      doc,
      "root",
    );
    await new Promise((resolve) => setTimeout(resolve, 150));
    const object = built.nodes.get("root").visual;
    let meshes = 0;
    object.traverse((o) => {
      if (o.isMesh) meshes++;
    });
    return { meshes, error: !!object.userData.assetError };
  });
  assert.ok(model.meshes > 0);
  assert.equal(model.error, false);
  await page.getByRole("button", { name: "+ Layout view", exact: true }).click();
  await page.waitForTimeout(500);
  // Reconstruct the documented fit camera to hit the actual displayed binder label.
  const point = await page.evaluate(async () => {
    const THREE = await import("/node_modules/three/build/three.module.js");
    const { buildTextScene } = await import("/src/textScene.ts");
    const { chartedBinders } = await import("/src/graph/presentation.ts");
    const { editorView } = await import("/src/graph/structural.ts");
    const { projectSpatial } = await import("/src/graph/spatial.ts");
    const doc = JSON.parse(localStorage.getItem("omnium.atlas.v2")),
      atlas = editorView(doc),
      nodes = projectSpatial(atlas).nodes.filter((n) => n.visible);
    const bounds = new THREE.Box3();
    for (const n of nodes) {
      const v = new THREE.Vector3(n.world.x, n.world.y, n.world.z);
      bounds.expandByPoint(v.clone().addScalar(0.75));
      bounds.expandByPoint(v.clone().addScalar(-0.75));
    }
    const element = document.querySelector(".spatial-workspace canvas"),
      rect = element.getBoundingClientRect();
    const center = bounds.getCenter(new THREE.Vector3()),
      camera = new THREE.PerspectiveCamera(55, rect.width / rect.height, 0.05, 100000);
    camera.position
      .copy(center)
      .add(
        new THREE.Vector3(0, 0, Math.max(6, bounds.getSize(new THREE.Vector3()).length() * 1.2)),
      );
    camera.lookAt(center);
    camera.updateMatrixWorld();
    const group = new THREE.Group(),
      built = buildTextScene(group, nodes, chartedBinders(doc, atlas), doc, "root");
    built.update(camera, rect.width, rect.height);
    const label = group.children.find((o) => o.isSprite && o.userData.binderId === "contains");
    const p = label.position.clone().project(camera);
    return { x: rect.x + ((p.x + 1) * rect.width) / 2, y: rect.y + ((1 - p.y) * rect.height) / 2 };
  });
  await page.mouse.click(point.x, point.y);
  const editor = page.getByRole("dialog", { name: "Binder editor" });
  await editor.waitFor();
  await editor.getByLabel("Binder text", { exact: true }).fill("is made from reusable components");
  await editor.getByLabel("Binder symbol", { exact: true }).fill("⊃");
  assert.equal((await read()).compositions.find((c) => c.id === "contains").visual.character, "⊃");
  assert.equal((await read()).compositions.find((c) => c.id === "contains").childId, "e1");
  await editor
    .getByLabel("Binder saved asset", { exact: true })
    .selectOption((await read()).assets[0].id);
  await frameAction(page, editor, "Close binder editor");
  // A slow icon download must not overwrite edits made while it was in flight.
  await select("System");
  let releaseIcon;
  const iconGate = new Promise((resolve) => {
    releaseIcon = resolve;
  });
  await page.route("https://api.iconify.design/search**", (route) =>
    route.fulfill({ json: { icons: ["custom:atom"] } }),
  );
  await page.route("https://api.iconify.design/custom/atom.svg**", async (route) => {
    await iconGate;
    await route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#abcdef"/></svg>',
    });
  });
  await page.getByRole("button", { name: "Search Iconify for node", exact: true }).click();
  await page.getByLabel("Search Iconify", { exact: true }).fill("atom");
  await page.getByRole("button", { name: "Use custom:atom", exact: true }).click();
  await page.getByLabel("Entity aliases", { exact: true }).fill("edited during download");
  releaseIcon();
  await page.waitForFunction(() =>
    JSON.parse(localStorage.getItem("omnium.atlas.v2")).assets?.some(
      (a) => a.name === "custom:atom",
    ),
  );
  assert.deepEqual((await read()).entities.find((e) => e.id === "e0").aliases, [
    "edited during download",
  ]);
  await page.getByRole("button", { name: "Toggle shortcut display", exact: true }).click();
  const shortcuts = page.getByRole("complementary", { name: "Shortcut display" });
  await shortcuts.waitFor();
  await shortcuts.getByRole("button", { name: "Rebind Focus selected", exact: true }).click();
  await page.keyboard.press("Q");
  assert.equal(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("omnium.workspace.settings.v1")).bindings.focus,
    ),
    "Q",
  );
  await shortcuts.getByRole("button", { name: "Rebind Focus selected", exact: true }).click();
  await page.keyboard.press("Control+z");
  assert.equal(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("omnium.workspace.settings.v1")).bindings.focus,
    ),
    "Q",
  );
  await page.keyboard.press("Escape");
  await frameAction(page, shortcuts, "Close shortcut display");
  await select("System");
  await page.getByLabel("Node name", { exact: true }).fill("System modified");
  await canvas.dispatchEvent("pointerdown", { button: 3, bubbles: true, cancelable: true });
  await page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("omnium.atlas.v2")).entities.find((e) => e.id === "e0")
        .label === "System",
  );
  await canvas.dispatchEvent("pointerdown", { button: 4, bubbles: true, cancelable: true });
  await page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("omnium.atlas.v2")).entities.find((e) => e.id === "e0")
        .label === "System modified",
  );
  // Ctrl-drag is an actual viewport selection, not a pan or a structural edit.
  await page.getByRole("button", { name: "Fit entire atlas", exact: true }).click();
  await page.waitForTimeout(450);
  const box = await canvas.boundingBox();
  await page.keyboard.down("Control");
  await page.mouse.move(box.x + 6, box.y + 70);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 6, box.y + box.height - 45, { steps: 10 });
  assert.equal(await page.locator(".selection-rectangle").count(), 1);
  await page.mouse.up();
  await page.keyboard.up("Control");
  assert.ok(Number((await page.locator(".selection-status").innerText()).match(/^\d+/)[0]) > 1);
  await page.mouse.click(box.x + 15, box.y + box.height - 55, { button: "right" });
  const beforeBatch = await read();
  await page.getByRole("menuitem", { name: "Collapse selected", exact: true }).click();
  const knowledge = await read();
  assert.deepEqual(knowledge.entities, beforeBatch.entities);
  assert.deepEqual(knowledge.compositions, beforeBatch.compositions);
  assert.deepEqual(knowledge.relationships, beforeBatch.relationships);
  assert.equal(knowledge.placements.find((p) => p.id === "root").collapsed, true);
  // Select just the shared root; its collapsed/unplaced descendants are also deleted globally.
  await select("System modified");
  const beforeDelete = await read();
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Workspace settings", exact: true }).focus();
  await page.keyboard.press("Delete");
  assert.deepEqual(
    await read(),
    beforeDelete,
    "dismissing the shared-concept warning leaves the entire document unchanged",
  );
  let warning = "";
  page.once("dialog", async (dialog) => {
    warning = dialog.message();
    await dialog.accept();
  });
  await page.getByRole("button", { name: "Workspace settings", exact: true }).focus();
  await page.keyboard.press("Delete");
  await page.waitForFunction(
    () => JSON.parse(localStorage.getItem("omnium.atlas.v2")).entities.length === 2,
  );
  const deleted = await read();
  assert.deepEqual(
    deleted.entities.map((e) => e.id),
    ["e3", "e5"],
  );
  assert.equal(deleted.relationships.length, 0);
  assert.equal(deleted.compositions.length, 0);
  assert.match(warning, /other appearance|connection/);
  await canvas.dispatchEvent("pointerdown", { button: 3, bubbles: true, cancelable: true });
  await page.waitForFunction(
    () => JSON.parse(localStorage.getItem("omnium.atlas.v2")).entities.length === 6,
  );
  const restored = await read();
  delete restored.revision;
  delete beforeDelete.revision;
  assert.deepEqual(
    restored,
    beforeDelete,
    "one mouse undo restores identities, every placement, assets, relationships and layouts",
  );
  await page.reload();
  await canvas.waitFor();
  assert.equal((await read()).assets.length, 3);
  assert.deepEqual(errors, []);
  await page.screenshot({ path: "/tmp/omnium-selection-visuals.png" });
  console.log(
    "PASS: portable Iconify/GLB visuals, canonical text preservation, click-to-edit binder text/assets, editable shortcuts/conflicts, MB4/5 undo/redo, Ctrl-drag selection and batch context actions, warned global cascade deletion and complete one-step recovery.",
  );
} finally {
  await browser.close();
}
