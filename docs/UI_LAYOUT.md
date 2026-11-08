# UI layout and templates

React Rnd supplies window resizing and bounds. Native desktop HTML drag-and-drop moves function, frame and window references through one drop resolver. No dashboard or second editor framework is introduced. The primary interaction is desktop mouse input; touch-specific arrangement is not implemented.

`src/ui/layout.ts` validates version-2 UI layouts and explicitly migrates version-1 square cells into ordered resident references and row breaks, preserving function identity, appearance and window state. The browser storage key stays `omnium.ui.layout.v1` so earlier saves are found. Stable function IDs refer to live runtime controls; callbacks and captured entity targets are never serialized. Inspector fields always use the currently selected entity. Data-specific field IDs may be unavailable on another atlas and are retained visibly rather than rebound to an unrelated field.

Custom frames and window records each own an ordered `members` array. A resident references a function, frame or window; no contents are copied. Validation rejects missing containers, duplicate membership, cycles and nesting beyond 16 levels. Pinning an ancestor protects all descendants. Function groups start collapsed; explicitly created empty frames start expanded. Removing a custom frame returns functions to their default positions and releases its nested frames/windows.

Native controls additionally support optional `nativeOrders` lists and an item's `anchorId`. These refer to a stable home slot scoped by window/panel, and express sibling insertion without making one field another field's container. Native home slots remain present while their controls are moved, and render attached controls directly rather than recursively. Thus reordering cannot create a nesting loop or duplicate a control. Docking/floating releases the native anchor. The same validated, UI-only metadata participates in templates and undo; old layouts require no additional migration.

`UIField` registers component-owned fields in the same live function registry. A small local store updates their rendered values/callbacks without rebuilding the registry on each keystroke. Multiple mounted editing surfaces can supply the same contextual field; the last live definition wins, and unavailable fields become explanatory placeholders rather than retaining stale callbacks. Shortcut row definitions live in the app registry, so closing the shortcut window does not disable a moved row. Four bounded edge targets avoid neighboring fields and frame backgrounds. Native field drops use before/after markers; frame handles are explicit nesting targets.

The UI library groups the complete action registry, persistent settings, default contextual field metadata and live registered fields into conventional categories. Search matches names, IDs and categories. Palette entries remain clickable and draggable. Contextual field placeholders explain the required selection; their canonical editing target is never serialized into a UI template.

`DockArea` measures actual residents with ResizeObserver and builds a faded SVG mask around their shapes, with short background bridges and an extended identifying tab. Unpositioned legacy members retain their wrapped rows. The first local drag or anchor choice snapshots measured positions and sizes into optional member metadata; subsequent edits use explicit local positions, with no insertion that pushes existing residents. Negative coordinates are supported. Dragging the background commits a single `bodyOffset` change, leaving the handle fixed and stretching its background connection. These coordinates are UI-only.

Optional `arrangement` metadata exists on the workspace and each frame/window. Free-hand preserves exact dropped coordinates. Snap captures an anchor ID, pixel origin and X/Y pitch from a clicked visible control/handle; the grid stays defined until another anchor is chosen. It does not reposition existing residents. `positioning.ts` searches deterministic nearest available cells and reserves multiple cells for wide/tall residents plus clearance. The workspace uses viewport coordinates for floating frames, windows and functions; containers use local coordinates. Escape cancels anchor selection and drag previews. Legacy `magnetic` metadata remains readable but is superseded by the explicit placement modes. No Alt bypass exists.

`FloatingWindow` portals to the document body or the host slot of its owning frame. It persists position, size, collapse and pin state; viewport fitting keeps imported geometry reachable. `UIPanel` reuses existing inspector/editing content, including when nested, rather than cloning editors. Fields use invisible edge drag surfaces with a grab cursor, keeping label and input together and leaving ordinary input interaction alone. Icon-only setting controls open a window containing the original field. Context-dependent inspector fields become unavailable when their original editing context is absent; selecting a compatible entity restores them.

`FrameChrome` keeps the text/icon handle outside the resident contents and mini controls owned by that container. In UI edit mode, bare mini controls can be dragged to relative positions and right-clicked for the shared icon/asset editor, but cannot be extracted into another frame. Frame-local reset restores positions and compact wrapping while retaining residents and handle appearance. App-wide context-menu prevention suppresses browser menus without stopping Omnium's handlers or right-drag camera controls. Existing node context menus keep fixed membership and their current target; they do not acquire unrestricted docking.

`EntityMenu` saves action slots by menu kind. Membership and the target remain supplied by the workspace on each right-click. Its drag payload is separate from global function dragging. The menu cannot be detached from the target or have its actions moved elsewhere. Resizing and internal arrangement do not create semantic graph edits.

Version-3 `omnium-ui-template` files contain `layout` and optional normalized workspace `settings`. The layout includes embedded image assets and rejects missing frame/icon references, duplicate slots, invalid coordinates and excessive size. These assets are separate from graph assets. Import validates before applying either UI layout or settings. It never imports canonical entities, placements, relationships or investigations. Legacy combined template imports remain available with confirmation.

`src/ui/default-template.json` is the website default for browsers without a saved UI layout. Replace it with the user's exported version-3 template when they provide one; optional settings become defaults only when the browser has no saved settings. Existing browser customizations take precedence. `Reset UI arrangement` returns to the original empty arrangement and does not delete graph data or change keybindings.

`useInterfaceState` owns layout/settings and appearance draft lifecycle. The app's
shared action journal (`ui/actionHistory.ts`) owns chronological undo/redo across
Omnium, UI arrangement, appearance and settings, retaining at most 100 actions.
Completed drags are atomic and typing coalesces. MB4/MB5 execute using configured
scope/steps; hold Shift with either base trigger to open contextual history controls,
repeat to cycle and release Shift to execute the chosen option. Right-click an
option applies and locks its default; left-click resets to priority 1. Legacy Shift-side-button UI-history
assignments migrate to configuration. Explicit category actions remain available.
History is transient; committed layout/settings autosave. Scope/step preferences
persist separately without adding undo entries. Hover previews never enter history.
A source-bound ephemeral editor still requires its normal source context.

Unknown function IDs are retained and shown as unavailable rather than silently discarded. Add future global controls to the function registry and render them with `FunctionControl`; entity-bound editing remains inside its owning panel/menu. New node-option categories still require developer changes. None of this changes Omnic semantics or the version-2 structural schema.

## Combined workspace and UI export (2026-11-04)

Omnic library → Export workspace now downloads `omnium-workspace-backup.json`:
`omnium-workspace-backup` version 1 wraps the unchanged version-1 workspace and a
version-3 UI template. It includes the current UI layout/settings/shortcuts,
current appearance, embedded UI icons and referenced custom fonts. Standalone UI
and individual-atlas exports remain available. Cloud snapshots remain workspace-only.

Import workspace validates the complete envelope before replacement. Historical
`omnium-workspace` version-1 files still load without changing UI. Unknown envelope,
workspace or UI versions reject safely. Font preparation and local recovery writes
must succeed first; edits during asynchronous preparation abort replacement.
Recover previous workspace restores the pre-import workspace/UI pair. UI appearance
is applied through its existing owner so it survives reload. Ordinary undo remains
separate for workspace, UI and appearance; one Undo is not a combined restore.

The before-replace slot stores an `omnium-workspace-replacement` version-1 envelope
when UI is included, atomically as one IndexedDB/fallback value. Workspace-only
readers in the current app can unwrap it; old apps reject the new recovery format.
A later workspace-only import/cloud load writes a plain workspace to the same
slot, removing the earlier UI companion. The active workspace format is unchanged.
Original-pair recovery is local to this browser/profile/origin, not an independent
backup. Separate local persistence owners still report their own save failures.

This is not a full environment archive: unsaved Composer drafts, all saved theme
presets, unused fonts, credentials, undo history and private cloud-media bytes are
excluded. Save shared before exporting Composer work. Workspace stays within 8 MB;
UI uses the existing font/template allowances; the envelope enforces their sum.

Model coverage includes a frozen workspace-v1 fixture, current combined round
trip and malformed/newer-format rejection, plus paired recovery/fallback and stale
companion replacement. Browser cross-profile restore/font/persistence acceptance
remains pending. No automatic cloud synchronization is introduced.

## Newly introduced native panels

The shared native-strip order merger inserts an absent new panel beside its
nearest declared native neighbor. Existing saved panel/custom-resident ordering
is retained; an explicitly saved placement for the new panel is authoritative.
This lets the new ♾️ menu appear after View in an existing layout without
resetting the toolbar or writing a migration over authored positions. The
library retains its former Metrics resident ID with the default label ♾️.

## Normal mode versus internal arrangement

Edit mode off fixes individual action/field arrangement by default. Complete
frames/windows remain movable/resizable; explicit rigidity overrides and pins
still apply. Normal actions, editors, minimize/restore and close are independent
of arrangement permission. The activation guard follows the nearest actual drag
source, so fixed controls remain clickable after pointer drift.

Saved-data impact: no layout/schema/identity changes or migration. This deliberately
changes only the implicit default for whole-frame mobility. Existing geometry,
labels, pins and explicit category/individual rigidity choices retain their
meaning and remain authoritative. No stored policy is erased or rewritten.

UI-customization right-click menus (controls, frame/tab chrome, background and selected UI) and right-click UI label renaming require UI edit mode. Content-specific menus remain available in normal mode. Disabling edit mode dismisses open UI customization; normal actions and frame movement retain their independent permission rules. This changes only transient menu entry, with no saved schema, identity, layout or policy changes.

## Reset one item to its default home

Enable UI edit mode and right-click a moved button/field → Placement → **Reset to
default home**. For a native section/window, right-click its frame title and use
**Reset to default home** directly. The existing return-function action ID is
retained; this replaces its old delete-item implementation, which discarded
styling and did not restore explicit template membership.

`residentHome.ts` resolves the shipped template (`default-template.json`) and
registered native window homes. Recovery restores the selected resident's original
container and order relative to remaining original siblings, or its declared
native slot/default floating geometry. It clears that resident's moved sizing and
anchor overrides, while retaining its name, styling, stored values and descendants.
Native order cleanup removes only that resident, leaving moved-in peers untouched.
Missing default window records are recreated without pulling back other controls.
An existing dock tree gets the returning window as a tab; unrelated panes remain.

This is an explicit existing-format UI transaction, persisted through
`useInterfaceState` and shared history. It works after saving/reloading without an
undo log. Original means the current shipped template/native declaration, not a
snapshot of a custom arrangement or imported template. User-created frames/fields
without a defined default home remain in place and disable recovery. Pins,
context-menu scopes, cycles and incompatible destinations remain protected.
**Reset this frame’s arrangement** remains the separate local cleanup action;
**Reset to default** in the library resets the whole layout.

Full-viewport world: .workbench > .workspace > .canvas is absolute inset 0 against the viewport-sized positioned workbench, without a stacking context; native toolbar/sidebar are positioned UI layer 1, existing floating overlays retain their layers. UI/dock allocation must not shrink the world host. Existing renderer ResizeObserver, camera aspect, wallpaper and pointer coordinates follow that full host. UI transparency reveals scene, not click-through. Saved graph/camera/UI ownership and arrangement are unchanged; responsive viewport composition is transient. Browser/physical-input acceptance remains user-owned.

Default world UI homes read --world-ui-* insets published by the existing DockWorkspace floating allocation. Only HUD/selection/navigation UI offsets use them; canvas dimensions, pointer projection and world rendering remain viewport-wide. Reuse its measured allocation/observer, never a second sidebar-size listener or hardcoded sidebar width.

Native sidebar clearance is independent of explicit edge-dock activation. DockWorkspace uses clearNativeSidebar for UI/HUD allocation in both modes, bounded to the available area; do not reserve native sidebar space only when geometry.active. The full world host is unaffected.

Top toolbar removal (2026-11-08): native toolbar instances and its chrome are retired, while the menu panel owners stay mounted to preserve user-moved tabs. Global registered commands, custom placements, shortcut bindings, workspace transfer and saved UI layouts retain their owners. No saved layout migration. Actual moved-tab rendering and user layout acceptance require browser verification.

View/audio update (2026-11-08): Hide UI in View temporarily suppresses interface chrome while retaining the atlas and live/saved layout; Escape restores it. The Empty lattice cells button is removed from its atlas-view home only; its existing setting, renderer and other placements remain. Waves multiplies the existing displacement by a bounded gain from the existing audio input level, with silence gain 1 and explicit zero/off preserved. No new persisted wave or visibility setting, migration or audio loop. Older layouts and explicit stored values remain authoritative; browser/visual acceptance is pending.
The new Hide UI command uses the existing UI placement and shortcut-binding formats; if a user customizes it, older clients may treat its ID as unavailable or drop the unknown binding when saving. Retain an export before rollback to an older client.

Correction (2026-11-08): Empty lattice cells is fully retired: control/property/display renderer removed, archived showVacantCells values preserved without effect; shared lattice snapping/creation/navigation remain. Waves uses the existing Audio response Sensitivity together with system audio level; no new sensitivity control. Hide UI participates in shared UI undo/redo; Escape or the assigned Undo shortcut restores it. Visibility remains transient and does not change saved layout. Browser interaction and wave acceptance remain pending.

UI selection removal (2026-11-08): in UI edit mode Delete/Backspace hides selected registered controls or closes selected containers using UI history. Controls retain their home, placement, styling and functionality; restore them via Undo or UI library → Removed UI controls. Containers use the existing Closed frames and panels recovery. Pinned items still require unpinning. The additive optional UIItem.hidden flag defaults to false and survives current layout export/import; older clients may ignore it and show a hidden control. No graph data changes. Browser acceptance remains pending.

A control dragged in UI edit mode remains selected after a successful drop so Delete can remove it immediately. The visible selection uses the existing UI selection and history owners. Browser acceptance remains pending.

Workspace settings → Workspace interface tools mirrors existing UI edit, shortcuts, UI library, frame creation, selection, compact, alignment and UI undo/redo actions. Their owners and saved placements are unchanged. This is not a complete consolidation of Scene, Atlas, sidebar and other pictured panels. Browser acceptance remains pending.

A layout may opt into @workspaceOnly after docking its live panels into Workspace settings. This hides the now-empty native sidebar and old spatial strip without unmounting their owners; it suppresses duplicate Workspace mirrors and Reset placement in settings. The supplied user-specific transfer contains only layout, preserving workspace and settings on import. The original export remains the recovery path. Older clients ignore the flag and may display the native shells. User browser acceptance remains pending.

The shipped default now consolidates these live panels inside Workspace settings, using stacked placement and collapsed sections. A fresh browser loads it automatically; existing saved arrangements retain precedence until Reset to default applies the new template through normal UI history. No import/download is needed. Duplicate Master controller and Reset launchers are suppressed in workspace-only mode. No user workspace, theme, custom labels or private export content is included in the shipped template. Browser acceptance remains pending.

Workspace-only mode uses one collapsed settings window as its entry, with the existing frame rename and toggle. Closing or Escape collapses it. Previously saved workspace-only layouts adopt this presentation once and copy an existing launcher label when the frame has none. Browser acceptance remains pending.
