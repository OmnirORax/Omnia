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
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.setDefaultTimeout(10000);
const graph = emptyDocument();
const icon = { mode: "icon", geometry: "circle", character: "○" };
const frame = (id, x, y, collapsed = false) => ({
  id,
  name: id,
  x,
  y,
  width: 350,
  cellSize: 96,
  collapsed,
  pinned: false,
  chrome: { style: icon },
  members: [],
});
const ui = {
  ...emptyUILayout(),
  frames: [
    {
      ...frame("Tools", 500, 260),
      members: [
        { kind: "function", id: "focus" },
        { kind: "function", id: "fitLocal" },
        { kind: "function", id: "ui:snap", breakBefore: true },
      ],
    },
    frame("A", 1000, 600, true),
    frame("B", 1200, 600, true),
  ],
  items: { focus: { x: 0, y: 0, style: icon }, fitLocal: { x: 0, y: 0, style: icon } },
};
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const read = () => page.evaluate(() => JSON.parse(localStorage.getItem("omnium.ui.layout.v1")));
const root = (id) => page.locator(`[data-ui-resident-root="frame:${id}"]`).first();
const fn = (id) => root("Tools").locator(`[data-ui-function="${id}"]`).first();
async function drag(source, x, y) {
  const b = await source.boundingBox();
  assert.ok(b);
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 14, b.y + b.height / 2 + 2);
  await page.mouse.move(x, y, { steps: 12 });
  await page.mouse.move(x + 1, y);
  await page.locator(".ui-snap-preview").waitFor();
  await page.mouse.up();
  await page.waitForFunction(() => !document.querySelector(".ui-snap-preview"));
}
try {
  await page.addInitScript(
    ({ ui, graph }) => {
      if (!localStorage.getItem("omnium.ui.layout.v1"))
        localStorage.setItem("omnium.ui.layout.v1", JSON.stringify(ui));
      if (!localStorage.getItem("omnium.atlas.v2"))
        localStorage.setItem("omnium.atlas.v2", JSON.stringify(graph));
    },
    { ui, graph },
  );
  await page.goto(process.env.ATLAS_URL || "http://127.0.0.1:5173/");
  await page.locator("canvas").waitFor();
  await page.evaluate(() => {
    window.nativeMenus = [];
    document.addEventListener(
      "contextmenu",
      (e) => {
        queueMicrotask(() => window.nativeMenus.push(e.defaultPrevented));
      },
      true,
    );
  });
  await root("Tools").locator(".ui-frame-handle").click({ button: "right" });
  await page.getByRole("button", { name: "Snap mode · choose anchor", exact: true }).click();
  await fn("focus").click();
  await page.locator(".ui-anchor-prompt").waitFor({ state: "hidden" });
  let saved = await read(),
    tools = saved.frames[0];
  assert.equal(tools.arrangement.mode, "snap");
  assert.ok(tools.members.every((m) => m.position));
  const before = structuredClone(tools.members.find((m) => m.id === "focus"));
  const anchor = await fn("focus").boundingBox();
  await drag(fn("fitLocal"), anchor.x + anchor.width / 2, anchor.y + anchor.height / 2);
  tools = (await read()).frames[0];
  assert.deepEqual(
    tools.members.find((m) => m.id === "focus"),
    before,
  );
  const moved = tools.members.find((m) => m.id === "fitLocal"),
    grid = tools.arrangement.grid;
  assert.ok(
    Math.abs(
      (moved.position.x - grid.origin.x) / grid.pitch.x -
        Math.round((moved.position.x - grid.origin.x) / grid.pitch.x),
    ) < 1e-6,
  );
  assert.notDeepEqual(moved.position, before.position);
  // Free-hand preserves fractional/non-grid positions instead of inserting/pushing.
  await root("Tools").locator(".ui-frame-handle").click({ button: "right" });
  await page.getByRole("button", { name: /^Free-hand mode/ }).click();
  const originalPos = (await read()).frames[0].members.find((m) => m.id === "focus").position;
  let b = await fn("fitLocal").boundingBox();
  await drag(fn("fitLocal"), b.x + b.width / 2 + 17, b.y + b.height / 2 + 13);
  assert.deepEqual(
    (await read()).frames[0].members.find((m) => m.id === "focus").position,
    originalPos,
  );
  // Background drags contents, keeping the identifying tab fixed; one UI undo restores it.
  const handle = await root("Tools").locator(".ui-frame-handle").boundingBox();
  const bubble = root("Tools").locator(".ui-bubble-drag");
  const first = await fn("focus").boundingBox();
  await page.mouse.move(first.x - 3, first.y + first.height / 2);
  await page.mouse.down();
  await page.mouse.move(first.x + 37, first.y + first.height / 2 + 30, { steps: 10 });
  await page.mouse.up();
  assert.deepEqual((await read()).frames[0].bodyOffset, { x: 40, y: 30 });
  assert.deepEqual(await root("Tools").locator(".ui-frame-handle").boundingBox(), handle);
  assert.ok(await bubble.count());
  await page.evaluate(() =>
    window.dispatchEvent(
      new PointerEvent("pointerdown", {
        button: 3,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      }),
    ),
  );
  assert.equal((await read()).frames[0].bodyOffset, undefined);
  // Edge drag surfaces replace noisy grips; input interior still accepts editing.
  assert.equal(await page.locator(".ui-field-grip").count(), 0);
  assert.equal(await fn("ui:snap").locator(".ui-field-edge").count(), 4);
  await fn("ui:snap").getByRole("combobox").selectOption("1");
  assert.equal(await fn("ui:snap").getByRole("combobox").inputValue(), "1");
  // No floating mini controls; pinning is available from the frame context menu.
  assert.equal(await page.locator(".frame-mini-control").count(), 0);
  await frameAction(page, root("Tools"), "Pin frame");
  assert.ok((await read()).frames[0].pinned);
  await frameAction(page, root("Tools"), "Unpin frame");
  // Workspace snap also positions whole frames relative to a clicked anchor.
  await page.getByLabel("UI placement mode", { exact: true }).selectOption("snap");
  await root("A").locator(".ui-frame-handle").click();
  assert.equal((await read()).arrangement.mode, "snap");
  const a = await root("A").locator(".ui-frame-handle").boundingBox();
  await drag(root("B").locator(".ui-frame-handle"), a.x + 80, a.y - 90);
  saved = await read();
  const wb = saved.frames.find((f) => f.id === "B"),
    wg = saved.arrangement.grid;
  assert.ok(
    Math.abs(
      ((await root("B").locator("..").boundingBox()).x - wg.origin.x) / wg.pitch.x -
        Math.round(((await root("B").locator("..").boundingBox()).x - wg.origin.x) / wg.pitch.x),
    ) < 1e-6,
  );
  assert.ok(
    Math.abs(
      ((await root("B").locator("..").boundingBox()).y - wg.origin.y) / wg.pitch.y -
        Math.round(((await root("B").locator("..").boundingBox()).y - wg.origin.y) / wg.pitch.y),
    ) < 1e-6,
  );
  await page.locator("canvas").click({ button: "right", position: { x: 650, y: 400 } });
  assert.ok(
    (await page.evaluate(() => window.nativeMenus)).every(Boolean),
    "all contextmenu events must suppress Chrome",
  );
  assert.ok((await page.evaluate(() => window.nativeMenus)).length >= 4);
  assert.deepEqual(
    await page.evaluate(() => JSON.parse(localStorage.getItem("omnium.atlas.v2"))),
    graph,
  );
  const snapshot = await read();
  await page.reload();
  await page.locator("canvas").waitFor();
  assert.deepEqual(await read(), snapshot);
  assert.deepEqual(errors, []);
  await page.screenshot({ path: "/tmp/omnium-anchored-ui.png" });
  console.log(
    "PASS: local/workspace anchored snapping, occupied cells, free-hand placement, fixed-tab bulk drag + undo, field edges, right-click controls, native-menu suppression and persistence.",
  );
} catch (e) {
  await page.screenshot({ path: "/tmp/omnium-anchored-ui-failure.png" });
  console.error(JSON.stringify(await read()));
  throw e;
} finally {
  await browser.close();
}
