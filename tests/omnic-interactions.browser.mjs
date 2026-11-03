/** Opt-in real-input regression for Composer selection/edit ownership.
 * Run against a local dev server; each profile uses a disposable browser context. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright-core";
import { emptyDocument } from "../src/graph/structural.ts";
import { validateRecipe } from "../src/omnic/model.ts";
import { defaultSettings, SETTINGS_KEY } from "../src/workspaceActions.ts";
const target = new URL(process.env.OMNIA_URL ?? "http://127.0.0.1:5173/");
if (!["127.0.0.1", "localhost"].includes(target.hostname))
  throw Error("Use a local disposable dev server.");
const output = process.env.OMNIA_INTERACTION_OUTPUT ?? "work/omnic-interactions";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
  args: [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--enable-webgl",
    "--use-gl=angle",
    "--use-angle=swiftshader",
  ],
});
const report = { source: process.env.OMNIA_SOURCE ?? null, checks: [], errors: [] };
let page, context, current;
async function check(name, fn) {
  current = name;
  await fn();
  report.checks.push(name);
  console.log(`PASS ${name}`);
}
async function fixture(active, settings) {
  await context?.close();
  context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.on("pageerror", (e) => report.errors.push(e.message));
  await page.route("**/*", (route) =>
    new URL(route.request().url()).origin === target.origin ? route.continue() : route.abort(),
  );
  const doc = emptyDocument(),
    recipe = validateRecipe({
      version: 1,
      revision: 0,
      components: [
        ...[-40, 0, 40].map((x, i) => ({
          id: `dot-${i}`,
          generator: "dot",
          params: { x, y: 0, size: 10 },
        })),
        { id: "line", generator: "line", params: { x: 0, y: 45, length: 50 } },
        {
          id: "chain",
          generator: "chain",
          params: { x: 0, y: -45, count: 3, spacing: 20, size: 6 },
        },
      ],
      operations: [],
      frames: [],
      atomnic: { active, mode: "free", viewSize: 160 },
    });
  doc.entities = [
    { id: "fixture", label: "Interaction fixture", aliases: [], notes: "", omnic: recipe },
  ];
  doc.placements = [
    {
      id: "p",
      entityId: "fixture",
      parentId: null,
      position: { x: 0, y: 0 },
      spatialPosition: { x: 0, y: 0, z: 0 },
      collapsed: false,
      hidden: false,
    },
  ];
  await page.addInitScript(
    ([doc, settings, key]) => {
      localStorage.setItem("omnium.atlas.v2", JSON.stringify(doc));
      if (settings && !localStorage.getItem(key))
        localStorage.setItem(key, JSON.stringify(settings));
    },
    [doc, settings, SETTINGS_KEY],
  );
  await page.goto(target.href);
  await page
    .getByRole("navigation", { name: "Node hierarchy" })
    .getByRole("button", { name: "Interaction fixture", exact: true })
    .first()
    .click();
  await page
    .locator('[data-ui-function="omnic.open"]')
    .first()
    .evaluate((e) => e.click());
  await page.locator(".atomnic-surface").waitFor();
  page.setDefaultTimeout(7000);
}
const owner = (id) =>
  page.locator(`.atomnic-surface [data-selection-geometry][data-omnic-component="${id}"]`).first();
const popup = () => page.locator('.contextual-master-controller[role="dialog"]');
async function selected(ids) {
  await page.waitForFunction(
    async (expected) => {
      const first = (await import("/src/ui/contextTargets.ts")).contextTargets.targets()[0];
      const actual = first?.label.startsWith("Geometry") ? first.id.split("|").sort() : [];
      return JSON.stringify(actual) === JSON.stringify(expected);
    },
    [...ids].sort(),
    { timeout: 4000 },
  );
}
async function noPopup() {
  assert.equal(await popup().count(), 0, "selection must not open a dial");
}
async function shape() {
  return page
    .locator(".atomnic-surface [data-selection-geometry]")
    .evaluateAll((es) =>
      es.map((e) =>
        Object.fromEntries(
          [
            "data-omnic-role",
            "x",
            "y",
            "cx",
            "cy",
            "r",
            "x1",
            "x2",
            "y1",
            "y2",
            "d",
            "fill",
            "stroke",
            "stroke-width",
          ].map((k) => [k, e.getAttribute(k)]),
        ),
      ),
    );
}
async function point(id) {
  return owner(id).evaluate((el) => {
    const b = el.getBoundingClientRect();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  });
}
async function clickOwner(id, { button = "left", modifiers = [] } = {}) {
  const p = await point(id);
  for (const key of modifiers) await page.keyboard.down(key);
  await page.mouse.click(p.x, p.y, { button });
  for (const key of modifiers.toReversed()) await page.keyboard.up(key);
}
async function pick(id, modifiers = []) {
  await clickOwner(id, { modifiers });
}
async function closeDials(ids) {
  for (let i = 0; i < 8 && (await popup().count()); i++) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(80);
    await selected(ids);
  }
  await noPopup();
}

try {
  for (const active of [true, false]) {
    await fixture(active);
    const profile = active ? "Atomnic on" : "Atomnic off",
      baseline = await shape();
    await check(`${profile}: primary target selection is passive`, async () => {
      await pick("dot-0");
      await selected(["dot-0"]);
      await noPopup();
      assert.deepEqual(await shape(), baseline);
    });
    await check(
      `${profile}: held Ctrl adds/toggles several targets without opening editors`,
      async () => {
        await page.keyboard.down("Control");
        await clickOwner("dot-1");
        await selected(["dot-0", "dot-1"]);
        await noPopup();
        await clickOwner("dot-2");
        await selected(["dot-0", "dot-1", "dot-2"]);
        await clickOwner("dot-1");
        await selected(["dot-0", "dot-2"]);
        await clickOwner("dot-1");
        await selected(["dot-0", "dot-1", "dot-2"]);
        await page.keyboard.up("Control");
        await noPopup();
        assert.deepEqual(await shape(), baseline);
      },
    );
    await check(`${profile}: Shift spatial range works in both directions`, async () => {
      await pick("dot-0");
      await selected(["dot-0"]);
      await pick("dot-2", ["Shift"]);
      await selected(["dot-0", "dot-1", "dot-2"]);
      await pick("dot-2");
      await selected(["dot-2"]);
      await pick("dot-0", ["Shift"]);
      await selected(["dot-0", "dot-1", "dot-2"]);
      await noPopup();
    });
    await check(
      `${profile}: Q plus held Shift+Q selects multiple targets without entering a setter`,
      async () => {
        await pick("line");
        await selected(["line"]);
        await noPopup();
        const start = await point("dot-0");
        await page.mouse.move(start.x, start.y);
        await page.keyboard.press("q");
        await page.waitForTimeout(100);
        await noPopup();
        await page.keyboard.down("Shift");
        await page.keyboard.down("q");
        try {
          await clickOwner("dot-0");
          await selected(["dot-0", "dot-1", "line"]);
          await clickOwner("dot-2");
          await selected(["dot-0", "dot-1", "dot-2", "line"]);
          await noPopup();
        } finally {
          await page.keyboard.up("q");
          await page.keyboard.up("Shift");
        }
        await page.keyboard.press("q");
        await page.keyboard.press("q");
        await page
          .getByRole("dialog", { name: "Visual selection controller", exact: true })
          .waitFor();
        await page.keyboard.press("Escape");
        await page.keyboard.press("Escape");
        await pick("dot-0");
        await pick("dot-2", ["Shift"]);
        await selected(["dot-0", "dot-1", "dot-2"]);
      },
    );
    await check(
      `${profile}: ordinary Q after Rotation keeps Ctrl selection and Q configuration independent`,
      async () => {
        await pick("line");
        await page.keyboard.press("r");
        await page
          .getByRole("dialog", { name: "Master controller — Rotation", exact: true })
          .waitFor();
        const start = await point("line");
        await page.mouse.move(start.x, start.y);
        await page.keyboard.press("q");
        await page.keyboard.down("Control");
        await page.keyboard.down("q");
        try {
          await clickOwner("dot-0");
          await selected(["dot-0"]);
          await clickOwner("dot-2");
          await selected(["dot-0", "dot-2"]);
          await page.keyboard.down("q");
          await noPopup();
        } finally {
          await page.keyboard.up("q");
          await page.keyboard.up("Control");
        }
        await page.keyboard.press("q");
        await page.keyboard.press("q");
        await page
          .getByRole("dialog", { name: "Visual selection controller", exact: true })
          .waitFor();
        await selected(["dot-0", "dot-2"]);
        await page.keyboard.press("Escape");
        await page.keyboard.press("Escape");
        await pick("dot-0");
        await pick("dot-2", ["Shift"]);
        await selected(["dot-0", "dot-1", "dot-2"]);
        assert.deepEqual(await shape(), baseline);
      },
    );
    await check(
      `${profile}: MS cursor persists across picks and Escape then Q restarts targeting`,
      async () => {
        await pick("line");
        await page.keyboard.press("q");
        await page.locator('[data-tool-cursor-owner="visual-selector"]').waitFor();
        await pick("dot-0", ["Control"]);
        await selected(["dot-0", "line"]);
        await page.locator('[data-tool-cursor-owner="visual-selector"]').waitFor();
        await pick("dot-2", ["Control"]);
        await selected(["dot-0", "dot-2", "line"]);
        await page.locator('[data-tool-cursor-owner="visual-selector"]').waitFor();
        await page.keyboard.press("Escape");
        await page
          .locator('[data-tool-cursor-owner="visual-selector"]')
          .waitFor({ state: "detached" });
        await page.keyboard.press("q");
        await page.locator('[data-tool-cursor-owner="visual-selector"]').waitFor();
        await noPopup();
        await page.keyboard.press("q");
        await page
          .getByRole("dialog", { name: "Visual selection controller", exact: true })
          .waitFor();
        await page.keyboard.press("Escape");
        await page.keyboard.press("Escape");
        await pick("dot-0");
        await pick("dot-2", ["Shift"]);
        await selected(["dot-0", "dot-1", "dot-2"]);
      },
    );
    await check(
      `${profile}: right-click opens once on release and retains the full selection`,
      async () => {
        const p = await point("dot-1");
        await page.mouse.move(p.x, p.y);
        await page.mouse.down({ button: "right" });
        await noPopup();
        await page.mouse.up({ button: "right" });
        await page
          .getByRole("dialog", { name: "Master controller — Target freedoms", exact: true })
          .waitFor();
        await selected(["dot-0", "dot-1", "dot-2"]);
        assert.deepEqual(await shape(), baseline);
      },
    );
    await check(
      `${profile}: right-click DOF config and Escape keep accepted selection`,
      async () => {
        await page
          .locator(
            '.contextual-master-controller [data-ui-function="omnic:target-dof:omnic.thickness"]',
          )
          .click({ button: "right" });
        await page
          .getByRole("dialog", { name: "Master controller — Stroke width mode", exact: true })
          .waitFor();
        await closeDials(["dot-0", "dot-1", "dot-2"]);
        assert.deepEqual(await shape(), baseline);
      },
    );
    await check(`${profile}: a selected-only edit changes no unselected geometry`, async () => {
      await pick("dot-0");
      await pick("dot-1", ["Control"]);
      await selected(["dot-0", "dot-1"]);
      await clickOwner("dot-1", { button: "right" });
      await page
        .locator('.contextual-master-controller [data-ui-function="omnic:target-dof:omnic.fill"]')
        .click();
      const checkbox = page.getByRole("checkbox", { name: "Fill", exact: true });
      await checkbox.waitFor();
      await checkbox.uncheck();
      await page.waitForFunction(
        () =>
          document
            .querySelector('.atomnic-surface [data-omnic-role="dot-0:shape"]')
            ?.getAttribute("fill") === "none",
      );
      const changed = await shape();
      for (const id of ["dot-0:shape", "dot-1:shape"])
        assert.equal(changed.find((e) => e["data-omnic-role"] === id).fill, "none");
      assert.deepEqual(
        changed.filter((e) => !["dot-0:shape", "dot-1:shape"].includes(e["data-omnic-role"])),
        baseline.filter((e) => !["dot-0:shape", "dot-1:shape"].includes(e["data-omnic-role"])),
      );
      await checkbox.check();
      await closeDials(["dot-0", "dot-1"]);
    });
    await check(
      `${profile}: new modifier selection closes an editor without replacing the set`,
      async () => {
        await clickOwner("dot-1", { button: "right" });
        await pick("dot-2", ["Control"]);
        await selected(["dot-0", "dot-1", "dot-2"]);
        await noPopup();
      },
    );
    await check(`${profile}: select-all and plain replacement remain passive`, async () => {
      await page.keyboard.press("Control+a");
      await selected(["dot-0", "dot-1", "dot-2", "line", "chain"]);
      await noPopup();
      await pick("dot-0");
      await selected(["dot-0"]);
      await noPopup();
    });
    await check(`${profile}: marquee adds and cancellation retains accepted members`, async () => {
      const a = await point("dot-1"),
        b = await point("dot-2");
      await page.keyboard.down("Control");
      await page.mouse.move(a.x - 12, a.y - 12);
      await page.mouse.down();
      await page.mouse.move(b.x + 12, b.y + 12, { steps: 5 });
      await page.mouse.up();
      await page.keyboard.up("Control");
      await selected(["dot-0", "dot-1", "dot-2"]);
      await noPopup();
      await page.keyboard.down("Control");
      await page.mouse.move(a.x, a.y);
      await page.mouse.down();
      await page.mouse.move(b.x, b.y, { steps: 3 });
      await page.keyboard.press("Escape");
      await page.mouse.up();
      await page.keyboard.up("Control");
      await selected(["dot-0", "dot-1", "dot-2"]);
      await noPopup();
      const stable = await shape(),
        surface = await page.locator(".atomnic-surface").boundingBox();
      await page.keyboard.down("Control");
      await page.mouse.click(surface.x + surface.width * 0.16, surface.y + surface.height * 0.72);
      await page.keyboard.up("Control");
      await selected(["dot-0", "dot-1", "dot-2"]);
      await noPopup();
      assert.deepEqual(await shape(), stable, "a modified blank click must not draw");
    });
    if (active)
      await check("Atomnic on: Escape cancels a pen preview before passive selection", async () => {
        const before = await shape(),
          b = await page.locator(".atomnic-surface").boundingBox();
        await page.mouse.move(b.x + b.width * 0.16, b.y + b.height * 0.72);
        await page.mouse.down();
        await page.mouse.move(b.x + b.width * 0.18, b.y + b.height * 0.72);
        assert.ok(
          (await shape()).length > before.length,
          "the pen must actually have an active preview",
        );
        await page.keyboard.press("Escape");
        await page.mouse.up();
        await selected(["dot-0", "dot-1", "dot-2"]);
        assert.deepEqual(await shape(), before);
        await noPopup();
      });
    await check(
      `${profile}: generated owners select as whole units and right-click preserves the group`,
      async () => {
        await pick("dot-0");
        await pick("chain", ["Control"]);
        await selected(["dot-0", "chain"]);
        await clickOwner("chain", { button: "right" });
        await page
          .getByRole("dialog", { name: "Master controller — Target freedoms", exact: true })
          .waitFor();
        await selected(["dot-0", "chain"]);
        await closeDials(["dot-0", "chain"]);
        await clickOwner("line", { button: "right" });
        await page
          .getByRole("dialog", { name: "Master controller — Target freedoms", exact: true })
          .waitFor();
        await selected(["line"]);
        await closeDials(["line"]);
        await pick("dot-0");
        await pick("dot-2", ["Shift"]);
        await selected(["dot-0", "dot-1", "dot-2"]);
      },
    );
    await check(
      `${profile}: registered selection undo/redo and Ctrl+Q/Shift+Q preserve ownership`,
      async () => {
        await pick("dot-1", ["Control"]);
        await selected(["dot-0", "dot-2"]);
        await page.evaluate(async () =>
          (await import("/src/featureActions.ts")).featureActionRuntime.invoke(
            "atomnic.selectionUndo",
          ),
        );
        await selected(["dot-0", "dot-1", "dot-2"]);
        await page.evaluate(async () =>
          (await import("/src/featureActions.ts")).featureActionRuntime.invoke(
            "atomnic.selectionRedo",
          ),
        );
        await selected(["dot-0", "dot-2"]);
        const a = await point("dot-0"),
          b = await point("dot-2");
        await page.mouse.move(a.x, a.y);
        await page.keyboard.press("Control+q");
        await selected(["dot-2"]);
        await page.mouse.move(b.x, b.y);
        await page.keyboard.press("Shift+q");
        await selected(["dot-0", "dot-1", "dot-2"]);
        await noPopup();
      },
    );
    await check(
      `${profile}: Q settings/Esc and returning to a target menu retain selection`,
      async () => {
        const p = await point("dot-1");
        await page.mouse.move(p.x, p.y);
        await page.keyboard.press("q");
        await page.keyboard.press("q");
        await page
          .getByRole("dialog", { name: "Visual selection controller", exact: true })
          .waitFor();
        await page.keyboard.press("Escape");
        await page
          .getByRole("dialog", { name: "Visual selection controller", exact: true })
          .waitFor({ state: "hidden" });
        await selected(["dot-0", "dot-1", "dot-2"]);
        await clickOwner("dot-1", { button: "right" });
        await page
          .getByRole("dialog", { name: "Master controller — Target freedoms", exact: true })
          .waitFor();
        await closeDials(["dot-0", "dot-1", "dot-2"]);
      },
    );
    await check(
      `${profile}: explicit Rotation shortcut/repeat/config preserves its target`,
      async () => {
        await pick("line");
        await selected(["line"]);
        await page.keyboard.press("r");
        await page
          .getByRole("dialog", { name: "Master controller — Rotation", exact: true })
          .waitFor();
        await selected(["line"]);
        await page.keyboard.press("r");
        await selected(["line"]);
        await closeDials(["line"]);
      },
    );
    await check(`${profile}: Master Controller retains the Composer shortcut target`, async () => {
      await page.getByText("Geometry · 1 selected", { exact: true }).click();
      await page.keyboard.press("r");
      await page
        .getByRole("dialog", { name: "Master controller — Rotation", exact: true })
        .waitFor();
      await selected(["line"]);
      await closeDials(["line"]);
    });
    await check(`${profile}: native text input does not invoke Composer shortcuts`, async () => {
      const name = page.getByRole("textbox", { name: "Node name", exact: true });
      await name.fill("r");
      await page.keyboard.press("r");
      assert.equal(await name.inputValue(), "rr");
      await noPopup();
      await name.fill("Interaction fixture");
      await pick("line");
      await selected(["line"]);
    });
    await check(
      `${profile}: explicit reference picking restores accepted selection on accept/cancel`,
      async () => {
        await clickOwner("line", { button: "right" });
        await page
          .locator(
            '.contextual-master-controller [data-ui-function="omnic:target-dof:omnic.angle"]',
          )
          .click();
        await page.waitForFunction(async () =>
          (await import("/src/featureActions.ts")).featureActionRuntime.available(
            "selector.confirm",
          ),
        );
        await page.keyboard.press("Escape");
        await selected(["line"]);
        await closeDials(["line"]);
        await clickOwner("line", { button: "right" });
        await page
          .locator(
            '.contextual-master-controller [data-ui-function="omnic:target-dof:omnic.angle"]',
          )
          .click();
        await page.waitForFunction(async () =>
          (await import("/src/featureActions.ts")).featureActionRuntime.available(
            "selector.confirm",
          ),
        );
        await page.mouse.click(1000, 30);
        assert.equal(
          await page.evaluate(async () =>
            (await import("/src/featureActions.ts")).featureActionRuntime.available(
              "selector.confirm",
            ),
          ),
          true,
          "an outside pick must leave the reference request available",
        );
        await selected(["line"]);
        await clickOwner("line");
        await selected(["line"]);
        await page.waitForFunction(
          async () =>
            !(await import("/src/featureActions.ts")).featureActionRuntime.available(
              "selector.confirm",
            ),
        );
        await closeDials(["line"]);
      },
    );
    await check(
      `${profile}: repeated right-click and empty dismissal do not draw or edit`,
      async () => {
        await clickOwner("line", { button: "right" });
        await page
          .getByRole("dialog", { name: "Master controller — Target freedoms", exact: true })
          .waitFor();
        await clickOwner("line", { button: "right" });
        await selected(["line"]);
        const b = await page.locator(".atomnic-surface").boundingBox();
        await page.mouse.click(b.x + b.width * 0.2, b.y + b.height * 0.2);
        await noPopup();
        assert.deepEqual(await shape(), baseline);
      },
    );
    await check(
      `${profile}: Escape after editor closure clears selection before collapsing Composer`,
      async () => {
        await page.keyboard.press("Escape");
        await selected([]);
        assert.equal(await page.locator(".atomnic-surface").isVisible(), true);
        await noPopup();
      },
    );
  }
  const chord = "Control+Alt+Shift+r",
    savedChord = "Ctrl+Alt+Shift+R",
    settings = defaultSettings();
  settings.bindings["atomnic.rotate"] = savedChord;
  await fixture(true, settings);
  await check(
    "Ctrl/Alt/Shift DOF combination opens its editor and repeats into configuration",
    async () => {
      await pick("line");
      await page.keyboard.press(chord);
      await page
        .getByRole("dialog", { name: "Master controller — Rotation", exact: true })
        .waitFor();
      await selected(["line"]);
      await page.keyboard.press(chord);
      await selected(["line"]);
      await closeDials(["line"]);
    },
  );
  await check("Modified DOF binding keeps its source while using Master Controller", async () => {
    await page.getByText("Geometry · 1 selected", { exact: true }).click();
    await page.keyboard.press(chord);
    await page.getByRole("dialog", { name: "Master controller — Rotation", exact: true }).waitFor();
    await selected(["line"]);
    await closeDials(["line"]);
  });
  await check("Modifier assignment survives reload without stealing selection", async () => {
    assert.equal(
      await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)).bindings["atomnic.rotate"],
        SETTINGS_KEY,
      ),
      savedChord,
    );
    await page.reload();
    await page
      .getByRole("navigation", { name: "Node hierarchy" })
      .getByRole("button", { name: "Interaction fixture", exact: true })
      .first()
      .click({ timeout: 30000 });
    await page
      .locator('[data-ui-function="omnic.open"]')
      .first()
      .evaluate((e) => e.click());
    await page.locator(".atomnic-surface").waitFor({ timeout: 30000 });
    await pick("line");
    await page.keyboard.press(chord);
    await page.getByRole("dialog", { name: "Master controller — Rotation", exact: true }).waitFor();
    await selected(["line"]);
    await closeDials(["line"]);
  });
  const collision = defaultSettings();
  collision.bindings["atomnic.rotate"] = "Ctrl+Alt+R";
  collision.bindings.selectAll = "Ctrl+Alt+R";
  await fixture(true, collision);
  await check(
    "Composer modifier command wins a same-key global action, including Master Controller",
    async () => {
      assert.equal(
        await page.evaluate(
          (key) => JSON.parse(localStorage.getItem(key)).bindings.selectAll,
          SETTINGS_KEY,
        ),
        "Ctrl+Alt+R",
      );
      await pick("line");
      await page.keyboard.press("Control+Alt+r");
      await page
        .getByRole("dialog", { name: "Master controller — Rotation", exact: true })
        .waitFor();
      await selected(["line"]);
      await closeDials(["line"]);
      await page.getByText("Geometry · 1 selected", { exact: true }).click();
      await page.keyboard.press("Control+Alt+r");
      await page
        .getByRole("dialog", { name: "Master controller — Rotation", exact: true })
        .waitFor();
      await selected(["line"]);
      await closeDials(["line"]);
    },
  );
  const entryCollision = defaultSettings();
  entryCollision.bindings["atomnic.rotate"] = "Q";
  await fixture(true, entryCollision);
  await check("MS entry retains priority over a retained same-key DOF after Escape", async () => {
    await pick("line");
    await page.keyboard.press("q");
    await page.locator('[data-tool-cursor-owner="visual-selector"]').waitFor();
    await noPopup();
    await pick("dot-0", ["Control"]);
    await selected(["dot-0", "line"]);
    await page.keyboard.press("Escape");
    await selected([]);
    await pick("line");
    await page.keyboard.press("q");
    await page.locator('[data-tool-cursor-owner="visual-selector"]').waitFor();
    await noPopup();
    await page.keyboard.press("q");
    await page.getByRole("dialog", { name: "Visual selection controller", exact: true }).waitFor();
  });
  assert.deepEqual(report.errors, [], "no runtime errors");
  console.log(`PASS ${report.checks.length} interaction sequences`);
} catch (error) {
  report.failure = { check: current, message: error.stack };
  if (page) {
    await page.screenshot({ path: `${output}/failure.png` });
    report.dialogs = await popup().allTextContents();
  }
  console.error(JSON.stringify(report.failure));
  process.exitCode = 1;
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2) + "\n");
  await browser.close();
}
