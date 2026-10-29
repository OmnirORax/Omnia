import { selectorPulseSettings } from "../src/appearance/selectorFeedback.ts";
import { selectionFeedbackVisible } from "../src/appearance/interactionHold.ts";
import { activityPreview } from "../src/appearance/activityPreview.ts";
import { createPropertyRegistry, selfInventory, resolvePropertyTarget } from "../src/properties/registry.ts";
import { registerHierarchyScene, scenePartAt, paintSceneSelection } from "../src/appearance/sceneFeedback.ts";
import { createElementEffectsResolver } from "../src/appearance/localEffects.ts";
import { describeSelectedParts } from "../src/appearance/selectedParts.ts";
import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyController,
  ancestry,
  applyValue,
  cycleTarget,
  included,
  toggleRule,
  connected,
} from "../src/appearance/model.ts";
import { controllerTargets, loadController, PROPERTY_REGISTRY } from "../src/appearance/registry.ts";
import { valueFor, createValueResolver, resolveControllerAppearance, effectsFor } from "../src/appearance/resolve.ts";
import { defaultSettings, normalizeSettings } from "../src/workspaceActions.ts";
import { parseThemeTemplate, themeTemplate } from "../src/themeTemplates.ts";
import { applySelectedValue, partEditable, resetSelectedParts, selectedPartId, selectedPartTarget } from "../src/appearance/selectionCoupling.ts";
import { normalizePartScope, partSelector, scopeContains } from "../src/appearance/partScope.ts";
import { lineBoxInterval, lineDomain, relativePoint, absolutePoint, paintStopDomain, nextPatternMode, toggleSelectionRegion, regionAllows, pathTouchesBox, pathVertices, conditionPoints, selectionWheelRotation } from "../src/appearance/selectionGeometry.ts";
import { workingGeometry, detectionGeometry, geometryBaseline, geometryMaskChange, selectionToggleRule, selectionRemovalRule } from "../src/appearance/selectionToggle.ts";
import { pointerInSelectionScope, partAt, boundaryInRegion, matchingVisualParts, resolveVisualSelection, selectionLineGuide, roleFor, partPaint } from "../src/appearance/visualSelection.ts";

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

test("line and closed-shape rotation uses screen-space angles in non-square owners", () => {
  const owner = { left: 0, top: 0, right: 200, bottom: 100 };
  const line = { mode: "position", start: { x: 0, y: .5 }, end: { x: 1, y: .5 }, bounded: true, rotation: 90 };
  const points = conditionPoints(line, owner);
  assert.deepEqual(points[0], { x: 0, y: 50 });
  assert.ok(Math.abs(points[1].x) < 1e-8 && Math.abs(points[1].y - 250) < 1e-8);
  for (const angle of [1, 25, 90, 180, 360, 725])
    assert.deepEqual(conditionPoints({ ...line, rotation: angle }, owner)[0], { x: 0, y: 50 }, "the stored line origin never drifts with rotation");
  const rectangle = { kind: "rectangle", closed: true, points: [{ x: .25, y: .25 }, { x: .75, y: .75 }], rotation: 90 };
  assert.equal(pathTouchesBox(rectangle, owner, { left: 99, right: 101, top: -1, bottom: 1 }, true), true);
});

test("Shift-wheel rotates armed axes before placement and working geometry after placement", () => {
  const event = { shiftKey: true, ctrlKey: false, deltaX: 0, deltaY: 50, deltaMode: 0 };
  for (const mode of ["axis", "direction", "position", "rectangle", "ellipse", "polygon", "freehand", "boundary"]) {
    assert.deepEqual(selectionWheelRotation(event, mode, false, 900), { target: "pending", degrees: 1 });
    assert.deepEqual(selectionWheelRotation(event, mode, true, 900), { target: "pending", degrees: 1 }, "a newly armed tool rotates instead of its enclosing boundary");
  }
  assert.deepEqual(selectionWheelRotation(event, "pattern", true, 900), { target: "placed", degrees: 1 });
  assert.equal(selectionWheelRotation(event, "item", false, 900), null);
  assert.equal(selectionWheelRotation({ ...event, shiftKey: false }, "axis", true, 900), null, "ordinary scroll/zoom is not captured");
  assert.deepEqual(selectionWheelRotation({ ...event, deltaX: -50, deltaY: 0 }, "axis", false, 900), { target: "pending", degrees: -1 }, "horizontal Shift-wheel deltas rotate too");
  assert.deepEqual(selectionWheelRotation({ ...event, deltaY: 1, deltaMode: 1 }, "axis", false, 900), { target: "pending", degrees: .32 });
  assert.deepEqual(selectionWheelRotation({ ...event, deltaY: 1, deltaMode: 2 }, "axis", false, 900), { target: "pending", degrees: 2 });
  assert.equal(selectionWheelRotation({ ...event, deltaY: 0 }, "axis", false, 900), null);
  assert.deepEqual(selectionWheelRotation({ ...event, ctrlKey: true }, "axis", false, 900), { target: "pending", degrees: 10 });
  assert.deepEqual(selectionWheelRotation({ ...event, ctrlKey: true, deltaY: -100 }, "pattern", true, 900), { target: "placed", degrees: -20 });
});

test("scene backgrounds use renderer hit tests, shared values and independent transient feedback", () => {
  const state = emptyController(), target = controllerTargets(state).find(target => target.id === "workspace.background");
  assert.equal(roleFor(target), "background");
  assert.ok(target.binding.selection.selector.includes("canvas"));
  const canvas = { contains: element => element === canvas };
  const part = { key: "world-background", element: canvas, role: "background", target };
  const paints = [], latePaints = [];
  const stop = registerHierarchyScene({ pulse: () => {}, clear: () => {},
    pick: (id, element, x) => id === target.id && element === canvas && x > 50,
    paint: id => id === target.id ? "rgb(3, 12, 21)" : undefined,
    selection: (targets, strength) => paints.push({ ids: [...targets.keys()], strength }) });
  let late;
  try {
    assert.equal(partAt([part], canvas, 60, 10), part, "empty world pixels resolve to the registered background");
    assert.equal(partAt([part], canvas, 20, 10), undefined, "scene objects reject background picking");
    assert.equal(partPaint(part), "rgb(3, 12, 21)", "sampling uses source renderer paint");
    const [selected] = describeSelectedParts([part]);
    assert.equal(selectedPartId(selected), target.id);
    assert.equal(selectedPartTarget(selected), target);
    const changed = applySelectedValue(state, [selected], "color", "#ff0000");
    assert.equal(changed.values[target.id].color, "#ff0000");
    assert.deepEqual(changed.instances, {}, "renderer targets must not manufacture DOM-local instances");
    assert.equal(resolveControllerAppearance({ ...defaultSettings().appearance, controller: changed }).background, "#ff0000");
    const locked = structuredClone(changed); locked.locks[target.id] = { all: true };
    assert.equal(applySelectedValue(locked, [selected], "color", "#00ff00"), locked);
    assert.equal(resetSelectedParts(changed, [selected]).values[target.id], undefined);
    paintSceneSelection(new Map([[target.id, { color: "#66efab", opacity: 1 }]]), .5);
    assert.deepEqual(paints.at(-1), { ids: [target.id], strength: .5 });
    late = registerHierarchyScene({ pulse: () => {}, clear: () => {}, selection: (targets, strength) => latePaints.push({ ids: [...targets.keys()], strength }) });
    assert.deepEqual(latePaints.at(-1), paints.at(-1), "late-mounted renderers inherit active transient selection feedback");
    paintSceneSelection(new Map(), 0);
    assert.deepEqual(paints.at(-1), { ids: [], strength: 0 });
    assert.deepEqual(state.values, {}, "detection and feedback never edit saved values");
  } finally { paintSceneSelection(new Map(), 0); late?.(); stop(); }
  assert.equal(scenePartAt(target.id, canvas, 60, 10), false, "unmounted renderer adapters cannot remain pickable");
});

test("Self inventory derives meta groups from shared couplings and includes future descendants", () => {
  const registry = createPropertyRegistry();
  registry.define({ id: "color", label: "Color", kind: "color", initial: "#000000" });
  const couple = (id, group) => registry.couple({ id, label: id, owner: "appearance", group, properties: [{ property: "color" }] });
  couple("ordinary", [{ id: "ui", label: "UI" }]);
  const path = [{ id: "ui", label: "UI" }, { id: "meta", label: "Meta", self: true }];
  couple("first", path);
  assert.deepEqual(selfInventory(registry).map(node => node.id), ["meta"]);
  assert.deepEqual(selfInventory(registry)[0].children.map(node => node.id), ["first"]);
  couple("future", [...path, { id: "new-subgroup", label: "New subgroup" }]);
  const [root] = selfInventory(registry);
  assert.deepEqual(root.consumers, ["first", "future"]);
  assert.deepEqual(root.children[1].children.map(node => node.id), ["future"], "coupling alone adds a future meta target without another inventory declaration");
  assert.deepEqual(resolvePropertyTarget(registry, root.id).consumers, root.consumers);
  assert.deepEqual(selfInventory(registry, consumer => consumer.id !== "future")[0].children.map(node => node.id), ["first"]);
  assert.equal(registry.definitions.length, 1, "inventory discovery creates no copied properties");
});

test("Mouse and Selector feedback inventory entries edit their existing independent consumers", () => {
  const definitions = PROPERTY_REGISTRY.definitions.length;
  const targets = controllerTargets(emptyController());
  const inventory = selfInventory(PROPERTY_REGISTRY, consumer => !targets.find(target => target.id === consumer.id)?.hidden);
  assert.deepEqual(inventory.find(node => node.id === "ui.mouse").consumers, ["ui.mouse.trail"]);
  const feedback = inventory.find(node => node.id === "ui.guides.selector");
  assert.deepEqual(feedback.children.map(node => node.id), ["ui.guides.selector.backgroundFill", "ui.guides.selector.contourStrength", "ui.guides.selector.pulse", "ui.guides.selector.included", "ui.guides.selector.excluded", "ui.guides.selector.boundary"]);
  for (const node of inventory) assert.ok(resolvePropertyTarget(PROPERTY_REGISTRY, node.id).consumers.length);
  const state = emptyController();
  const next = applyValue(state, targets, "color", "#aabbcc", "ui.guides.selector.included");
  assert.equal(next.values["ui.guides.selector.included"].color, "#aabbcc");
  assert.equal(next.values["ui.guides.selector.boundary"], undefined);
  assert.equal(next.values["ui.mouse.trail"], undefined);
  assert.deepEqual(next.instances, {});
  assert.equal(PROPERTY_REGISTRY.definitions.length, definitions);
  let tuned = applyValue(next, targets, "speed", .5, "ui.guides.selector.pulse");
  tuned = applyValue(tuned, targets, "intensity", .7, "ui.guides.selector.pulse");
  tuned = applyValue(tuned, targets, "pulse", false, "ui.guides.selector.pulse");
  const restored = loadController(JSON.parse(JSON.stringify(tuned)));
  const pulse = selectorPulseSettings(restored.values["ui.guides.selector.pulse"]);
  assert.equal(pulse.enabled, false);
  assert.equal(pulse.duration, 1300);
  assert.equal(pulse.depth, .7);
  assert.deepEqual(restored.values["ui.guides.selector.included"], next.values["ui.guides.selector.included"]);
  assert.equal(restored.values["ui.mouse.trail"], undefined);
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
  const typed = [
    { ...a, key: "title", target: { id: "text.ui.titles" } },
    { ...a, key: "label", target: { id: "text.ui.buttons" } },
    { ...c, key: "window-fill", target: { id: "ui.windows.background" } },
    { ...c, key: "button-fill", target: { id: "ui.buttons.background" } },
  ];
  const targetRule = target => ({ boundary, include: true, target });
  assert.deepEqual(matchingVisualParts(typed, targetRule("text.ui.titles")).map(part => part.key), ["title"], "hovered text subtype excludes sibling text types");
  assert.deepEqual(matchingVisualParts(typed, targetRule("ui.buttons.background")).map(part => part.key), ["button-fill"], "the same subtype rule applies to backgrounds");
  assert.deepEqual(matchingVisualParts(typed, targetRule("text.ui")).map(part => part.key), ["title", "label"], "an explicitly chosen parent includes its subtypes");
  const widened = selectionToggleRule(typed, [typed[0]], targetRule("text.ui"));
  assert.equal(widened.include, true, "a partially selected parent broadens rather than clearing its selected child");
  assert.equal(selectionToggleRule(typed, typed.slice(0, 2), targetRule("text.ui")).include, false, "a fully selected parent toggles off");
  assert.deepEqual(matchingVisualParts(typed, { ...targetRule("text.ui"), scope: { boundary: appBoundary, region: "outside" } }), [], "parent widening retains geometric constraints");
  const removeText = selectionRemovalRule(parts, [a, b], a, { boundary, role: "text" });
  assert.equal(removeText.include, false, "right-click removal cannot turn a mixed pattern on");
  const start = [{ boundary, part: a.key, include: true }, { boundary, part: b.key, include: true }];
  assert.deepEqual(resolveVisualSelection(parts, boundary, [...start, removeText]).included.map(part => part.key), [b.key]);
  assert.equal(selectionRemovalRule(parts, [a, b], c, { boundary, role: "background" }), null, "an unselected hovered target requests clear-all");
  assert.equal(selectionRemovalRule(parts, [a, b], undefined, { boundary }), null, "empty space requests clear-all");
  const individualRemoval = selectionRemovalRule(parts, [a, b], a, { boundary, part: b.key });
  assert.equal(individualRemoval.part, a.key, "nonmatching geometry falls back to the pointed selected part");
  const axisRemoval = selectionRemovalRule(parts, [a, b, outside], a, rule);
  assert.deepEqual(resolveVisualSelection(parts, appBoundary, [{ boundary: appBoundary, include: true }, axisRemoval]).included.map(part => part.key), [gap.key, outside.key], "axis removal follows its existing mathematical intersection");
  const outline = { boundary, path: { kind: "rectangle", points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], closed: true } };
  const defaultMask = { contour: true, region: null };
  let work = workingGeometry(outline, defaultMask);
  const baseline = geometryBaseline(work, defaultMask);
  const evaluate = rules => resolveVisualSelection(parts, boundary, rules);
  assert.deepEqual(evaluate(baseline), { included: [], excluded: [] }, "unchecked interiors start implicitly off without red paint everywhere");
  assert.deepEqual(matchingVisualParts(parts, { ...work, include: true }).map(p => p.key), [], "frame-only mode does not permit interior picks");
  work = workingGeometry(outline, { contour: false, region: "inside" });
  const individual = { boundary: appBoundary, scope: work, part: "label" };
  const on = selectionToggleRule(parts, evaluate(baseline).included, individual);
  assert.equal(on.include, true);
  const selected = [...baseline, on];
  assert.deepEqual(evaluate(selected).included.map(p => p.key), ["label"]);
  const off = selectionToggleRule(parts, evaluate(selected).included, individual);
  assert.equal(off.include, false);
  assert.deepEqual(evaluate([...selected, off]).included, [], "clicking the same target twice deselects it");
  const allMask = { contour: true, region: "inside" };
  const all = [...baseline, ...geometryMaskChange(work, allMask, "inside")];
  assert.deepEqual(evaluate(all).included.map(p => p.key), ["label", "icon", "button", "gap"], "Inside includes all contents");
  for (const role of ["text", "icon", "background"]) {
    const constraint = { boundary: appBoundary, scope: work, role };
    const remove = selectionToggleRule(parts, evaluate(all).included, constraint);
    assert.equal(remove.include, false, `included ${role} toggles off with the same action`);
    const after = [...all, remove];
    const restore = selectionToggleRule(parts, evaluate(after).included, constraint);
    assert.equal(restore.include, true);
    assert.deepEqual(evaluate([...after, restore]).included.map(p => p.key), evaluate(all).included.map(p => p.key));
  }
  const mixedText = selectionToggleRule(parts, evaluate(selected).included, { boundary: appBoundary, scope: work, role: "text" });
  assert.equal(mixedText.include, true, "a partially selected category fills rather than clearing its existing members");
  assert.deepEqual(evaluate([...all, ...geometryMaskChange(work, defaultMask, "inside")]).included, [], "turning Inside off restores its off baseline");
  const frame = { key: "frame", role: "background", target: { id: "frame" }, element: root };
  const framed = [frame, ...parts], pointed = { ...outline, ownerFrame: true };
  assert.deepEqual(matchingVisualParts(framed, { ...workingGeometry(pointed, { contour: false, region: "inside" }), include: true }).map(p => p.key), ["label", "icon", "button", "gap"], "inside-only excludes the frame itself");
  assert.deepEqual(matchingVisualParts(framed, { ...workingGeometry(pointed, { contour: true, region: null }), include: true }).map(p => p.key), ["frame"], "ring-only selects the frame itself");
  assert.deepEqual(matchingVisualParts(framed, { ...workingGeometry(pointed, { contour: false, region: "outside" }), include: true }).map(p => p.key), ["outside"], "outside-only excludes the frame and its interior");
  assert.equal(pointerInSelectionScope(work, a.element, { x: 30, y: 35 }), true);
  assert.equal(pointerInSelectionScope(work, a.element, { x: 225, y: 35 }), false, "a large hit part cannot leak preview beyond the actual geometry");
  const neutralMask = { contour: false, region: null };
  const neutralFrame = workingGeometry(pointed, neutralMask);
  const neutralRules = geometryBaseline(neutralFrame, neutralMask);
  assert.deepEqual(evaluate(neutralRules).included, [], "all-off defines a neutral frame, not an inclusion");
  const innerDetection = detectionGeometry(neutralFrame, neutralMask, a.element, { x: 30, y: 35 });
  const outerDetection = detectionGeometry(neutralFrame, neutralMask, outside.element, { x: 225, y: 35 });
  assert.deepEqual(matchingVisualParts(framed, { ...innerDetection, include: true }).map(p => p.key), ["label", "icon", "button", "gap"], "neutral detection follows the pointer inside");
  assert.deepEqual(matchingVisualParts(framed, { ...outerDetection, include: true }).map(p => p.key), ["outside"], "neutral detection follows the pointer outside");
  assert.deepEqual(evaluate(neutralRules).included, [], "switching detection sides does not select anything");
  const innerText = selectionToggleRule(parts, [], { boundary: appBoundary, scope: innerDetection, role: "text" });
  assert.deepEqual(evaluate([...neutralRules, innerText]).included.map(p => p.key), ["label", "gap"], "an accepted toggle retains its chosen side");
  assert.deepEqual(evaluate([...neutralRules, ...geometryMaskChange(neutralFrame, { contour: false, region: "inside" }, "inside")]).included.map(p => p.key), ["label", "icon", "button", "gap"], "pressing In-frame after neutral includes all interior parts");
  const neutralLine = workingGeometry(rule, neutralMask);
  assert.deepEqual(evaluate(geometryBaseline(neutralLine, neutralMask)).included, []);
  assert.deepEqual(matchingVisualParts(parts, { ...neutralLine, include: true }).map(p => p.key), ["label", "icon", "button"], "a neutral open line still detects its intersecting patterns");
  const independentOutside = { boundary: appBoundary, part: "outside", include: true };
  assert.deepEqual(evaluate([...all, independentOutside, ...geometryMaskChange(work, defaultMask, "inside")]).included.map(p => p.key), ["outside"], "changing one region preserves unrelated selections");
  const axisWork = workingGeometry(rule, { contour: true, region: null });
  const axisOff = [...geometryBaseline(axisWork, { contour: true, region: null }), { ...axisWork, include: false, implicit: true }];
  assert.deepEqual(evaluate(axisOff).included, []);
  assert.deepEqual(matchingVisualParts(parts, { ...axisWork, include: true }).map(p => p.key), ["label", "icon", "button"], "deselected intersections within the active line region remain pickable");
  const axisIcon = selectionToggleRule(parts, [], { boundary: appBoundary, scope: axisWork, role: "icon" });
  assert.deepEqual(evaluate([...axisOff, axisIcon]).included.map(p => p.key), ["icon"]);

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
test("complete selected text hosts expose fonts/effects while partial runs retain narrow capabilities", t => {
  const previous = Object.fromEntries(["document", "Node", "NodeFilter", "Highlight", "CSS"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  t.after(() => { for (const [key, descriptor] of Object.entries(previous)) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
  } });
  const root = { childNodes: [], getAttribute: key => key === "data-ui-function" ? "label" : null,
    closest: selector => selector === "[data-ui-resident-root]" ? null : root, querySelector: () => null };
  const a = { nodeType: 3, textContent: "Hello", parentElement: root }, b = { nodeType: 3, textContent: "World", parentElement: root };
  root.childNodes = [a, b];
  Object.assign(globalThis, { Highlight: function() {}, CSS: { highlights: {} }, Node: { TEXT_NODE: 3 }, NodeFilter: { SHOW_TEXT: 4 },
    document: { createTreeWalker: () => { let index = 0; return { nextNode: () => root.childNodes[index++] ?? null }; } } });
  const part = node => ({ key: node.textContent, role: "text", target: { id: "text.ui.buttons" }, element: root, range: { startContainer: node } });
  const partial = describeSelectedParts([part(a)])[0];
  assert.equal(partial.part.text, 0);
  assert.equal(selectedPartTarget(partial).properties.includes("font"), false);
  const [complete] = describeSelectedParts([part(a), part(b)]);
  assert.equal(complete.part.text, undefined);
  assert.equal(selectedPartTarget(complete).properties.includes("font"), true);
  assert.equal(selectedPartTarget(complete).properties.includes("effect"), true);
  const state = applySelectedValue(emptyController(), [complete], "font", "serif");
  assert.equal(state.values[selectedPartId(complete)].font, "serif");
});

test("paint-only local edits do not activate effect scans; local animation resolution is cached", t => {
  const old = Object.getOwnPropertyDescriptor(globalThis, "CSS");
  t.after(() => { if (old) Object.defineProperty(globalThis, "CSS", old); else delete globalThis.CSS; });
  globalThis.CSS = { escape: value => value };
  const raw = defaultSettings().appearance, glyph = selectedLabel("a");
  const color = { ...raw, controller: applySelectedValue(raw.controller, [glyph], "color", "#ff0000") };
  const target = controllerTargets(color.controller).find(target => target.id === "text.ui.buttons");
  const paint = createElementEffectsResolver(color, resolveControllerAppearance(color));
  assert.equal(paint.activeLocalBases.has(target.id), false);
  assert.ok(paint.forTarget(target).every(local => paint.localStyle(local).effect === "off"), "paint companions cannot start animations");
  const host = { ...glyph, part: { steps: [] } };
  const animated = { ...raw, controller: applySelectedValue(raw.controller, [host], "effect", "electric-text") };
  const plan = createElementEffectsResolver(animated, resolveControllerAppearance(animated));
  assert.equal(plan.activeLocalBases.has(target.id), true);
  const element = { closest: () => ({}), matches: () => true };
  const local = plan.forTarget(target)[0];
  assert.equal(plan.localStyle(local).effect, "electric-text");
  const first = plan.resolve(target, element);
  assert.equal(first.effect, "off", "exact text effects must not spill onto unselected nodes in the same host");
  assert.equal(plan.resolve(target, element), first, "steady frames reuse the resolved style");
  plan.invalidate();
  assert.notEqual(plan.resolve(target, element), first, "real DOM changes can invalidate ownership caches");
});

test("selection edits write only accepted parts in one controller transaction and preserve targeting", () => {
  const state = emptyController(), a = selectedLabel("a"), b = selectedLabel("b"), excluded = selectedLabel("excluded");
  const before = structuredClone(state);
  const next = applySelectedValue(state, [a, b], "color", "#e01234");
  assert.deepEqual(state, before);
  assert.deepEqual(next.sets, state.sets);
  assert.deepEqual(Object.keys(next.instances).sort(), [selectedPartId(a), selectedPartId(b)].sort());
  assert.deepEqual(next.values[selectedPartId(a)], { color: "#e01234", effectColor: "#e01234" });
  assert.equal(next.values[selectedPartId(excluded)], undefined);
  assert.equal(next.values["text.ui.buttons"], undefined);
  assert.deepEqual(next.refined[selectedPartId(a)], ["color", "effectColor"]);
  assert.equal(applySelectedValue(next, [a, b], "color", "#e01234"), next);
});
test("narrow parts inherit broader values independently and never inherit sibling text", () => {
  const state = emptyController(), a = selectedLabel("a"), sibling = selectedLabel("a", 1);
  const parent = "text.ui.buttons@@function%3Aa";
  state.instances[parent] = { base: a.base, owner: a.owner, label: "whole button", path: a.path };
  state.values[parent] = { color: "#123456", opacity: .65 };
  let next = applySelectedValue(state, [a], "glow", 1.5);
  assert.deepEqual(next.values[selectedPartId(a)], { glow: .8, effectGlow: .8 });
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
  const properties = selectedPartTarget(glyph).properties;
  for (const property of ["color", "brightness", "opacity", "glow", "effect", "speed", "effectColor"]) assert.ok(properties.includes(property));
  for (const property of ["font", "textSize", "textWeight", "textSpacing"]) assert.equal(properties.includes(property), false);
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
  assert.equal(state.values["ui.buttons.background"].glow, .8);
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
    ["text.nodes", "visual.role.text.omnium"], ["text.binders", "visual.role.text.omnium"],
    ["symbols.nodes", "visual.role.icons.omnium"], ["symbols.binders", "visual.role.icons.omnium"],
    ["symbols.ui", "visual.role.icons.ui"], ["workspace.background", "visual.role.backgrounds"],
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

test("layout-only actions preserve the existing settings and appearance renderer identities", () => {
  const initial = { layout: emptyUILayout(), settings: defaultSettings() };
  const session = editSession(startSession(initial), {
    ...initial, layout: { ...initial.layout, panels: { "@theme": true } },
  });
  assert.equal(session.draft, null, "opening a frame does not start an appearance investigation");
  assert.equal(currentState(session).settings, initial.settings);
  assert.equal(currentState(session).settings.appearance, initial.settings.appearance);
  assert.equal(session.saved.past.length, 1);
  assert.equal(travelSession(session, "undo").saved.present, initial);
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


test("editing an inactive consumer previews activation without authoring it or changing its neighbors", () => {
  const base = defaultSettings().appearance;
  const targets = controllerTargets(base.controller), trail = targets.find(t => t.id === "ui.mouse.trail");
  assert.equal(valueFor(base, base.controller, trail, "effect"), "off");
  const saved = JSON.stringify(base);
  const preview = activityPreview(base, [{ property: "color", targets: [trail] }]);
  assert.equal(valueFor(preview, preview.controller, trail, "effect"), "lightning");
  assert.equal(valueFor(preview, preview.controller, trail, "color"), valueFor(base, base.controller, trail, "color"));
  assert.deepEqual(Object.keys(preview.controller.values), [trail.id]);
  assert.equal(JSON.stringify(base), saved);
  assert.equal(activityPreview(base, []), base, "leaving the editor restores the original source");
  assert.equal(activityPreview(base, [{ property: "effect", targets: [trail] }]), base, "explicit Off is never overridden");
  const bypassed = { ...base, controller: toggleRule(base.controller, "disconnected", "ui.mouse") };
  assert.equal(activityPreview(bypassed, [{ property: "color", targets: [trail] }]), bypassed);
  const active = { ...base, controller: applyValue(base.controller, targets, "effect", "stars", trail.id) };
  assert.equal(activityPreview(active, [{ property: "speed", targets: [trail] }]), active, "retain the authored effect");
});

test("inactive animation previews stay scoped to an uncustomized selected part", () => {
  const base = defaultSettings().appearance;
  base.controller = applyValue(base.controller, controllerTargets(base.controller), "effect", "off", "text.ui.buttons");
  const part = { base: "text.ui.buttons", owner: "function:example", label: "Example", part: { steps: [], text: 0 } };
  const target = selectedPartTarget(part), saved = JSON.stringify(base);
  const preview = activityPreview(base, [{ property: "speed", targets: [target] }]);
  assert.equal(valueFor(preview, preview.controller, target, "effect"), "lightning");
  assert.equal(valueFor(preview, preview.controller, controllerTargets(base.controller).find(t => t.id === part.base), "effect"), "off");
  assert.deepEqual(Object.keys(preview.controller.instances), [target.id]);
  assert.equal(JSON.stringify(base), saved, "no persistent local customization is created");
  const bypassed = { ...base, controller: toggleRule(base.controller, "disconnected", part.base) };
  assert.equal(activityPreview(bypassed, [{ property: "speed", targets: [target] }]), bypassed);
});


test("shared property dependencies preview inactive gradients and restore them without saving the switch", () => {
  const base = defaultSettings().appearance, target = controllerTargets(base.controller).find(t => t.id === "ui.buttons.background");
  base.controller.values[target.id] = { gradient: false, gradientColor: "#ff0000" };
  const preview = activityPreview(base, [{ property: "gradientColor", targets: [target] }]);
  assert.equal(valueFor(preview, preview.controller, target, "gradient"), true);
  assert.equal(valueFor(preview, preview.controller, target, "gradientColor"), "#ff0000");
  assert.equal(base.controller.values[target.id].gradient, false);
  assert.equal(activityPreview(base, [{ property: "gradient", targets: [target] }]), base);
});


test("Selection / Preview changes only feedback visibility", () => {
  assert.equal(selectionFeedbackVisible("auto"), true);
  assert.equal(selectionFeedbackVisible("selection"), true);
  assert.equal(selectionFeedbackVisible("preview"), false);
});

test("invocation-only coupled inputs preserve independent defaults and restore after nesting/errors", async () => {
  const { bindStateProperties } = await import("../src/properties/registry.ts");
  const { withFunctionInputs } = await import("../src/properties/runtimeInputs.ts");
  const registry = createPropertyRegistry();
  registry.define({ id: "level", label: "Level", kind: "number", min: 0, max: 10, step: 1, initial: 1 });
  registry.define({ id: "enabled", label: "Enabled", kind: "toggle", initial: true });
  for (const id of ["a", "b"]) registry.couple({ id, label: id, owner: "settings", group: [], properties: [{ property: "level" }, { property: "enabled" }] });
  const state = { a: { level: 3, enabled: true }, b: { level: 7, enabled: true } };
  let writes = 0;
  const adapters = Object.fromEntries(["a", "b"].map(id => [id, { channels: Object.fromEntries(["level", "enabled"].map(property => [property, {
    read: current => current[id][property], write: (current, value) => ({ ...current, [id]: { ...current[id], [property]: value } }),
  }])) }]));
  const bindings = bindStateProperties(registry, "settings", state, adapters, () => { writes++; });
  withFunctionInputs([{ consumer: "a", property: "level", value: 0 }, { consumer: "a", property: "enabled", value: false }], () => {
    assert.equal(bindings.values.a.level, 0); assert.equal(bindings.values.a.enabled, false);
    assert.equal(bindings.values.b.level, 7);
    assert.throws(() => withFunctionInputs([{ consumer: "a", property: "level", value: 9 }], () => {
      assert.equal(bindings.values.a.level, 9); assert.equal(bindings.values.a.enabled, false); throw Error("stop");
    }), /stop/);
    assert.equal(bindings.values.a.level, 0);
  });
  assert.deepEqual(bindings.values, state); assert.equal(writes, 0);
  bindings.commit([{ consumer: "a", property: "level", value: 4 }]); assert.equal(writes, 1, "locking still uses the shared setter");
});

test("property clipboard captures shared values, omits mixed/unknown values and retains independent sources", async () => {
  const { copyPropertyValues } = await import("../src/properties/clipboard.ts");
  const registry = createPropertyRegistry();
  registry.define({ id: "color", label: "Color", kind: "color", initial: "#000000" });
  registry.define({ id: "opacity", label: "Opacity", kind: "number", min: 0, max: 1, step: .05, initial: 1 });
  const a = { color: "#00ff00", opacity: .7 }, b = { color: "#ff0000", opacity: .7 };
  const snapshot = copyPropertyValues(registry, [a, b].map(values => ({ properties: ["color", "opacity", "unknown"], read: property => values[property] })));
  assert.deepEqual(snapshot.values, { opacity: .7 }); assert.deepEqual(snapshot.mixed, ["color"]);
  const one = copyPropertyValues(registry, [{ properties: ["color", "opacity"], read: property => a[property] }]);
  a.color = "#ffffff"; assert.equal(one.values.color, "#00ff00", "clipboard holds values, not a live source link");
  registry.define({ id: "font", label: "Font", kind: "select", initial: "system", options: [{ id: "system", label: "System" }] });
  assert.equal(copyPropertyValues(registry, [{ properties: ["font"], read: () => "imported-font" }]).values.font, "imported-font", "runtime font choices survive copying");
});

test("clipboard application skips bypassed and locked destinations without widening applicability", () => {
  const targets = [{ id: "all", label: "All" },
    { id: "a", label: "A", parent: "all", properties: ["color", "font"] },
    { id: "b", label: "B", parent: "all", properties: ["color"] },
    { id: "c", label: "C", parent: "all", properties: ["color"] },
    { id: "d", label: "D", parent: "all", properties: ["color"] }];
  let state = emptyController(); state.disconnected.b = { properties: ["color"] }; state.locks.c = { all: true };
  const before = JSON.stringify(state);
  state = applyValue(state, targets, "color", "#00ff00", undefined, false, { skipBypassed: true });
  state = applyValue(state, targets, "font", "serif", undefined, false, { skipBypassed: true });
  assert.equal(state.values.a.color, "#00ff00"); assert.equal(state.values.d.color, "#00ff00");
  assert.equal(state.values.a.font, "serif"); assert.equal(state.values.b?.color, undefined);
  assert.equal(state.values.c?.color, undefined); assert.equal(state.values.d.font, undefined);
  assert.notEqual(JSON.stringify(state), before); assert.deepEqual(state.instances, {});
});

test("selectable property copies retain only checked values, including zero and false", async () => {
  const { selectPropertyValues } = await import("../src/properties/clipboard.ts");
  const snapshot = { values: { color: "#00ff00", opacity: 0, pulse: false, font: "serif" }, mixed: ["glow"] };
  const selected = selectPropertyValues(snapshot, new Set(["opacity", "pulse", "unknown"]));
  assert.deepEqual(selected.values, { opacity: 0, pulse: false });
  assert.deepEqual(selectPropertyValues(snapshot, new Set()).values, {});
  assert.equal(Object.keys(snapshot.values).length, 4);
});

test("selective paste does not rewrite unchecked companion properties", () => {
  const targets = [{ id: "all", label: "All" }, { id: "text", label: "Text", parent: "all", properties: ["color", "effectColor", "opacity"] }];
  const state = emptyController(); state.values.text = { effectColor: "#0000ff", opacity: .4 };
  const next = applyValue(state, targets, "color", "#00ff00", undefined, false, { skipBypassed: true, exact: true });
  assert.deepEqual(next.values.text, { color: "#00ff00", effectColor: "#0000ff", opacity: .4 });
  const part = { base: "text.ui.buttons", owner: "window:theme", label: "Text", part: { steps: [{ tag: "button", index: 0 }] } };
  const selected = applySelectedValue(emptyController(), [part], "color", "#00ff00", { exact: true });
  assert.equal(selected.values[selectedPartId(part)].color, "#00ff00");
  assert.equal(selected.values[selectedPartId(part)].effectColor, undefined);
});


test("hierarchy targeting is independent of setter compatibility without widening selected scopes", async () => {
  const { hierarchyInteraction } = await import("../src/appearance/hierarchyInteraction.ts");
  const targets = controllerTargets(emptyController());
  const windows = targets.filter(target => target.id === "ui" || ancestry(targets, target.id).includes("ui"));
  const feedback = hierarchyInteraction(windows, "font", "off");
  assert.equal(feedback.selectable, true, "Windows stays targetable while Font is active");
  assert.equal(feedback.feedbackProperty, "color", "unsupported Font uses existing surface ink for hover feedback");
  assert.ok(feedback.feedbackTargets.length > 0);
  assert.ok(feedback.feedbackTargets.every(target => target.properties.includes("color")));
  assert.equal(hierarchyInteraction(windows, "font", "off", false).selectable, false, "unrelated branches remain outside an inspected selection");
  const lettering = targets.filter(target => target.binding?.text);
  const font = hierarchyInteraction(lettering, "font", "off");
  assert.equal(font.feedbackProperty, "font", "compatible setters keep their usual feedback");
  const glyph = { id: "glyph", label: "Glyph", properties: ["color", "effect"], effectKinds: ["electric-text"] };
  assert.equal(hierarchyInteraction([glyph], "effect", "snow").selectable, true);
  assert.equal(hierarchyInteraction([glyph], "effect", "snow").feedbackProperty, "color");
  assert.equal(hierarchyInteraction([], "font", "off").selectable, false);
});

test("electric text reuses measured scope masks and keeps local and inherited masks separate", async () => {
  const { drawUIElectricText, clearUILightningContours, invalidateUILightningContours } = await import("../src/uiLightning.ts");
  const { createElectricInk } = await import("../src/electricInk.ts");
  const names = ["document", "NodeFilter", "HTMLInputElement", "HTMLTextAreaElement", "HTMLSelectElement", "HTMLImageElement", "getComputedStyle", "innerWidth", "innerHeight"];
  const saved = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  let queries = 0, styles = 0, canvases = 0;
  const contexts = [];
  const context = { scale() {}, translate() {} };
  try {
    for (const name of ["HTMLInputElement", "HTMLTextAreaElement", "HTMLSelectElement", "HTMLImageElement"]) globalThis[name] = class {};
    globalThis.NodeFilter = { SHOW_TEXT: 4 };
    globalThis.innerWidth = globalThis.innerHeight = 100;
    globalThis.getComputedStyle = () => { styles++; return { font: "12px sans-serif" }; };
    globalThis.document = {
      createElement: tag => { assert.equal(tag, "canvas"); canvases++; return { width: 0, height: 0, getContext: (_kind, options) => { contexts.push(options); return context; } }; },
      createTreeWalker: () => ({ nextNode: () => null }),
    };
    const element = { querySelectorAll: () => { queries++; return []; }, matches: () => false, textContent: "", scrollTop: 0, scrollLeft: 0 };
    const rect = { x: 0, y: 0, width: 20, height: 10, right: 20, bottom: 10 };
    const scopes = [{ key: "inherited", shape: "glyphs", icons: false }, { key: "local", shape: "glyphs", icons: false }];
    const draw = scope => drawUIElectricText({}, element, rect, {}, 0, 1, false, 1000, scope);
    clearUILightningContours();
    scopes.forEach(draw);
    const warm = { queries, styles, canvases };
    for (let frame = 0; frame < 60; frame++) scopes.forEach(draw);
    assert.deepEqual({ queries, styles, canvases }, warm, "animation-only frames do no mask DOM/style work or canvas allocation");
    draw({ ...scopes[0] });
    assert.equal(canvases, warm.canvases, "a rebuilt job reuses its inherited mask after an exact local scope used the same host");
    clearUILightningContours(); draw(scopes[0]);
    assert.equal(canvases, warm.canvases + 2, "real invalidation rebuilds the mask and compositing surface");
    const sibling = { ...element }, siblingScope = { ...scopes[0], key: "sibling" };
    const drawSibling = () => drawUIElectricText({}, sibling, rect, {}, 0, 1, false, 1000, siblingScope);
    drawSibling();
    const beforeEdit = canvases;
    invalidateUILightningContours([element]); drawSibling();
    assert.equal(canvases, beforeEdit, "editing one host preserves an unrelated host's mask");
    draw(scopes[0]);
    assert.equal(canvases, beforeEdit + 2, "the edited host rebuilds its own mask");
    const field = Object.assign(new globalThis.HTMLInputElement(), element, { value: "first", type: "text", matches: () => true });
    const fieldScope = { key: "field", shape: "glyphs", icons: false, input: () => false };
    const drawField = () => drawUIElectricText({}, field, rect, {}, 0, 1, false, 1000, fieldScope);
    drawField(); const beforeValue = canvases;
    field.value = "updated without input event"; drawField();
    assert.equal(canvases, beforeValue + 2, "controlled field values refresh without a DOM mutation event");
    createElectricInk(true);
    assert.equal(contexts.at(-1).willReadFrequently, true, "CPU ink readback is declared when creating its context");
  } finally {
    clearUILightningContours();
    for (const name of names) {
      const descriptor = saved.get(name);
      if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name];
    }
  }
});

test("selection pulse ink does not invalidate effect geometry but typography and movement do", async () => {
  const { effectGeometryStyle } = await import("../src/appearance/effectInvalidation.ts");
  const base = "font-size: 14px; transform: translate(2px, 3px);";
  assert.equal(effectGeometryStyle(base), effectGeometryStyle(`${base} --omnium-selector-glyph-mix: 20%; --omnium-selector-surface-mix: 50%;`));
  assert.notEqual(effectGeometryStyle(base), effectGeometryStyle(base.replace("14px", "18px")));
  assert.notEqual(effectGeometryStyle(base), effectGeometryStyle(base.replace("2px", "8px")));
  assert.equal(effectGeometryStyle(null), "");
});

test("electric text shares pattern generation across colors and reuses unchanged composites beyond its palette size", async () => {
  const { drawUIElectricText, clearUILightningContours } = await import("../src/uiLightning.ts");
  const names = ["document", "NodeFilter", "HTMLInputElement", "HTMLTextAreaElement", "HTMLSelectElement", "HTMLImageElement", "getComputedStyle", "innerWidth", "innerHeight"];
  const saved = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const counts = { canvases: 0, strokes: 0, segments: 0, reads: 0, copies: 0, uploads: 0 };
  const colors = [];
  const pixels = () => ({ data: new Uint8ClampedArray(128 * 128 * 4).fill(128) });
  try {
    for (const name of ["HTMLInputElement", "HTMLTextAreaElement", "HTMLSelectElement", "HTMLImageElement"]) globalThis[name] = class {};
    globalThis.NodeFilter = { SHOW_TEXT: 4 };
    globalThis.innerWidth = globalThis.innerHeight = 100;
    globalThis.getComputedStyle = () => ({ font: "12px sans-serif" });
    globalThis.document = {
      createTreeWalker: () => ({ nextNode: () => null }),
      createElement: () => {
        counts.canvases++;
        const context = { scale() {}, translate() {}, fillRect() {}, beginPath() {}, moveTo() {},
          lineTo() { counts.segments++; }, stroke() { counts.strokes++; },
          createImageData: pixels, getImageData: () => { counts.reads++; return pixels(); },
          putImageData: image => { counts.uploads++; colors.push([...image.data.slice(0, 3)]); },
          drawImage() { counts.copies++; }, createPattern: () => ({}) };
        return { width: 0, height: 0, getContext: () => context };
      },
    };
    const element = { querySelectorAll: () => [], matches: () => false, textContent: "", scrollTop: 0, scrollLeft: 0 };
    const rect = { x: 0, y: 0, width: 20, height: 10, right: 20, bottom: 10 };
    const output = { save() {}, restore() {}, drawImage() {} };
    const fx = { density: .431, boltLength: .387, intensity: .7, motion: .291 };
    const scope = key => ({ key, shape: "surface", icons: false });
    const a = scope("shared-red"), b = scope("shared-green");
    const draw = (owner, color, seconds = 0) => drawUIElectricText(output, element, rect, { ...fx, color }, seconds, 1, true, 1000, owner);
    clearUILightningContours();
    draw(a, "#fe0000");
    const first = { ...counts };
    assert.ok(first.segments < (6 + Math.ceil(fx.density * 16)) * 12 * 9 / 2, "off-tile copies are culled before canvas path submission");
    draw(b, "#00fd00");
    assert.equal(counts.strokes, first.strokes, "a second color reuses the monochrome pattern");
    assert.equal(counts.reads, 1, "matching colors/settings share one pixel read per noise frame");
    assert.ok(colors[0][0] > 0 && colors[0][1] === 0 && colors[1][0] === 0 && colors[1][1] > 0, "tinting does not mutate the shared monochrome source");
    const warm = { ...counts };
    for (let i = 0; i < 60; i++) { draw(a, "#fe0000"); draw(b, "#00fd00"); }
    assert.deepEqual(counts, warm, "unchanged noise frames neither regenerate nor recomposite masks");
    draw(a, "#fe0000", .1); draw(b, "#00fd00", .1);
    assert.equal(counts.reads, 2, "the next noise frame is generated/read once for both colors");
    const palette = Array.from({ length: 64 }, (_, i) => ({ owner: scope(`palette-${i}`), color: `#${i.toString(16).padStart(6, "0")}` }));
    palette.forEach(item => draw(item.owner, item.color, .1));
    const large = { ...counts };
    palette.forEach(item => draw(item.owner, item.color, .1));
    assert.deepEqual(counts, large, "active scopes prevent material eviction churn on many-color pages");
  } finally {
    clearUILightningContours();
    for (const name of names) { const descriptor = saved.get(name); if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; }
  }
});

test("effect-only scene frames do not rewrite the camera HUD or trigger UI text invalidation", async () => {
  const THREE = await import("three");
  const { updateCameraGuide } = await import("../src/cameraGuideState.ts");
  let queries = 0, writes = 0;
  const text = () => {
    let value = "";
    return { get textContent() { return value; }, set textContent(next) { value = next; writes++; } };
  };
  const attributeNode = () => {
    const values = new Map();
    return { getAttribute: name => values.get(name) ?? null, setAttribute: (name, value) => { values.set(name, value); writes++; } };
  };
  const nodes = new Map(["zoom", "direction", "position", "target", "node"].map(name => [`[data-camera="${name}"]`, text()]));
  for (const axis of ["x", "y", "z"]) for (const sign of [-1, 1]) {
    const line = attributeNode(), label = attributeNode();
    let opacity = "";
    const style = { get opacity() { return opacity; }, set opacity(next) { opacity = next; writes++; } };
    nodes.set(`[data-compass="${axis}:${sign}"]`, { style, querySelector: name => { queries++; return name === "line" ? line : label; } });
  }
  const element = { querySelector: selector => { queries++; return nodes.get(selector); } };
  const camera = new THREE.PerspectiveCamera(55, 1, .1, 100);
  camera.position.set(7, 5, 9); camera.lookAt(0, 0, 0);
  const target = new THREE.Vector3();
  updateCameraGuide(element, camera, target);
  const first = { queries, writes };
  assert.ok(writes > 0);
  for (let frame = 0; frame < 60; frame++) updateCameraGuide(element, camera, target);
  assert.deepEqual({ queries, writes }, first, "stationary animation frames do zero HUD DOM work");
  camera.position.x += .000001; updateCameraGuide(element, camera, target);
  assert.equal(writes, first.writes, "rounded display values are not replaced for sub-display camera changes");
  camera.position.x += 1; updateCameraGuide(element, camera, target);
  assert.ok(writes > first.writes, "actual camera changes still update the display");
  const beforeSelection = writes;
  updateCameraGuide(element, camera, target, new THREE.Vector3(1, 2, 3));
  assert.ok(writes > beforeSelection, "selected-node coordinates stay live");
});

test("shared hierarchy indexes preserve order and bulk targeting does not clone unrelated state", async () => {
  const { createHierarchyIndex, toggleTarget, applyValue } = await import("../src/appearance/model.ts");
  const state = emptyController(), targets = controllerTargets(state), view = createHierarchyIndex(targets);
  for (const target of targets) {
    assert.deepEqual(view.paths.get(target.id), ancestry(targets, target.id));
    assert.deepEqual(view.descendants.get(target.id).map(item => item.id), targets.filter(item => ancestry(targets, item.id).includes(target.id)).map(item => item.id));
  }
  const toggled = toggleTarget(state, targets, "text");
  for (const key of ["values", "instances", "locks", "disconnected", "refined"]) assert.equal(toggled[key], state[key], `${key} is not a targeting edit`);
  assert.notEqual(toggled.sets, state.sets);
  const edited = applyValue(state, targets, "brightness", 1.5, "text");
  assert.equal(edited.instances, state.instances);
  assert.equal(edited.refined, state.refined);
  assert.equal(applyValue(edited, targets, "brightness", 1.5, "text"), edited, "repeating a bulk value returns the same snapshot");
  assert.equal(state.values["text.ui.buttons"], undefined, "editing does not mutate previous snapshots");
});

test("live settings validation retains unchanged structure while enforcing invalid input bounds", async () => {
  const { normalizeLiveSettings } = await import("../src/ui/normalizeLiveSettings.ts");
  const prior = defaultSettings();
  const targets = controllerTargets(prior.appearance.controller);
  const controller = applyValue(prior.appearance.controller, targets, "brightness", 1.5, "text");
  const source = { ...prior, appearance: { ...prior.appearance, controller } };
  const checked = normalizeLiveSettings(source, prior);
  assert.equal(checked.bindings, prior.bindings);
  for (const key of ["instances", "locks", "disconnected", "refined"]) assert.equal(checked.appearance.controller[key], prior.appearance.controller[key]);
  assert.equal(checked.appearance.controller.values["text.ui.buttons"].brightness, 1.5);
  const invalid = normalizeLiveSettings({ ...prior, appearance: { ...prior.appearance, opacity: NaN } }, prior);
  assert.equal(invalid.appearance.opacity, 1);
  assert.equal(normalizeLiveSettings({ ...prior, appearance: { ...prior.appearance } }, prior), prior, "equivalent wrappers do not publish another state update");
});

test("history comparison skips shared resources instead of serializing full state", async () => {
  const { sameValue } = await import("../src/valueEquality.ts");
  const { startHistory, recordHistory } = await import("../src/ui/history.ts");
  const resource = new Proxy({}, { ownKeys() { throw new Error("shared resource was unnecessarily traversed"); } });
  const before = { resource, settings: { value: 1 } }, after = { resource, settings: { value: 2 } };
  assert.equal(sameValue(before, after), false);
  const recorded = recordHistory(startHistory(before), after);
  assert.equal(recorded.present, after);
  assert.equal(recordHistory(recorded, { ...after, settings: { value: 2 } }), recorded);
  assert.equal(sameValue({ a: 1, optional: undefined }, { a: 1 }), true);
  assert.equal(sameValue([undefined], [null]), true);
});


test("consumer/mode ranges bound edits and rendering while retaining stored choices", async () => {
  const { numericRange } = await import("../src/properties/numericRange.ts");
  const { propertyFor } = await import("../src/properties/catalog.ts");
  const density = propertyFor("density");
  assert.deepEqual(numericRange(density, () => "lightning"), { min: 0, max: 1 });
  assert.deepEqual(numericRange(density, () => "starfield"), { min: 0, max: 4 });
  let { state, targets } = fixture();
  state = applyValue(state, targets, "effect", "lightning", "text");
  state = applyValue(state, targets, "density", 4, "text");
  assert.equal(state.values["text.ui.buttons"].density, 1);
  state = applyValue(state, targets, "effect", "starfield", "text");
  state = applyValue(state, targets, "density", 4, "text");
  assert.equal(state.values["text.ui.buttons"].density, 4);
  state = applyValue(state, targets, "glow", 2);
  assert.equal(state.values["text.ui.buttons"].glow, .8);
  assert.equal(state.values["omnium.nodes.body"].glow, 2, "scene adapters retain their independent supported range");
  assert.equal(applyValue(state, targets, "glow", NaN), state);
  const saved = loadController({ ...state, values: { ...state.values, "text.ui.buttons": { glow: 2, effectGlow: 2, effect: "lightning", density: 4 } } });
  const appearance = { ...defaultSettings().appearance, controller: saved };
  const read = createValueResolver(appearance, saved);
  const text = targets.find(target => target.id === "text.ui.buttons");
  assert.equal(read(text, "glow"), .8);
  assert.equal(read(text, "effectGlow"), .8);
  assert.equal(read(text, "density"), 1);
  assert.equal(saved.values[text.id].glow, 2, "rendering never rewrites imported values or history");
  assert.equal(saved.values[text.id].density, 4);
  const legacy = resolveControllerAppearance({ ...appearance, controller: undefined, blur: 20, textGlow: 2, controlGlow: 2 });
  assert.equal(legacy.blur, 8);
  assert.equal(legacy.textGlow, .8);
  assert.equal(legacy.controlGlow, .8);
  const selected = selectedLabel("range");
  const local = applySelectedValue(saved, [selected], "glow", 2);
  assert.equal(local.values[selectedPartId(selected)].glow, .8, "accepted-part edits share the renderer limit");
});

test("state property bindings enforce mode bounds on direct writes and skip equal writes", async () => {
  const { bindStateProperties, preparePropertyChanges } = await import("../src/properties/registry.ts");
  const registry = createPropertyRegistry();
  registry.define({ id: "mode", label: "Mode", kind: "select", initial: "small", options: [{ id: "small", label: "Small" }, { id: "large", label: "Large" }] });
  registry.define({ id: "amount", label: "Amount", kind: "number", min: 0, max: 4, step: 1, initial: 1,
    numericRange: { by: "mode", otherwise: { max: 1 }, cases: { large: { max: 4 } } } });
  registry.couple({ id: "test", label: "Test", owner: "owner", group: [], properties: [{ property: "mode" }, { property: "amount" }] });
  let state = { mode: "small", amount: 0 }, writes = 0;
  const adapters = { test: { channels: Object.fromEntries(["mode", "amount"].map(key => [key, { read: s => s[key], write: (s, value) => { writes++; return { ...s, [key]: value }; } }])) } };
  const binding = bindStateProperties(registry, "owner", state, adapters, change => { state = change(state); });
  binding.commit(preparePropertyChanges(registry, "amount", 4, ["test"]));
  assert.equal(state.amount, 1);
  binding.commit(preparePropertyChanges(registry, "amount", 4, ["test"]));
  assert.equal(writes, 1);
  binding.commit([...preparePropertyChanges(registry, "mode", "large", ["test"]), ...preparePropertyChanges(registry, "amount", 4, ["test"])]);
  assert.equal(state.amount, 4);
});

test("render budgets bound resolution with the aspect ratio preserved", async () => {
  const { RENDER_BUDGET, budgetPixelRatio, bloomSize } = await import("../src/renderBudget.ts");
  for (const [w, h, dpr] of [[3840, 2160, 2], [1920, 1080, 1], [640, 480, 1]]) {
    const ratio = budgetPixelRatio(w, h, dpr, RENDER_BUDGET.scenePixels, RENDER_BUDGET.maxSceneDpr);
    assert.ok(w * h * ratio * ratio <= RENDER_BUDGET.scenePixels + .001);
    assert.ok(ratio <= dpr && ratio <= RENDER_BUDGET.maxSceneDpr);
    const size = bloomSize(w, h);
    assert.ok(size.width <= RENDER_BUDGET.bloomEdge && size.height <= RENDER_BUDGET.bloomEdge);
    assert.ok(Math.abs(size.width / size.height - w / h) < .01);
  }
  const { sameValue } = await import("../src/valueEquality.ts");
  assert.equal(sameValue([,], [1]), false, "sparse arrays must not compare equal to populated arrays");
  assert.equal(sameValue([,], [null]), true);
});


test("effect ownership ignores unrelated saved locals and preserves ancestor/proxy precedence", () => {
  const raw = defaultSettings().appearance;
  const state = emptyController();
  for (let i = 0; i < 500; i++) {
    const id = `local-${i}`;
    state.instances[id] = { base: "text.ui.buttons", owner: `function:owner-${i}`, label: id };
    state.values[id] = { effect: "sparks" };
  }
  state.instances.outer = { base: "text.ui.buttons", owner: "window:test", label: "Outer" };
  state.values.outer = { effect: "stars" };
  state.instances.inner = { base: "text.ui.buttons", owner: "function:active", label: "Inner", path: ["window:test"] };
  state.values.inner = { effect: "lightning" };
  const appearance = { ...raw, effect: "off", controller: state };
  const target = controllerTargets(state).find(target => target.id === "text.ui.buttons");
  const attrs = { "data-ui-function": "active" };
  let reads = 0;
  const outer = { parentElement: null, getAttribute: name => name === "data-ui-proxy-for" ? "window:test" : null };
  const host = { parentElement: outer, getAttribute: name => { reads++; return attrs[name] ?? null; },
    closest: () => { throw new Error("must not query unrelated saved owners"); } };
  const plan = createElementEffectsResolver(appearance, resolveControllerAppearance(appearance));
  const inner = plan.resolve(target, host);
  assert.equal(inner.effect, "lightning");
  const firstReads = reads;
  assert.equal(plan.resolve(target, host), inner);
  assert.equal(reads, firstReads);
  delete attrs["data-ui-function"];
  plan.invalidate();
  assert.equal(plan.resolve(target, host).effect, "stars", "ownership is refreshed after a real DOM change");
});


test("sustained slow decoration yields, stays bounded, and ignores time spent idle", async () => {
  const { createDecorationAllowance } = await import("../src/renderBudget.ts");
  const budget = createDecorationAllowance(4);
  assert.equal(budget.sample(1000, 15), false);
  assert.equal(budget.sample(1050, 15), false);
  assert.equal(budget.sample(1100, 15), true);
  assert.equal(budget.sources, 2);
  for (const start of [1150, 1200, 1250]) budget.sample(start, 15);
  assert.equal(budget.sources, 1);
  for (const start of [1300, 1350, 1400]) budget.sample(start, 15);
  assert.equal(budget.sources, 0, "unaffordable animation freezes instead of monopolizing input");
  assert.equal(budget.sample(1450, 0), false);
  const timing = createDecorationAllowance(1);
  timing.sample(1000, 0); timing.resetTiming();
  timing.sample(10000, 0); timing.sample(10050, 0); timing.sample(10100, 0);
  assert.equal(timing.sources, 1, "hidden/static intervals are not dropped animation frames");
  for (const start of [10300, 10500, 10700]) timing.sample(start, 0);
  assert.equal(timing.sources, 0, "delayed display frames are detected even when JS draw time is low");
});


test("discovered paint roles generate functional groups for unseen component types", async () => {
  const { groupVisualRoles } = await import("../src/appearance/roleHierarchy.ts");
  const { createTargetIndex, blocked, toggleTarget } = await import("../src/appearance/model.ts");
  const discovered = groupVisualRoles([
    { id: "all", label: "Everything" }, { id: "future", parent: "all", label: "Future system" },
    { id: "new-widget", parent: "future", label: "Unseen widget" },
    { id: "new-edge", parent: "new-widget", label: "Contour", properties: ["color"], binding: { css: "border-color" } },
    { id: "new-fill", parent: "new-widget", label: "Background", properties: ["color"], binding: { css: "background-color" } },
  ]);
  const index = createTargetIndex(discovered);
  assert.ok(index.path("new-edge").includes("visual.role.contours"));
  assert.ok(index.path("new-fill").includes("visual.role.backgrounds"));
  assert.ok(!index.path("new-edge").includes("visual.role.backgrounds"));
  let state = emptyController(); state.sets[0].selection = { all: false, "new-widget": true };
  assert.equal(included(state.sets[0], discovered, "new-edge", index), true, "saved type masks retain scope");
  state = toggleTarget(state, discovered, "visual.role.contours");
  state = toggleTarget(state, discovered, "visual.role.contours");
  assert.equal(included(state.sets[0], discovered, "new-edge", index), false);
  assert.equal(included(state.sets[0], discovered, "new-fill", index), true);
  state.locks["new-widget"] = { all: true };
  assert.equal(blocked(state, discovered, "new-edge", "color", "visual.role.contours", index), true);
  assert.equal(blocked(state, discovered, "new-edge", "color", "new-edge", index), false);
  state.disconnected["new-widget"] = { all: true };
  assert.equal(connected(state, discovered, "new-edge", "color", index), false);
});

test("generated role branches select/edit real targets and preserve legacy renderer bypass", () => {
  let { state, targets } = fixture();
  state.sets[0].selection = { all: false, "visual.role.contours": true };
  state = applyValue(state, targets, "color", "#fedcba");
  assert.equal(state.values["ui.buttons.contour"].color, "#fedcba");
  assert.equal(state.values["ui.buttons.background"], undefined);
  state.disconnected["ui.buttons"] = { all: true };
  const read = createValueResolver(defaultSettings().appearance, state);
  assert.notEqual(read(targets.find(t => t.id === "ui.buttons.contour"), "color"), "#fedcba");
  const leaf = targets.find(t => t.id === "ui.buttons.contour");
  assert.equal(roleFor(leaf), "contour");
  assert.ok(ancestry(targets, leaf.id).includes("visual.role.contours"));
});


test("new Text role spans systems while saved legacy Text targeting keeps its old scope", () => {
  const { state, targets } = fixture();
  state.sets[0].selection = { all: false, text: true };
  assert.equal(included(state.sets[0], targets, "text.ui.buttons"), true);
  assert.equal(included(state.sets[0], targets, "text.nodes"), false);
  const allText = applyValue(state, targets, "brightness", 2, "visual.role.text");
  assert.equal(allText.values["text.ui.buttons"].brightness, 2);
  assert.equal(allText.values["text.nodes"].brightness, 2);
  assert.equal(allText.values["ui.buttons.background"], undefined);
});

test('excluding draft targets restores their applied paint while preserving other targets and targeting', async () => {
  const {restoreTargetDraft,removedTargets}=await import('../src/appearance/draftTargets.ts');
  const {toggleTarget}=await import('../src/appearance/model.ts');
  const applied=defaultSettings().appearance, targets=controllerTargets(applied.controller);
  const a=targets.find(t=>t.id==='text.nodes'), b=targets.find(t=>t.id==='text.binders');
  const baseline={...applied,controller:applyValue(applied.controller,targets,'color','#112233',a.id)};
  const draft={...baseline,controller:applyValue(baseline.controller,targets,'color','#abcdef')};
  const off=toggleTarget(draft.controller,targets,a.id), restored=restoreTargetDraft(draft,baseline,targets,removedTargets(draft.controller,off,targets),off);
  const read=createValueResolver(draft,restored,targets);
  assert.equal(read(a,'color'),'#112233');assert.equal(read(b,'color'),'#abcdef');
  assert.equal(included(restored.sets[0],targets,a.id),false);
  const adjusted=applyValue(restored,targets,'color','#fedcba');
  assert.equal(createValueResolver(draft,adjusted,targets)(a,'color'),'#112233');
  assert.equal(createValueResolver(draft,adjusted,targets)(b,'color'),'#fedcba');
  const reselected=toggleTarget(adjusted,targets,a.id);
  assert.equal(createValueResolver(draft,reselected,targets)(a,'color'),'#112233');
  assert.equal(createValueResolver(draft,applyValue(reselected,targets,'color','#778899'),targets)(a,'color'),'#778899');
});

test('restoring a deselected local part retains the applied value despite a draft change to its parent', async () => {
  const {restoreTargetDraft}=await import('../src/appearance/draftTargets.ts');
  const applied=defaultSettings().appearance;
  const id='test:local', part={base:'text.nodes',owner:'function:example',label:'Example'};
  const controller={...applied.controller,instances:{[id]:part},values:{'text.nodes':{color:'#abcdef'},[id]:{color:'#ee4400'}}};
  const targets=controllerTargets(controller), draft={...applied,controller};
  const next=restoreTargetDraft(draft,applied,targets,[id]);
  const read=createValueResolver(draft,next,targets),baseline=createValueResolver(applied,applied.controller);
  assert.equal(read(targets.find(t=>t.id===id),'color'),baseline(targets.find(t=>t.id===id),'color'));
  assert.equal(next.values['text.nodes'].color,'#abcdef');
});


test('mathematical dial exposes named visual parts with shared role detection and search aliases',async()=>{
 const {TARGETS}=await import('../src/appearance/registry.ts');
 const ids=['contours','hover','marks','base','direction'];
 for(const name of ids){const target=TARGETS.find(t=>t.id===`ui.fields.mathematicalDial.${name}`);assert.ok(target);assert.ok(target.label.includes('⠒❉'));assert.ok(target.aliases.includes('count dial'));assert.ok(target.properties.includes('color'));}
 const hover=TARGETS.find(t=>t.id==='ui.fields.mathematicalDial.hover');
 assert.equal(roleFor(hover),'contour');assert.equal(roleFor(TARGETS.find(t=>t.id==='ui.fields.mathematicalDial.marks')),'indicator');
 assert.ok(TARGETS.find(t=>t.id==='ui.buttons.background').binding.selector.includes(':not(.mathematical-dial-slot)'));
});
