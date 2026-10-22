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

The complete command group includes toggling configuration / selection (MB3), cycling patterns
(E), editing accepted appearance (MB2), disable/clear (Esc), selection undo/redo
(Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y) and unassigned commands for the ring, inside/outside,
include/exclude, clear, aiming, finite bounds and color termination. Their buttons
and input paths invoke the same handlers. A selected appearance editor retains
normal property editing and its own input-preview lifecycle.

Left-click/drag picking, wheel boundary depth and platform context menus are
listed alongside the selector commands. Native focused-label F2 rename and
focused-control context actions also derive their descriptions/keys from the
gesture metadata. No independent feature settings store or copied shortcut
editor is introduced.

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
