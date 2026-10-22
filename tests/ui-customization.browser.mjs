import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const b = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
try {
  const p = await b.newPage({ viewport: { width: 1500, height: 1050 } });
  p.setDefaultTimeout(6000);
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(process.env.ATLAS_URL || "http://127.0.0.1:5173/");
  const master = p.getByRole("region", { name: "Master controller" });
  await master.waitFor();
  if (await p.getByRole("button", { name: "Visuals", exact: true }).getAttribute("aria-expanded") === "false") await p.getByRole("button", { name: "Visuals", exact: true }).click();
  const animation = master.locator(
    '[data-property-node="effect"] > .property-node-heading .property-node-name',
  );
  await animation.waitFor();
  await p.waitForFunction(() =>
    document
      .querySelector('[data-property-node="effect"] > .property-node-heading .property-node-name')
      ?.dataset.uiDrag?.startsWith("window:property:"),
  );
  await animation.click({ button: "right" });
  const frameMenu = p.getByRole("menu", { name: "UI frame settings" });
  await frameMenu.waitFor();
  await frameMenu.getByRole("button", { name: "Frame handle appearance", exact: true }).click();
  const dialog = p.locator(".function-appearance");
  await dialog.waitFor();
  assert.match(await dialog.locator(".ui-frame-handle").first().innerText(), /Animation/);
  await dialog.getByLabel("Frame handle display", { exact: true }).selectOption("icon");
  await dialog.getByLabel("Frame handle symbol", { exact: true }).fill("A");
  await p.keyboard.press("Escape");
  assert.equal(await animation.evaluate((e) => e.classList.contains("function-icon")), true);
  assert.match(await animation.innerText(), /A/);
  // Property clicks still expand after icon conversion.
  await animation.click();
  await master.getByRole("group", { name: "Adjust selected effect", exact: true }).waitFor();
  const choice = master
    .getByRole("group", { name: "Adjust selected effect", exact: true })
    .getByRole("button", { name: "Falling stars / snow", exact: true });
  await choice.click({ button: "right" });
  await dialog.waitFor();
  assert.match(await dialog.locator(".ui-frame-handle").first().innerText(), /Falling stars/);
  await dialog.getByLabel("Function display", { exact: true }).selectOption("icon");
  await dialog.getByLabel("Function symbol", { exact: true }).fill("S");
  await p.keyboard.press("Escape");
  await choice.click();
  await p.getByRole("complementary", { name: "Appearance preview" }).waitFor();
  // A future window and plain button require no registry code or component wrapper.
  await p.evaluate(() => {
    const frame = document.createElement("section");
    frame.dataset.uiResidentRoot = "window:future-feature";
    frame.style.cssText = "position:fixed;left:400px;top:80px;z-index:500";
    const button = document.createElement("button");
    button.textContent = "Future feature action";
    button.dataset.uiId = "future-action";
    button.onclick = () => {
      window.futureClicks = (window.futureClicks || 0) + 1;
    };
    frame.append(button);
    document.body.append(frame);
  });
  const future = p
    .getByRole("button", { name: "Future feature action", exact: true })
    .filter({ visible: true })
    .first();
  await p.waitForFunction(
    () => document.querySelector('[data-ui-id="future-action"]')?.dataset.uiFunction,
  );
  const fid = await future.getAttribute("data-ui-function");
  await future.click({ button: "right" });
  await dialog.waitFor();
  assert.match(
    await dialog.locator(".ui-frame-handle").first().innerText(),
    /Future feature action/,
  );
  await dialog.getByLabel("Function display", { exact: true }).selectOption("icon");
  await dialog.getByLabel("Function symbol", { exact: true }).fill("F");
  await p.keyboard.press("Escape");
  await future.click();
  assert.equal(await p.evaluate(() => window.futureClicks), 1);
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem("omnium.ui.layout.v1")));
  assert.equal(saved.windows["property:master:effect"].chrome.style.character, "A");
  assert.equal(saved.items[fid].style.character, "F");
  assert.equal(saved.windows.theme?.chrome?.style?.character, undefined);
  // Replacing DOM as a future component remount does keeps its stable customization.
  await p.evaluate(() => {
    const previous = document.querySelector('[data-ui-id="future-action"]');
    const replacement = document.createElement("button");
    replacement.textContent = "Future feature action";
    replacement.dataset.uiId = "future-action";
    replacement.onclick = () => window.futureClicks++;
    previous.replaceWith(replacement);
  });
  await p.waitForFunction(() =>
    document.querySelector('[data-ui-id="future-action"]')?.hasAttribute("data-ui-native-icon"),
  );
  assert.equal(
    await p.locator('[data-ui-id="future-action"]').getAttribute("data-ui-function"),
    fid,
  );
  await p.evaluate(() => {
    const button = document.createElement("button");
    button.textContent = "Unregistered expandable group";
    button.setAttribute("aria-expanded", "false");
    document.querySelector('[data-ui-resident-root="window:future-feature"]').append(button);
  });
  await p.waitForFunction(() =>
    [...document.querySelectorAll("button")].some(
      (button) =>
        button.textContent === "Unregistered expandable group" && button.dataset.uiAutoAction,
    ),
  );
  assert.equal(
    await p
      .getByRole("button", { name: "Unregistered expandable group", exact: true })
      .evaluate((button) => button.draggable),
    false,
  );
  assert.deepEqual(errors, []);
  console.log(
    "Theme property and effect buttons customize individually; behavior is preserved; an unregistered future-window action automatically customizes, persists and survives remount.",
  );
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await b.close();
}
