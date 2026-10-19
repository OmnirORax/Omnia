import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { worldPositions } from "../src/graph/layout3d.ts";
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
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(process.env.ATLAS_URL || "http://127.0.0.1:5173/");
  const read = () => page.evaluate(() => JSON.parse(localStorage.getItem("omnium.atlas.v2")));
  const title = "Software ecosystem and its complete cross-domain compatibility specifications";
  await page.getByRole("button", { name: "+ Add first node" }).click();
  await page.getByLabel("Node name", { exact: true }).fill(title);
  await page.getByRole("button", { name: "+ Child node" }).click();
  await page
    .getByLabel("Node name", { exact: true })
    .fill("Structural knowledge and canonical entity references");
  const root = (await read()).placements.find((p) => p.parentId === null).id;
  await page
    .getByRole("navigation", { name: "Node hierarchy" })
    .getByRole("button", { name: title, exact: true })
    .click();
  await page.getByRole("button", { name: "+ Child node" }).click();
  await page
    .getByLabel("Node name", { exact: true })
    .fill("Rendering adapters and replaceable contextual representations");
  await page.getByLabel("Node color").evaluate((input) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, "#a8e0c0");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.getByLabel("Node opacity").focus();
  await page.keyboard.press("ArrowLeft");
  const before = await read();
  assert.equal(before.placements.at(-1).appearance.opacity, 0.95);
  assert.equal(before.placements.at(-1).appearance.color, "#a8e0c0");
  const child = before.placements.find((p) => p.id !== root).id;
  await page.getByLabel("New relationship source").selectOption(child);
  await page.getByLabel("New relationship target").selectOption(before.placements.at(-1).id);
  await page.getByRole("button", { name: "Add relationship", exact: true }).click();
  await page.getByRole("button", { name: "+ Binder operator" }).click();
  await page
    .getByLabel("Binder operator 1", { exact: true })
    .fill("must preserve identity across representations");
  await page.getByLabel("Binder opacity").focus();
  await page.keyboard.press("ArrowLeft");
  await page.getByLabel("Binder color").evaluate((input) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, "#f5ba71");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const authored = await read();
  assert.equal(authored.relationships[0].appearance.color, "#f5ba71");
  await page.getByLabel("New view rule").selectOption("hierarchy");
  await page.getByRole("button", { name: "+ Layout view" }).click();
  await page.waitForTimeout(450);
  const hierarchy = await read();
  const viewId = hierarchy.activeLayoutViewId;
  assert.ok(viewId);
  assert.deepEqual(hierarchy.entities, authored.entities);
  assert.deepEqual(hierarchy.relationships, authored.relationships);
  assert.deepEqual(hierarchy.compositions, authored.compositions);
  assert.ok(
    hierarchy.placements.filter((p) => p.parentId === root).every((p) => p.spatialPosition.y < 0),
  );
  await page.getByLabel("Layout view").selectOption("authored-layout");
  assert.deepEqual((await read()).placements, authored.placements);
  await page.getByLabel("Layout view").selectOption(viewId);
  await page.waitForTimeout(450);
  await page.screenshot({ path: "/tmp/omnium-text-workspace.png" });

  // Exercise actual Three.js text geometry, including overlap and midpoint arrows.
  const geometry = await page.evaluate(async () => {
    const THREE = await import("/node_modules/three/build/three.module.js");
    const { buildTextScene } = await import("/src/textScene.ts");
    const { editorView } = await import("/src/graph/structural.ts");
    const { projectSpatial } = await import("/src/graph/spatial.ts");
    const { chartedBinders } = await import("/src/graph/presentation.ts");
    const doc = JSON.parse(localStorage.getItem("omnium.atlas.v2"));
    const group = new THREE.Group();
    const projected = projectSpatial(editorView(doc)).nodes.filter((n) => n.visible);
    const built = buildTextScene(group, projected, chartedBinders(doc), doc, null);
    const camera = new THREE.PerspectiveCamera(55, 1.5, 0.05, 1000);
    camera.position.set(0, 0, 20);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    built.update(camera, 1200, 800);
    const arrows = built.binderHits.filter((o) => o.type === "Mesh");
    const lines = built.binderHits.filter((o) => o.type === "Line");
    const overlapping = buildTextScene(
      new THREE.Group(),
      projected.map((n) => ({ ...n, world: { x: 0, y: 0, z: 0 } })),
      chartedBinders(doc),
      doc,
      null,
    );
    overlapping.update(camera, 1200, 800);
    const rectangles = [...overlapping.nodes.values()].map((n) => ({
      x: n.group.position.x,
      y: n.group.position.y,
      width: n.sprite.scale.x,
      height: n.sprite.scale.y,
    }));
    const anyOverlap = rectangles.some((a, i) =>
      rectangles.some(
        (b, j) =>
          i !== j &&
          Math.abs(a.x - b.x) < (a.width + b.width) / 2 &&
          Math.abs(a.y - b.y) < (a.height + b.height) / 2,
      ),
    );
    return {
      anyOverlap,
      names: [...built.nodes.values()].map((n) => n.sprite.userData.label),
      sphereCount: group.children.filter((o) => o.geometry?.type === "SphereGeometry").length,
      annotations: built.binderHits.filter((o) => o.type === "Sprite").map((o) => o.userData.label),
      midpointDistances: arrows.map((arrow, i) => {
        const points = lines[i].geometry.attributes.position;
        return arrow.position.distanceTo(
          new THREE.Vector3().fromBufferAttribute(points, Math.floor(points.count / 2)),
        );
      }),
      hierarchyLines: lines.filter((line) => line.userData.binderKind === "composition").length,
    };
  });
  assert.ok(geometry.names.includes(title), "full name reaches the renderer");
  assert.equal(
    geometry.anyOverlap,
    false,
    "overlapping names move sideways instead of disappearing",
  );
  assert.equal(geometry.sphereCount, 0);
  assert.equal(geometry.hierarchyLines, 2);
  assert.ok(geometry.annotations.some((s) => s.includes("must preserve identity")));
  assert.ok(
    geometry.midpointDistances.every((distance) => distance < 1e-5),
    "arrowheads are at binder midpoints",
  );
  await page.getByLabel("New view rule").selectOption("flow");
  await page.getByRole("button", { name: "+ Layout view" }).click();
  const flow = await read(),
    flowWorld = worldPositions(flow);
  assert.ok(flowWorld.get(child).y > flowWorld.get(before.placements.at(-1).id).y);
  assert.deepEqual(flow.relationships, authored.relationships);
  await page.getByRole("button", { name: "Remove view", exact: true }).click();
  assert.equal(
    (await read()).layoutViews.some((v) => v.id === flow.activeLayoutViewId),
    false,
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  assert.equal((await read()).activeLayoutViewId, flow.activeLayoutViewId);
  await page.getByLabel("Layout view").selectOption(viewId);
  await page
    .getByRole("navigation", { name: "Node hierarchy" })
    .getByRole("button", { name: title, exact: true })
    .click();
  await page.getByRole("button", { name: "Edit composition binder", exact: true }).first().click();
  await page.getByRole("button", { name: "+ Binder operator" }).click();
  await page.getByLabel("Binder operator 1", { exact: true }).fill("charted component");
  assert.ok(
    (await read()).compositions.some((c) =>
      c.operators?.some((o) => o.text === "charted component"),
    ),
  );
  await page.reload();
  assert.equal((await read()).activeLayoutViewId, viewId);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: full text nodes, composition binders, midpoint arrows, appearance/operators, saved hierarchy view and authored-layout recovery.",
  );
} finally {
  await browser.close();
}
