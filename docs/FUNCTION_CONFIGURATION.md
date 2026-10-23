# Universal function configuration

Shift is the Master Controller configuration modifier. Hold Shift, press any
configured shortcut (keyboard or mouse), adjust the function's compact adaptive
controls, then release Shift to finish. The function does not execute on that
press or on Shift release. Its normal shortcut executes with retained settings.
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
