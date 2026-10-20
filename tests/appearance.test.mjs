import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyController,
  applyValue,
  cycleTarget,
  included,
  toggleRule,
  connected,
} from "../src/appearance/model.ts";
import { controllerTargets, loadController } from "../src/appearance/registry.ts";
import { valueFor, resolveControllerAppearance, effectsFor } from "../src/appearance/resolve.ts";
import { defaultSettings, normalizeSettings } from "../src/workspaceActions.ts";
import { parseThemeTemplate, themeTemplate } from "../src/themeTemplates.ts";
const fixture = () => {
  const state = emptyController();
  return { state, targets: controllerTargets(state) };
};
test("target off/only/on changes only the editing mask and restores other targets", () => {
  let { state, targets } = fixture();
  state = applyValue(state, targets, "color", "#8844cc", "text");
  const before = structuredClone(state.values);
  state = cycleTarget(state, targets, "text");
  assert.equal(included(state.sets[0], targets, "text.nodes"), false);
  state = cycleTarget(state, targets, "text");
  assert.equal(included(state.sets[0], targets, "text.nodes"), true);
  assert.equal(included(state.sets[0], targets, "ui.buttons.background"), false);
  state = cycleTarget(state, targets, "text");
  assert.equal(included(state.sets[0], targets, "ui.buttons.background"), true);
  assert.equal(included(state.sets[0], targets, "text.nodes"), true);
  assert.deepEqual(state.values, before);
});
test("inherited exclusions cycle correctly and targeting sets remember independent adjustments", () => {
  let { state, targets } = fixture();
  state = cycleTarget(state, targets, "text");
  state = cycleTarget(state, targets, "text.nodes");
  assert.equal(state.sets[0].only, "text.nodes");
  state = cycleTarget(state, targets, "text.nodes");
  assert.equal(included(state.sets[0], targets, "ui.buttons.background"), true);
  state = applyValue(state, targets, "color", "#112233");
  state.sets.push({ id: "second", name: "Second", selection: {} });
  state.activeSet = "second";
  state = applyValue(state, targets, "color", "#abcdef");
  assert.equal(state.sets[0].adjustments.color, "#112233");
  assert.equal(state.sets[1].adjustments.color, "#abcdef");
  assert.deepEqual(
    loadController(state).sets.map((s) => s.adjustments.color),
    ["#112233", "#abcdef"],
  );
});
test("category locks block ancestor propagation but allow direct edits and respect deeper locks", () => {
  let { state, targets } = fixture();
  state = toggleRule(state, "locks", "text");
  state = applyValue(state, targets, "color", "#abcdef");
  assert.equal(state.values["text.nodes"], undefined);
  assert.equal(state.values["ui.buttons.background"].color, "#abcdef");
  state = applyValue(state, targets, "color", "#123456", "text");
  assert.equal(state.values["text.nodes"].color, "#123456");
  state = toggleRule(state, "locks", "text.nodes");
  state = applyValue(state, targets, "color", "#654321", "text");
  assert.equal(state.values["text.nodes"].color, "#123456");
  state = applyValue(state, targets, "color", "#fedcba", "text.nodes");
  assert.equal(state.values["text.nodes"].color, "#fedcba");
});
test("property locks are independent and all locks cover future property IDs", () => {
  let { state, targets } = fixture();
  state = toggleRule(state, "locks", "ui.buttons", "color");
  state = applyValue(state, targets, "color", "#112233");
  state = applyValue(state, targets, "glow", 1.5);
  assert.equal(state.values["ui.buttons.background"].color, undefined);
  assert.equal(state.values["ui.buttons.background"].glow, 1.5);
  state = toggleRule(state, "locks", "ui.buttons");
  const future = targets.map((t) =>
    t.id === "ui.buttons.background"
      ? { ...t, properties: [...t.properties, "future-property"] }
      : t,
  );
  state = applyValue(state, future, "future-property", 42);
  assert.equal(state.values["ui.buttons.background"]["future-property"], undefined);
});
test("plugs bypass application without erasing values and reconnect restores effects", () => {
  const base = defaultSettings().appearance;
  let { state, targets } = fixture();
  state = applyValue(state, targets, "effect", "starfield", "workspace.background");
  state = toggleRule(state, "disconnected", "workspace");
  assert.equal(connected(state, targets, "workspace.background", "effect"), false);
  assert.equal(
    valueFor(
      base,
      state,
      targets.find((t) => t.id === "workspace.background"),
      "effect",
    ),
    "off",
  );
  assert.equal(state.values["workspace.background"].effect, "starfield");
  state = toggleRule(state, "disconnected", "workspace");
  assert.equal(
    valueFor(
      base,
      state,
      targets.find((t) => t.id === "workspace.background"),
      "effect",
    ),
    "starfield",
  );
});
test("individual refinements are references, overwritten only by eligible categorical edits", () => {
  let { state } = fixture();
  const id = "ui.windows.background@@window%3Atest";
  state.instances[id] = {
    base: "ui.windows.background",
    owner: "window:test",
    label: "Test",
    path: ["window:test"],
  };
  state.values[id] = { color: "#123456" };
  state.refined[id] = ["color"];
  let targets = controllerTargets(state);
  const normalized = loadController(state);
  assert.equal(controllerTargets(normalized).filter((t) => t.id === id).length, 1);
  state = applyValue(state, targets, "color", "#999999", "ui.windows");
  assert.equal(state.values[id].color, "#999999");
  assert.deepEqual(state.refined[id], []);
  state = toggleRule(state, "locks", id);
  state = applyValue(state, targets, "color", "#ffffff");
  assert.equal(state.values[id].color, "#999999");
});
test("legacy settings retain authored defaults and controller/theme round trips preserve sets and rules", () => {
  const base = normalizeSettings({
    appearance: {
      accent: "#112233",
      nodes: { color: "#fedcba", opacity: 0.8, glow: 1 },
      effect: "starfield",
      density: 4,
      starSize: 3,
    },
  });
  assert.equal(base.appearance.accent, "#112233");
  assert.equal(base.appearance.nodes.color, "#fedcba");
  assert.deepEqual(base.appearance.controller.values, {});
  let state = base.appearance.controller;
  state = applyValue(state, controllerTargets(state), "brightness", 1.5, "text");
  state = toggleRule(state, "locks", "text", "color");
  base.appearance.controller = state;
  const restored = parseThemeTemplate(themeTemplate("Test", base.appearance));
  assert.deepEqual(restored.appearance.controller, loadController(state));
  assert.equal(restored.appearance.density, 4);
  const rendered = resolveControllerAppearance(base.appearance);
  assert.equal(rendered.nodes.color, "#fedcba");
  assert.equal(base.appearance.nodes.color, "#fedcba");
});

test("animations are properties of real branches, with independent text and surface rendering", () => {
  let { state, targets } = fixture();
  const base = defaultSettings().appearance;
  assert.equal(
    targets.some((t) => t.id === "vfx" || t.id.startsWith("vfx.")),
    false,
  );
  for (const id of [
    "text.nodes",
    "text.binders",
    "text.ui.buttons",
    "symbols.ui",
    "ui.windows.contour",
    "omnium.binders.path",
    "workspace.background",
  ])
    assert.ok(targets.find((t) => t.id === id).properties.includes("effect"));
  state = applyValue(state, targets, "effect", "electric-text", "text");
  base.controller = state;
  const resolved = resolveControllerAppearance(base);
  assert.equal(effectsFor(resolved, "text.nodes").effect, "electric-text");
  assert.equal(effectsFor(resolved, "text.ui.buttons").effect, "electric-text");
  assert.notEqual(effectsFor(resolved, "omnium.nodes.body").effect, "electric-text");
  state = applyValue(state, targets, "effect", "electric-text", "all");
  assert.equal(state.values["omnium.nodes.body"]?.effect, undefined);
  state = toggleRule(state, "locks", "text", "effect");
  state = applyValue(state, targets, "effect", "off");
  assert.equal(state.values["text.nodes"].effect, "electric-text");
  const withoutFormatting = structuredClone(state.values["text.nodes"]);
  state = applyValue(state, targets, "speed", 0.8, "text");
  assert.equal(state.values["text.nodes"].color, withoutFormatting.color);
});
test("old VFX values, locks, plugs and local references migrate without overwriting surface colors", () => {
  const state = emptyController();
  state.values["ui.windows.contour"] = { color: "#123456" };
  state.values["vfx.windows"] = { effect: "lightning", color: "#ee22aa", speed: 0.7 };
  state.locks.vfx = { all: true };
  state.disconnected["vfx.background"] = { all: true };
  const id = "vfx.windows@@window%3Atheme";
  state.instances[id] = {
    base: "vfx.windows",
    owner: "window:theme",
    label: "Theme",
    path: ["window:theme"],
  };
  state.values[id] = { color: "#ff00ff", intensity: 0.8 };
  state.refined[id] = ["color"];
  const migrated = loadController(state);
  assert.equal(migrated.values["ui.windows.contour"].color, "#123456");
  assert.equal(migrated.values["ui.windows.contour"].effectColor, "#ee22aa");
  assert.equal(migrated.values["ui.windows.contour"].effect, "lightning");
  assert.ok(migrated.locks["text.ui.titles"].properties.includes("effect"));
  assert.ok(migrated.disconnected["workspace.background"].properties.includes("effect"));
  const local = Object.keys(migrated.instances).find(
    (key) => migrated.instances[key].base === "ui.windows.contour",
  );
  assert.equal(migrated.instances[local].owner, "window:theme");
  assert.equal(migrated.values[local].effectColor, "#ff00ff");
  assert.ok(migrated.refined[local].includes("effectColor"));
  assert.equal(
    Object.keys(migrated.values).some((key) => key.startsWith("vfx")),
    false,
  );
  assert.deepEqual(loadController(migrated), migrated);
});
