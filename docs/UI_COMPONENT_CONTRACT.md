# Shared UI component contract

Visual-hierarchy targeting uses a binary inherited edit mask: parents set the subtree baseline, and later child toggles create exceptions. Toggling a parent in either direction clears prior exceptions in that subtree. Excluding a target does not change its rendered appearance; the existing plug separately bypasses/restores saved styling. Current editors use `toggleTarget`; old isolate selections remain readable and become equivalent inherited masks on the first binary edit. The targeting/power controls use square hit areas and symmetric SVG geometry, with no isolate state in the UI.

Compactness applies to every new or changed feature. Prefer content-sized surfaces,
tight consistent spacing and compact rows of related controls. Avoid unused space,
redundant headings, permanent explanatory paragraphs and arbitrary large minimum
sizes. Use accessible tooltips for secondary instructions. Preserve readable text,
keyboard navigation and usable pointer targets. Contextual projections must fit
only their relevant controls, with category-specific rows appearing when needed.

`RadialMenu` is a shared icon-only contextual projection. A `RadialEntry`/`RadialNode` may supply an optional `setter`: it renders as a horizontal strip directly above that node's button, at the same width. Rings reserve the strip's footprint when sizing/separating slots. Numeric strips project the existing `PropertyEditor`/`RangeControl`, retaining validation, right-click value/bounds editing and session step settings; the DOF's configuration editor exposes full halving/step controls. This adds no pointer listeners or per-motion discovery. The empty-space Omnic preset menu uses this shared projection. `radialTree` groups
declared action presentation metadata without changing command IDs or live controls.
Categories open child rings around the centre of the clicked category button, leaving the parent ring and Composer canvas in place. Deeper categories repeat this anchoring; one branch per level is expanded, using 32/28/24px spheres in
content-sized footprints, starting at top and proceeding clockwise. Contextual rings pack around their 24px centre button with a 2px clearance; radius grows only to prevent neighbour/value-strip overlap, rather than imposing fixed 64/34/30px radii. At most six
spheres are drawn per ring; overflow becomes More tools and deeper navigation
stops shrinking at 24px targets. No pointer-move layout/matching is needed. `ContextualMasterController`
provides centred/clamped top-layer presentation and existing context-menu ownership. Child rings are portalled to escape the circular frame clip. Nested portalled controllers retain their connected parent context layers; the deepest ring is active, and closing it restores its parent so Escape steps outward. Anchors are measured once on click; viewport edges clamp popups.
Embedded radar tools are hidden by default, with no eye/show-hide button. A visible circular axis and a 28px pointer-only rim band reveal controls on hover; tool hover, keyboard focus, an open child path or heldOpen requested editor retain reveal. The hit band stays outside the editing interior for quick-rim layouts. CSS reveal keeps controls mounted and adds no pointer-move matching, React updates, storage or history writes. Standalone context rings remain explicitly visible and have Close/Back instead of a visibility switch. The embedded radar can project quickItems followed by its root entries and optional quickEnd controls into adjacent 24px rim slots with 2px gaps, starting at top clockwise. Free/Realistic, ⠒ Atomnic and promoted tools share this arc; pen/eraser is in quickEnd so toggling it does not shift preceding controls. ResizeObserver updates its geometry only on resize, never on pointer movement. Category metadata may flatten a wrapper while preserving hidden descendants, IDs and child rings. Category metadata may retire a presentation branch without deleting command owners. Contextual controllers opened during a held press consume its trailing contextmenu event before newly appeared controls can interpret it; a fresh pointerdown enables normal interaction.
`FunctionControl mirror symbol symbolOpacity tooltip` projects the existing action/field without
another identity/value owner. Optional symbolMask supplies a vector silhouette; symbolOpacity fades and symbolFill paints only the default projected glyph (including conic-gradient color wheels), preserving button availability and saved custom appearances. Writable-input freedom metadata can supply this presentation through DOF discovery. Symbol fields open compact contextual editors.
`UIField`/`UIAction registerOnly` retain real registry entries while their inline
presentation is replaced by a projection. Names/current values belong in tooltips;
editors show values only on request.

Target-specific menus use `editableDegrees` over actual writable input adapters,
not a hardcoded list of available tools. Operation metadata (`adjusts`) maps
compatible property sets to their existing executors. A flat target ring may
contain more than six degrees: it scales its geometry to separate buttons instead
of introducing category/More navigation. The general category renderer remains
bounded/paged. Shared scalar editors can open directly in step configuration;
`RangeSettingsScope` retains working intervals/steps through portalled editor
reopens for one editing session. This is transient widget navigation state, not
another model-value store. Drag/keyboard/nudge/wheel honor the configured step;
halving picks still respect hard property precision and bounds.

`RadialMenu` can host an editing surface. Then it fills its circular frame, keeps
the canvas size fixed while categories change, and attaches tools to the rim.
Tool visibility does not hide the surface. `FloatingWindow shape="circle"` retains
the existing resident ID, ownership, customization and history; it defaults to
symbol chrome and locks resize aspect. Legacy rectangular sizes project into the
circular default; square custom resizes survive. Shape-aware resize/viewport
projection inscribes the circle in requested bounds. Circle styling belongs to
the shared frame stylesheet, independent of its payload; clipping also makes
outside corners noninteractive.

New features must use the existing UI ownership, rendering, customization, history and persistence contracts. A clickable header is not the object it represents.

Drag pickup measures destination bounds and child slots on demand and caches them
for the gesture; it must not eagerly measure every destination's children. Release
refreshes the pointed destination. Fixed surfaces mounted directly on document.body
move with their existing transform, avoiding popover promotion and geometry/style
rewrites; nested/tab payloads still use the shared lift to escape clipping.
`FloatingWindow` exposes its free-placement policy with `data-ui-free-placement`:
cursor-open windows use the viewport; persistent panels use workspace packing.
Free-drop resolution must follow the same policy as rendering. Explicit docking
still uses shared docking rules. Future window features inherit this automatically.

Held payload movement is a direct transform-only pointer update, independent of
frame-batched destination discovery and feedback. Do not put docking calculations,
interpolation or an additional animation-frame wait in front of pointer attachment.
The browser coalesces transform writes for paint; placement previews remain
transient and commits continue through the existing single-move history path.
Release restores transient styles and commits the saved layout in one synchronous
render boundary; do not expose an intermediate pre-drag position to paint.
The interface owner uses `normalizeLiveUILayout` for immutable live snapshots:
coordinate-only edits validate their coordinates and retain unchanged topology;
all structural changes and imports still use full layout validation.

- Actions use `FunctionControl`/the function registry. The shared `NativeActions` adapter also discovers ordinary buttons in new frames, preserving their original handlers. Stable `data-ui-id` keys protect customized actions from markup/list reordering. Automatically discovered expandable buttons remain customizable but are not draggable as incomplete headers; use the shared group component for their payload.
- Fields use `UIField`, which moves the label and input together. Shared
  `ValueFieldBehavior` selects numeric value contents on focus/first click so typing
  replaces the old value. Subsequent clicks allow caret placement; deliberate
  drag selections remain available. Native and portalled fields inherit this
  without per-feature handlers; ordinary prose/search inputs keep native editing.
- Expandable groups use `EmbeddedGroup`; floating windows use `FloatingWindow`. Both are complete window residents in the same `UILayout.windows` model. Moving a group moves its header, editors, children and behavior together. New property definitions receive this automatically through `PropertyTree`.
- Every `FrameChrome` header opens the shared frame context menu, including compact embedded groups and icon handles. Appearance customization remains an action in that menu; header presentation must not change which frame capabilities are available.
- An embedded group's `inline.parent` records its original home. Until detached, that home participates in normal ownership, pinning and cycle validation. Docking and floating use the same operations as existing windows, not a second property-specific layout store.
- Default children stay mounted when collapsed. A moved child can therefore render outside its original parent without losing its handlers. Portals project content at its current owner; headers are never copied as substitutes for live contents. If the originating feature is explicitly closed, the destination shows a context-unavailable message rather than an empty slot.
- Drop resolution must produce a compatible destination and a visible preview before committing. Self/descendant containment and pinned targets reject unchanged. Cancelled or rejected operations must preserve the original layout. Hiding a source requires a real destination renderer.
- Regrouping is UI organization only. It must not change property applicability, values, canonical knowledge or relationships.
- Subtree expansion and search revelation follow current UI ownership, including moved-in children, rather than a hardcoded initial property hierarchy.
- Each completed move is one UI undo operation and must survive template/browser save and reload. Existing icons/styles must migrate when a previously button-only group becomes a complete resident.

The model regression in `tests/ui-nesting.test.mjs` exercises generic embedded ownership, cycle/pin rejection, undo and JSON persistence. The focused UI regression exercises actual property nesting and a newly introduced group; it is intentionally separate from the broad browser suites.

Stable native anchor identity and current container ownership are separate contexts. Moving a group must not change the IDs/anchors of its fields; the new container context must not replace their original home scope.

Vertical `UIFrameStrip` collections expose their whole outer border as an anchored docking target. On the first split, the original collection becomes one normal window/tab in the existing split tree; its original panel IDs, native ordering and added residents stay together. Preview and commit use the same transaction and sidebar allocation, without duplicating live controls. The collection retains its own resident renderer through `FloatingWindow.residentArea`. Dock tab bars remain explicit tab targets even when their nearest resident root is the native strip. A tab-bar drop joins that bar’s owning tree; an active tab that contains another split group must not redirect the drop into its internal tree. An enclosing dock pane must not turn native section interiors into full-surface targets. Native panels supply their own container context, and windows in fill hosts use pane sizing/scrolling rather than natural-height stacked-row sizing. The strip’s exposed right border reuses the shared frame resizer; its transient width reallocates the sidebar/canvas while held, and release saves one normal UI-history change. Freeze percentage sizing to pixels at resize start so resizing the flex parent cannot amplify the pointer delta.

UI display names are optional `UILayout.labels` overrides keyed by stable owner/branch IDs. `FrameChrome` supplies renaming for new windows and embedded groups automatically; target-tree rows use the shared `EditableLabel`. Renaming is saved/undoable UI customization, never a change to property IDs, applicability or canonical knowledge. Blank names restore the supplied default. Search uses display overrides, including for closed windows.

Text, icon artwork and control surfaces are separate appearance targets. The existing NamePresentation pass marks icon-only versus text buttons; text-label bindings skip icon-only controls, while inline SVG/glyph ink belongs to `symbols.ui` and establishes its own color even without a local override. Text effects must not fall back to a parent text owner for icon artwork. React and native customized glyphs share `iconTintFor`; image artwork retains its original colors unless explicitly tinted. Keep explicit animation kinds when adding CSS bindings. Native color swatches share one square size constraint and circular browser swatches; per-form height rules must not stretch them.

Named UI uses shared Unicode notation and optional name hiding. `NamePresentation` discovers semantic buttons, field labels, headings and window/group names, including newly mounted features. Supply `data-ui-name` for a caption not expressed by standard markup and `data-ui-symbol` for a feature-specific default; otherwise `nameSymbols` provides semantic defaults with a `◇` fallback. Existing custom assets/icons take priority. Presentation uses CSS, leaving React children, canonical names, action IDs, field values and search text untouched. `UILayout.hideNames` persists in UI templates/history; it enables name-only hover tooltips, while visible-name mode suppresses name-only tooltips. Explicit help uses `data-ui-tooltip`, which NamePresentation preserves in either name mode; property/group tooltips pass through the shared frame chrome. Do not append drag/customization instructions to control titles. Recovery remains independent and readable.

Pointer previews are transient subscriptions, separate from the saved UI layout and workspace context. Only preview overlays and the affected docking area subscribe to movement; commit one layout change on release. Coalesce pointer work to one animation frame, resolve the final release coordinates, and cancel queued feedback on Esc/end/unmount. Keep measurement observers attached across renders and discover controls/captions from changed subtrees, rather than rescanning the document because a preview message moved.

Capture drop-target bounds and zone coordinate origins at the start of a resident gesture. Docking feedback is a viewport overlay outside measured frame contents; keep the source, residents, container size and arrangement unchanged until release. Never hide/reorder the source or apply a proposed baseline to live residents mid-drag: that changes frame measurements and triggers viewport clamping. Overlays cannot become targets. Moving outside the original target and its proximity margin restores a floating preview. Resolve the same explicit target position/baseline for preview and commit. `tests/ui-dock-exit.browser.mjs` covers dock entry/exit, source/parent stability near the screen edge, and matching committed placement.

Tab drags lift the existing resident surface through `beginLiveDrag`, never the shared pane or sibling tab headers. The held resident uses the pane’s eventual floating size and its own normal frame chrome. Align its real title grip to the grabbed tab grip before the first paint; use that adjusted origin for both pointer offsets and final floating placement, so tear-off never resets the grip to the pane’s left edge. For other drags, capture origin offsets before lifting the DOM. During a tab drag, dock-fill rules do not hide or flatten a `.ui-live-drag` resident. Temporarily hide only its source tab label, preserving strip geometry, and restore it on cancellation/drop. Inactive residents reuse the pane bounds without activating tabs or saving history. Only a context-unavailable placeholder falls back to lifting tab/body pieces.

Internal resident drags use a threshold and capture the active pointer on the document root, which survives source reflow/remount. Keep the existing drop resolver and frame-batched previews. Do not complete a drag on mouseleave, source bounds changes, capture loss, an unrelated pointer/button release or a stale native dragend. Reacquire lost/stolen capture while the logical gesture remains active; window listeners continue receiving movement. Primary release commits; Esc, actual pointer cancellation, focus loss and unmount cancel the preview without committing. A move reporting that the initiating button is no longer held cancels a missed release without saving. Block native browser dragging/context menus during the captured gesture, preserve ordinary clicks below the threshold, and release capture on every exit. Selected-button gestures use the same capture contract. `tests/ui-pointer-capture.browser.mjs` is an optional focused regression for this behavior.

Camera gesture ownership is independent of UI preview/capture lifetime. `pointerOwnership` tracks physical UI presses, including fields, frame bubbles, resizing and future windows. Capture helpers explicitly claim ownership so protection does not depend on listener registration order or whether UI handlers consume pointerdown/up. Esc, mouse pointercancel and blur may discard a preview but cannot transfer a still-held mouse press to the camera. Clear ownership only on an observed physical release or movement proving its buttons are no longer held; cancelled touch/pen contacts may end immediately. `guardCameraPointer` observes that shared ownership, clears interrupted canvas gestures through the OrbitControls public lifecycle, and permits navigation again on a fresh canvas gesture after release.

Photoshop-style panel docking is presentation metadata on the same ownership model. `dockLayout` is an optional split/tab tree whose leaves reference existing frame/window residents; each member must occur exactly once. No control payload, graph data or window identity is copied. Ordinary free-form frames keep their arrangement until explicitly docked. Frame edges create horizontal/vertical splits, title/center zones create tabs, viewport edges create anchored groups, and dragging a tab out floats that original resident. Empty generated groups and branches are pruned. Divider gestures commit one saved ratio/undo step; tabs retain their live mounted contents.

Native sidebar row wrappers are not split/tab hit surfaces. Their actual frame handles retain compact docking targets, and ordinary buttons retain the existing button-grouping path. Use the nearest actual frame/pane/handle rather than treating the whole sidebar section as its button. This restriction does not change containment, reordering, workspace-edge docking or floating-frame behavior.

Actual frame/window outer borders remain split-docking targets in either Stacked or Freeform layout, including frames residing in a stack. Left/right edges create neighboring columns; top/bottom edges create neighboring rows through the shared dockFrame transaction. A thin edge marker uses the same captured target bounds as the projected split preview. The stacked body's interior retains ordinary row insertion, while its handle and active five-way guides retain grouping. Do not apply sidebar wrapper exclusions to actual stacked frame roots.

Frame layout is independent of floating/docked placement. `layoutMode` defaults to `freeform` for older data; `stacked` renders the same residents as full-width, naturally sized rows with separators. Existing child handles collapse/expand their real payloads, automatically reflowing subsequent rows. Nested windows use the same DockHost/portal identity with natural height rather than a second sidebar-only renderer. Direct and multi-selection drops insert/reorder rows through existing ownership operations; stacked members do not acquire arbitrary XY positions. Individual alignment/compaction requires switching their container to Freeform; moving or aligning the whole container remains available.

All explicit Create UI frame entry points use the shared two-choice popup and `createUIFrame` transaction. Opening/dismissing the popup does not save history; choosing a layout creates one frame/undo step. Right-click Layout uses `setFrameLayout` to save each layout's order, placements, dimensions and body offset in `layoutMemory`. Remembered split/tab geometry is restored when compatible with current membership. Snapshots contain presentation references only: switching never resurrects removed residents or drops newly added ones. Labels, actions, pin/scope restrictions, templates, JSON validation and existing UI undo continue through the shared frame model.

Docked panel tabs use the same frame context menu, saved label/icon/shortcut and appearance identity as the original handle, with per-panel search. A `data-ui-proxy-for` handle shares its resident’s local appearance without becoming a second content root. Search revelation activates owning tabs as well as expanding ancestors. Pinning, contextual ownership, cycles, templates, local persistence and UI history continue through shared operations; new windows and complete embedded groups inherit docking without named special cases. `tests/ui-docking.test.mjs` and the focused `tests/ui-docking.browser.mjs` cover this optional layout form.

Workspace-edge docks share one `workspaceDockRects` allocation with the native sidebar, canvas and floating residents. Reserve their space in the workspace; do not implement edges as overlay-only coordinates. Opposing docks share a constrained size budget so the center remains usable. Floats fit into the remaining canvas without rewriting authored coordinates, so undocking or UI undo restores the previous layout. The same geometry drives docking previews, actual edge frames and floating bounds. Native-strip split/tab drops replace the target's position in that strip; they must not create a floating group over its neighbors. Implicit embedded ownership also keeps newly split groups in their parent. Structured dock frames measure their full rectangular contents, rather than just their original contour handle.

All floating windows, detached embedded groups, custom frames and floating functions register their desired rectangles through `useDockResident`. The shared projection preserves reachable positions, resolves collisions into free gaps, and uses smaller disjoint cells when the requested sizes cannot fit. Do not clamp each window independently: that can stack several windows over the same location. Preview uses this projection as well; derived adaptation never overwrites the saved layout.

Do not constrain an explicitly dragged window/frame by its entire content rectangle. Wide/tall frames may float partly outside the viewport while a usable part of their handle remains reachable. `floatingOverflow` records this explicit placement in the existing window/frame state; preview, rendering, reload and UI history preserve its coordinates and actual dimensions instead of immediately packing it back on screen. Ordinary dock adaptation retains its shared allocation. Dragging an edge group's own handle sideways must be able to leave that edge's capture zone. Keep `keepFloatingHandleVisible` shared by the movement and rendering paths; dragging does not require a prior resize.

Ctrl/Cmd selection uses the existing function registry and complete window/frame handles (`data-ui-drag`), including embedded property groups and tabs. `data-ui-selected` provides the same highlight for all of them. Selected UI uses one context menu and the existing move/compact/align pipeline. `groupResidents` is the shared grouping transaction for multi-selection, drag-to-group and the legacy two-button wrapper; retain IDs, child editors, pin/scope restrictions and one-step UI history. Selecting a parent includes its contents once, rather than also moving selected descendants independently. Merge registered window defaults with saved geometry so older saved groups still acquire their complete ownership metadata.

Collapsed custom frames keep their DockArea/child hosts mounted and hidden, just like tabbed dock groups. New floating frames share the existing window layer counter and portal into the same root as floating windows. Focus/raising follows actual DOM containment: a portal child must not raise its previous React owner and cover the destination frame while a click is in progress.

UI placement is fixed outside UI edit mode by default, including older saved templates. `residentMovable` is the shared permission for frame/function/field dragging, tab tear-off, resizing, divider/body-offset gestures and selection arrangement. The existing `@devMode` flag enables editing; it is a simple toggle that opens no toolbox. UIWorkspace owns its document attribute and field-edge hints independently of any window. The separate UI library and template actions remain available; saved custom fields remain supported. Explicit pins remain authoritative. Normal actions, input editing, expanding, closing and tab activation remain available. The master hierarchy's UI rigidity property uses an independent inherited policy in `UILayout.uiRigidity`: included means fixed, excluded means movable outside edit mode. Category defaults cover future registered controls; individual resident overrides follow actual ownership. This policy uses UI history/templates and never appearance values, graph data or appearance targeting sets. Paint-only/text/graph branches are inapplicable. The rigidity hierarchy displays individual residents only when they have local appearance customizations or an existing individual rigidity override. Merely registering, moving or saving a resident does not add a row. Keep the complete inventory internally for category hover and policy resets. Generated hierarchy inventory controls must not list themselves recursively; their categories still apply. Fields declare their input category through UIField's shared adapter.

Hover preview belongs only to the visual-hierarchy include/exclude on/off button; the row, label, expander and editors do not activate it. Each appearance row has one circle: left-click toggles targeting (filled/hollow), right-click or Shift+F10 toggles stored-appearance bypass (bright/dark). Both states remain independent; inherited bypass darkens descendants. The separate power button is removed. The rigidity circle retains its movement policy without an appearance bypass. Keyboard focus on that same button also previews. Everything (`all`) is excluded from hover/focus preview; its include/exclude action remains available. The selected property's applicable bindings identify the actual paint to light-pulse: text glyphs, icon artwork, existing backgrounds, borders, fields and scrollbar parts. UI text uses the CSS Custom Highlight API with a glyph-color/shadow fallback; temporary inline paint overrides and pseudo-element rules preserve their exact previous values on exit. No bounding boxes, outline markers or added borders are used. UI rigidity uses its concrete resident inventory. Excluded, locked or bypassed matches receive a weaker pulse. Renderer parts register through `registerHierarchyScene`; the 3D adapter uses existing `graphEffectItems` references and shader masks to pulse lettering separately from its shared label background and contour. Sphere/icon/path materials pulse their own pixels, while environment background preview changes only the scene background. Shader extensions compose their cache keys with existing electric text. Individual-instance revelation retains its temporary expansion/scroll behavior with the search outline explicitly disabled. UI hover resolves targets and reads original styles in a single setup pass, then animates registered paint variables through the browser animation engine. It does not scan/read/write every window each frame. Rebuild only when relevant DOM content/visibility changes, and cancel/restore animations on exit. Large surfaces use a restrained color/alpha-preserving pulse; small controls use stronger accent color and existing-shape glow. Gradient stops retain their alpha. UI glyph highlights use shared animated tint/glow variables, without replacing the stylesheet every frame. A precomputed-variable fallback supports browsers without registered-property animations. The independent 3D pulse stays capped at 30 fps; reduced motion uses a steady cue. Leaving the button for ordinary app content clears temporary paint. Moving into shared controller controls retains that feedback while editing; leaving/defocusing the editor, blur, page hiding, hierarchy collapse and unmount clear it. Hover never commits appearance/layout values, camera, graph selection or history.

The visual selector's ○ has independent 🞅 Frame, ◉ In-frame and ⏺ Outside frame
inclusion settings, separate from geometry mode. LMB toggles membership; RMB edits.
In-frame includes all interior parts but not the frame itself. All three off
creates a neutral boundary: detection follows the pointer inside/outside without
including anything. Each accepted refinement captures that side. Before any
boundary/selection, hover previews are automatic; afterwards Ctrl enables them,
showing additions in green and removals by hiding green; exclusions
are unpainted. Shift+Wheel rotates the active drawing mode before placement or
working geometry while refining, in screen space. Ctrl accelerates rotation 10×;
line origins remain anchored at the defined start point. Pointed
boundaries, lines, polygons and freehand share matching, transient selection history
and the existing selected-part editor. Complete text hosts support CSS typography;
partial runs retain exact-node paint/effects without widening. Editing holds the last
selection feedback context. Reuse indexed/cached effect plans; paint-only edits must not start
inactive animation scans. Do not restore obsolete boundary-picking flags or bars
that intercept E modes.

Registered HTML background feedback uses a removable native inset tint on the
actual rounded surface, preserving shadows, images, gradients and foreground ink.
It shares the 2.6-second pulse and Included paint, rather than a barely visible
SVG rectangle fill. Do not animate inherited variables at document scope or scan
surfaces per frame. Empty UI space resolves to its owned registered background;
independent gaps still need picking adapters. The 3D-world background exposes a
selection-only binding on its canvas, with raycast rejection of foreground objects.
It addresses the existing consumer directly; no CSS/DOM instance can stand in for
scene paint. The shared scene registration supplies hierarchy and selector feedback
independently, so green feedback changes only the background and cleanup restores
authored paint. It runs at most 30 fps, with no per-frame discovery.

The selector's ◎ Self inventory is the common route to pointer-transparent
logical/meta targets. Project consumer groups tagged `self: true` from the existing
coupling graph; descendants appear automatically, with no copied properties or
values. Inventory rows use the shared logical selection/toggle/history API and
Master controller inspection. Keep compatibility target IDs but hide retired rows.
Feedback inspection reuses the actual trace renderer for its live sample. The old
Mouse command remains rebindable; a separate mouse-only UI path is replaced by
inventory access. Ordinary input controls and selected-property editors stay shared.


## Closing and reopening

The frame × closes its content through the normal window/panel close action. It
is separate from collapse/minimize and never deletes members or customizations.
Normal open buttons use `reopenContainer`: clear saved closed/collapsed state,
reveal containing frames, activate its dock tab and enable the corresponding
window visibility flag. This applies to Master controller, settings, shortcuts,
sidebar panels and the UI library, including old saved closed flags. Explicitly
mounting a caller-controlled FloatingWindow also clears stale closed state.

Custom frames without a dedicated launcher are available under UI library →
**Closed frames and panels**, with ordinary **Open** actions. No separate unhide
step is required before a normal panel launcher can work. Closed workspace-edge
groups reserve no space or docking targets; reopening floats them if their former
edge is occupied. UI history owns closing/reopening. Stable recovery control IDs
are retained for saved customization and bindings.


Shared property editors and Master controller roots carry `data-appearance-editor`.
The visual selector treats those as tool input. Selection / Preview controls
feedback independently of membership. MS locking is explicit and rebindable:
Ctrl+MB3 parks its symbol, restores normal cursor input, and toggles back to MS.
Do not automatically retain hover/event context when entering editors. Accepted
selection and normal property-input previews remain live.


Mounted appearance consumers use the shared context `read`/`renderRead` instead of
building a resolver per icon/control. Value-only previews preserve target structure
and policy identity; new controls must not trigger glyph discovery or selector
geometry rebuilds on every input sample. See APPEARANCE_CONTROLLER.md.


The selector's BG detection toggle defaults off and affects new picks/previews,
not already accepted membership. It uses the common action catalog. Retargeting
shares catalog-scoped geometry, viewport-only paint and cached continuous pulse paint. Contour and geometry seams are one device pixel, moving in their own unfiltered
layer for drawing guides and accepted selection. Hover previews remain available while aiming; explicit lock retains the pointed preview.

Selector feedback sparkles are removed. The MS center dot is saturated cyan without a halo or ring,
without moving its hotspot. Labeled Selection / Preview and BG controls sit below
the clamped circle; their titles show live shortcut bindings. Pulse speed/depth
and enablement use the discovered shared Pulse consumer, normal serialization and
property editors; unsupported parent properties never render an editor merely
because supported children are present.

Selector background feedback uses the shared `selectorSurface.ts` source-over
strength and display-sRGB blend in DOM/SVG/scene adapters. Native inset tint stays
below content; cached transparency compensation prevents full-strength tint from
stacking through nested selected surfaces or transparent windows over the scene.
Preserve underlying paint and configured pulse values; do not add independent
renderer-specific strength multipliers or per-frame geometry queries.

Workspace settings exposes the existing Master controller action even when its
normal resident was moved or closed; it invokes the shared function, not another
controller. Global search indexes window/frame destinations independently of their
mounted contents. Direct label matches rank before ancestor-heading matches and
before the first-100 limit. Choosing a window keeps its reveal path instead of
clicking its first control (which could collapse it).

Property hierarchy stems use a 2px, 65%-accent line with short child connectors.
The shared PropertyTree receives editability separately from supported properties.
Unavailable setters are omitted, including their headings and editors. Branches
with editable descendants remain as navigation, with no unavailable parent editor.
Supported descendants/operators retain their normal paint.
Native and canvas text effects omit disabled controls so animation cannot make an
unavailable setter appear active.

Browser chrome is outside application input. `pageInputBoundary.ts`, installed
before mounting React, blocks external blur/focusout from reaching UI action and
commit handlers. Never implement semantic actions on window blur. Held-input
owners use `PAGE_INPUT_SUSPEND` only to release unfinished presses/drags; it must
not clear selections, close editors, commit drafts or create history. Visibility
listeners may pause rendering clocks without changing application state.

`FloatingWindow.footer` provides a compact strip of shared actions attached
below the window, outside its scroll body, with the same scope/theme. An `onClose` returning false vetoes closing
before releasing dock ownership. `onMinimize` can similarly veto collapsing
until pending work is resolved. `FunctionControl mirror` renders an existing
action contextually with its shared styling, without relocating its resident or
creating another registry/action definition.

Master Controller → Active context exposes the shared descendant expansion action.
Repeated close/search/descendant header and dock-tab tools are no longer rendered.
At click time it follows actual saved/inline ownership, excludes the owning frame
from collapse, and collapses all descendants if any are open; otherwise expands
all. The parent stays expanded. One indexed ownership traversal and one batched
UI update preserve a single undo entry; never scan the graph per frame render or
pointer move. Closed flags, docking, placement, pins and appearance values remain
unchanged. Native inline homes follow code regrouping only while not explicitly
docked/detached. Local expansion adapters in `frameExpansion.tsx` let transient
property trees and hierarchy chevrons participate without persisting their state.
Legacy frame-control configuration remains readable for compatibility; new commands
use the shared action catalog, with no private hotkeys or second expansion store.

An expanded frame's visible interior is a drop destination even where its resident
allocation is smaller than the window. `dropSurface.ts` supplies the shared
single/multi-item rule: use the containing frame's live zone, reject incompatible
interiors without detaching, and keep sidebar-strip/collapsed-handle rules intact.
Explicit pointed destinations take priority over the source owner's proximity.
The final release refreshes only pointed destination/ancestor geometry and their
slots, so scrolling/reflow between movement and release cannot use stale origins.

`EmbeddedGroup`/`UISection` accept a transient `reveal` projection for inspection:
it shows a saved-closed group without changing its persisted closed flag. Clearing
the inspection restores ordinary visibility. Keep this separate from reopening
a resident through an explicit user layout action.

Window merge/tab/split guides initially activate only when a dragged frame header
points at another frame header or tab strip. Body centers, body edges and native
strip borders do not activate merging. Once opened, the existing guide cross and
its travel gaps remain usable for choosing any side. Workspace-edge docking is a
separate explicit target. Ordinary interior drops still use resident placement.

## Universal adaptive function configuration

Shift plus any configured shortcut opens only that function's compact Master
Controller configuration. Repeated presses cycle choices; releasing Shift executes
once. Right-click an option applies and locks its future default; left-click
resets to priority 1. Temporary choices do not overwrite locked defaults. This applies to every new
feature. Use the single `ShortcutConfiguration` router and existing action/input
metadata, not per-feature modifier handlers. Primary clicks inside configuration
remain ordinary controls while Shift is held. Read FUNCTION_CONFIGURATION.md.

Resize/restore is a shared active-frame action (W). Its viewport projection retains
the actual resident, ownership and original geometry; undo/redo uses UI history.
Hovering detected resize levels is only a preview outline. Enlarged frames must
be restored before ordinary dragging/resizing, so dock ownership cannot change
beneath a projection. Pinned residents and ancestors reject the action.


## Shared spectrum slider

`ui/RangeControl.tsx` is the shared numeric slider, including PropertyEditor,
legacy appearance/visual-size controls and history steps. Use it for new slider
features rather than introducing another implementation. The horizontal spectrum
shows maximum on the right, minimum on the left and the current value beside the
dot. Press anywhere along the track to select and drag the value, including
outside the track after capture. Track bounds are measured once per gesture;
release commits once, while Escape/capture loss cancels the draft. Left-click an endpoint
bar selects that limit. Left-click an arrow nudges by the configured jump.
Right-click the dot types the value; right-click a bar types its bound; right-click
either arrow types their shared jump size. Enter/blur accepts, Escape cancels.
Native range focus and keyboard support remain; no per-pointer layout scans.

The component retains existing input preview/commit/cancel semantics. Property
validation limits are authoritative. Owners can supply real min/max setters
(history does); otherwise endpoint edits narrow a transient working interval
inside the allowed bounds. Working intervals and jump size are widget-local and
reset on remount; they are not duplicated property definitions or saved defaults.
Widget internals are one `data-ui-control`, not separately movable/discoverable
commands. Spectrum appearance is coupled under Visual hierarchy → Sliders.


Spectrum glyphs use a compact 44px axis with 18px bars in 22px hit targets, plus content-sized
inline min/max labels. The current value sits directly above the dot. The outer
control reserves the label row plus the full 22px interaction row in normal flow;
never force its total height to the rail height (global border-box sizing would
make the slider overflow onto its following sibling). The rail,
rail uses a soft filled/unfilled split, compact rounded chevrons and a softly lit dot.
The shared spectrum target uses color ink classified as an indicator for MS; its
transparent native range is only an input surface, not a separate visible target. Arrow tips meet
the end bars. Internal glyph buttons have no button background/border/shadow/filter;
shared slider color still applies through the existing spectrum target. These are
one compound widget, not independent movable button surfaces.
Native sidebar ↗ float buttons are removed. MC Active context → Float active frame
uses the shared floatResident transaction, including the native panel's floating
projection flag. The live contents, ownership constraints and pins remain intact.


A registered active popup layer takes precedence over a `data-ui-resident-root`
on the same element. Resident IDs support search/ownership, but must not erase a
popup's close handler from the active stack. Shared contextStackFromScopes builds
field → popup → parent-frame Escape order, including portalled search dialogs.
Do not register such popups as ordinary frames without close/minimize adapters.


Search indexes visual hierarchy destinations once, rather than every target ×
property combination. Direct name/shortcut matches take precedence over results
that match only an ancestor breadcrumb. A category query (for example `slider`)
opens that branch without forcing a property; a contextual query (`slider color`)
materializes only the matching applicable setters. Bare property queries use the
shared property command. Normalize the catalog once per snapshot; hover must not
rebuild or re-sort it. Global search renders at most 24 results and invites a more
specific query beyond that. Hover revelation waits 180ms and cancels on exit, so
crossing result rows does not repeatedly mount/reveal the controller. Clicking or
keyboard navigation remains immediate. Frame searches do not rescan DOM per keystroke.


Ordinary UI commits preserve unchanged settings/layout references. Validate and
normalize a branch only when that branch changes; a frame toggle must not rebuild
appearance settings and invalidate every renderer. Session storage preserves the
original settings reference for layout-only edits. NativeActions depends on actual
appearance inputs rather than the context wrapper, indexes explicit ownership once
per layout snapshot and skips unchanged DOM attributes/styles. UIWorkspace shares
one default-window projection per render/input snapshot for permission checks;
never clone all window defaults once per button. These paths run before paint and
must stay bounded even with many discovered controls. Graph node single-click versus
double-click arbitration remains a separate 320ms interaction, unchanged here.


Frame right-click menus omit Close; closing lives in Master Controller Active
context and its shared command. Keep the menu-dismiss × separate from closing the
frame. Existing close callbacks, vetoes and frame action registration remain intact.

Active context Minimize / maximize toggles collapsed state and retains its frame
target for restoration. Esc still steps back/minimizes and pops context normally.
Front-on Focus shares this group and the existing rebindable F command.

## Scoped UI subscriptions

`UIProvider` publishes committed owner snapshots to a transient subscription
projection; it does not own layout/history/settings. Frequently repeated controls
use `useUITracked(select)` from `ui/context.tsx`. Select only render dependencies;
returned slices compare references/scalars, while the live handle reads current
committed state for events. Do not omit a render dependency to save a rerender.
The provider publishes in a layout effect, never during an abandoned render.

Buttons/fields/embedded headers and action registration now use this route.
Legacy `useUI`/`UIContext` remains for consumers not yet migrated; avoid adding broad
subscriptions to repeated controls. Appearance action delegates preserve current
handlers, but `read`/`renderRead` retain snapshot identity so property/range memos
invalidate correctly. Dock workspace context preserves identity for equal geometry.
Native fields stay mounted and callable while collapsed. No duplicate value store,
shortcut router or history owner is introduced by selective subscriptions.


Window/panel/frame chrome, docking residents/tabs and editable labels also use
scoped projections (`residentRenderSlice`). Docked controls subscribe to their own
current registry entry so updated handlers/values do not require their parent to
rerender. Closed frame searches and dormant active-layer adapters have empty
render slices; events still read current committed state. Search subscribes to its
inventory only while open.

Native caption/button observers distinguish actual inserted subtrees from changed
caption hosts. Deduplicate inserted roots with `minimalMutationRoots` before a
subtree query; do not query all descendants of a changed caption. Initial discovery
and an explicit global Hide names change may scan globally. Native presentation
compares each entry's own item/label/binding, ownership permissions and relevant
appearance/asset inputs; force reapply only after a real DOM host change. Function
scope/rigidity metadata changes must invalidate permission checks.

`createRegistrationBatch` coalesces function-registration metadata into one UI
inventory publication per microtask. Source stacks/token cleanup update immediately;
last registration/cleanup per ID wins. This is not an editor/action/history queue:
commands and commits remain synchronous, and no registration publication occurs
after owner unmount. Preserve unavailable placeholders and source-stack fallback.


Snapshot selectors must be pure projections of the committed owner snapshot and
captured component inputs. `createSliceReader` reuses a result for the same snapshot
and selector identity, retaining the prior slice reference if values compare equal.
A new inline selector/captured props or a new committed snapshot triggers evaluation;
events continue to read the live committed handle. Never mutate snapshot objects to
signal an update or use a render selector for side effects.

UI-selection marker reconciliation must return immediately when its selected-ID
set is empty: the previous effect cleanup removes old markers. Do not discover or
measure every selectable control after an ordinary layout/registry change just to
write false selection markers. Actual selection/arrangement still uses the shared
selection path, current permissions and visible-control bounds.


Window/frame drag previews use `createDragQueries` only for read-only gesture
snapshots: ownership, inherited pinning, context scope and canDock results are
reused by key until the effective layout identity changes. Do not use this cache
inside mutating layout transactions. Final commits still revalidate using the
shared layout functions. Frame-slot/visible-zone discovery occurs at pickup and
release, rather than querying/measuring the entire inventory on each move. Existing
source geometry snapshots keep target positions stable during preview; release
refreshes pointed ancestors and slot bounds before resolving the final drop.

Pointer movement retains only the newest coordinates. The frame callback reads
hit geometry before writing the held payload's transform and publishing feedback.
Esc/end/unmount cancel queued frames; release resolves its own coordinates even if
there was no final animation callback. Live DOM lifting, grab offsets, payload
restoration, ownership/pinning and a single saved history commit remain shared.
Do not introduce per-pointer React layout updates or persistence for movement.

Active-context shortcuts defer while `uiPointerHeld()` is true, allowing the
existing drag/resize gesture handler to consume cancellation first. Esc must
restore a held drag before any parent minimize action. Physical press ownership
still ends only on release; cancel must not send that held input into the scene.


Cold caption setup in `NamePresentation` reads initial font sizes for newly
symbolized captions in one pass before applying symbol, tooltip or accessibility
writes. Do not interleave `getComputedStyle` with per-caption styling: the first
open of a large frame otherwise repeatedly forces synchronous style recalculation.
Existing captions retain their measured symbol size; selectors and caption metadata
remain shared. This does not preload feature modules, change saved appearance,
unmount native fields or replace real first-use mounting/layout work with a fake
loading delay. Test cold opens separately from warmed minimize/reopen.

For frame/window pickup, omit the held root and its descendants from candidate
destination zones, slots and bounds; they cannot receive their own ancestor. Keep
ancestors/siblings eligible. Snapshot visibility and slot lists before the live
lift writes popover/position styles. Exact resident IDs use a direct escaped
selector. Function payloads retain their existing candidate semantics. Release
still refreshes current destination geometry; do not reuse a stale expansion size.


MC option hover/focus is selection of the temporary configuration choice, routed
centrally through `ConfigurationInteractionBoundary` and the registered `select`.
Armed Shift release applies that choice exactly once. Hover/focus never locks the
future default; explicit unarmed configuration still needs an apply/lock action.
Keep repeated-key cycling, right-click lock/apply, and left-click priority-1 reset
on the same gesture owner. Do not add per-feature Shift/hover state stores.

Resize viewport projection is owned by `data-ui-viewport-original` and private CSS
variables, not React-owned className/inline position/transform. The stable marker
retains geometry, original background/padding/border and fill rules across local
window rerenders, so native popover defaults cannot leak through. CSS projection
geometry yields to `.ui-live-drag`. Cleanup removes only projection-owned variables
and its marker, leaving current React/Rnd geometry authoritative. Minimize must not
clamp saved original coordinates using enlarged projection bounds.

Use `useWindowLayer` for floating windows, detached groups and user frames. Repeated
presses on the current front layer are no-ops; other windows still rise. Preserve
menu priority and DOM ownership. Do not allocate a new layer and rerender all of a
window's chrome on every grab when its stacking order is already correct.


## Content context-menu ownership

A surface with its own right-click workflow declares `data-context-menu-owner`;
shared `ContextualMasterController` popups already inherit ownership through
`data-context-controller`. `ui/contextMenuOwnership.ts` supplies the same predicate
for background UI menus, selected-UI capture and native-action customization.
Those fallbacks yield on owned content. Local handlers still stop propagation;
controllers consume unused context-menu bubbling on their own surface.

`FunctionControl` preserves a registered function's original `onContextMenu`
before applying its UI-customization fallback (except palette projections, whose
right-click continues to edit the UI item). Consumed local handlers win even when
a control is moved outside its original parent. Original form-control handlers
already run inside their wrapper and are not invoked twice. Do not use
`defaultPrevented` as an ownership signal: document capture globally prevents the
browser menu before React dispatch. Ordinary frame chrome and unowned controls
keep existing UI editing. No Omnic-specific IDs, permission changes, listeners per
function, geometry scans or saved ownership values are needed.


## Active tool cursor inheritance

`FEATURE_ACTIONS.toolIcon` declares a persistent tool's default glyph/image once.
Its owner supplies active `cursor` state to `useFeatureActions`; the shared hook
registers it automatically with the single website `ToolCursorLayer`. Alias
buttons use `UIAction tool` with the canonical command ID. FunctionControl renders
the same declared icon and captures the actual clicked glyph/custom asset before
a toggle swaps to the next action. Native keyboard/default activation uses the
declared icon; clicked appearance snapshots refresh on the next activation.

The shared layer gives MS priority, keeps its live SelectorSymbol, precision
anchor and parked position, and restores the underlying tool when MS closes.
Other specialized live tools use `useToolCursor` with their existing symbol.
Cursor nodes inherit the existing nonselectable decoration marker. Pointer motion
updates one transform only: no React, geometry/style reads, matching, persistence
or history. Style capture is activation-only and bounded to 128 icon nodes.
Do not introduce another hardcoded cursor emoji, private portal or pointer listener.

The pen/eraser uses two opposite halves of the same rounded diagonal silhouette,
without an underline. Pen is upper black/lower white; Erase is upper black/lower
white. The button offers the next action; the cursor shows the active one.

Tool cursor inheritance is applicability-scoped. Every active cursor declares a
`zone`; absent scope means native cursor. DOM surfaces register through
`useToolCursorZone`, caching geometry on entry/resize/scroll; canvas/3D adapters
publish existing hit results through `setToolCursorZone`. The resolver filters
by the pointer's actual zone before choosing priority. Only an explicitly
page-wide operation declares `zone: "*"`; selector/settings chrome is excluded.
Leaving a zone restores native controls immediately, even with pointer capture
(cached circle/rectangle containment). Function/zone transitions update the
cursor selection; ordinary motion only updates its transform. The existing
capture-phase cursor tracker feeds this transport before domain handlers can
consume pointer events. It does not install another pointer-move listener.
