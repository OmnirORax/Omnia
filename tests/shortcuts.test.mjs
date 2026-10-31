import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { ACTIONS, actionForKey, defaultSettings, functionShortcutBinding, keyConflict, matchesPointerShortcut, matchesShortcut, normalizeKey, normalizePointer, normalizeSettings } from "../src/workspaceActions.ts";
import { FEATURE_ACTIONS, FEATURE_GESTURES, clearRecordedShortcutPress, createFeatureActionRuntime, recordedShortcutTail, recordShortcutPress } from "../src/featureActions.ts";
import { privateShortcutLiterals } from "../scripts/shortcut-audit.mjs";

test("feature commands automatically join the catalog, defaults and saved settings without stealing existing keys", () => {
  const defaults = defaultSettings();
  assert.equal(new Set(ACTIONS.map(action => action.id)).size, ACTIONS.length);
  for (const feature of FEATURE_ACTIONS) {
    assert.equal(ACTIONS.find(action => action.id === feature.id), feature);
    assert.equal(defaults.bindings[feature.id], feature.defaultKey);
    assert.ok(feature.label && feature.category && feature.scope && feature.description);
  }
  assert.equal(defaults.bindings["selector.open"], "Q");
  assert.equal(defaults.bindings["selector.pattern"], "E");
  assert.equal(keyConflict(defaults.bindings, "selector.pattern", "E"), null, "contextual E coexists with global expand");
  assert.equal(actionForKey(defaults.bindings, "E"), "expand", "inactive selector never steals global E");
  assert.equal(keyConflict(defaults.bindings, "selector.pattern", "Ctrl+Z"), "selector.undo");
  const previous = { bindings: { "button:existing": "MB3", "selector.clear": "E", searchUI: "Q" } };
  const loaded = normalizeSettings(previous);
  assert.equal(loaded.bindings["selector.open"], "", "new defaults cannot steal saved global bindings");
  assert.equal(loaded.bindings["selector.pattern"], "", "same-context saved bindings win over a newly added default");
  assert.equal(loaded.bindings.searchUI, "Q");
  assert.equal(loaded.bindings["atomnic.draw"], "D", "content editing retains D without conflicting with frame descendants");
  assert.equal(keyConflict(defaults.bindings, "atomnic.draw", "D"), null);
  assert.ok(FEATURE_GESTURES.some(gesture => gesture.id === "selector.pick"));
  assert.ok(FEATURE_GESTURES.some(gesture => gesture.id === "selector.depth"));
  assert.equal(normalizeSettings({ bindings: { "selector.open": "", "selector.pattern": "Ctrl+Alt+P" } }).bindings["selector.open"], "");
});

test("selector single-toggle defaults migrate retired operation bundles without reviving later clears", () => {
  const dual = { bindings: { "selector.edit": "", "selector.include": "MB2", "selector.exclude": "MB1", "selector.finishGeometry": "Enter" } };
  const migrated = normalizeSettings(dual);
  assert.equal(migrated.bindings["selector.include"], "MB1");
  assert.equal(migrated.bindings["selector.edit"], "");
  assert.equal(Object.hasOwn(migrated.bindings, "selector.exclude"), false);
  assert.equal(FEATURE_ACTIONS.some(action => action.id === "selector.exclude"), false);
  assert.equal(dual.bindings["selector.edit"], "", "loading does not mutate saved input");
  const original = normalizeSettings({ bindings: { "selector.edit": "MB2", "selector.include": "", "selector.exclude": "" } });
  assert.equal(original.bindings["selector.include"], "MB1");
  const custom = normalizeSettings({ bindings: { ...dual.bindings, "selector.include": "Q" } });
  assert.equal(custom.bindings["selector.include"], "Q");
  assert.equal(custom.bindings["selector.edit"], "");
  const cleared = normalizeSettings({ ...migrated, bindings: { ...migrated.bindings, "selector.include": "", "selector.edit": "MB2" } });
  assert.equal(cleared.bindings["selector.include"], "", "cleared toggles do not migrate again");
  assert.equal(cleared.bindings["selector.edit"], "MB2");
});

test("keyboard and pointer matching honor rebinding and cleared bindings", () => {
  const modifiers = { ctrlKey: false, metaKey: false, altKey: false, shiftKey: false };
  assert.equal(normalizePointer({ ...modifiers, button: 1 }), "MB3");
  assert.equal(normalizePointer({ ...modifiers, button: 2 }), "MB2");
  assert.equal(normalizePointer({ ...modifiers, button: 3, shiftKey: true }), "Shift+MB4");
  assert.equal(normalizePointer({ ...modifiers, button: 8 }), "");
  const bindings = { "selector.open": "Ctrl+P", "selector.pattern": "Q", "selector.edit": "" };
  assert.equal(matchesShortcut("selector.open", bindings, normalizeKey({ ...modifiers, key: "p", ctrlKey: true })), true);
  assert.equal(matchesShortcut("selector.open", bindings, "MB3"), false);
  assert.equal(matchesShortcut("selector.pattern", bindings, "E"), false);
  assert.equal(matchesShortcut("selector.pattern", bindings, "Q"), true);
  assert.equal(matchesShortcut("selector.edit", bindings, "MB2"), false);
  assert.equal(matchesShortcut("selector.edit", bindings, ""), false);
});

test("pointer gesture modifiers preserve selector picking and explicit bindings without leaking defaults", () => {
  const bindings = defaultSettings().bindings;
  const pointer = { button: 0, ctrlKey: true, metaKey: false, altKey: false, shiftKey: false };
  assert.equal(matchesPointerShortcut("selector.include", bindings, pointer), true, "Ctrl-preview still commits the saved MB1 selection action");
  assert.equal(matchesPointerShortcut("selector.include", bindings, pointer, false), false, "exact pass leaves explicit Ctrl commands priority");
  const custom = { ...bindings, "selector.edit": "Ctrl+MB1" };
  assert.equal(matchesPointerShortcut("selector.edit", custom, pointer, false), true);
  assert.equal(matchesPointerShortcut("selector.include", { ...bindings, "selector.include": "" }, pointer), false);
  assert.equal(matchesPointerShortcut("selector.include", { ...bindings, "selector.include": "Q" }, pointer), false);
  assert.equal(matchesPointerShortcut("selector.include", { ...bindings, "selector.include": "MB2" }, pointer), false);
  assert.equal(matchesPointerShortcut("selector.include", { ...bindings, "selector.include": "MB2" }, { ...pointer, button: 2 }), true, "native preview also works with a rebound pointer action");
  assert.equal(matchesPointerShortcut("selector.include", bindings, { ...pointer, shiftKey: true }), false, "unrelated modifiers retain exact semantics");
  assert.equal(matchesPointerShortcut("selector.include", bindings, { ...pointer, ctrlKey: false, metaKey: true }), false, "the native Ctrl preview gesture does not consume Command clicks");
  assert.equal(matchesPointerShortcut("selector.include", { ...bindings, "selector.include": "Ctrl+MB1" }, pointer, false), true);
  assert.equal(matchesPointerShortcut("selector.include", { ...bindings, "selector.include": "Ctrl+MB1" }, { ...pointer, ctrlKey: false }), false);
});

test("shortcut search resolves live bindings for commands, rows and customized functions", () => {
  const bindings = defaultSettings().bindings;
  for (const id of ["selector.open", "shortcut:selector.open"])
    assert.equal(functionShortcutBinding(id, bindings), "Q");
  const rebound = { ...bindings, "selector.open": "Ctrl+P", "button:custom-action": "Shift+MB3" };
  for (const id of ["selector.open", "shortcut:selector.open"])
    assert.equal(functionShortcutBinding(id, rebound), "Ctrl+P", "old Q must disappear from search metadata");
  for (const id of ["custom-action", "button:custom-action", "shortcut:button:custom-action"])
    assert.equal(functionShortcutBinding(id, rebound), "Shift+MB3");
  assert.equal(functionShortcutBinding("shortcut:selector.open", { ...rebound, "selector.open": "" }), "");
  assert.equal(functionShortcutBinding("unassigned-control", rebound), "");
  assert.equal(functionShortcutBinding(undefined, rebound), "");
});

test("feature runtime rejects missing metadata and respects availability and teardown for future owners", () => {
  const runtime = createFeatureActionRuntime(["future.feature"]), calls = [];
  assert.throws(() => runtime.register("hidden.unlisted", { enabled: () => true, run: () => {} }), /metadata/);
  let enabled = false;
  const off = runtime.register("future.feature", { enabled: () => enabled, run: input => calls.push(input) });
  assert.equal(runtime.invoke("future.feature"), false);
  enabled = true;
  assert.equal(runtime.invoke("future.feature", "input"), true);
  const offLater = runtime.register("future.feature", { enabled: () => true, run: () => calls.push("later") });
  runtime.invoke("future.feature"); offLater(); runtime.invoke("future.feature", "restored");
  off(); assert.equal(runtime.invoke("future.feature"), false);
  assert.deepEqual(calls, ["input", "later", "restored"]);
});

test("recording a mouse binding suppresses its trailing click and context menu but not the next press", () => {
  recordShortcutPress({ button: 2, timeStamp: 100 });
  assert.equal(recordedShortcutTail({ type: "contextmenu", button: 2, timeStamp: 105 }), true);
  assert.equal(recordedShortcutTail({ type: "auxclick", button: 2, timeStamp: 150 }), true);
  assert.equal(recordedShortcutTail({ type: "pointerdown", button: 2, timeStamp: 105 }), false);
  assert.equal(recordedShortcutTail({ type: "click", button: 0, timeStamp: 105 }), false);
  clearRecordedShortcutPress();
  assert.equal(recordedShortcutTail({ type: "contextmenu", button: 2, timeStamp: 160 }), false);
});

test("shortcut policy catches private hotkeys, aliases and middle-button triggers in new or existing features", () => {
  const hidden = 'if (event.key.toLowerCase() === "e") run(); const key = event.key; if (key === "F2") run(); if (e.button === 1) open();';
  assert.equal(privateShortcutLiterals(hidden).length, 3);
  assert.equal(privateShortcutLiterals('if (e.key === "Enter" || e.key === "Escape") close(); if (e.button === 0) drag();').length, 0);
  assert.equal(privateShortcutLiterals('if (e.button === 1) open();', "src/App.tsx").length, 1, "existing adapters do not exempt new hidden triggers");
  const walk = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(`${directory}/${entry.name}`) : [`${directory}/${entry.name}`]);
  const violations = walk("src").filter(file => /\.[cm]?[jt]sx?$/.test(file)).flatMap(file => privateShortcutLiterals(readFileSync(file, "utf8"), file));
  assert.deepEqual(violations, [], `Register new shortcut actions in the shared catalog and use binding matching:\n${violations.join("\n")}`);
});

test("active context commands share catalog defaults and preserve saved search choices", () => {
  const defaults = defaultSettings().bindings;
  for (const [id, key] of Object.entries({ back: "Esc", search: "S", close: "X", minimize: "M", descendants: "D" }))
    assert.equal(defaults[`context.${id}`], key);
  assert.equal(defaults.searchUI, "Ctrl+Alt+S");
  assert.equal(normalizeSettings({ bindings: { searchUI: "S" } }).bindings.searchUI, "Ctrl+Alt+S");
  assert.equal(normalizeSettings({ bindings: { searchUI: "Q" } }).bindings.searchUI, "Q");
  assert.equal(normalizeSettings({ bindings: { searchUI: "" } }).bindings.searchUI, "");
  const occupied = normalizeSettings({ bindings: { searchUI: "S", "button:custom": "Shift+S" } });
  assert.equal(occupied.bindings.searchUI, "Ctrl+Alt+S");
  assert.equal(occupied.bindings["button:custom"], "");
  assert.equal(keyConflict(defaults, "context.close", "X"), null);
});

test("context back removes exactly one field/popup/frame level without mutating its source", async () => {
  const { activeFrame, parentContext } = await import("../src/ui/activeContextModel.ts");
  const frame = { kind: "frame", key: "window:theme" };
  const nested = { kind: "frame", key: "window:properties" };
  const layer = { kind: "layer", element: {} }, field = { kind: "field", element: {} };
  const stack = Object.freeze([frame, nested, layer, field]);
  assert.equal(activeFrame(stack), nested);
  const step1 = parentContext(stack);
  assert.deepEqual(step1, [frame, nested, layer]);
  const step2 = parentContext(step1);
  assert.deepEqual(step2, [frame, nested]);
  assert.deepEqual(parentContext(step2), [frame]);
  assert.deepEqual(parentContext(parentContext(parentContext(step2))), []);
  assert.equal(stack.length, 4);
  assert.equal(activeFrame([]), undefined);
});

test("history configuration replaces legacy Shift side-button UI routing", () => {
  assert.equal(defaultSettings().mouse.backButton, "undo");
  assert.equal(defaultSettings().mouse.forwardButton, "redo");
  assert.equal(defaultSettings().mouse.shiftBackButton, "history.configure");
  const migrated = normalizeSettings({ mouse: { shiftBackButton: "ui:undo", shiftForwardButton: "ui:redo" } });
  assert.equal(migrated.mouse.shiftBackButton, "history.configure");
  assert.equal(migrated.mouse.shiftForwardButton, "history.configure");
});

test("chronological undo crosses owners and selective undo preserves unrelated edits", async () => {
  const { createActionHistory } = await import("../src/ui/actionHistory.ts");
  const history = createActionHistory();
  let ui = { color: "blue", x: 0 }, graph = { label: "A" };
  history.register("ui", { read: () => ui, write: value => { ui = value; } });
  history.register("graph", { read: () => graph, write: value => { graph = value; } });
  const edit = (next, category) => { history.record("ui", ui, next, [category], ["window:theme"]); ui = next; };
  edit({ ...ui, color: "red" }, "appearance");
  edit({ ...ui, x: 5 }, "ui");
  history.travel("undo"); assert.deepEqual(ui, { color: "red", x: 0 });
  history.travel("redo"); assert.equal(ui.x, 5);
  history.configure({ mode: "selective", categories: ["appearance"] });
  history.travel("undo"); assert.deepEqual(ui, { color: "blue", x: 5 });
  history.travel("redo"); assert.deepEqual(ui, { color: "red", x: 5 });
  history.record("graph", graph, { label: "B" }, ["omnium"], ["omnium"]); graph = { label: "B" };
  history.configure({ mode: "recent", steps: 2 });
  assert.equal(history.travel("undo"), 2);
  assert.equal(graph.label, "A"); assert.deepEqual(ui, { color: "red", x: 0 });
  assert.equal(history.travel("redo"), 2); assert.equal(graph.label, "B"); assert.equal(ui.x, 5);
});

test("history scopes, locked step cap, overlap protection and branching are safe", async () => {
  const { createActionHistory } = await import("../src/ui/actionHistory.ts");
  const h = createActionHistory(); let value = { x: 0 };
  h.register("ui", { read: () => value, write: next => { value = next; } });
  const edit = (x, category, context) => { h.record("ui", value, { x }, [category], [context]); value = { x }; };
  edit(1, "ui", "window:a"); edit(2, "settings", "window:b");
  h.activeContext = "window:a"; h.configure({ mode: "context", steps: 100, limit: 3 });
  assert.equal(h.options.steps, 3); assert.equal(h.options.limit, 3);
  assert.equal(h.travel("undo"), 0); assert.match(h.message, /overlaps/); assert.equal(value.x, 2);
  h.configure({ mode: "recent", steps: 1 }); h.travel("undo"); assert.equal(value.x, 1);
  h.configure({ mode: "context" }); h.travel("undo"); assert.equal(value.x, 0);
  edit(9, "ui", "window:a"); assert.equal(h.candidates("redo").length, 0);
  h.configure({ steps: 10 }); assert.equal(h.options.steps, 3);
  h.configure({ limit: 1 }); assert.equal(h.options.steps, 1);
});

test("coalesced history handles new object branches and creates one reversible gesture", async () => {
  const { createActionHistory } = await import("../src/ui/actionHistory.ts");
  const h = createActionHistory(); let value = {};
  h.register("ui", { read: () => value, write: next => { value = next; } });
  for (const next of [{ color: { red: 1 } }, { color: { red: 2 } }]) { h.record("ui", value, next, ["appearance"], ["window:a"], "gesture"); value = next; }
  assert.equal(h.candidates("undo").length, 1); h.travel("undo"); assert.deepEqual(value, {});
  h.travel("redo"); assert.deepEqual(value, { color: { red: 2 } });
});

test("Shift universally resolves the base action, scoped commands, custom buttons and pointer assignments", async () => {
  const { configurationTarget } = await import("../src/ui/shortcutConfiguration.ts");
  const bindings = defaultSettings().bindings;
  assert.equal(configurationTarget(bindings, "Shift+W", id => id === "context.resize"), "context.resize");
  assert.equal(configurationTarget(bindings, "Shift+Ctrl+Z", () => false), "undo");
  assert.equal(configurationTarget(bindings, "Ctrl+Shift+Z", id => id === "selector.undo"), "selector.undo");
  assert.equal(configurationTarget(bindings, "Shift+S", id => id === "context.search"), "context.search");
  assert.equal(configurationTarget(bindings, "Shift+MB4", () => false, { MB4: "undo" }), "undo");
  assert.equal(configurationTarget({ ...bindings, "button:custom": "P" }, "Shift+P", () => false), "button:custom");
  assert.equal(configurationTarget({ ...bindings, undo: "" }, "Ctrl+Shift+Z", () => false), null, "cleared bindings never revive");
  assert.equal(configurationTarget(bindings, "W", () => true), null, "normal presses execute rather than configure");
});

test("Shift executable bindings migrate without stealing keys or reviving clears", () => {
  const defaults = defaultSettings();
  assert.ok(Object.values(defaults.bindings).every(binding => !binding.split("+").includes("Shift")));
  const migrated = normalizeSettings({ bindings: { searchUI: "Shift+S", redo: "Ctrl+Shift+Z", "selector.lock": "Shift+MB3", newChild: "", "button:custom": "Shift+P" } });
  assert.equal(migrated.bindings.searchUI, "Ctrl+Alt+S");
  assert.equal(migrated.bindings.redo, "Ctrl+Y");
  assert.equal(migrated.bindings["selector.lock"], "Ctrl+MB3");
  assert.equal(migrated.bindings["button:custom"], "Ctrl+Alt+P");
  assert.equal(migrated.bindings.newChild, "");
  const occupied = normalizeSettings({ bindings: { redo: "Ctrl+Shift+Z", "button:owned": "Ctrl+Y" } });
  assert.equal(occupied.bindings.redo, ""); assert.equal(occupied.bindings["button:owned"], "Ctrl+Y");
  assert.deepEqual(normalizeSettings(migrated).bindings, migrated.bindings, "migration is idempotent");
});

test("new function settings serialize with typed property validation and safe defaults", () => {
  const settings = normalizeSettings({ functionValues: { "ui.frame.resize": { "operation.level": 500, invalid: Infinity }, future: { flag: true, count: 2, text: "value" } } });
  assert.equal(settings.functionValues["ui.frame.resize"]["operation.level"], 10);
  assert.equal(Object.hasOwn(settings.functionValues["ui.frame.resize"], "invalid"), false);
  assert.deepEqual(normalizeSettings(JSON.parse(JSON.stringify(settings))).functionValues, settings.functionValues);
  assert.deepEqual(normalizeSettings({ functionValues: { "ui.frame.resize": { "operation.level": "invalid" } } }).functionValues["ui.frame.resize"], {});
});

test("the shared configuration gesture cycles repeated presses and applies exactly once on release", async () => {
  const { createConfigurationGesture } = await import("../src/ui/configurationGesture.ts");
  const invoked = [], gesture = createConfigurationGesture(id => invoked.push(id));
  let selected = 1, applied = 0;
  assert.equal(gesture.begin("resize"), "open");
  gesture.register({ cycle: () => { selected = selected % 3 + 1; }, apply: () => { applied = selected; } });
  assert.equal(gesture.begin("resize"), "cycle"); assert.equal(selected, 2);
  gesture.begin("resize"); assert.equal(selected, 3); gesture.begin("resize"); assert.equal(selected, 1);
  assert.equal(gesture.finish(), true); assert.equal(applied, 1);
  assert.equal(gesture.finish(), false); assert.deepEqual(invoked, []);
  gesture.begin("undo"); gesture.finish(); assert.deepEqual(invoked, ["undo"]);
  gesture.begin("resize"); gesture.cancel(); assert.equal(gesture.finish(), false);
  gesture.begin("resize", false); assert.equal(gesture.finish(), false, "opening configuration by a button does not arm a release action");
});

test("MC option reset and lock preserve defaults and never double execute", async () => {
  const { createConfigurationGesture } = await import("../src/ui/configurationGesture.ts");
  const calls = [], gesture = createConfigurationGesture(id => calls.push(id));
  let choice = 2, locked = 2;
  const register = () => gesture.register({ cycle: () => { choice = choice % 3 + 1; }, select: index => { choice = index + 1; },
    reset: () => { choice = locked = 1; }, lock: () => { locked = choice; calls.push("lock"); }, apply: () => calls.push(choice) });
  gesture.begin("resize"); register(); gesture.begin("resize");
  assert.equal(choice, 3); gesture.finish(); assert.equal(locked, 2); assert.deepEqual(calls, [3]);
  gesture.begin("resize"); register(); gesture.reset(); assert.equal(locked, 1); assert.deepEqual(calls, [3]);
  gesture.finish(); assert.deepEqual(calls, [3, 1]);
  gesture.begin("resize"); register(); gesture.select(2); gesture.lock();
  assert.equal(locked, 3); assert.deepEqual(calls, [3, 1, "lock", 3]);
  assert.equal(gesture.finish(), false);
  gesture.begin("resize"); register(); gesture.begin("other"); gesture.finish();
  assert.equal(calls.at(-1), "other", "switching actions discards the old adapter");
});

test("history spectrum bounds clamp steps and remain valid after shrinking the maximum", async () => {
  const { createActionHistory } = await import("../src/ui/actionHistory.ts");
  const h = createActionHistory();
  h.configure({ minimum: 3, limit: 8, steps: 1 }); assert.equal(h.options.steps, 3);
  h.configure({ steps: 100 }); assert.equal(h.options.steps, 8);
  h.configure({ limit: 2 }); assert.equal(h.options.minimum, 2); assert.equal(h.options.steps, 2);
  const restored = createActionHistory({ minimum: -100, limit: 100, steps: -1 });
  assert.equal(restored.options.minimum, 1); assert.equal(restored.options.limit, 10); assert.equal(restored.options.steps, 1);
});

test("shared spectrum stepping clamps and quantizes without decimal drift", async () => {
  const { rangeValue } = await import("../src/ui/rangeMath.ts");
  assert.equal(rangeValue(.1 + .2, 0, 1, .05), .3);
  assert.equal(rangeValue(30, 1, 10, 1), 10);
  assert.equal(rangeValue(-30, 1, 10, 1), 1);
  assert.equal(rangeValue(.26, .1, 5, .1), .3);
  assert.equal(rangeValue(1, 1, 1, 1), 1);
});

test("search scope progresses through nearest ancestors and keeps a locked global choice global", async () => {
  const { searchScopes, searchScope } = await import("../src/ui/searchScopes.ts");
  assert.deepEqual(searchScopes(["window:theme", "window:properties"]), [
    { key: "window:properties", level: 1 }, { key: "window:theme", level: 2 }, { key: "workspace", level: 10 },
  ]);
  assert.equal(searchScope([], 1).key, "workspace");
  assert.equal(searchScope(["window:other"], 10).key, "workspace");
  assert.equal(searchScope(["window:theme", "window:properties"], 2).key, "window:theme");
});

test("programmatic catalog dispatch executes search without a button binding or DOM runner", async () => {
  const { invokeCatalogAction } = await import("../src/workspaceActions.ts");
  const { featureActionRuntime } = await import("../src/featureActions.ts");
  const calls = [], base = id => calls.push(id);
  assert.equal(invokeCatalogAction("searchUI", base), true); assert.deepEqual(calls, ["searchUI"]);
  let enabled = true;
  const stop = featureActionRuntime.register("context.search", { enabled: () => enabled, run: () => calls.push("context.search") });
  try {
    assert.equal(invokeCatalogAction("context.search", base), true); assert.equal(calls.at(-1), "context.search");
    enabled = false; assert.equal(invokeCatalogAction("context.search", base), false);
    assert.equal(invokeCatalogAction("unknown", base), false); assert.equal(calls.length, 2);
  } finally { stop(); }
});

test("active MS owns Escape before window actions, then yields once selection is cleared", async () => {
  const { preferredFeatureKey } = await import("../src/workspaceActions.ts");
  const bindings = defaultSettings().bindings;
  const active = new Set(["selector.cancel", "atomnic.cancel", "context.back"]);
  assert.equal(preferredFeatureKey(bindings, "", () => true), null);
  assert.equal(preferredFeatureKey(bindings, "Esc", id => active.has(id)), "selector.cancel");
  assert.equal(preferredFeatureKey(bindings, "Esc", id => active.has(id), true, true), "selector.cancel");
  active.delete("selector.cancel");
  assert.equal(preferredFeatureKey(bindings, "Esc", id => active.has(id)), "atomnic.cancel");
  active.delete("atomnic.cancel");
  assert.equal(preferredFeatureKey(bindings, "Esc", id => active.has(id)), "context.back");
  assert.equal(preferredFeatureKey({ ...bindings, "selector.cancel": "" }, "Esc", id => active.has(id)), "context.back");
  assert.equal(preferredFeatureKey({ ...bindings, "selector.cancel": "P" }, "P", id => id === "selector.cancel"), "selector.cancel");
});


test("Shift configuration preserves the same selector-before-window priority", async () => {
  const { configurationTarget } = await import("../src/ui/shortcutConfiguration.ts");
  assert.equal(configurationTarget(defaultSettings().bindings, "Shift+Esc", id => id === "selector.cancel" || id === "context.back"), "selector.cancel");
});

test("a searchable popup resident retains its dismissal layer after field focus", async () => {
  const { contextStackFromScopes, parentContext } = await import("../src/ui/activeContextModel.ts");
  const popup = { id: "search" }, input = { id: "query" }, owner = { id: "mc" };
  let closed = 0;
  const layer = { parent: "window:theme", close: () => closed++ };
  const framesFor = key => [{ kind: "frame", key, element: owner }];
  let stack = contextStackFromScopes([{ element: popup, frame: "window:global-ui-search", layer }], framesFor, input);
  assert.deepEqual(stack.map(entry => entry.kind), ["frame", "layer", "field"]);
  assert.equal(stack[0].key, "window:theme");
  stack = parentContext(stack); assert.equal(stack.at(-1).kind, "layer");
  assert.equal(stack.at(-1).element, popup); layer.close(); stack = parentContext(stack);
  assert.equal(closed, 1); assert.equal(stack.at(-1).key, "window:theme");
  const nested = contextStackFromScopes([{ element: owner, frame: "window:theme" }, { element: popup, frame: "window:global-ui-search", layer }], framesFor);
  assert.deepEqual(nested.map(entry => entry.kind), ["frame", "layer"], "DOM nesting and portals preserve the same dismissal order");
});

test("RMB edit migrates to deselection and Shift-selector delegates to selected-property editing", async () => {
  const settings = normalizeSettings({ bindings: { "selector.open": "MB3", "selector.edit": "MB2" } });
  assert.equal(settings.bindings["selector.open"], "Q");
  assert.equal(settings.bindings["selector.edit"], ""); assert.equal(settings.bindings["selector.deselect"], "MB2");
  const modern = normalizeSettings({ bindings: { "selector.deselect": "", "selector.edit": "Ctrl+P", "selector.open": "K" } });
  assert.equal(modern.bindings["selector.deselect"], ""); assert.equal(modern.bindings["selector.edit"], "Ctrl+P");
  assert.equal(functionShortcutBinding("selector.edit", { "selector.open": "Q", "selector.edit": "" }), "Shift+Q");
  assert.equal(functionShortcutBinding("selector.edit", { "selector.open": "Ctrl+P", "selector.edit": "" }), "Ctrl+Shift+P");
  assert.equal(FEATURE_ACTIONS.find(action => action.id === "selector.open").configurationAction, "selector.edit");
});


test("search returns a category instead of its property cross-product, retaining explicit setter queries", async () => {
  const { prepareSearchResults, matchSearchResults } = await import("../src/ui/searchMatching.ts");
  const entries = [
    { key: "sliders", label: "Sliders", appearance: { target: "ui.sliders" } },
    { key: "spectrum", label: "Spectrum / arrows", heading: "Controls › Sliders", appearance: { target: "ui.sliders.spectrum" }, appearanceProperties: [{ id: "color", label: "Color" }, { id: "opacity", label: "Opacity" }] },
    { key: "fill", label: "Filled track / thumb", heading: "Controls › Sliders", appearance: { target: "ui.sliders.fill" }, appearanceProperties: [{ id: "color", label: "Color" }] },
    { key: "color", label: "Color", heading: "Properties" },
    { key: "search", label: "Search", heading: "Workspace" },
    { key: "accent", label: "Éclairage", heading: "Visuals" },
  ];
  const index = prepareSearchResults(entries, entry => entry.key === "search" ? "Ctrl+K" : "");
  assert.deepEqual(matchSearchResults(index, "slider").map(entry => entry.key), ["sliders"]);
  assert.deepEqual(matchSearchResults(index, "color").map(entry => entry.key), ["color"]);
  const specific = matchSearchResults(index, "slider color");
  assert.equal(specific.length, 2);
  assert.ok(specific.every(entry => entry.appearance.property === "color"));
  assert.deepEqual(matchSearchResults(index, "spectrum opacity").map(entry => entry.appearance), [{ target: "ui.sliders.spectrum", property: "opacity" }]);
  assert.equal(matchSearchResults(index, "ctrl+k")[0].key, "search");
  assert.equal(matchSearchResults(index, "eclairage")[0].key, "accent");
  assert.equal(matchSearchResults(index, "no-such-control").length, 0);
  assert.equal(entries[1].appearance.property, undefined, "specific queries do not mutate branch destinations");
});

test("held actions ignore OS repeat bursts and duplicate physical presses without publishing or queuing work", async () => {
  const { createHeldActions } = await import("../src/ui/heldActions.ts");
  const held = createHeldActions(); let notifications = 0;
  held.subscribe(() => notifications++);
  const empty = held.getSnapshot();
  assert.equal(held.press("moveLeft", "KeyA", true), false, "a delayed repeat cannot begin a gesture");
  assert.equal(held.getSnapshot(), empty);
  assert.equal(held.press("moveLeft", "KeyA"), true);
  const first = held.getSnapshot();
  for (let i = 0; i < 1000; i++) assert.equal(held.press("moveLeft", "KeyA", true), false);
  assert.equal(held.press("moveRight", "KeyA"), false, "one physical key cannot switch action while held");
  assert.equal(held.getSnapshot(), first); assert.equal(notifications, 1);
  held.release("KeyA");
  assert.deepEqual(held.getSnapshot().actions, []);
  assert.equal(held.getSnapshot().generation, first.generation + 1);
});

test("held actions combine physical keys and retain an action until its last assigned key is released", async () => {
  const { createHeldActions } = await import("../src/ui/heldActions.ts");
  const held = createHeldActions();
  held.press("left", "KeyA"); held.press("up", "KeyW");
  const beforeAlias = held.getSnapshot();
  held.press("left", "ArrowLeft");
  assert.equal(held.getSnapshot(), beforeAlias);
  assert.deepEqual(held.getSnapshot().actions, ["left", "up"]);
  held.release("KeyA"); assert.equal(held.getSnapshot(), beforeAlias);
  held.release("ArrowLeft"); assert.deepEqual(held.getSnapshot().actions, ["up"]);
  assert.equal(held.release("Missing"), false);
  held.release("KeyW"); assert.deepEqual(held.getSnapshot().actions, []);
});

test("stopping held input invalidates snapshots, clears every key, and respects subscriber cleanup", async () => {
  const { createHeldActions } = await import("../src/ui/heldActions.ts");
  const held = createHeldActions(); let calls = 0;
  const unsubscribe = held.subscribe(() => calls++);
  held.press("left", "ArrowLeft"); const beforeStop = held.getSnapshot();
  held.stop(); assert.deepEqual(held.getSnapshot().actions, []);
  assert.ok(held.getSnapshot().generation > beforeStop.generation);
  assert.equal(held.release("ArrowLeft"), false);
  const stopped = held.getSnapshot(); held.stop();
  assert.ok(held.getSnapshot().generation > stopped.generation, "empty stop invalidates pending work too");
  unsubscribe(); const beforeCleanup = calls;
  held.press("right", "ArrowRight"); held.release("ArrowRight");
  assert.equal(calls, beforeCleanup);
});

test('pointed configuration selection applies once on Shift release without locking preferences',async()=>{
  const {createConfigurationGesture}=await import('../src/ui/configurationGesture.ts');
  const applied=[],gesture=createConfigurationGesture(()=>assert.fail('registered choice must handle apply'));
  let choice=0,locked=0;
  const register=()=>gesture.register({cycle:()=>choice=(choice+1)%3,select:index=>{choice=index;},apply:()=>applied.push(choice),lock:()=>{locked=choice;}});
  gesture.begin('resize');register();gesture.select(2);assert.equal(locked,0);assert.deepEqual(applied,[]);
  gesture.finish();assert.deepEqual(applied,[2]);assert.equal(gesture.finish(),false);assert.equal(locked,0);
  gesture.begin('resize',false);register();gesture.select(1);assert.equal(gesture.finish(),false);assert.deepEqual(applied,[2]);
  gesture.lock();assert.equal(locked,1);assert.deepEqual(applied,[2,1]);assert.equal(gesture.finish(),false);
});


test('symbol named visual controls remain searchable by shared aliases without renaming',async()=>{
 const {prepareSearchResults,matchSearchResults}=await import('../src/ui/searchMatching.ts');
 const entries=[{key:'math',label:'⠒❉',aliases:['mathematical dial','count dial']}],index=prepareSearchResults(entries);
 for(const query of ['⠒❉','mathematical dial','count dial'])assert.equal(matchSearchResults(index,query)[0].key,'math');
 assert.equal(entries[0].label,'⠒❉');
});


test('MC hierarchy bindings reserve Alt side buttons without replacing plain mouse history',()=>{
 const bindings=defaultSettings().bindings;
 assert.equal(bindings['context.previous'],'Alt+MB4');assert.equal(bindings['context.next'],'Alt+MB5');assert.equal(bindings['context.confirm'],'Enter');
 const event={button:3,altKey:true,ctrlKey:false,metaKey:false,shiftKey:false};
 assert.equal(matchesPointerShortcut('context.previous',bindings,event),true);
 assert.equal(matchesPointerShortcut('context.previous',bindings,{...event,altKey:false}),false);
 assert.equal(matchesPointerShortcut('context.next',bindings,{...event,button:4}),true);
 assert.equal(bindings['atomnic.confirm'],'','legacy confirmation delegates to MC without a competing default');
});


test('shared MC stage navigation resolves nearest applicable layer and retains field context',async()=>{
 const {contextLayerAction}=await import('../src/ui/activeContextModel.ts');
 const outer={},inner={},field={},calls=[];
 const layers=new Map([[outer,{close:()=>{},advance:()=>calls.push('outer')}],[inner,{close:()=>{},confirm:()=>calls.push('inner'),cancel:()=>calls.push('cancel') }]]);
 const stack=[{kind:'layer',element:outer},{kind:'layer',element:inner},{kind:'field',element:field}],before=[...stack];
 contextLayerAction(stack,layers,'confirm')();contextLayerAction(stack,layers,'advance')();contextLayerAction(stack,layers,'cancel')();
 assert.deepEqual(calls,['inner','outer','cancel']);assert.deepEqual(stack,before);
 assert.equal(contextLayerAction([],layers,'confirm'),undefined);
});

test('nested popup surfaces own their events even when React bubbles through a parent',async()=>{
 const {ownsPointerSurface}=await import('../src/ui/pointerOwnership.ts');
 const parent={},child={},parentMath={},childMath={};
 const childTarget={closest:selector=>selector==='[data-context-controller]'?child:selector==='.mathematical-dial'?childMath:null};
 assert.equal(ownsPointerSurface(parent,childTarget,'[data-context-controller]'),false,'parent must not start dragging or suppress a child click');
 assert.equal(ownsPointerSurface(child,childTarget,'[data-context-controller]'),true);
 assert.equal(ownsPointerSurface(parentMath,childTarget,'.mathematical-dial'),false,'amount-slot painting must not edit the parent property');
 assert.equal(ownsPointerSurface(childMath,childTarget,'.mathematical-dial'),true);
 assert.equal(ownsPointerSurface(parent,null,'[data-context-controller]'),false);
});


test('secondary menus activate once on release in either native contextmenu order',async()=>{
 const {createSecondaryRelease}=await import('../src/ui/secondaryRelease.ts');
 const click=createSecondaryRelease();
 assert.equal(click.hasPress(),false);
 click.press('press');
 assert.equal(click.hasPress(),true,'mouse-only right-button chords can detect an already recorded press');
 assert.equal(click.context(),undefined,'press-time contextmenu must not expose controls');
 assert.equal(click.release('release'),'release');
 assert.equal(click.hasPress(),false);
 assert.equal(click.context(),undefined,'the same click cannot open settings again');
 click.press('press');
 assert.equal(click.release('release'),undefined,'wait for native contextmenu when it follows release');
 assert.equal(click.context(),'release');
 assert.equal(click.context(),undefined);
 click.press('cancelled');click.cancel();
 assert.equal(click.release('release'),undefined);
 assert.equal(click.context(),undefined);
 click.press('abandoned');click.press('new');
 assert.equal(click.context(),undefined);
 assert.equal(click.release('latest'),'latest','new press replaces abandoned state');
});


test('saved button shortcuts yield to active scoped commands before reporting a missing resident',async()=>{
 const {residentShortcutAction}=await import('../src/workspaceActions.ts');
 const saved=normalizeSettings({bindings:{'button:context:node:edit':'R'}}).bindings;
 assert.equal(saved['atomnic.rotate'],'R','different scopes retain their bindings');
 assert.equal(residentShortcutAction(saved,'R',id=>id==='atomnic.rotate'),'atomnic.rotate');
 assert.equal(residentShortcutAction(saved,'R',()=>false),'button:context:node:edit','saved node binding remains usable outside the content operation');
 assert.equal(residentShortcutAction({...saved,'atomnic.rotate':''},'R',()=>true),'button:context:node:edit','explicit clears are respected');
 assert.equal(residentShortcutAction({...saved,'atomnic.rotate':'T'},'T',id=>id==='atomnic.rotate'),'atomnic.rotate','rebound commands use the same arbitration');
 assert.equal(residentShortcutAction(saved,'',()=>true),null);
});


test('newly appeared settings controls cannot inherit the opener right-click',async()=>{
 const {contextPressOwnsControl}=await import('../src/ui/contextMenuOwnership.ts');
 const canvas={},body={},popup={},sizeRange={},sizeInput={},icon={};
 const openingPath=[canvas,body];
 assert.equal(contextPressOwnsControl(openingPath,sizeInput),false,'size input mounted under the release must ignore it');
 assert.equal(contextPressOwnsControl(openingPath,sizeRange),false);
 assert.equal(contextPressOwnsControl(openingPath,undefined),true,'the original canvas menu still receives its context event');
 assert.equal(contextPressOwnsControl([icon,popup,body],sizeInput),false,'another control in the same existing popup cannot receive the press either');
 assert.equal(contextPressOwnsControl([sizeInput,sizeRange,popup,body],sizeInput),true,'a fresh deliberate settings click works');
 assert.equal(contextPressOwnsControl(null,sizeInput),false,'unknown pointer origin cannot configure a newly visible control');
 assert.equal(contextPressOwnsControl(null,sizeInput,true),true,'keyboard-native context invocation is explicitly allowed');
});

test('value sliders traverse a generated sequence without replacing its rule',async()=>{
 const {rangeSequence,sequenceIndex,sequenceAt,sequenceStep}=await import('../src/ui/rangeMath.ts');
 const values=rangeSequence([10,5,2.5,1.25,5,NaN],0,64);
 assert.deepEqual(values,[1.25,2.5,5,10]);
 assert.equal(sequenceAt(values,0),1.25);assert.equal(sequenceAt(values,1),10);
 assert.equal(sequenceAt(values,.5),5,'nonlinear values are traversed by index, never linearly interpolated');
 assert.equal(sequenceStep(values,5,-1),2.5);assert.equal(sequenceStep(values,5,1),10);
 assert.equal(sequenceStep(values,6,-1),5);assert.equal(sequenceStep(values,6,1),10);
 assert.equal(sequenceIndex(values,4.9),2);
 assert.deepEqual(rangeSequence(values,2,8),[2.5,5],'limits filter execution without changing the generator');
 assert.equal(sequenceAt([],1),undefined);assert.equal(sequenceStep([],1,1),undefined);
 assert.equal(sequenceAt([7],.95),7);
});

test('DOF options inherit configurable pointer scope priority and physical press de-duplication',async()=>{
 const {pointerFeatureKey,defaultSettings}=await import('../src/workspaceActions.ts');
 const {pointerCommandGate}=await import('../src/ui/pointerCommandGate.ts');
 const bindings=defaultSettings().bindings;
 assert.equal(bindings['atomnic.dofOptions'],'MB3');
 const event={button:1,ctrlKey:false,altKey:false,shiftKey:false,metaKey:false,target:{closest:s=>s.includes('data-atomnic-surface')?{}:null}};
 assert.equal(pointerFeatureKey(bindings,event,id=>id==='atomnic.dofOptions'),'atomnic.dofOptions');
 assert.equal(pointerFeatureKey(bindings,{...event,target:{closest:()=>null}},id=>id==='atomnic.dofOptions'),null);
 assert.equal(pointerFeatureKey({...bindings,'selector.include':'MB3'},event,id=>['atomnic.dofOptions','selector.include'].includes(id)),'selector.include');
 assert.equal(pointerFeatureKey({...bindings,'atomnic.dofOptions':'MB4'},{...event,button:3},id=>id==='atomnic.dofOptions'),'atomnic.dofOptions');
 const gate=pointerCommandGate();gate.pointer(1);
 assert.equal(gate.mouse(1),false,'compatibility mouse event cannot toggle twice');
 assert.equal(gate.mouse(2),true,'a chord without pointerdown still dispatches');
 gate.pointer(1);gate.release(1);assert.equal(gate.mouse(1),true);
});

test('free-space scalar scrubbing locks the first drag axis and reverses without following geometry',async()=>{
 const {createValueScrub}=await import('../src/ui/valueScrub.ts');
 const config={origin:{x:0,y:0},width:100,value:50,min:0,max:100,step:1};
 const right=createValueScrub(config);
 assert.equal(right.sample({x:2,y:0}),undefined,'press/jitter does not edit a value');
 assert.equal(right.sample({x:4,y:0}),54);
 assert.equal(right.sample({x:20,y:900}),70,'perpendicular motion does not change or relock the axis');
 assert.equal(right.sample({x:-10,y:900}),40,'reversing past the start decreases');
 const left=createValueScrub(config);assert.equal(left.sample({x:-4,y:0}),54);assert.equal(left.sample({x:-20,y:90}),70);
 const down=createValueScrub(config);assert.equal(down.sample({x:0,y:4}),54);assert.equal(down.sample({x:900,y:20}),70);
 const up=createValueScrub(config);assert.equal(up.sample({x:0,y:-4}),54);assert.equal(up.sample({x:900,y:-20}),70);
 const diagonal=createValueScrub(config);assert.equal(diagonal.sample({x:3,y:4}),55);
 assert.equal(diagonal.sample({x:-40,y:30}),50,'motion perpendicular to the original diagonal contributes zero');
 assert.equal(diagonal.sample({x:30,y:40}),100);assert.equal(diagonal.sample({x:-30,y:-40}),0);
});

test('nested editor navigation resolves confirmation and cancellation independently',async()=>{
 const {contextNavigationAction}=await import('../src/ui/contextNavigation.ts');
 const outer={contains:node=>node===inner||node===leaf},inner={contains:node=>node===leaf},leaf={contains:()=>false};
 const calls=[],entries=[{owner:{current:outer},confirm:()=>calls.push('outer confirm'),advance:()=>calls.push('outer advance')},{owner:{current:inner},confirm:()=>calls.push('preview commit')},{owner:{current:leaf},cancel:()=>calls.push('stroke cancel')}];
 contextNavigationAction(entries,'confirm')();contextNavigationAction(entries,'cancel')();contextNavigationAction(entries,'advance')();
 assert.deepEqual(calls,['preview commit','stroke cancel','outer advance'],'a cancel-only child cannot hide the current value confirmation');
 assert.equal(contextNavigationAction(entries,'back'),undefined);
 const reordered=[entries[1],entries[0],entries[2]];contextNavigationAction(reordered,'confirm')();
 assert.equal(calls.at(-1),'preview commit','DOM containment, not effect registration order, selects the deeper owner');
});

test('popup dismissal yields to active input owners and every registered popup interior',async()=>{
 const {dismissContextPointer}=await import('../src/ui/activeContextModel.ts');
 const grid={},blankInside={},outside={},calls=[];
 const parent={contains:node=>node===grid||node===blankInside},child={contains:node=>node===grid};
 const layers=new Map([[parent,{close:()=>{},dismiss:()=>calls.push('parent')}],[child,{close:()=>{},dismissOutside:true,dismiss:()=>calls.push('child')}]]);
 assert.equal(dismissContextPointer(layers,outside,true,false),false,'MS or another active input owner gets the press before either dismissal path');
 assert.equal(dismissContextPointer(layers,grid,false,false),false,'a grid needs no control/button/role marker to own its popup interior');
 assert.equal(dismissContextPointer(layers,blankInside,false,false),false,'a parent popup interior cannot dismiss its active child');
 assert.deepEqual(calls,[]);
 assert.equal(dismissContextPointer(layers,outside,false,true),true,'explicit outside-dismissal retains its consume-on-outside behavior');
 assert.deepEqual(calls,['child']);
 const generic=new Map([[parent,{close:()=>{},dismiss:()=>calls.push('generic')}]]);
 assert.equal(dismissContextPointer(generic,outside,false,true),false,'ordinary native/content controls remain usable for generic dials');
 assert.equal(dismissContextPointer(generic,outside,false,false),true);
 assert.deepEqual(calls,['child','generic']);
});

test('logical popup parents register before portalled children and navigation updates preserve the deepest value owner',async()=>{
 const {insertContextLayer,contextLayerAction}=await import('../src/ui/activeContextModel.ts');
 const frame={kind:'frame',key:'composer'},outer={},inner={},leaf={},calls=[];
 const layers=new Map([[inner,{ancestors:[outer],close:()=>{},confirm:()=>calls.push('inner')}]]);
 let stack=insertContextLayer([frame],inner,layers);
 layers.set(outer,{close:()=>{}});stack=insertContextLayer(stack,outer,layers);
 assert.deepEqual(stack,[frame,{kind:'layer',element:outer},{kind:'layer',element:inner}],'late parent registration cannot put the parent above its child');
 const before=[...stack];layers.get(outer).confirm=()=>calls.push('outer');
 contextLayerAction(stack,layers,'confirm')();assert.deepEqual(calls,['inner'],'new parent actions cannot steal confirmation');
 assert.deepEqual(stack,before,'action availability does not rebuild the scope stack');
 layers.set(leaf,{ancestors:[inner,outer],close:()=>{},confirm:()=>calls.push('leaf')});stack=insertContextLayer(stack,leaf,layers);
 stack=insertContextLayer(stack,outer,layers);
 assert.deepEqual(stack.map(e=>e.element??e.key),['composer',outer,inner,leaf]);
 contextLayerAction(stack,layers,'confirm')();assert.deepEqual(calls,['inner','leaf']);
});

test('Enter accepts the preview before finishing its stage, while rejected choices and cancel retain editing',async()=>{
 const {confirmContextStage}=await import('../src/ui/contextNavigation.ts');
 const {mathematicalValueSession}=await import('../src/properties/mathematicalDial.ts');
 const {confirmValue}=await import('../src/ui/valueConfirmation.ts');
 const session=mathematicalValueSession({x:1,y:2},(a,b)=>a.x===b.x&&a.y===b.y),calls=[];
 session.preview({x:9,y:6});
 assert.deepEqual(session.restore(),{x:1,y:2},'leaving an unconfirmed preview is still cancellation');
 session.preview({x:9,y:6});
 assert.equal(confirmContextStage(()=>confirmValue({candidate:()=>session.expected,onCommit:value=>{session.commit(value);calls.push('commit');}}),()=>{calls.push('finish');session.restore();}),true);
 assert.deepEqual(calls,['commit','finish'],'finishing may unmount/cancel the surface only after its owner accepts');
 assert.deepEqual(session.restore(),{x:9,y:6},'leaving/unmount after Enter retains the accepted value');
 assert.equal(confirmContextStage(()=>false,()=>calls.push('invalid finish')),false);
 assert.deepEqual(calls,['commit','finish'],'invalid/no-candidate selection cannot close the stage');
});

test('hovering a popup activates its logical confirmation scope before any click',async()=>{
 const {contextLayerScope,contextLayerAction}=await import('../src/ui/activeContextModel.ts');
 const frame={kind:'frame',key:'composer'},parent={},child={},removed={},calls=[];
 const layers=new Map([[parent,{close:()=>{},confirm:()=>calls.push('parent')}],[child,{ancestors:[parent,removed],close:()=>{},confirm:()=>calls.push('child')}] ]);
 const stack=contextLayerScope([frame],child,layers);
 assert.deepEqual(stack,[frame,{kind:'layer',element:parent},{kind:'layer',element:child}]);
 contextLayerAction(stack,layers,'confirm')();assert.deepEqual(calls,['child'],'Enter has the child owner without a prior selection click');
 assert.deepEqual(contextLayerScope([frame],removed,layers),[frame],'closed layers cannot reactivate');
});
