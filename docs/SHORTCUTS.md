# Shared shortcuts and feature commands

Every feature command belongs to `ACTIONS` in `workspaceActions.ts`. Its global
entries and the component-owned `FEATURE_ACTIONS` manifest form one catalog, not
two user-facing inventories. Both shortcut screens, defaults, saved binding
normalization, action functions and conflict checks derive from it automatically.
Never add a feature's key to a private event handler and separately describe it
in a shortcut list.

## Adding a feature

Declare each command once in `featureActions.ts`: stable ID, owner, category,
label, default binding (empty is valid), activation scope and description. Add
the feature's callbacks and availability using `useFeatureActions(owner, handlers)`.
The typed handler map requires every declared command for that owner. The shared
runtime rejects an unknown ID, removes handlers on unmount and restores the prior
live handler when multiple mounted contexts share an action.

Use the hook's `handle(event)` in the feature's keyboard/pointer adapter and
`invoke(id)` for its buttons. Use `binding(id)` for hints. The adapter owns native
gesture timing, pointer ownership and geometry; it does not compare hard-coded
keys or middle/side-button numbers. The hook registers the same actions in the
live function registry, so library/moved controls and shortcut rows use the same
behavior and availability. Inactive contextual commands remain cataloged.

Letter/function-key and middle/side-button shortcuts introduced as private
literals fail `tests/shortcuts.test.mjs`, including common lowercased and aliased
comparisons. This source audit complements the typed API; it is not an exhaustive
JavaScript behavior detector. Its narrow legacy exceptions are only existing
MB4/5 hardware adapters that already use configurable `settings.mouse` actions.
Do not add feature-specific exceptions. Native widget Enter/Escape/arrows and
primary/context-click mechanics are conventional gestures, not hidden hotkeys.
Register meaningful feature gesture descriptions in `FEATURE_GESTURES`, which
both shortcut screens also render. Renderer-specific gestures are described as
gestures rather than offered a rebind operation their adapter cannot support.
The protected Hold-Escape recovery gesture is also listed and reads its fixed
key/hold duration from this metadata; ordinary rebinding cannot disable recovery.

## Binding behavior

- Keyboard and pointer commands use the existing settings `bindings` map. Mouse
  buttons normalize to MB1 left, MB2 right, MB3 middle, MB4 back and MB5 forward,
  with the same Ctrl/Cmd, Alt and Shift modifiers used for keyboard bindings.
  Rebinding records either kind of input; Escape cancels capture.
- Empty means unassigned. Clearing/rebinding a command disables its old trigger;
  there is no hard-coded fallback. Native platform context-menu gestures remain
  available as listed gestures.
- Conflict checks reject duplicate bindings in the same activation scope.
  Contextual bindings may share a global key: the active feature's capture
  adapter handles them before global actions. Within a feature, contextual
  commands precede global commands. For example E expands nodes normally and
  cycles pattern modes only while configuring/aiming the visual selector.
- While recording a binding or editing a blocked dialog, feature matching and
  picking pause. Keyboard input in fields is ignored unless a command explicitly
  declares `allowTyping`. Repeats do not replay feature commands.
- A mouse press used to record or invoke a command belongs to UI. Its trailing
  click/contextmenu must not run another action after capture closes. The shared
  recording guard and existing UI ownership protect that lifecycle.
- Newly introduced defaults never steal an existing saved binding in the same
  scope. Saved assignments and deliberately cleared bindings survive reload,
  templates and normal interface history; scoped defaults can coexist with
  global assignments.

## Visual selector integration

The selector command group includes configuration/aiming (MB3), geometry modes
(E), toggle pattern / define geometry (LMB/MB1, stable ID `selector.include`), edit
(RMB/MB2), polygon finish (Enter), disable/clear (Esc), selection undo/redo and
unassigned commands for contour, inside/outside, releasing geometry, closing paths,
finite bounds, color stops and logical Mouse selection. The separate exclude
command is retired. Exact untouched older pointer bundles migrate to these
single-toggle defaults; custom bindings and later clears remain intact.

Click/drag geometry, polygon closure, automatic previews before the first
boundary/selection, Hold Ctrl for later previews, Shift+Wheel for fine geometry
rotation before or after placement, Wheel for pointed-owner depth before placement, and platform keyboard
context menus remain listed alongside commands. A click toggles current
membership; circle checkboxes supply the region baseline. Buttons and pointer/key
input use the same registered handlers. F2 focused-label rename and focused-control
context actions derive their descriptions from gesture metadata.

Pointer commands can declare native `pointerGestureModifiers` in the shared
feature catalog. The selector's selection command treats held Ctrl-preview as
transparent to its saved pointer binding. Dispatch first checks every exact
binding, so an explicit modified command keeps priority. Gesture matching preserves
rebindings, clears and unrelated modifiers; it is not another button fallback.
The selector consumes the complete owned pointer/mouse press, release and click
tail even when no command matches, preventing underlying function activation.

Frame search, global UI search and library filtering resolve each function or
`shortcut:` row through `functionShortcutBinding`. Current bindings are searchable
metadata and appear on search results, even when a command's name contains no key
name. Matching reads live settings rather than capturing hint text in the search
index, so rebinding/clearing changes the search immediately. Custom function
bindings use the same path. Ordinary input values remain excluded from search.

The normal model suite checks catalog/default integration, saved-key precedence,
scope conflicts, cleared/rebound mouse and keyboard matching, future-owner runtime
availability/cleanup and the private-hotkey architecture rule. Browser interaction
testing remains user-driven unless requested.
