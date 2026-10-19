import assert from "node:assert/strict";
import { frameAction } from "./ui-browser-helpers.mjs";
import { chromium } from "playwright-core";
import { emptyDocument } from "../src/graph/structural.ts";
import { emptyUILayout } from "../src/ui/layout.ts";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--enable-webgl",
    "--use-gl=angle",
    "--use-angle=swiftshader",
  ],
});
const page = await browser.newPage({ viewport: { width: 1800, height: 1100 } });
page.setDefaultTimeout(10000);
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const graph = emptyDocument();
graph.entities = ["System", "Child"].map((id) => ({ id, label: id, aliases: [], notes: "" }));
graph.placements = graph.entities.map((e, i) => ({
  id: e.id,
  entityId: e.id,
  parentId: i ? "System" : null,
  position: i ? { x: 28, y: 104 } : { x: 0, y: 0 },
  spatialPosition: { x: i * 4, y: 0, z: 0 },
  collapsed: false,
  hidden: false,
}));
graph.compositions = [{ id: "contains", parentId: "System", childId: "Child" }];
const ui = {
  ...emptyUILayout(),
  frames: [
    {
      id: "tools",
      name: "Tools",
      x: 1100,
      y: 740,
      width: 420,
      cellSize: 96,
      collapsed: false,
      pinned: false,
      chrome: { style: { mode: "icon", geometry: "circle", character: "U" } },
      members: [],
    },
  ],
};
const read = () => page.evaluate(() => JSON.parse(localStorage.getItem("omnium.atlas.v2")));
const layout = () => page.evaluate(() => JSON.parse(localStorage.getItem("omnium.ui.layout.v1")));
const control = (id) => page.locator(`[data-ui-function="${id}"]:not([data-ui-palette])`).first();
async function selectRoot() {
  await page
    .getByRole("navigation", { name: "Node hierarchy" })
    .getByRole("button", { name: "System", exact: true })
    .click();
}
async function drag(source, x, y) {
  const box = await source.boundingBox();
  assert.ok(box);
  const sx = box.x + box.width / 2,
    sy = box.y + box.height / 2;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx + 14, sy + 3);
  await page.mouse.move(x, y, { steps: 12 });
  await page.mouse.move(x + 1, y);
  await page.locator(".ui-snap-preview").waitFor();
  const preview = await page.locator(".ui-snap-preview").textContent();
  await page.mouse.up();
  await page.waitForFunction(() => !document.querySelector(".ui-snap-preview"));
  return preview;
}
async function dragField(id, targetId, edge, after) {
  const target = control(targetId);
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  return drag(
    control(id).locator(`.edge-${edge}`),
    box.x + box.width / 2,
    box.y + box.height * (after ? 0.85 : 0.15),
  );
}
try {
  await page.route("https://api.iconify.design/**", (route) => route.abort());
  await page.addInitScript(
    ({ graph, ui }) => {
      if (!localStorage.getItem("omnium.atlas.v2"))
        localStorage.setItem("omnium.atlas.v2", JSON.stringify(graph));
      if (!localStorage.getItem("omnium.ui.layout.v1"))
        localStorage.setItem("omnium.ui.layout.v1", JSON.stringify(ui));
    },
    { graph, ui },
  );
  await page.goto("http://127.0.0.1:5173/");
  await page.locator("canvas").waitFor();
  await selectRoot();
  await page.keyboard.press("Shift+N");
  await page.waitForFunction(
    () => JSON.parse(localStorage.getItem("omnium.atlas.v2")).entities.length === 3,
  );
  let doc = await read(),
    added = doc.placements.find((p) => !["System", "Child"].includes(p.id));
  assert.equal(added.parentId, "System");
  assert.ok(Math.hypot(...Object.values(added.spatialPosition)) <= 2.01);
  assert.deepEqual(doc.placements.find((p) => p.id === "Child").spatialPosition, {
    x: 4,
    y: 0,
    z: 0,
  });
  await selectRoot();
  await page.getByRole("button", { name: "Edit composition binder", exact: true }).first().click();
  await page.getByRole("button", { name: "Search Iconify for binder", exact: true }).click();
  await page.getByLabel("Search Iconify", { exact: true }).fill("droplet");
  await page.getByRole("button", { name: "Use lucide:droplet", exact: true }).click();
  await page.waitForFunction(
    () => JSON.parse(localStorage.getItem("omnium.atlas.v2")).assets?.length === 1,
  );
  doc = await read();
  assert.equal(doc.compositions[0].visual.assetId, doc.assets[0].id);
  assert.equal(doc.compositions[0].childId, "Child");
  // Exercise the actual WebGL upload, rather than only checking that JSON contains an asset ID.
  const pixels = await page.evaluate(async () => {
    const THREE = await import("/node_modules/three/build/three.module.js"),
      { visualObject } = await import("/src/visualScene.ts");
    const doc = JSON.parse(localStorage.getItem("omnium.atlas.v2")),
      scene = new THREE.Scene();
    scene.background = new THREE.Color("#101927");
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 2;
    camera.lookAt(0, 0, 0);
    let loaded;
    const ready = new Promise((resolve) => (loaded = resolve));
    const icon = visualObject(
      doc.compositions[0].visual,
      doc.assets,
      () => new THREE.Sprite(new THREE.SpriteMaterial()),
      () => loaded(),
    );
    scene.add(icon);
    await Promise.race([
      ready,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Icon load timed out")), 3000)),
    ]);
    const renderer = new THREE.WebGLRenderer(),
      target = new THREE.WebGLRenderTarget(64, 64);
    renderer.setSize(64, 64);
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    const data = new Uint8Array(64 * 64 * 4);
    renderer.readRenderTargetPixels(target, 0, 0, 64, 64, data);
    let colored = 0;
    for (let i = 0; i < data.length; i += 4)
      if (data[i] > 80 && data[i + 1] > 80 && data[i + 2] > 80) colored++;
    const rasterized = icon.children[0].material.map.isCanvasTexture;
    target.dispose();
    renderer.dispose();
    return { colored, rasterized };
  });
  assert.ok(pixels.colored > 20, "Iconify SVG must produce visible GPU pixels");
  assert.equal(pixels.rasterized, true);
  await selectRoot();
  const knowledgeBeforeUI = await read();
  for (const [index, edge] of ["top", "right", "bottom", "left"].entries()) {
    assert.equal(
      await control("field:node-name")
        .locator(`.edge-${edge}`)
        .evaluate((el) => getComputedStyle(el).cursor),
      "grab",
    );
    const after = index % 2 === 0,
      preview = await dragField("field:node-name", "visual:Node:symbol", edge, after);
    assert.match(preview, /Place Node name (after|before) Node symbol/);
    await page.waitForFunction(
      () =>
        JSON.parse(localStorage.getItem("omnium.ui.layout.v1")).items["field:node-name"]?.anchorId,
    );
    const saved = await layout(),
      anchor = saved.items["field:node-name"].anchorId;
    assert.deepEqual(
      saved.nativeOrders[anchor],
      after ? ["visual:Node:symbol", "field:node-name"] : ["field:node-name", "visual:Node:symbol"],
    );
    assert.equal(saved.frames.length, 1, "field reorder must not create a nested frame");
  }
  assert.deepEqual(await read(), knowledgeBeforeUI);
  await page.locator('.toolbar [data-ui-function="shortcuts"]').click();
  const shortcuts = page.getByRole("complementary", { name: "Shortcut display", exact: true });
  await shortcuts.locator('[data-ui-function="shortcut:fitLocal"]').scrollIntoViewIfNeeded();
  assert.match(
    await dragField("shortcut:focus", "shortcut:fitLocal", "right", true),
    /Place Focus selected shortcut after Fit local system shortcut/,
  );
  assert.ok((await layout()).items["shortcut:focus"].anchorId.startsWith("window:shortcuts|"));
  const handle = page.locator('[data-ui-chrome="frame:tools"] .ui-frame-handle');
  let b = await handle.boundingBox();
  assert.match(
    await drag(
      control("shortcut:focus").locator(".edge-left"),
      b.x + b.width / 2,
      b.y + b.height / 2,
    ),
    /Add to Tools/,
  );
  await page.waitForFunction(() =>
    JSON.parse(localStorage.getItem("omnium.ui.layout.v1")).frames[0].members.some(
      (m) => m.id === "shortcut:focus",
    ),
  );
  assert.equal((await layout()).items["shortcut:focus"].anchorId, undefined);
  await frameAction(page, shortcuts, "Close shortcut display");
  const tools = page.locator('[data-ui-resident-root="frame:tools"]');
  await tools.getByRole("button", { name: "Rebind Focus selected", exact: true }).click();
  await page.keyboard.press("Control+Shift+K");
  assert.equal(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("omnium.workspace.settings.v1")).bindings.focus,
    ),
    "Ctrl+Shift+K",
  );
  await page.locator('.toolbar [data-ui-function="ui:arrange"]').click();
  const library = page.getByRole("dialog", { name: "UI library", exact: true });
  assert.ok(await library.locator("summary").filter({ hasText: "File" }).count());
  assert.ok(await library.locator("summary").filter({ hasText: "Nodes" }).count());
  await library.getByLabel("Find UI function", { exact: true }).fill("workspace settings");
  await library.getByRole("button", { name: "Place Workspace settings", exact: true }).click();
  await frameAction(
    page,
    page.getByRole("dialog", { name: "Workspace settings", exact: true }),
    "Close Workspace settings",
  );
  await library.getByLabel("Find UI function", { exact: true }).fill("node name");
  const name = library.getByRole("button", { name: "Place Node name", exact: true });
  assert.equal(await name.getAttribute("draggable"), "true");
  await name.click();
  const editor = page.getByRole("dialog", { name: "Node name", exact: true });
  assert.equal(await editor.getByLabel("Node name", { exact: true }).inputValue(), "System");
  await frameAction(page, editor, "Close Node name");
  await tools.getByRole("button", { name: "Toggle frame Tools", exact: true }).click();
  b = await handle.boundingBox();
  assert.match(await drag(name, b.x + b.width / 2, b.y + b.height / 2), /Add to Tools/);
  await page.waitForFunction(() =>
    JSON.parse(localStorage.getItem("omnium.ui.layout.v1")).frames[0].members.some(
      (m) => m.id === "field:node-name",
    ),
  );
  await frameAction(page, library, "Close UI library");
  await tools.getByRole("button", { name: "Toggle frame Tools", exact: true }).click();
  await tools.getByLabel("Node name", { exact: true }).fill("Renamed system");
  assert.equal((await read()).entities.find((e) => e.id === "System").label, "Renamed system");
  const saved = await layout(),
    savedDoc = await read();
  await page.reload();
  await page.locator("canvas").waitFor();
  assert.deepEqual(await layout(), saved);
  assert.deepEqual(await read(), savedDoc);
  assert.deepEqual(errors, []);
  await page.screenshot({ path: "/tmp/omnium-usability-fixes.png" });
  console.log(
    "PASS: visible Iconify SVG pixels, adjacent new children, four-edge node field ordering, movable live shortcut rows, explicit frame docking, categorized/searchable interactive library, and persistence without duplicated knowledge.",
  );
} catch (error) {
  await page.screenshot({ path: "/tmp/omnium-usability-fixes-failure.png" });
  console.error("UI", JSON.stringify(await layout()));
  throw error;
} finally {
  await browser.close();
}
