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
import { valueFor, createValueResolver, resolveControllerAppearance, effectsFor } from "../src/appearance/resolve.ts";
import { defaultSettings, normalizeSettings } from "../src/workspaceActions.ts";
import { parseThemeTemplate, themeTemplate } from "../src/themeTemplates.ts";
import { applySelectedValue, partEditable, resetSelectedParts, selectedPartId, selectedPartTarget } from "../src/appearance/selectionCoupling.ts";
import { normalizePartScope, partSelector, scopeContains } from "../src/appearance/partScope.ts";
import { lineBoxInterval, lineDomain, relativePoint, absolutePoint, paintStopDomain, nextPatternMode, toggleSelectionRegion, regionAllows, pathTouchesBox, pathVertices } from "../src/appearance/selectionGeometry.ts";
import { partAt, boundaryInRegion, matchingVisualParts, resolveVisualSelection, selectionLineGuide } from "../src/appearance/visualSelection.ts";

test("inside and outside toggle independently through all four combinations", () => {
  for (const [current, side, expected] of [
    [null, "inside", "inside"], [null, "outside", "outside"],
    ["inside", "outside", "both"], ["outside", "inside", "both"],
    ["both", "inside", "outside"], ["both", "outside", "inside"],
    ["inside", "inside", null], ["outside", "outside", null],
  ]) assert.equal(toggleSelectionRegion(current, side), expected);
  assert.equal(regionAllows("both", true), true);
  assert.equal(regionAllows("both", false), true);
  assert.equal(regionAllows("inside", false), false);
  assert.equal(regionAllows("outside", true), false);
});

test("axis, ray and position geometry includes touched endpoints without selecting a rectangle", () => {
  const start = { x: 10, y: 10 }, end = { x: 20, y: 10 };
  const box = (left, top, right, bottom) => ({ left, top, right, bottom });
  assert.deepEqual(lineBoxInterval(start, end, box(0, 5, 5, 15), lineDomain({ mode: "axis", bounded: false })), [-1, -.5]);
  assert.equal(lineBoxInterval(start, end, box(0, 5, 5, 15), lineDomain({ mode: "direction", bounded: false })), null);
  assert.deepEqual(lineBoxInterval(start, end, box(20, 10, 30, 20), lineDomain({ mode: "position", bounded: false })), [1, 1]);
  assert.equal(lineBoxInterval(start, end, box(25, 5, 30, 15), lineDomain({ mode: "axis", bounded: true })), null);
  assert.equal(lineBoxInterval(start, { x: 20, y: 20 }, box(10, 18, 12, 20), [0, 1]), null);
  assert.equal(lineBoxInterval(start, start, box(0, 0, 30, 30), [-Infinity, Infinity]), null);
  const local = relativePoint({ x: 50, y: 35 }, box(10, 10, 110, 60));
  assert.deepEqual(absolutePoint(local, box(110, 110, 310, 210)), { x: 190, y: 160 });
  assert.equal(nextPatternMode("pattern"), "axis");
  assert.equal(nextPatternMode("axis"), "direction");
  assert.equal(nextPatternMode("direction"), "position");
});

test("closed geometry separates its contour, interior and exterior; disabled sides only remove edge intersections", () => {
  const box = (left, top, right, bottom) => ({ left, top, right, bottom });
  const owner = box(0, 0, 100, 100);
  const rectangle = { kind: "rectangle", points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], closed: true };
  assert.equal(pathTouchesBox(rectangle, owner, box(40, 40, 60, 60), true), false, "an outline does not include its interior");
  assert.equal(pathTouchesBox(rectangle, owner, box(40, 40, 60, 60), false, "inside"), true);
  assert.equal(pathTouchesBox(rectangle, owner, box(120, 40, 130, 60), false, "outside"), true);
  assert.equal(pathTouchesBox(rectangle, owner, box(40, 40, 60, 60), false, "outside"), false);
  assert.equal(pathTouchesBox(rectangle, owner, box(40, -2, 60, 2), true), true);
  const withoutTop = { ...rectangle, disabledEdges: [0] };
  assert.equal(pathTouchesBox(withoutTop, owner, box(40, -2, 60, 2), true), false);
  assert.equal(pathTouchesBox(withoutTop, owner, box(40, 98, 60, 102), true), true);
  assert.equal(pathTouchesBox(withoutTop, owner, box(40, 40, 60, 60), false, "inside"), true, "edge masks do not tear the fill");
  assert.deepEqual(pathVertices(rectangle, box(10, 20, 210, 120))[2], { x: 210, y: 120 }, "geometry follows its owner");
  const ellipse = { ...rectangle, kind: "ellipse" };
  assert.equal(pathTouchesBox(ellipse, owner, box(0, 0, 5, 5), true, "inside"), false, "ellipse excludes its bounding-box corners");
  assert.equal(pathTouchesBox(ellipse, owner, box(45, 45, 55, 55), false, "inside"), true);
  const triangle = { kind: "polygon", points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: .5, y: 1 }], closed: true };
  assert.equal(pathTouchesBox(triangle, owner, box(48, 48, 52, 52), false, "inside"), true);
  assert.equal(pathTouchesBox(triangle, owner, box(0, 80, 5, 85), false, "inside"), false);
  const open = { kind: "freehand", points: [{ x: 0, y: .5 }, { x: 1, y: .5 }], closed: false };
  assert.equal(pathTouchesBox(open, owner, box(40, 49, 60, 51), true), true);
  assert.equal(pathTouchesBox(open, owner, box(40, 49, 60, 51), false, "inside"), false, "open paths have no implicit interior");
  assert.equal(pathTouchesBox(open, owner, box(40, 80, 60, 90), false, "outside"), false, "open paths have no implicit exterior");
});

test("text hit detection recognizes a nested text host when pointer events target its parent", () => {
  const host = { contains: () => false };
  const button = { contains: node => node === host };
  const text = { key: "nested-text", role: "text", element: host,
    range: { getClientRects: () => [{ left: 10, right: 40, top: 10, bottom: 20 }] } };
  assert.equal(partAt([text], button, 15, 15), text);
  assert.equal(partAt([text], button, 15, 30), undefined, "the surrounding button is not text ink");
});

test("sampled-color termination stops each side at the nearest different peer, not a gap", () => {
  assert.deepEqual(paintStopDomain([
    { interval: [4, 5], paint: "white" }, { interval: [-3, -2], paint: "white" },
    { interval: [8, 9], paint: "black" }, { interval: [6, 7], paint: "red" },
    { interval: [-5, -4], paint: "red" }, { interval: [-.1, .1], paint: "black" },
  ], "white", [-Infinity, Infinity]), [-4, 6]);
});

test("geometric selection uses all touched roles, exact text lines, live boundary coordinates and later exceptions", t => {
  const previous = Object.fromEntries(["document", "innerWidth", "innerHeight", "getComputedStyle"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  t.after(() => { for (const [key, descriptor] of Object.entries(previous)) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
  } });
  let offset = 0;
  const box = (left, top, right, bottom) => ({ left: left + offset, top, right: right + offset, bottom });
  const root = { isConnected: true, closest: () => null, getClientRects: () => [box(0, 0, 200, 200)], getBoundingClientRect: () => box(0, 0, 200, 200),
    contains: element => element === root || element.parent === root };
  const app = { ...root, getBoundingClientRect: () => box(0, 0, 400, 400), contains: () => true };
  Object.assign(globalThis, { document: { body: app }, innerWidth: 400, innerHeight: 400,
    getComputedStyle: element => ({ visibility: "visible", color: element.paint ?? "white", backgroundColor: element.paint ?? "white",
      borderTopColor: element.paint ?? "white", borderTopWidth: "1", borderRightWidth: "1", borderBottomWidth: "1", borderLeftWidth: "1",
      getPropertyValue: () => "" }) });
  const part = (key, role, bounds, paint = "white", parent = root) => ({ key, role, target: { id: key },
    element: { parent, paint, hasAttribute: () => false, getClientRects: () => [box(...bounds)] } });
  const a = part("label", "text", [20, 30, 40, 40]);
  a.range = { getClientRects: () => [box(20, 30, 40, 40), box(20, 50, 40, 60)] };
  const b = part("icon", "icon", [60, 30, 70, 40]);
  const c = part("button", "background", [80, 30, 95, 40]);
  const gap = part("gap", "text", [20, 43, 40, 47]);
  const outside = part("outside", "icon", [220, 30, 230, 40], "white", app);
  const parts = [a, b, c, gap, outside], boundary = { element: root, key: "root" };
  const line = { mode: "position", bounded: false, start: { x: .1, y: .2 }, end: { x: .4, y: .2 } };
  const rule = { boundary, include: true, line };
  assert.deepEqual(matchingVisualParts(parts, rule).map(p => p.key), ["label", "icon", "button"], "all roles, including the touched endpoint");
  const axisScope = { ...rule, geometryId: "axis-work-set" };
  const narrow = { boundary: { element: app, key: "app" }, include: true, scope: axisScope, part: "label" };
  assert.deepEqual(resolveVisualSelection(parts, boundary, [{ ...rule, include: false }, narrow]).included.map(p => p.key), ["label"], "start with the axis excluded, then include one touched pattern");
  assert.deepEqual(resolveVisualSelection(parts, boundary, [{ ...rule, include: false }, { ...narrow, part: "outside" }]).included, [], "refinements cannot escape the axis");
  assert.deepEqual(matchingVisualParts(parts, { ...rule, contour: false }).map(p => p.key), [], "turning the contour off also disables line intersections");
  const leftShape = { boundary, path: { kind: "rectangle", points: [{ x: 0, y: 0 }, { x: .25, y: 1 }], closed: true }, contour: false, region: "inside" };
  const nested = { ...narrow, scope: { ...axisScope, scope: leftShape } };
  assert.deepEqual(matchingVisualParts(parts, { ...nested, part: undefined }).map(p => p.key), ["label"], "line refinements obey an enclosing shape as well as the line");
  const withinGap = { ...rule, role: "text", line: { ...line, start: { x: .1, y: .225 }, end: { x: .2, y: .225 } } };
  assert.deepEqual(matchingVisualParts(parts, withinGap).map(p => p.key), ["gap"], "text's blank inter-line box is not its ink");
  assert.deepEqual(resolveVisualSelection(parts, boundary, [rule, { boundary, include: false, part: "icon" }]).included.map(p => p.key), ["label", "button"]);
  assert.deepEqual(resolveVisualSelection(parts, boundary, [rule, { boundary, include: false, role: "text" }, { boundary, include: true, part: "label" }]).included.map(p => p.key), ["label", "icon", "button"]);
  assert.deepEqual(matchingVisualParts(parts, { ...rule, line: { ...line, mode: "axis" } }).map(p => p.key), ["label", "icon", "button"]);
  assert.deepEqual(matchingVisualParts(parts, { ...rule, region: "outside", line: { ...line, mode: "axis" } }).map(p => p.key), ["outside"]);
  const appBoundary = { element: app, key: "app" };
  assert.equal(boundaryInRegion(appBoundary, boundary, "inside"), false, "scrolling to app ancestor must not escape Inside");
  assert.equal(boundaryInRegion(appBoundary, boundary, "outside"), false, "ancestor must not flash Inside while working Outside");
  assert.equal(boundaryInRegion(boundary, boundary, "inside"), true);
  assert.equal(boundaryInRegion(boundary, boundary, "outside"), false);
  assert.deepEqual(matchingVisualParts(parts, { boundary: appBoundary, include: true, scope: { boundary, region: "inside" } }).map(p => p.key), ["label", "icon", "button", "gap"]);
  assert.deepEqual(matchingVisualParts(parts, { boundary: appBoundary, include: true, scope: { boundary, region: "outside" } }).map(p => p.key), ["outside"]);
  assert.equal(boundaryInRegion(appBoundary, boundary, "both"), true);
  assert.deepEqual(matchingVisualParts(parts, { boundary, include: true, region: "both" }).map(p => p.key), parts.map(p => p.key));
  assert.deepEqual(matchingVisualParts(parts, { boundary: appBoundary, include: true, scope: { boundary, region: "both" } }).map(p => p.key), parts.map(p => p.key));
  assert.deepEqual(matchingVisualParts(parts, { ...rule, region: "both", line: { ...line, mode: "axis" } }).map(p => p.key), ["label", "icon", "button", "outside"]);
  offset = 100;
  assert.deepEqual(matchingVisualParts(parts, rule).map(p => p.key), ["label", "icon", "button"], "line follows the moved owner");
  assert.deepEqual(selectionLineGuide(parts, rule), [{ x: 120, y: 40 }, { x: 180, y: 40 }]);
  offset = 0;
  const custom = { ...boundary, area: { left: .25, top: .1, right: .5, bottom: .25 } };
  assert.deepEqual(matchingVisualParts(parts, { boundary: custom, include: true }).map(p => p.key), ["icon", "button"]);
  const contour = part("frame edge", "contour", [0, 0, 100, 100]);
  assert.deepEqual(matchingVisualParts([contour], rule), [], "position inside frame never touches its outer contour");
  const red = part("red", "text", [110, 30, 120, 40], "red"), beyond = part("beyond", "text", [130, 30, 140, 40]);
  const stopped = { ...rule, role: "text", line: { ...line, mode: "direction", stopAtPaint: "white" } };
  assert.deepEqual(matchingVisualParts([a, red, beyond], stopped).map(p => p.key), ["label"], "color stop excludes its terminating peer and later matches");
  assert.deepEqual(selectionLineGuide([a, red, beyond], stopped), [{ x: 20, y: 40 }, { x: 110, y: 40 }]);
});
const fixture = () => {
  const state = emptyController();
  return { state, targets: controllerTargets(state) };
};
const selectedLabel = (owner, text = 0) => ({ base: "text.ui.buttons", owner: `function:${owner}`, label: `${owner} label`,
  path: ["window:panel:inspector"], part: { steps: [], text } });
test("selection edits write only accepted parts in one controller transaction and preserve targeting", () => {
  const state = emptyController(), a = selectedLabel("a"), b = selectedLabel("b"), excluded = selectedLabel("excluded");
  const before = structuredClone(state);
  const next = applySelectedValue(state, [a, b], "color", "#e01234");
  assert.deepEqual(state, before);
  assert.deepEqual(next.sets, state.sets);
  assert.deepEqual(Object.keys(next.instances).sort(), [selectedPartId(a), selectedPartId(b)].sort());
  assert.deepEqual(next.values[selectedPartId(a)], { color: "#e01234" });
  assert.equal(next.values[selectedPartId(excluded)], undefined);
  assert.equal(next.values["text.ui.buttons"], undefined);
  assert.deepEqual(next.refined[selectedPartId(a)], ["color"]);
  assert.equal(applySelectedValue(next, [a, b], "color", "#e01234"), next);
});
test("narrow parts inherit broader values independently and never inherit sibling text", () => {
  const state = emptyController(), a = selectedLabel("a"), sibling = selectedLabel("a", 1);
  const parent = "text.ui.buttons@@function%3Aa";
  state.instances[parent] = { base: a.base, owner: a.owner, label: "whole button", path: a.path };
  state.values[parent] = { color: "#123456", opacity: .65 };
  let next = applySelectedValue(state, [a], "glow", 1.5);
  assert.deepEqual(next.values[selectedPartId(a)], { glow: 1.5 });
  let target = controllerTargets(next).find(t => t.id === selectedPartId(a));
  const read = createValueResolver(defaultSettings().appearance, next);
  assert.equal(read(target, "color"), "#123456");
  next.values[parent].color = "#654321";
  assert.equal(read(target, "color"), "#654321");
  next = applySelectedValue(next, [sibling], "color", "#abcdef");
  target = controllerTargets(next).find(t => t.id === selectedPartId(a));
  assert.equal(valueFor(defaultSettings().appearance, next, target, "color"), "#654321");
  assert.equal(scopeContains(a, sibling), false);
});
test("selection respects categorical and existing owner locks and bypass without creating empty instances", () => {
  const a = selectedLabel("a"), b = selectedLabel("b");
  let state = emptyController();
  state.locks.text = { properties: ["color"] };
  assert.equal(applySelectedValue(state, [a, b], "color", "#123456"), state);
  delete state.locks.text;
  const parent = "parent";
  state.instances[parent] = { base: a.base, owner: a.owner, label: "parent" };
  state.locks[parent] = { all: true };
  const next = applySelectedValue(state, [a, b], "color", "#123456");
  assert.equal(next.instances[selectedPartId(a)], undefined);
  assert.equal(next.values[selectedPartId(b)].color, "#123456");
  state = emptyController(); state.disconnected["text.ui"] = { all: true };
  assert.equal(partEditable(state, a, "color"), false);
  assert.equal(applySelectedValue(state, [a], "color", "#123456"), state);
});
test("part capabilities limit glyph editing while surface adapters retain their supported properties", () => {
  const glyph = selectedLabel("a"), state = emptyController();
  assert.deepEqual(selectedPartTarget(glyph).properties, ["color", "brightness", "opacity", "glow"]);
  assert.equal(applySelectedValue(state, [glyph], "font", "serif"), state);
  const surface = { ...glyph, base: "ui.buttons.contour", part: { steps: [] } };
  const next = applySelectedValue(state, [surface], "contourWidth", 20);
  assert.equal(next.values[selectedPartId(surface)].contourWidth, 12);
  assert.equal(next.values["ui.buttons.contour"], undefined);
});
test("part addresses survive theme export/reload and malformed narrow scopes never broaden", () => {
  const a = selectedLabel("a"), state = applySelectedValue(emptyController(), [a], "color", "#abcdef");
  const appearance = { ...defaultSettings().appearance, controller: state };
  const restored = parseThemeTemplate(JSON.parse(JSON.stringify(themeTemplate("Selected", appearance)))).appearance.controller;
  assert.deepEqual(restored.instances[selectedPartId(a)].part, a.part);
  const target = controllerTargets(restored).find(t => t.id === selectedPartId(a));
  assert.equal(target.binding.selector, '[data-ui-function="a"]:not([data-ui-native-hidden])');
  assert.equal(valueFor(defaultSettings().appearance, restored, target, "color"), "#abcdef");
  const corrupt = structuredClone(state); corrupt.instances[selectedPartId(a)].part.steps = [{ tag: 'div,body', index: 1 }];
  assert.equal(loadController(corrupt).instances[selectedPartId(a)], undefined);
  assert.equal(normalizePartScope({ steps: [], text: -1 }), undefined);
  const keyed = index => normalizePartScope({ steps: [{ tag: "button", index, key: "data-ui-id", value: 'x"]{color:red}/*' }] });
  assert.deepEqual(keyed(1), keyed(8));
  assert.match(partSelector({ owner: 'function:a"b', part: keyed(1) }), /\\22 /);
});
test("resetting selected refinements preserves other parts and protects locked ones", () => {
  const a = selectedLabel("a"), b = selectedLabel("b");
  let state = applySelectedValue(emptyController(), [a, b], "color", "#abcdef");
  const reset = resetSelectedParts(state, [a]);
  assert.equal(reset.instances[selectedPartId(a)], undefined);
  assert.deepEqual(reset.values[selectedPartId(b)], state.values[selectedPartId(b)]);
  state.locks[selectedPartId(a)] = { properties: ["color"] };
  assert.equal(resetSelectedParts(state, [a]), state);
});
test("target off/only/on changes only the editing mask and restores other targets", () => {
  let { state, targets } = fixture();
  state = applyValue(state, targets, "color", "#8844cc", "text");
  const before = structuredClone(state.values);
  state = cycleTarget(state, targets, "text");
  assert.equal(included(state.sets[0], targets, "text.ui.buttons"), false);
  state = cycleTarget(state, targets, "text");
  assert.equal(included(state.sets[0], targets, "text.ui.buttons"), true);
  assert.equal(included(state.sets[0], targets, "ui.buttons.background"), false);
  state = cycleTarget(state, targets, "text");
  assert.equal(included(state.sets[0], targets, "ui.buttons.background"), true);
  assert.equal(included(state.sets[0], targets, "text.ui.buttons"), true);
  assert.deepEqual(state.values, before);
});
test("inherited exclusions cycle correctly and targeting sets remember independent adjustments", () => {
  let { state, targets } = fixture();
  state = cycleTarget(state, targets, "text");
  state = cycleTarget(state, targets, "text.ui.buttons");
  assert.equal(state.sets[0].only, "text.ui.buttons");
  state = cycleTarget(state, targets, "text.ui.buttons");
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
  assert.equal(state.values["text.ui.buttons"], undefined);
  assert.equal(state.values["ui.buttons.background"].color, "#abcdef");
  state = applyValue(state, targets, "color", "#123456", "text");
  assert.equal(state.values["text.ui.buttons"].color, "#123456");
  state = toggleRule(state, "locks", "text.ui.buttons");
  state = applyValue(state, targets, "color", "#654321", "text");
  assert.equal(state.values["text.ui.buttons"].color, "#123456");
  state = applyValue(state, targets, "color", "#fedcba", "text.ui.buttons");
  assert.equal(state.values["text.ui.buttons"].color, "#fedcba");
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
  state = toggleRule(state, "disconnected", "workspace.background");
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
  state = toggleRule(state, "disconnected", "workspace.background");
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
  for (const [id, parent] of [
    ["text.nodes", "omnium.nodes"], ["text.binders", "omnium.binders"],
    ["symbols.nodes", "omnium.nodes"], ["symbols.binders", "omnium.binders"],
    ["symbols.ui", "ui"], ["workspace.background", "all"],
  ]) assert.equal(targets.find(t => t.id === id).parent, parent);
  assert.ok(!targets.some(t => t.id === "symbols" || t.id === "workspace"));
  state = applyValue(state, targets, "effect", "electric-text", "text");
  base.controller = state;
  const resolved = resolveControllerAppearance(base);
  assert.notEqual(effectsFor(resolved, "text.nodes").effect, "electric-text");
  assert.equal(effectsFor(resolved, "text.ui.buttons").effect, "electric-text");
  assert.notEqual(effectsFor(resolved, "omnium.nodes.body").effect, "electric-text");
  state = applyValue(state, targets, "effect", "electric-text", "all");
  assert.equal(state.values["omnium.nodes.body"]?.effect, undefined);
  state = toggleRule(state, "locks", "omnium.nodes", "effect");
  state = applyValue(state, targets, "effect", "off");
  assert.equal(state.values["text.nodes"].effect, "electric-text");
  const withoutFormatting = structuredClone(state.values["text.nodes"]);
  state = applyValue(state, targets, "speed", 0.8, "text.nodes");
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

// Appearance recovery is a persistence boundary, so verify it without a browser suite.
import { emptyUILayout } from "../src/ui/layout.ts";
import { startSession, currentState, editSession, applySession, travelSession } from "../src/appearance/session.ts";
import { appendCheckpoint, parseCheckpoints, safeAppearance } from "../src/appearance/checkpoints.ts";
import { PROPERTY_TREE, propertyPath } from "../src/appearance/propertyTree.ts";
import { PROPERTIES, validateProperty } from "../src/appearance/registry.ts";

test("appearance previews never enter saved settings; Apply is one undo step", () => {
  const initial = { layout: emptyUILayout(), settings: defaultSettings() };
  let session = startSession(initial);
  for (const accent of ["#8844aa", "#ff0000", "#000000"]) {
    const current = currentState(session);
    session = editSession(session, { ...current, settings: { ...current.settings, appearance: { ...current.settings.appearance, accent } } });
  }
  assert.deepEqual(session.saved.present, initial);
  assert.equal(session.saved.past.length, 0);
  assert.equal(currentState(session).settings.appearance.accent, "#000000");
  session = travelSession(session, "undo", 2);
  assert.equal(currentState(session).settings.appearance.accent, "#8844aa");
  session = travelSession(session, "redo", 2);
  const applied = applySession(session);
  assert.equal(applied.draft, null);
  assert.equal(applied.saved.past.length, 1);
  assert.equal(travelSession(applied, "undo").saved.present.settings.appearance.accent, initial.settings.appearance.accent);
  assert.equal(travelSession(travelSession(applied, "undo"), "redo").saved.present.settings.appearance.accent, "#000000");
});

test("layout and controls save independently; discard preserves them and prior appearance", () => {
  const initial = { layout: emptyUILayout(), settings: defaultSettings() };
  let session = startSession(initial);
  session = editSession(session, { ...initial, settings: { ...initial.settings, appearance: { ...initial.settings.appearance, opacity: 0 } } });
  const pending = currentState(session);
  session = editSession(session, { layout: { ...pending.layout, panels: { "@theme": false } }, settings: { ...pending.settings, isolateFocus: true } });
  assert.equal(session.saved.present.settings.appearance.opacity, 1);
  assert.equal(session.saved.present.layout.panels["@theme"], false);
  assert.equal(session.saved.present.settings.isolateFocus, true);
  const discarded = currentState({ ...session, draft: null });
  assert.equal(discarded.settings.appearance.opacity, 1);
  assert.equal(discarded.settings.isolateFocus, true);
  assert.deepEqual(discarded.layout, session.saved.present.layout);
  // Applying a live picker preview also preserves its latest value atomically.
  const applied = applySession(session, { ...pending.settings.appearance, accent: "#123456" });
  assert.equal(applied.saved.present.settings.appearance.accent, "#123456");
});

test("checkpoints retain the newest ten normalized snapshots and allow named manual saves", () => {
  const appearance = defaultSettings().appearance;
  let checkpoints = appendCheckpoint([], appearance, "Original");
  const original = structuredClone(checkpoints[0]);
  assert.equal(appendCheckpoint(checkpoints, appearance), checkpoints);
  checkpoints = appendCheckpoint(checkpoints, appearance, "Named save", true);
  assert.equal(checkpoints.length, 2);
  for (let i = 0; i < 15; i++) checkpoints = appendCheckpoint(checkpoints, { ...appearance, glow: i / 20 }, `Save ${i}`);
  assert.equal(checkpoints.length, 10);
  assert.equal(checkpoints[0].name, "Save 5");
  assert.equal(checkpoints.at(-1).name, "Save 14");
  assert.deepEqual(parseCheckpoints(JSON.parse(JSON.stringify(checkpoints))), checkpoints);
  assert.deepEqual(original.appearance, normalizeSettings({ appearance }).appearance);
  assert.equal(parseCheckpoints([null, { id: "broken" }, ...checkpoints, checkpoints[0]]).length, 10);
  const safe = safeAppearance();
  assert.equal(safe.effect, "off");
  assert.equal(safe.opacity, 1);
  assert.equal(safe.font, "system");
  assert.deepEqual(safe.controller.values, {});
});

test("each registered adjuster has one property node; styles apply only to supported renderer targets", () => {
  const flatten = nodes => nodes.flatMap(node => [...(node.property ? [node.property] : []), ...flatten(node.children ?? [])]);
  const ids = flatten(PROPERTY_TREE);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual([...ids].sort(), PROPERTIES.map(p => p.id).sort());
  assert.deepEqual(propertyPath("effectColor"), ["effect", "effectAppearance", "effectColor"]);
  assert.deepEqual(propertyPath("textSpacing"), ["font", "textSpacing"]);
  const targets = controllerTargets(emptyController());
  assert.ok(targets.find(t => t.id === "text.ui.buttons").properties.includes("textSize"));
  assert.ok(!targets.find(t => t.id === "text.nodes").properties.includes("textSize"));
  assert.ok(targets.find(t => t.id === "omnium.binders.path").properties.includes("contourWidth"));
  assert.ok(!targets.find(t => t.id === "symbols.nodes").properties.includes("saturation"));
  assert.equal(validateProperty("gradient", true), true);
  assert.equal(validateProperty("gradient", "true"), undefined);
  assert.equal(validateProperty("contourWidth", 50), 12);
});
