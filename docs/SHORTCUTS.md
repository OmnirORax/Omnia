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

The selector command group includes configuration/aiming (Q), geometry modes
(E), toggle pattern / define geometry (LMB/MB1, stable ID `selector.include`), deselect pointed pattern or all (RMB/MB2), selected-property editing
(Shift + selector shortcut, default Shift+Q), polygon finish (Enter), disable/clear (Esc), selection undo/redo and
unassigned commands for BG detection, Selection / Preview, contour, inside/outside, releasing geometry, closing paths,
finite bounds, color stops, Self inventory and logical Mouse selection. The separate exclude
command is retired. Exact untouched older pointer bundles migrate to these
single-toggle defaults; custom bindings and later clears remain intact.

Click/drag geometry, polygon closure, automatic previews before the first
boundary/selection, Hold Ctrl for later previews, Shift+Wheel for fine geometry
rotation before or after placement (Ctrl+Shift+Wheel is 10× faster), Wheel for
pointed-owner depth before placement, and platform keyboard
context menus remain listed alongside commands. A click toggles current
membership; circle checkboxes supply the region baseline. Buttons and pointer/key
input use the same registered handlers. F2 focused-label rename and focused-control
context actions derive their descriptions from gesture metadata.

Self inventory is one cataloged, rebindable command. Its rows use native logical
target selection through the shared selector API. New coupled meta descendants
need no private key handlers or handwritten target command lists. The existing
Mouse-selection command remains compatible with saved bindings.

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


The stationary selector exposes labeled Selection / Preview and BG buttons below
the circle. Both titles show their live binding or Unassigned. In Shortcuts →
Visual selector, search **Toggle Selection / Preview** or **Toggle BG / empty space
detection**. Both remain unassigned by default; saved bindings/explicit clears are
preserved. BG's label includes both aliases so searching "space" finds it.

MS cursor locking uses `selector.lock` (Ctrl+MB3 by default). It is a normal
rebindable catalog action: park MS / use normal cursor, then resume MS. The former
Hold Ctrl selection-preview gesture is removed; Selection / Preview remains an
independent feedback visibility toggle.

## Active UI context

The shared catalog declares Esc (one level back), S (search active frame), X
(close), M (minimize), D (toggle descendants), and Ctrl+Alt+S (global UI search).
Master Controller → Active context exposes the same commands as clickable buttons.
Click/focus activates a field, popup or frame; hovering does not. Esc cancels an
uncommitted field draft first, then exits its popup/parent, then minimizes the
frame. Letter shortcuts do not intercept typing. World-axis X remains available
when no UI frame is active. Legacy default global S migrates to Ctrl+Alt+S only if
that binding is free; custom bindings and explicit clears survive.

The controller preserves the previous target while its action buttons are used.
The transient stack in `ActiveContext.tsx` is not saved UI/appearance/history.
Shared draft editors use `useCancelValueEdit`; popup adapters use `useActiveLayer`
(or `useOutsideDismiss`). Frame adapters can veto close/minimize by returning
false, preserving pending appearance Apply/Discard/Cancel behavior. Protected
hold-Esc recovery stays independent. No website shortcut closes browser tabs.

## Shared action history

MB4/MB5 default to Undo/Redo using the retained settings. Hold Shift and press
either configured base undo/redo mouse trigger to open Master Controller's compact
history projection; repeat the trigger to cycle scopes and release Shift to execute
the chosen history operation once.
Wheel cycles: most recent action (default), active context, selective categories.
Over category controls it cycles categories; checkboxes permit multiple categories.
Over the step spectrum it changes the current count. Left-click its bars selects
min/max; right-click the bars edits those limits. Right-click the dot types a count;
left-click arrows nudges, right-click arrows edits their jump size. The hard maximum
is 10; chosen bounds stay fixed until explicitly edited.
Ctrl+Z / Ctrl+Y route through the same general history commands; the visual
selector still has its explicit transient selection timeline and scoped shortcuts.

The obsolete Shift-side-button UI-only defaults migrate to `history.configure`.
Legacy explicit UI undo/redo commands remain category-filtered commands.
`actionHistory.ts` records per-owner patches, categories and affected contexts.
Global undo uses commit order, not whichever subsystem has an open draft. Selective
undo preserves unrelated paths and refuses overlapping newer changes with feedback.
Arrays are atomic patches, so some dependent edits must be undone in reverse order.
After undo, a new edit clears the redo branch. A multi-step request stops at the
first unavailable/conflicting action. No pointer-move scans or persisted snapshots.

## Universal configuration signature (supersedes feature-specific Shift routes)

Shift is reserved for configuring the function behind any assigned shortcut.
Hold Shift, press its normal trigger, configure only that function's adaptive
controls. Repeat the shortcut to cycle options, then release Shift to execute
the chosen option once. Right-click an MC option applies and locks its future
default; left-click resets to priority 1. Temporary choices preserve locked
defaults. The opening press does not execute. This
single router replaces history's private Shift route and applies to future actions
without per-feature input handlers. Native gestures which are not shortcuts (such
as Shift+wheel geometry rotation) retain their normal mechanics.

Executable shifted bindings migrate to non-Shift alternatives. Current defaults
are Ctrl+Alt+S global search, Ctrl+Y redo, Ctrl+MB3 MS lock, Ctrl+Alt+N new child,
Ctrl+Alt+E subtree expansion, Ctrl+Alt+F local fit and Ctrl+/ shortcuts. Shortcut
capture explains why Shift cannot be assigned to an executable command. Explicit
clears remain cleared; migrations never steal another assigned combination.

W resizes/restores the active frame; Shift+W shows its detected levels. Hover/focus
previews a level; scrolling/cycling changes the temporary choice. Right-click
applies and locks a level; left-click restores priority 1. Read
[FUNCTION_CONFIGURATION.md](FUNCTION_CONFIGURATION.md) for the shared architecture.


S now uses the retained progressive search scope. Shift+S configures nearest frame,
parents or All UI; repeat to cycle and release Shift to focus the chosen search
before typing. All UI is available even without an active frame. Ctrl+Alt+S remains
a compatible direct global alias. Copy properties/Paste applicable properties are
cataloged MC actions, unassigned by default, preserving native text copy/paste.
Float active frame is also a shared MC Active context action, replacing repeated
sidebar ↗ buttons; existing movement/pin restrictions and UI history apply.


When feature bindings overlap, keyboard routing uses active scope priority:
Visual selector → active UI context → global. Active MS or its accepted selection
therefore owns Escape before the active window; clearing MS yields subsequent
Escape to the normal field/popup/window stack. Cleared/rebound bindings, typing,
availability, capture and protected recovery rules remain authoritative. Shift
configuration resolves the same priority. Do not rely on listener mount order.


The selector action declares `configurationAction: selector.edit`: universal Shift
routing opens the existing selected-property MC instead of its old generic Shift
configuration. This follows the live base binding and uses shared catalog dispatch;
there is no private Shift+Q listener or executable Shift binding. Shortcut search
shows the derived editing gesture. Q is the new selector default; legacy default
MB3/RMB-edit settings migrate when Q is free, preserving other custom assignments.


## Held node movement

The existing rebindable nudge actions (arrows by default) use physical held-key
state, not OS repeat counts. A tap previews one grid/default step; after 180ms,
holding moves at 12 steps/sec in the captured camera plane. Diagonals normalize.
`ui/heldActions.ts` follows the same action catalog/settings and releases by
physical code even if modifiers/focus change. Key repeats and stale initial events
(over 150ms old) never enqueue document actions. Shift configuration/typing/capture
and existing feature priority remain authoritative.

`navigation/nudgeGesture.ts` snapshots the selected node and its visible descendants
once (maximum 256 visible nodes) and previews existing scene anchors. Each frame
advances at most 32ms, dropping missed time instead of catching up after stalls.
Key release stops/cancels frame work immediately and commits once through the
existing onMove/collision/history owner; there are no per-frame React, graph,
validation, texture rebuild, history or storage writes. Backlogged repeat events
cannot restart motion after release. Collision/grid validation happens on release,
so the final safe position can differ from an overlapping preview.

Blur, page suspension, starting another command or pointer interaction finishes
held input. Entering a field/blocking dialog, rebinding and selection changes clear
it. Scene/document replacement cancels its old preview before replacing objects;
no stale scheduled frame may move a new target. Explicit clicks/programmatic nudge
commands remain single-step catalog actions.
