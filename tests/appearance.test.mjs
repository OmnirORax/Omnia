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
import { valueFor, resolveControllerAppearance } from "../src/appearance/resolve.ts";
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
  state = applyValue(state, targets, "effect", "starfield", "vfx.background");
  state = toggleRule(state, "disconnected", "vfx");
  assert.equal(connected(state, targets, "vfx.background", "effect"), false);
  assert.equal(
    valueFor(
      base,
      state,
      targets.find((t) => t.id === "vfx.background"),
      "effect",
    ),
    "off",
  );
  assert.equal(state.values["vfx.background"].effect, "starfield");
  state = toggleRule(state, "disconnected", "vfx");
  assert.equal(
    valueFor(
      base,
      state,
      targets.find((t) => t.id === "vfx.background"),
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
