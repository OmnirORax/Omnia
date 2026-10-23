# Universal function configuration

Shift is the Master Controller configuration modifier. Hold Shift, press any
configured shortcut (keyboard or mouse), adjust the function's compact adaptive
controls. Repeated presses of the same shortcut cycle options; release Shift to
execute the chosen option once. The opening press does not execute. Right-click
an MC option to apply it immediately and lock it as the future default; left-click
an option to reset the function to priority 1. Temporary cycling/scrolling never
replaces the locked default. The normal shortcut uses that retained default.
This is a project-wide interface contract, not a special history/resize gesture.
Ordinary uppercase text entry remains native. Binding capture and protected
appearance recovery retain their input safety rules.

`ui/ShortcutConfiguration.tsx` owns the single early capture router. The pure
`shortcutConfiguration.ts` resolves the unshifted binding, prioritizing enabled
contextual actions and respecting saved bindings/clears. Side-button assignments
join the same resolution path. Pointer command tails are consumed. Do not add
another feature-specific Shift handler. The public `openActionConfiguration`
request can expose the same configuration through a clickable control.

A normal action belongs in ACTIONS / FEATURE_ACTIONS. Component-owned actions use
`useFeatureActions`. Adjustable inputs belong in a co-located `*.function.ts`,
with the existing property IDs, real state read/write adapters and `controls`
linking their actions. The generic projection automatically finds those consumers
and reuses PropertyEditor. A function with no additional declared inputs still
exposes its shared shortcut setting. This is capability discovery, not inference
of arbitrary code variables.

Specialized action configurations attach React content through the existing
`UIFunction.configuration` field or a `useFeatureActions` handler's `configuration`
content. This is a renderer adapter, not another shortcut/property inventory.
History aliases share the same HistoryControls and journal. Resize choices use
its discovered Level input, with the shared settings adapter. Future actions
inherit Shift routing without another input handler. Preview adapters are needed
only for specialized visual behavior; do not claim arbitrary effects can be
simulated without a renderer.

Shift-bearing executable bindings are retired/migrated to available non-Shift
bindings. New defaults: Ctrl+Alt+S global search; Ctrl+Y redo; Ctrl+MB3 selector
lock; Ctrl+Alt+N new child; Ctrl+Alt+E subtree expansion; Ctrl+Alt+F local fit;
Ctrl+/ shortcuts. Saved explicit clears remain cleared. A displaced custom binding
moves to a free Ctrl+Alt equivalent, or is cleared if that would collide. Shortcut
capture rejects new Shift-bearing assignments and explains the reserved gesture.
Both shortcut screens list the universal gesture through FEATURE_GESTURES.

# Active-frame resize / restore

`context.resize` defaults to W. Shift+W shows only resize configuration. Level 1
expands to the nearest surrounding detected frame edges; subsequent levels expand
progressively, up to the available website viewport. This does not request browser
fullscreen. Levels are computed from one geometry snapshot on invocation/opening;
hover/focus draws an outline without layout, ownership or history writes.

`ui/resize.function.ts` declares the shared ordinal Level input, its consumer and
settings adapter. Values use the normalized extensible `settings.functionValues`
map. The generic Master Controller also discovers it automatically.

Execution records the selected viewport projection in the original frame's layout
state. `FrameViewportSystem` projects that same mounted payload into the top layer;
it does not detach it, duplicate its editor, change canonical data or rebuild its
dock tree. Pressing W again removes the projection and restores the retained
original arrangement. Undo/redo follows the existing UI journal. Pinned frames
reject resize. The viewport projection is validated/serialized with its owner.
Preview/configuration surfaces use top-layer rendering so they remain usable above
an enlarged frame. No geometry scans occur on pointer movement or choice hovering.

## Shared choice interaction and invocation inputs

`configurationGesture.ts` owns session arming, repeated presses, exactly-once
release, cancellation and right-click completion. `ConfigurationInteractionBoundary`
handles option clicks centrally. Specialized adapters register only cycle/select,
apply, lock and reset operations through `useConfigurationInteraction`; option
buttons declare `data-configuration-option` with their zero-based index. Do not
add feature-specific input listeners. Left-click resets immediately and leaves
configuration open; releasing Shift then executes priority 1. Right-click selects,
locks, applies and closes, disarming the later Shift release. Explicit button-based
opening is unarmed: merely releasing Shift does not execute an action.

Generic configurations draft existing coupled inputs locally. `withFunctionInputs`
overlays them for the synchronous shared action invocation; `bindStateProperties`
reads that overlay without preference writes, rollback or extra history entries.
Locking uses the ordinary validated setter. Actions must consume their declared
bound inputs during invocation; capture needed values before asynchronous work.
Arbitrary direct state reads and deferred reads cannot inherit temporary values.
A specialized adapter may execute its chosen operation directly (resize geometry,
history scope) while keeping the same gesture and persistence contract. No runtime
code inspection or automatic enumeration of arbitrary behavior is implied.


## Progressive search scope

S (`context.search`) executes the retained search scope. Shift + its configured
binding shows real options: active frame, each enclosing frame, then All UI. Repeat
or scroll to cycle; release Shift to open/focus the chosen search, then type.
Right-click locks a scope, left-click restores nearest scope. Without an active
frame, nearest means All UI. Global is stored at ordinal 10 so locking it remains
global across different nesting depths. `search.function.ts` reuses the shared
Level input with independent values; SearchController supplies the existing shared
interaction adapter and frame/global search renderers. Ctrl+Alt+S remains a direct
global-search alias for existing bindings, but is not required to reach All UI.
