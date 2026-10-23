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
  assert.equal(defaults.bindings["selector.open"], "MB3");
  assert.equal(defaults.bindings["selector.pattern"], "E");
  assert.equal(keyConflict(defaults.bindings, "selector.pattern", "E"), null, "contextual E coexists with global expand");
  assert.equal(actionForKey(defaults.bindings, "E"), "expand", "inactive selector never steals global E");
  assert.equal(keyConflict(defaults.bindings, "selector.pattern", "Ctrl+Z"), "selector.undo");
  const previous = { bindings: { "button:existing": "MB3", "selector.clear": "E", searchUI: "Q" } };
  const loaded = normalizeSettings(previous);
  assert.equal(loaded.bindings["selector.open"], "", "new defaults cannot steal saved global bindings");
  assert.equal(loaded.bindings["selector.pattern"], "", "same-context saved bindings win over a newly added default");
  assert.equal(loaded.bindings.searchUI, "Q");
  assert.ok(FEATURE_GESTURES.some(gesture => gesture.id === "selector.pick"));
  assert.ok(FEATURE_GESTURES.some(gesture => gesture.id === "selector.depth"));
  assert.equal(normalizeSettings({ bindings: { "selector.open": "", "selector.pattern": "Ctrl+Alt+P" } }).bindings["selector.open"], "");
});

test("selector single-toggle defaults migrate retired operation bundles without reviving later clears", () => {
  const dual = { bindings: { "selector.edit": "", "selector.include": "MB2", "selector.exclude": "MB1", "selector.finishGeometry": "Enter" } };
  const migrated = normalizeSettings(dual);
  assert.equal(migrated.bindings["selector.include"], "MB1");
  assert.equal(migrated.bindings["selector.edit"], "MB2");
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
    assert.equal(functionShortcutBinding(id, bindings), "MB3");
  const rebound = { ...bindings, "selector.open": "Ctrl+P", "button:custom-action": "Shift+MB3" };
  for (const id of ["selector.open", "shortcut:selector.open"])
    assert.equal(functionShortcutBinding(id, rebound), "Ctrl+P", "old MB3 must disappear from search metadata");
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
  assert.equal(defaults.searchUI, "Shift+S");
  assert.equal(normalizeSettings({ bindings: { searchUI: "S" } }).bindings.searchUI, "Shift+S");
  assert.equal(normalizeSettings({ bindings: { searchUI: "Q" } }).bindings.searchUI, "Q");
  assert.equal(normalizeSettings({ bindings: { searchUI: "" } }).bindings.searchUI, "");
  const occupied = normalizeSettings({ bindings: { searchUI: "S", "button:custom": "Shift+S" } });
  assert.equal(occupied.bindings.searchUI, "S");
  assert.equal(occupied.bindings["button:custom"], "Shift+S");
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
