# Omnia capabilities and how to use them

Generated from the reviewed capability catalog and the live command/gesture registries. Edit `docs/capabilities/catalog.json`; run `node --run docs:capabilities`.

This is the user guide and the first place workers check before proposing a duplicate feature. It describes this branch, not proof that every feature has reached production. **Browser acceptance is unrecorded unless an entry says otherwise.** Cloud rollout and provider configuration are separate from implementation.

Find a feature by name in the index or command table. Open the relevant owner/frame first: contextual commands can be unavailable until that owner is mounted. Custom layouts can move controls; UI search and Shortcuts show registered names and your actual saved bindings. Catalog defaults below may differ from your settings.

Use disposable work for tests; export your workspace first. Each numbered step includes its expected result. Record failures and observed results against the stable capability ID; do not mark a test passed from builds alone.

## Feature index

| Capability | Availability | Find it |
| --- | --- | --- |
| [Capability guide and automatic coverage checks](#guidance-catalog) | Implemented; generator and coverage checks verified | Repository README → capabilities and user guide; bookmark docs/CAPABILITIES.md. |
| [Active context, close, minimize, resize and descendants](#interface-context) | Implemented; browser verification pending | Master controller → Active context. Click the intended frame first. |
| [Universal Shift configuration](#interface-configure) | Implemented; browser verification pending | Hold Shift and press the configured shortcut of the function you want. |
| [Search UI and reveal settings](#interface-search) | Implemented; browser verification pending | S in the active context; Shift+S chooses scope. Global UI search also exists in the catalog. |
| [Move, dock, select and organize UI](#interface-arrange) | Implemented; browser verification pending | UI library; UI edit mode; shared frame/control context actions. |
| [Chronological undo/redo and filtering](#history-global) | Implemented; browser verification pending | MC → History; Shift plus the configured Undo/Redo trigger. Check current bindings in Shortcuts. |
| [Visual hierarchy, shared properties and Apply/Discard](#appearance-edit) | Implemented; browser verification pending | Master controller → Visuals → Visual hierarchy / Properties. |
| [Choose, copy and paste applicable properties](#appearance-clipboard) | Implemented; browser verification pending | MC → Properties → Copy properties / Paste applicable properties. |
| [Themes, templates, fonts and emergency recovery](#appearance-recovery) | Implemented; browser verification pending | Master controller / appearance settings; hold Esc for two seconds for protected recovery. |
| [Horizontal spectrum slider](#controls-spectrum) | Implemented; browser verification pending | Numeric property editors, including history Steps and visual parameters. |
| [Master Selector: patterns, scope, removal and cursor parking](#selector-core) | Implemented; browser verification pending | Q opens/resumes MS; Shift+Q opens selected-property editing by default. |
| [Selection geometry, feedback and logical Self targets](#selector-geometry) | Implemented; browser verification pending | MS geometry controls; Self inventory; Selection / Preview and BG controls. |
| [Create nodes, children, reuse identities and connect](#graph-create) | Implemented; browser verification pending | Create menu, node Inspector and context actions; N / New child / Connect from selected. |
| [Expansion, movement, axis constraints and compaction](#graph-layout) | Implemented; browser verification pending | Node selection; expansion controls; spatial settings and compaction actions. |
| [Investigative frames, variants, layouts and proposals](#graph-frames) | Implemented; browser verification pending | Create / investigative-frame / relationship / external AI proposal panels. |
| [Camera versus object rotation, trackball and axis lock](#camera-navigation) | Implemented; browser verification pending | World canvas → configured navigation drag (MB2 by default); Shift opens its MC settings. |
| [Front-on centering, fit, origin, roll and focus navigation](#camera-framing) | Implemented; browser verification pending | MC World view / Active context and navigation catalog; F frames selected front-on. |
| [Procedural generators and parameters](#omnic-compose) | Implemented; browser verification pending | Create → New Omnic object; Open Omnic composer without a selection; or select a node → Inspector → Open Omnic composer. |
| [Ordered operations, role picking, target repair and count extraction](#omnic-operations) | Implemented; user verification pending | Composer → Scope / Ordered operations. |
| [Interpretive frame declarations](#omnic-frames) | Implemented; browser verification pending | Composer → Interpretation frames. |
| [Semantic oscillation and playback](#omnic-motion) | Implemented; browser verification pending | Composer → Semantic oscillation preset / Play–pause. |
| [Live world drafts before saving](#omnic-worldPreview) | Implemented for review; source PR and visual preview do not establish production deployment or browser acceptance | Create → New Omnic object; Open Omnic composer with or without an existing selected object. |
| [Shared save, independent copy, drafts and recipe import/export](#omnic-saving) | Implemented; browser verification pending | Composer toolbar; Inspector → Show Omnic structure. |
| [Shared library, multiple atlases and copy provenance](#library-objects) | Implemented; browser verification pending | Create → Omnic library. |
| [Collections, tags, presets and names](#library-organize) | Implemented; browser verification pending | Omnic library → selected object / Organization. |
| [Structural filters, indexing and saved families](#library-filters) | Implemented; browser verification pending | Omnic library → Structural filters / Organization → Save filter as family. |
| [Live dependencies, frozen pins, restore and archive pruning](#library-revisions) | Implemented; browser verification pending | Composer reference component → Dependency version; library → Dependencies / revisions. |
| [Local workspace autosave, portability and recovery](#library-persistence) | Implemented; browser verification pending | Library → Export workspace / Import workspace / Recover previous workspace; File → Import/Export JSON for individual atlases. |
| [Existing account, private workspace and image storage](#cloud-connection) | Existing hosted foundation; current browser acceptance not recorded | Workspace settings → Cloud connection. |
| [Explicit workspace cloud save/load and conflicts](#cloud-snapshots) | Implemented and locally tested; hosted rollout pending | Omnic library → Cloud workspace, after signing in. |
| [Node-linked scenes from imported images and copied prompts](#scene-manual) | Implemented; browser verification pending | Scene panel; select an Omnium node. |
| [Optional API scene generation](#scene-api) | Implemented; paid generation gated by server configuration | Scene → API generation (optional). |
| [Click responsiveness and shared rendering work](#performance-clicks) | Earlier lag improvements confirmed; release handoff and live validation follow-up await user testing | Ordinary controls, including Omnic library → Objects → Structural filters. |

<a id="guidance-catalog"></a>
## Capability guide and automatic coverage checks

**ID:** `guidance.catalog` · **Status:** Implemented; generator and coverage checks verified

**Where:** Repository README → capabilities and user guide; bookmark docs/CAPABILITIES.md.

Reviewed walkthroughs explain features, exact entry points, limitations and observable tests. The command/gesture inventory regenerates from the application registries. Builds and model checks reject missing command coverage and stale generated guidance.

**Minimal working test**

1. Open the repository README and follow capabilities and user guide. Search for Interpretive frame declarations. **Expected:** Its location, scoped tri-state behavior and explicit lack of constraint enforcement are visible.
2. Follow a capability’s numbered test and compare each expected result. **Expected:** You can report the stable capability ID and the failing step without reconstructing chat history.
3. For contributors: run node --run docs:capabilities, then node --run check:capabilities. **Expected:** The generated guide is current and every registered command/gesture has walkthrough coverage.

**Limits / unavailable behavior:** Repository guide only; no in-app guide viewer yet. Automation checks coverage/freshness, not whether a human walkthrough or browser behavior is correct.

**Verification:** browser — Not applicable to repository-only guide generation. Automated — Generator and check command run; model suite validation recorded in delivery.

**Details:** [subsystem guide](capabilities/README.md). **Implementation:** [scripts/capabilities.mjs](../scripts/capabilities.mjs).

**Related:** [Interpretive frame declarations](#omnic-frames), [Shared library, multiple atlases and copy provenance](#library-objects).

<a id="interface-context"></a>
## Active context, close, minimize, resize and descendants

**ID:** `interface.context` · **Status:** Implemented; browser verification pending

**Where:** Master controller → Active context. Click the intended frame first.

Actions target the clicked/focused frame. Esc steps out one field/popup level before minimizing; active MS has priority. W resizes/restores, M minimizes/restores, X closes, D toggles descendants, subject to saved bindings. Resized windows retain projected bounds and themed borders across focus and minimize/reopen. W restores retained original geometry. Projection styling is independent of React/Rnd wrapper updates.

**Minimal working test**

1. Open a frame, click a value field, edit it, then press Esc. **Expected:** The value edit cancels and focus returns to its parent.
2. Press Esc again at frame level; reopen it. Try M, W, then W again. **Expected:** The frame minimizes/restores; resize can restore its earlier size.
3. Expand several nested sections, then invoke Expand / collapse active descendants. **Expected:** Descendant sections collapse together. Closing preserves reopenable frames.
4. Resize with Shift+W, hover Full viewport and release Shift. Click the window body, minimize/re-expand it several times, then press W. **Expected:** No extra white wrapper border or unexpected position jump. Expanded cycles return to the selected viewport; W restores original size and position.

**Limits / unavailable behavior:** Website viewport sizing, not OS/browser fullscreen. Pinned frames reject resizing. Projected frames use W restore before dragging, under the existing rigidity policy. User acceptance pending.

**Verification:** browser — Focused floating-window and custom-frame cycles, body clicks, restored geometry and no browser border pass locally; user acceptance pending.. Automated — 281 model checks and type/build checks.

**Details:** [subsystem guide](UI_COMPONENT_CONTRACT.md). **Implementation:** [src/ui/ActiveContext.tsx](../src/ui/ActiveContext.tsx), [src/ui/FrameResize.tsx](../src/ui/FrameResize.tsx), [src/ui/FrameResize.tsx](../src/ui/FrameResize.tsx), [src/ui/FrameViewport.tsx](../src/ui/FrameViewport.tsx), [src/ui/useWindowLayer.ts](../src/ui/useWindowLayer.ts), [scripts/check-ui-resize.mjs](../scripts/check-ui-resize.mjs).

**Command IDs:** `cancel`, `settings`, `context.resize`, `context.back`, `context.float`, `context.close`, `context.minimize`, `context.descendants`.

**Related:** [Universal Shift configuration](#interface-configure).

<a id="interface-configure"></a>
## Universal Shift configuration

**ID:** `interface.configure` · **Status:** Implemented; browser verification pending

**Where:** Hold Shift and press the configured shortcut of the function you want.

Only relevant MC settings appear. Repeated shortcut presses cycle choices; hovering/focusing an option selects the temporary choice. Release Shift applies the selected choice once. Right-click applies and locks it; left-click resets to priority 1. Hover/focus does not change the saved default.

**Minimal working test**

1. Activate a frame. Hold Shift, press W, then hover a different resize level without pressing W again. Release Shift. **Expected:** The pointed option becomes selected and previews its bounds; Shift release applies that option exactly once. Keyboard focus selects an option the same way.
2. Repeat Shift+W, right-click another option, release Shift, then use plain W. Repeat and left-click an option. **Expected:** Right-click applies and locks once; later Shift release does not execute again. Plain W uses the locked level or restores an active projection. Left-click resets to priority 1.

**Limits / unavailable behavior:** Shift release executes only an armed shortcut configuration. Explicit button-opened configuration remains unarmed. User acceptance pending.

**Verification:** browser — Focused local hover/focus release, no implicit lock, right-click locking and left-click reset checks pass. User acceptance pending.. Automated — 281 model checks, including pointed selection exactly-once release, unarmed sessions, defaults and layer reuse; build/type checks.

**Details:** [subsystem guide](FUNCTION_CONFIGURATION.md). **Implementation:** [src/ui/ShortcutConfiguration.tsx](../src/ui/ShortcutConfiguration.tsx), [src/ui/ConfigurationInteraction.tsx](../src/ui/ConfigurationInteraction.tsx), [src/ui/configurationGesture.ts](../src/ui/configurationGesture.ts), [scripts/check-ui-resize.mjs](../scripts/check-ui-resize.mjs).

**Command IDs:** `shortcuts`.

<a id="interface-search"></a>
## Search UI and reveal settings

**ID:** `interface.search` · **Status:** Implemented; browser verification pending

**Where:** S in the active context; Shift+S chooses scope. Global UI search also exists in the catalog.

Search finds registered functions/settings. S uses retained scope, progressing from active frame through parents to All UI. Selecting a destination retains its reveal after pointer exit.

**Minimal working test**

1. Activate MC, use Shift+S to choose All UI, release Shift, and type blur. **Expected:** A focused search field accepts text and shows relevant results.
2. Activate a result and move the pointer away; press Esc through the field and popup. **Expected:** The destination stays revealed. Esc exits each active layer without a stuck focus border.

**Limits / unavailable behavior:** Browser acceptance has not been recorded for this guide.

**Verification:** browser — Not recorded. Automated — See subsystem tests and PR checks; not proof of usability.

**Details:** [subsystem guide](FUNCTION_CONFIGURATION.md). **Implementation:** [src/ui/SearchController.tsx](../src/ui/SearchController.tsx), [src/ui/search.ts](../src/ui/search.ts).

**Command IDs:** `searchUI`, `context.search`.

<a id="interface-arrange"></a>
## Move, dock, select and organize UI

**ID:** `interface.arrange` · **Status:** Implemented; browser verification pending

**Where:** UI library; UI edit mode; shared frame/control context actions.

Drag actual frame handles or supported control edges. Docking offers destinations when a dragged header reaches another header. UI selection, alignment, compaction and reset are separate from knowledge structure. Window/frame drag previews reuse gesture-local target discovery and read-only docking policy results. Visual movement uses the latest pointer position once per animation frame, with geometry reads before transform writes. Release refreshes destination geometry and commits through the existing shared history; cancellation restores the live payload. Active-context shortcuts defer to a held UI gesture, so Esc cancels the drag before a parent minimize action. Pickup snapshots exclude descendants of the held frame/window and read visibility before lifting, reducing the expand-then-drag setup burst.

**Minimal working test**

1. Create a UI frame, then drag a complete section into it by its handle. **Expected:** Its live controls move with it.
2. Hover another window without dragging; then drag a header over another header and choose a dock guide. **Expected:** Hover alone offers no docking. The deliberate drop docks the frame.
3. Select multiple UI controls and invoke Compact selected UI / Align UI. Undo. **Expected:** Selected controls rearrange; undo restores their UI arrangement without changing graph facts.
4. In UI edit mode, drag an expanded floating window across empty canvas, release it, then Undo once. Start another drag and press Esc before release. **Expected:** The window follows the latest pointer position. Release saves its final location; one Undo restores the prior layout. Esc cancels movement without saving a layout change. Report any visible frame skipping.

**Limits / unavailable behavior:** Drag targets use a gesture-local discovery snapshot, refreshed at release. Browser traces are local diagnostics; user hardware smoothness acceptance remains pending.

**Verification:** browser — Focused isolated Chromium drag checks passed live payload, no persistence during movement, release commit, one-step Undo, Esc cancellation without minimizing, docking and one-step docking Undo. User hardware frame-skipping verification pending.. Automated — 279 model checks, including cached docking/ownership/pinning/context policy equivalence and invalidation on changed snapshots; build/type checks.

**Details:** [subsystem guide](UI_LAYOUT.md). **Implementation:** [src/ui/UIWorkspace.tsx](../src/ui/UIWorkspace.tsx), [src/ui/docking.ts](../src/ui/docking.ts), [src/ui/layout.ts](../src/ui/layout.ts), [src/ui/dragQueries.ts](../src/ui/dragQueries.ts), [scripts/profile-ui-drag.mjs](../scripts/profile-ui-drag.mjs).

**Command IDs:** `ui:devMode`, `ui:select`, `ui:compact`, `ui:align`.

<a id="history-global"></a>
## Chronological undo/redo and filtering

**ID:** `history.global` · **Status:** Implemented; browser verification pending

**Where:** MC → History; Shift plus the configured Undo/Redo trigger. Check current bindings in Shortcuts.

Recent uses chronological actions across owners; Context limits actions to the active context; Selective uses categories. Configure steps and a retained maximum of 10. MS selection has a separate transient timeline.

**Minimal working test**

1. Change a visual property, then move a UI frame. Invoke normal Undo twice. **Expected:** The frame move reverses before the earlier visual edit.
2. Hold Shift plus Undo, cycle Recent / Context / Selective, set steps, and release Shift. **Expected:** The selected history operation executes once using those settings.
3. Redo, then switch atlases and undo a knowledge edit. **Expected:** The shared workspace is restored safely; the edit is not applied to an unrelated atlas.

**Limits / unavailable behavior:** Browser acceptance has not been recorded for this guide.

**Verification:** browser — Not recorded. Automated — See subsystem tests and PR checks; not proof of usability.

**Details:** [subsystem guide](SHORTCUTS.md). **Implementation:** [src/ui/actionHistory.ts](../src/ui/actionHistory.ts), [src/ui/ContextualHistoryController.tsx](../src/ui/ContextualHistoryController.tsx).

**Command IDs:** `ui:undo`, `ui:redo`, `undo`, `redo`, `history.configure`.

**Related:** [Master Selector: patterns, scope, removal and cursor parking](#selector-core).

<a id="appearance-edit"></a>
## Visual hierarchy, shared properties and Apply/Discard

**ID:** `appearance.edit` · **Status:** Implemented; browser verification pending

**Where:** Master controller → Visuals → Visual hierarchy / Properties.

Visual roles group backgrounds, contours, text and other repeated parts. Selection becomes the exclusive edit scope. Unapplied edits are drafts; deselecting a target rolls its draft back to applied values.

**Minimal working test**

1. Select two visual subtypes and change their color without applying. **Expected:** Both selected types preview the edit.
2. Deselect one type, then change color again and Apply. **Expected:** The removed type returns to its applied appearance; only the retained type receives later changes.
3. Make another draft change and request close/minimize. **Expected:** Existing Apply / Discard / Cancel choices blink; Apply/Discard completes the queued action and Cancel keeps editing.

**Limits / unavailable behavior:** Browser acceptance has not been recorded for this guide.

**Verification:** browser — Not recorded. Automated — See subsystem tests and PR checks; not proof of usability.

**Details:** [subsystem guide](APPEARANCE_CONTROLLER.md). **Implementation:** [src/appearance/MasterController.tsx](../src/appearance/MasterController.tsx), [src/appearance/draftTargets.ts](../src/appearance/draftTargets.ts).

**Command IDs:** `appearance`.

<a id="appearance-clipboard"></a>
## Choose, copy and paste applicable properties

**ID:** `appearance.clipboard` · **Status:** Implemented; browser verification pending

**Where:** MC → Properties → Copy properties / Paste applicable properties.

Copy offers a property checklist. Mixed values are omitted. Paste uses destination capabilities and protections; unchecked companion properties remain unchanged.

**Minimal working test**

1. Choose a text target, customize color and glow, then Copy properties and check only Color. **Expected:** The transient copy contains Color only.
2. Choose a different compatible text type and Paste applicable properties. **Expected:** Its color changes; its glow and unsupported/locked properties stay unchanged.

**Limits / unavailable behavior:** Browser acceptance has not been recorded for this guide.

**Verification:** browser — Not recorded. Automated — See subsystem tests and PR checks; not proof of usability.

**Details:** [subsystem guide](APPEARANCE_CONTROLLER.md). **Implementation:** [src/appearance/MasterController.tsx](../src/appearance/MasterController.tsx).

**Command IDs:** `properties.copy`, `properties.paste`.

<a id="appearance-recovery"></a>
## Themes, templates, fonts and emergency recovery

**ID:** `appearance.recovery` · **Status:** Implemented; browser verification pending

**Where:** Master controller / appearance settings; hold Esc for two seconds for protected recovery.

Appearance and UI templates preserve supported settings. Custom fonts are imported through the font library. Recovery remains usable when a theme becomes unreadable.

**Minimal working test**

1. Save a theme/template, make a small appearance change, then restore the saved template. **Expected:** Supported saved appearance returns.
2. Hold Esc for two seconds and inspect recovery choices. **Expected:** Protected recovery opens even if normal theme controls are hard to see. Cancel without resetting.

**Limits / unavailable behavior:** Use disposable themes when testing restoration. Effects are budgeted; smoothness on user hardware remains unverified.

**Verification:** browser — Not recorded. Automated — See subsystem tests and PR checks; not proof of usability.

**Details:** [subsystem guide](APPEARANCE_CONTROLLER.md). **Implementation:** [src/appearance/Recovery.tsx](../src/appearance/Recovery.tsx), [src/themeTemplates.ts](../src/themeTemplates.ts), [src/fontLibrary.ts](../src/fontLibrary.ts).

**Command IDs:** `ui:arrange`, `ui:createFrame`, `ui:reset`, `theme`.

<a id="controls-spectrum"></a>
## Horizontal spectrum slider

**ID:** `controls.spectrum` · **Status:** Implemented; browser verification pending

**Where:** Numeric property editors, including history Steps and visual parameters.

Drag anywhere on the track. Left-click endpoints selects min/max; right-click endpoints edits working limits. Right-click the dot types a value; right-click arrows changes jump size. Working limits cannot override hard renderer/semantic bounds.

**Minimal working test**

1. Drag from an empty point on the track, rather than the dot. **Expected:** The value follows the pointer continuously.
2. Right-click the dot, enter a value, then right-click an endpoint and an arrow. **Expected:** Manual value, working bound and jump editors appear for the corresponding parts.
3. Select an endpoint and undo the completed property edit. **Expected:** The value reaches the supported endpoint; undo restores the prior committed setting.

**Limits / unavailable behavior:** Browser acceptance has not been recorded for this guide.

**Verification:** browser — Not recorded. Automated — See subsystem tests and PR checks; not proof of usability.

**Details:** [subsystem guide](UI_COMPONENT_CONTRACT.md). **Implementation:** [src/ui/RangeControl.tsx](../src/ui/RangeControl.tsx).

<a id="selector-core"></a>
## Master Selector: patterns, scope, removal and cursor parking

**ID:** `selector.core` · **Status:** Implemented; browser verification pending

**Where:** Q opens/resumes MS; Shift+Q opens selected-property editing by default.

Pattern matching selects registered subtypes. E cycles modes; drawing geometry combines boundary/inside/outside. RMB removes the pointed selected pattern, or clears all over an unselected target. Ctrl+MB3 parks the MS cursor. Esc clears MS before minimizing a window.

**Minimal working test**

1. Aim MS at one text subtype and select it. Enter MC. **Expected:** That subtype is selected for editing; cursor becomes normal in the editor.
2. Resume aiming and right-click a selected target, then an unselected target. **Expected:** The first removes the matching selection; the second clears all.
3. Make a selection, undo/redo it while MS is active, then press Esc. **Expected:** Selection history works independently; Esc clears MS before affecting the window.

**Limits / unavailable behavior:** Browser acceptance has not been recorded for this guide.

**Verification:** browser — Not recorded. Automated — See subsystem tests and PR checks; not proof of usability.

**Details:** [subsystem guide](VISUAL_SELECTION.md). **Implementation:** [src/appearance/VisualSelector.tsx](../src/appearance/VisualSelector.tsx), [src/appearance/visualSelection.ts](../src/appearance/visualSelection.ts).

**Command IDs:** `selector.open`, `selector.lock`, `selector.selectMouse`, `selector.pattern`, `selector.deselect`, `selector.edit`, `selector.cancel`, `selector.undo`, `selector.redo`, `selector.redoAlternate`, `selector.clear`, `selector.aim`, `selector.boundary`, `selector.inside`, `selector.outside`, `selector.include`, `selector.finishGeometry`, `selector.releaseGeometry`, `selector.closePath`, `selector.bounds`, `selector.colorStop`.

<a id="selector-geometry"></a>
## Selection geometry, feedback and logical Self targets

**ID:** `selector.geometry` · **Status:** Implemented; browser verification pending

**Where:** MS geometry controls; Self inventory; Selection / Preview and BG controls.

Rectangle, ellipse, polygon, freehand and directional modes refine scope. BG inclusion is opt-in. Feedback visibility does not alter selection. Self inventory exposes registered logical consumers such as Mouse trail.

**Minimal working test**

1. Choose polygon mode, place at least three vertices, then Enter. **Expected:** The polygon completes and defines the selected region.
2. Toggle Selection / Preview, then restore it. **Expected:** Feedback hides/returns while accepted membership remains.
3. Select Mouse through Self inventory and open MC. **Expected:** Its coupled controls are available without creating a visual instance.

**Limits / unavailable behavior:** Arbitrary negative-space and general semantic 3D picking are not implemented. See the subsystem guide for exact supported geometries.

**Verification:** browser — Not recorded. Automated — See subsystem tests and PR checks; not proof of usability.

**Details:** [subsystem guide](VISUAL_SELECTION.md). **Implementation:** [src/appearance/selectionGeometry.ts](../src/appearance/selectionGeometry.ts), [src/appearance/VisualSelector.tsx](../src/appearance/VisualSelector.tsx).

**Command IDs:** `selector.selfInventory`, `selector.feedbackView`, `selector.backgrounds`.

<a id="graph-create"></a>
## Create nodes, children, reuse identities and connect

**ID:** `graph.create` · **Status:** Implemented; browser verification pending

**Where:** Create menu, node Inspector and context actions; N / New child / Connect from selected.

N resolves creation from the current focus/selection. Placements can share a canonical identity. Typed relationships, structural composition and visual nesting are distinct.

**Minimal working test**

1. Select a node and press N, then select its child and press N again. **Expected:** Creation follows the current context rather than a hardcoded parent.
2. Reuse an identity as another placement; rename the identity. **Expected:** Both placements refer to the renamed object.
3. Connect two nodes through the relationship controls. **Expected:** An explicit relationship is created; merely moving one near another creates none.

**Limits / unavailable behavior:** Browser acceptance has not been recorded for this guide.

**Verification:** browser — Not recorded. Automated — See subsystem tests and PR checks; not proof of usability.

**Details:** [subsystem guide](WORKER_ONBOARDING.md). **Implementation:** [src/App.tsx](../src/App.tsx), [src/graph/structural.ts](../src/graph/structural.ts).

**Command IDs:** `selectAll`, `deleteSelected`, `newNode`, `newChild`, `connect`.

<a id="graph-layout"></a>
## Expansion, movement, axis constraints and compaction

**ID:** `graph.layout` · **Status:** Implemented; browser verification pending

**Where:** Node selection; expansion controls; spatial settings and compaction actions.

Expansion shows charted structure. Arrow-key movement previews per frame and commits once on release. Axis constraints and graph compaction affect placement, not canonical identity.

**Minimal working test**

1. Create a parent/child pair and toggle the selected node and its whole subtree. **Expected:** Visibility expands/collapses at the selected scope.
2. Hold a movement arrow, release it, then Undo. **Expected:** Movement stops on release and reverses as one gesture without a queued backlog.
3. Compact the selected subsystem. **Expected:** Its placements rearrange; unrelated knowledge identities are unchanged.

**Limits / unavailable behavior:** Browser acceptance has not been recorded for this guide.

**Verification:** browser — Not recorded. Automated — See subsystem tests and PR checks; not proof of usability.

**Details:** [subsystem guide](SHORTCUTS.md). **Implementation:** [src/navigation/nudgeGesture.ts](../src/navigation/nudgeGesture.ts), [src/graph/layout3d.ts](../src/graph/layout3d.ts).

**Command IDs:** `expand`, `expandAll`, `toggleSnap`, `nudgeLeft`, `nudgeRight`, `nudgeUp`, `nudgeDown`, `axisX`, `axisY`, `axisZ`, `compactSelected`, `compactFrame`, `compactAll`.

<a id="graph-frames"></a>
## Investigative frames, variants, layouts and proposals

**ID:** `graph.frames` · **Status:** Implemented; browser verification pending

**Where:** Create / investigative-frame / relationship / external AI proposal panels.

Investigative frames scope knowledge references. Variants and coordinate layout views retain canonical IDs. External changesets are reviewed against a local revision before acceptance.

**Minimal working test**

1. Create a frame around a small branch and change its scope. **Expected:** The frame view changes without deleting the underlying identities.
2. Switch a saved coordinate layout or inspect a variant. **Expected:** Presentation changes without inventing knowledge relationships.
3. Preview a disposable external changeset before accepting it. **Expected:** Proposed changes remain a preview until accepted; invalid or stale proposals are rejected.

**Limits / unavailable behavior:** Browser acceptance has not been recorded for this guide.

**Verification:** browser — Not recorded. Automated — See subsystem tests and PR checks; not proof of usability.

**Details:** [subsystem guide](WORKER_ONBOARDING.md). **Implementation:** [src/graph/changeset.ts](../src/graph/changeset.ts), [src/graph/presentation.ts](../src/graph/presentation.ts), [src/graph/variants.ts](../src/graph/variants.ts).

<a id="camera-navigation"></a>
## Camera versus object rotation, trackball and axis lock

**ID:** `camera.navigation` · **Status:** Implemented; browser verification pending

**Where:** World canvas → configured navigation drag (MB2 by default); Shift opens its MC settings.

Direct node drag turns the object. Empty space with a selection orbits the selected branch; without selection it turns the camera in place. Ctrl locks the initial rotation axis. Context choices persist for the session.

**Minimal working test**

1. Drag near a node center, then tangentially near its rim. **Expected:** Trackball turn/tilt differs from rim spin.
2. Select the node, zoom in, and drag empty space vertically through a full turn. **Expected:** Camera orbits the branch without an automatic zoom-out or vertical pole lock.
3. Hold Ctrl and begin horizontal motion, adding vertical jitter. **Expected:** The initial axis stays locked until Ctrl is released.

**Limits / unavailable behavior:** Camera context choices are session-only. Check the current shortcut binding rather than assuming MB2 when MS is active.

**Verification:** browser — Not recorded. Automated — See subsystem tests and PR checks; not proof of usability.

**Details:** [subsystem guide](WORLD_NAVIGATION.md). **Implementation:** [src/SpatialWorkspace.tsx](../src/SpatialWorkspace.tsx), [src/navigation/transforms.ts](../src/navigation/transforms.ts).

**Command IDs:** `world.navigate`.

<a id="camera-framing"></a>
## Front-on centering, fit, origin, roll and focus navigation

**ID:** `camera.framing` · **Status:** Implemented; browser verification pending

**Where:** MC World view / Active context and navigation catalog; F frames selected front-on.

Front-on framing changes the camera, not the object. Fit local/all, return focus, roll, origin and zoom reset are separate explicit actions.

**Minimal working test**

1. Select a rotated node and invoke Frame selected front-on. **Expected:** It is centered and fitted face-on without changing its stored orientation.
2. Use Fit local system, zoom reset, then Back to previous focus. **Expected:** Each command changes the relevant camera view; Back restores the prior focus.

**Limits / unavailable behavior:** Browser acceptance has not been recorded for this guide.

**Verification:** browser — Not recorded. Automated — See subsystem tests and PR checks; not proof of usability.

**Details:** [subsystem guide](WORLD_NAVIGATION.md). **Implementation:** [src/SpatialWorkspace.tsx](../src/SpatialWorkspace.tsx).

**Command IDs:** `focus`, `isolateFocus`, `fitLocal`, `fitAll`, `back`, `zoom100`, `cameraOrigin`, `rollLeft`, `rollRight`, `world.faceSelection`.

<a id="omnic-compose"></a>
## Procedural generators and parameters

**ID:** `omnic.compose` · **Status:** Implemented; browser verification pending

**Where:** Create → New Omnic object; Open Omnic composer without a selection; or select a node → Inspector → Open Omnic composer.

New work opens a recoverable single-dot world draft without creating an object. Existing dot, ring, line, chain, radial, group and Reference generators use shared parameter controls. Valid changes preview directly in Omnium; canonical definitions change only on save.

**Minimal working test**

1. Open New Omnic object, choose a radial construction preset and change Count and Radius. **Expected:** Both the composer and temporary world structure change; no canonical object is created until Save shared or Save copy.
2. Add a group and add a generator inside it. Change its parameters. **Expected:** Nested structure appears and can be edited without manually placing units.

**Limits / unavailable behavior:** Lattice-constrained mouse/sweep construction, exact MS regions and calibrated reading size remain planned. Existing procedural controls are implemented. Browser acceptance has not been recorded.

**Verification:** browser — Not recorded. Automated — See subsystem tests and PR checks; not proof of usability.

**Details:** [subsystem guide](OMNIC_COMPOSER.md). **Implementation:** [src/omnic/Composer.tsx](../src/omnic/Composer.tsx), [src/omnic/registry.ts](../src/omnic/registry.ts).

**Command IDs:** `omnic.create`, `omnic.open`.

**Related:** [Live world drafts before saving](#omnic-worldPreview), [Shared save, independent copy, drafts and recipe import/export](#omnic-saving).

<a id="omnic-operations"></a>
## Ordered operations, role picking, target repair and count extraction

**ID:** `omnic.operations` · **Status:** Implemented; user verification pending

**Where:** Composer → Scope / Ordered operations.

Count, scale, fill, rotate, select, connect and oscillate run in order. Picked roles scope new operations; flow selection otherwise applies. Missing generated roles remain unresolved until explicitly repaired. Highlight units / region selects a 1-based unit or all scoped units and highlights an exact disk sector/ring arc fraction. Rotate supports highlighted region, each unit and group scopes, target-center/origin/custom pivots, saved snap step/origin and optional allowed angles. Rotate one step is rebindable and inherits Shift configuration. Operation tools are canonical scope-relative recipes, saved from the focused operation and applied as editable snapshots to picked/flow scope.

**Minimal working test**

1. Add Count followed by Extract count; change Count. **Expected:** The extracted scalar reflects the preceding count operation.
2. Move Extract count before Count using the order controls. **Expected:** Its scalar now reflects the earlier state.
3. Target a generated unit, shrink count so it disappears, then use picked scope / repair targets. **Expected:** The missing role is reported, never silently redirected, and an explicit replacement repairs it.
4. Open Create → New Omnic object. In Preset choose Member · one of two. Select Highlight units / region in Ordered operations. **Expected:** Two generated dots remain; Unit 1 is highlighted. Change Unit to 2 to move the highlight without drawing or changing unit count.
5. Choose Part · half a unit. Its highlight has fraction 0.5. Add Rotate structure, set Rotate to Highlighted region and Snap step to 30°. Set Angle to 50°. **Expected:** The half highlight rotates to 60°; the dot stays fixed. Together rotates the scoped composition; Each unit rotates each shape about its own center. Earlier operations determine the region available.
6. Set Snap step to 30° and use Rotate one step. Rebind that action in Master controller shortcuts if desired; hold Shift with its configured trigger to edit rotation configuration. **Expected:** Each ordinary invocation advances the angle by its saved snap. Repeated Shift trigger cycles Region → Each unit → Together; release applies. Right-click applies/locks; left-click resets to the first scope. Temporary changed configuration adds a scoped rotation operation and preserves the focused settings.
7. Focus Highlight units / region, set a copy name and choose Save operation as tool. Return to a composition, pick a component or Whole structure, open Reusable tools, choose the saved tool and Stamp copy to scope. **Expected:** The tool is a shared canonical object with no generated units. Applying it adds independently editable operations to the current draft; changing the tool later does not retroactively change stamped operations. Save shared, reopen and Undo/Redo retain authored rules.

**Limits / unavailable behavior:** Browser acceptance has not been recorded for this guide. Fractions are angular sectors of disks or arc fractions of rings; fractional lines report inapplicable. Whole line highlight works. One highlight layer per primitive (later highlight replaces earlier). Rotation is planar, angles bounded ±1080°, snap step 0–360°, up to 32 allowed-angle values. New rotation operators use target center; legacy operators retain origin/pivot offsets. Tool stamping snapshots operations rather than introducing live executable dependencies. No default rotation shortcut is assigned. Fixed-size world reading integration remains deferred.

**Verification:** browser — New Member/Part, rotation and tool workflows await user interaction testing; no browser suite run.. Automated — Normal model command passes; 20 focused Omnic engine cases pass directly, including highlighting, rotation, tools and parameter applicability. Production/type/property checks and self-contained preview build pass..

**Details:** [subsystem guide](OMNIC_COMPOSER.md). **Implementation:** [src/omnic/evaluate.ts](../src/omnic/evaluate.ts), [src/omnic/Composer.tsx](../src/omnic/Composer.tsx), [src/omnic/rotation.ts](../src/omnic/rotation.ts), [src/omnic/tools.ts](../src/omnic/tools.ts).

**Command IDs:** `omnic.rotateStep`.

<a id="omnic-frames"></a>
## Interpretive frame declarations

**ID:** `omnic.frames` · **Status:** Implemented; browser verification pending

**Where:** Composer → Interpretation frames.

Frames record inactive, active-unspecified or active-specified properties and an explicit scope. They do not yet interpret meaning, enforce constraints or alter geometry.

**Minimal working test**

1. Pick part of a composition, add an inactive angle frame, then switch it to active-specified and enter a value. **Expected:** The scoped declaration is recorded; geometry does not rotate.
2. Save shared, reopen and inspect the frame. **Expected:** Its scope, state and value are retained. Use Rotate structure separately to change geometry.

**Limits / unavailable behavior:** Constraint enforcement, inheritance and full semantic interpretation belong to Stage 3; unavailable now.

**Verification:** browser — Not recorded. Automated — See subsystem tests and PR checks; not proof of usability.

**Details:** [subsystem guide](OMNIC_COMPOSER.md). **Implementation:** [src/omnic/Composer.tsx](../src/omnic/Composer.tsx), [src/omnic/model.ts](../src/omnic/model.ts).

<a id="omnic-motion"></a>
## Semantic oscillation and playback

**ID:** `omnic.motion` · **Status:** Implemented; browser verification pending

**Where:** Composer → Semantic oscillation preset / Play–pause.

Oscillation is evaluated at explicit time, paused by default. Only the active bounded composer preview animates; world nodes stay static.

**Minimal working test**

1. Load Semantic oscillation, then press Play. **Expected:** The selected structure oscillates.
2. Pause and change amplitude/frequency/axis; play again. **Expected:** Motion reflects those parameters; pause changes playback without removing the operation.

**Limits / unavailable behavior:** 256 animated roles / 12fps; hidden/reduced-motion/slow previews pause. Atlas nodes are static.

**Verification:** browser — Not recorded. Automated — See subsystem tests and PR checks; not proof of usability.

**Details:** [subsystem guide](OMNIC_COMPOSER.md). **Implementation:** [src/omnic/Composer.tsx](../src/omnic/Composer.tsx), [src/omnic/evaluate.ts](../src/omnic/evaluate.ts).

**Command IDs:** `omnic.play`.

<a id="omnic-worldPreview"></a>
## Live world drafts before saving

**ID:** `omnic.worldPreview` · **Status:** Implemented for review; source PR and visual preview do not establish production deployment or browser acceptance

**Where:** Create → New Omnic object; Open Omnic composer with or without an existing selected object.

New work uses a recoverable temporary world structure. Valid composer inputs preview on selected identities and transitive live uses through a transient renderer bridge. Saved data and pins remain unchanged until an explicit save. Close removes the projection; Reset reverts unsaved edits.

**Minimal working test**

1. Open New Omnic object without saving and change Unit size or add/modify a generator. **Expected:** A temporary world structure follows valid edits. No new entity or graph placement appears in the saved workspace.
2. Close and reopen the new composer, then reload and open it again. **Expected:** The temporary world preview disappears on close and the unfinished recipe recovers on reopening in the same workspace/atlas.
3. Enter Glyph name and choose Save shared. **Expected:** One canonical object is created through normal placement/history, at the preview creation context.
4. Open an object with multiple placements and live Reference users; change its draft without saving. Compare with a revision-pinned Reference. **Expected:** Visible live uses and live dependency chains preview the draft within the shared budget; the pinned expansion stays saved.
5. Use draft Undo/Redo and Reset draft, then close. Switch atlases while a draft is open. **Expected:** Valid world edits follow the existing draft owner, Reset restores the saved definition, and closing/switching leaves no stale preview in the other atlas.
6. Open an object with an explicit imported visual override and change its recipe, then close without clearing that override. **Expected:** The structural draft is visible while editing; the original explicit visual returns on close.

**Limits / unavailable behavior:** At most 32 structural world sources at 256px; extra occurrences retain saved rendering and a temporary with no free slot uses the preview-budget placeholder. Inputs are coalesced to 12fps, dependents use 4ms batches, and evaluation is static at time zero. Invalid evaluations keep the last valid preview. Temporary work is edited in the composer until saved. This does not deliver frame/dial editing, lattice gestures, MS region picking or reading-size calibration.

**Verification:** browser — Not run; user acceptance pending. Automated — 2026-10-28: type/capability/property checks and self-contained preview build pass (2.85MB); no browser suite or performance trace..

**Details:** [subsystem guide](OMNIC_COMPOSER.md). **Implementation:** [src/omnic/worldPreview.ts](../src/omnic/worldPreview.ts), [src/omnic/presentation.ts](../src/omnic/presentation.ts), [src/omnic/Composer.tsx](../src/omnic/Composer.tsx), [src/textScene.ts](../src/textScene.ts), [src/SpatialWorkspace.tsx](../src/SpatialWorkspace.tsx), [src/App.tsx](../src/App.tsx).

**Related:** [Procedural generators and parameters](#omnic-compose), [Shared save, independent copy, drafts and recipe import/export](#omnic-saving), [Live dependencies, frozen pins, restore and archive pruning](#library-revisions).

<a id="omnic-saving"></a>
## Shared save, independent copy, drafts and recipe import/export

**ID:** `omnic.saving` · **Status:** Implemented; browser verification pending

**Where:** Composer toolbar; Inspector → Show Omnic structure.

Draft changes preview in the world before saving. Save shared creates unsaved work or updates an existing canonical object; Save copy deliberately creates a new identity. Close restores saved visuals while preserving draft recovery and shared history. Exports retain the existing dependency contracts.

**Minimal working test**

1. Open a shared object used twice, change its draft, then close without saving. **Expected:** Visible live uses preview the change within the world budget, then restore saved rendering. Reopening recovers the draft.
2. Save copy and edit the copy. **Expected:** The original stays unchanged.
3. Leave a draft, close/reopen, then reload. Export/import its recipe. **Expected:** The unfinished draft recovers; imported structure reproduces when dependencies are available.
4. Start a new unsaved draft, set Glyph name and Save shared. Then open another new draft. **Expected:** The first becomes one canonical object at its creation context; the next has a fresh independent draft identity.

**Limits / unavailable behavior:** Explicit asset/character overrides are temporarily covered by structural preview and restored on close; Show Omnic structure clears an override permanently. World animation, structural part picking and calibrated reading remain outside this slice.

**Verification:** browser — Not recorded. Automated — See subsystem tests and PR checks; not proof of usability.

**Details:** [subsystem guide](OMNIC_COMPOSER.md). **Implementation:** [src/omnic/document.ts](../src/omnic/document.ts), [src/omnic/draftHistory.ts](../src/omnic/draftHistory.ts).

**Command IDs:** `omnic.show`, `omnic.save`, `omnic.copy`, `omnic.export`, `omnic.import`, `omnic.reset`.

**Related:** [Live world drafts before saving](#omnic-worldPreview).

<a id="library-objects"></a>
## Shared library, multiple atlases and copy provenance

**ID:** `library.objects` · **Status:** Implemented; browser verification pending

**Where:** Create → Omnic library.

Named atlases share one canonical object pool. Edit object opens its definition; Place shared object adds a placement in the current context; independent copy records provenance without equating identities.

**Minimal working test**

1. Create a second atlas through Organization. Select an object and Place shared object. **Expected:** The second atlas contains a placement of the existing identity.
2. Edit that source and Save shared; switch back to the first atlas. **Expected:** Live uses in both atlases update.
3. Create independent copy and inspect Copied from. **Expected:** The copy is separately editable and records its source.

**Limits / unavailable behavior:** Browser acceptance has not been recorded for this guide.

**Verification:** browser — Not recorded. Automated — See subsystem tests and PR checks; not proof of usability.

**Details:** [subsystem guide](OMNIC_LIBRARY.md). **Implementation:** [src/omnic/Library.tsx](../src/omnic/Library.tsx), [src/omnic/workspace.ts](../src/omnic/workspace.ts).

**Command IDs:** `omnic.library.open`, `omnic.library.place`, `omnic.library.copy`, `omnic.library`.

<a id="library-organize"></a>
## Collections, tags, presets and names

**ID:** `library.organize` · **Status:** Implemented; browser verification pending

**Where:** Omnic library → selected object / Organization.

One object may have several tags and nested collection memberships without copying data. Reusable preset makes its definition available to the composer preset selector.

**Minimal working test**

1. Select an object, edit its name/tags and Save name / tags. Create a collection and assign it. **Expected:** The object is searchable by its new name/tag and belongs to that collection.
2. Mark Reusable preset, then open a different object in the composer and select that workspace preset. **Expected:** The saved structure loads into the destination draft; it does not silently change identity.

**Limits / unavailable behavior:** Browser acceptance has not been recorded for this guide.

**Verification:** browser — Not recorded. Automated — See subsystem tests and PR checks; not proof of usability.

**Details:** [subsystem guide](OMNIC_LIBRARY.md). **Implementation:** [src/omnic/Library.tsx](../src/omnic/Library.tsx), [src/omnic/Composer.tsx](../src/omnic/Composer.tsx).

<a id="library-filters"></a>
## Structural filters, indexing and saved families

**ID:** `library.filters` · **Status:** Implemented; browser verification pending

**Where:** Omnic library → Structural filters / Organization → Save filter as family.

Queries combine computed counts, boundary/fill/motion, generator/operator use, declared numeric ranges, tags and collection scope. Families are saved live queries, not semantic equivalence claims.

**Minimal working test**

1. Create a six-unit radial object and a five-unit chain. Filter count to six. **Expected:** Only matching indexed objects remain.
2. Save the filter as a named family, clear filters, then choose the family. **Expected:** The same combined query is restored.
3. Edit the six-unit source to five, save and reopen the family. **Expected:** Membership updates after indexing. Search mounts at most 32 result rows per page.

**Limits / unavailable behavior:** Indexing is scheduled and bounded to 256 dependencies/object. Uncomputed/error facts are not treated as zero or false.

**Verification:** browser — Not recorded. Automated — See subsystem tests and PR checks; not proof of usability.

**Details:** [subsystem guide](OMNIC_LIBRARY.md). **Implementation:** [src/omnic/libraryIndex.ts](../src/omnic/libraryIndex.ts), [src/omnic/Library.tsx](../src/omnic/Library.tsx).

<a id="library-revisions"></a>
## Live dependencies, frozen pins, restore and archive pruning

**ID:** `library.revisions` · **Status:** Implemented; browser verification pending

**Where:** Composer reference component → Dependency version; library → Dependencies / revisions.

Live references follow edits. Pinned references use saved revisions with frozen dependencies. Restore creates a new revision. Pruning keeps current snapshots and required pins.

**Minimal working test**

1. Reuse a source in two objects. Pin one reference and leave the other live. Edit and save the source. **Expected:** Only the live reference follows the source change.
2. Select an archived revision and Restore as new revision. **Expected:** The old structure becomes a new current revision; history is not rewritten.
3. Prune unpinned history, then Undo. **Expected:** Required pins survive; Undo restores the pruned archive.

**Limits / unavailable behavior:** 32 revisions/object, 2,048 archived recipes/workspace; missing revisions and cycles are rejected.

**Verification:** browser — Not recorded. Automated — See subsystem tests and PR checks; not proof of usability.

**Details:** [subsystem guide](OMNIC_LIBRARY.md). **Implementation:** [src/omnic/revisions.ts](../src/omnic/revisions.ts), [src/omnic/model.ts](../src/omnic/model.ts).

<a id="library-persistence"></a>
## Local workspace autosave, portability and recovery

**ID:** `library.persistence` · **Status:** Implemented; browser verification pending

**Where:** Library → Export workspace / Import workspace / Recover previous workspace; File → Import/Export JSON for individual atlases.

IndexedDB autosaves locally. Workspace import/cloud load retain a durable previous-workspace backup. Atlas imports remap independent canonical identities rather than merging equal legacy IDs.

**Minimal working test**

1. Create two atlases with organization metadata, reload, and export the workspace. **Expected:** Both atlases and organization survive reload and are included in the export.
2. Import that workspace, then Recover previous workspace or Undo. **Expected:** The imported state loads; the previous state is recoverable.
3. Import an atlas whose old IDs overlap existing IDs. **Expected:** It becomes an independent atlas with remapped canonical identities.

**Limits / unavailable behavior:** 8 MB workspace commit/export/cloud budget; 5 MB atlas import/export limit. Local images have separate backup requirements.

**Verification:** browser — Not recorded. Automated — See subsystem tests and PR checks; not proof of usability.

**Details:** [subsystem guide](OMNIC_LIBRARY.md). **Implementation:** [src/omnic/workspaceStorage.ts](../src/omnic/workspaceStorage.ts), [src/omnic/workspace.ts](../src/omnic/workspace.ts).

**Command IDs:** `omnic.workspace.recover`, `omnic.workspace.export`, `omnic.workspace.import`.

<a id="cloud-connection"></a>
## Existing account, private workspace and image storage

**ID:** `cloud.connection` · **Status:** Existing hosted foundation; current browser acceptance not recorded

**Where:** Workspace settings → Cloud connection.

Supabase login is separate from site Access. Existing accounts create private workspaces. Owner/editor/viewer roles govern files and snapshots. Signing in does not upload local work.

**Minimal working test**

1. Sign in with a pre-created account and create/select a disposable private workspace. **Expected:** Its membership/role appears; local atlas data has not been uploaded.
2. Upload a small PNG/WebP/JPEG, download it, then delete the disposable file. **Expected:** File lifecycle respects current membership and upload validation.

**Limits / unavailable behavior:** Requires configured backend and existing account. Test file deletion only on disposable files; it is permanent.

**Verification:** browser — Not recorded. Automated — See subsystem tests and PR checks; not proof of usability.

**Details:** [subsystem guide](BACKEND.md). **Implementation:** [src/backend/CloudPanel.tsx](../src/backend/CloudPanel.tsx), [src/backend/client.ts](../src/backend/client.ts).

**Command IDs:** `backend.signIn`, `backend.signOut`, `backend.refresh`, `backend.createWorkspace`, `backend.upload`, `backend.download`, `backend.finalize`, `backend.delete`.

<a id="cloud-snapshots"></a>
## Explicit workspace cloud save/load and conflicts

**ID:** `cloud.snapshots` · **Status:** Implemented and locally tested; hosted rollout pending

**Where:** Omnic library → Cloud workspace, after signing in.

Save uploads the workspace snapshot. Load replaces local workspace after backup. Server concurrency versions are separate from local revisions; a stale save cannot overwrite a newer snapshot.

**Minimal working test**

1. After backend rollout, save a disposable workspace, then load it in a second signed-in browser. **Expected:** Atlases, canonical objects, organization and revisions reproduce.
2. Save a change from browser A, then try saving from B without loading the new version. **Expected:** B receives a conflict and its local work stays intact.
3. Load the newer cloud snapshot, then Recover previous workspace. **Expected:** The cloud state loads explicitly and the replaced local state remains recoverable.

**Limits / unavailable behavior:** Hosted migration/function rollout is not recorded as completed. No background synchronization or automatic merge.

**Verification:** browser — Not recorded. Automated — See subsystem tests and PR checks; not proof of usability.

**Details:** [subsystem guide](OMNIC_LIBRARY.md). **Implementation:** [src/omnic/WorkspaceCloud.tsx](../src/omnic/WorkspaceCloud.tsx), [supabase/migrations/20261027000100_workspace_snapshots.sql](../supabase/migrations/20261027000100_workspace_snapshots.sql).

**Command IDs:** `omnic.workspace.saveCloud`, `omnic.workspace.loadCloud`.

<a id="scene-manual"></a>
## Node-linked scenes from imported images and copied prompts

**ID:** `scene.manual` · **Status:** Implemented; browser verification pending

**Where:** Scene panel; select an Omnium node.

A saved prompt resolves selected-node label/notes into one named variable. Copy it for external ChatGPT use, then import the returned image. Assignments and image bytes stay local and separate from atlas exports.

**Minimal working test**

1. Select a node, choose a prompt using {{subject}}, then Copy resolved prompt. **Expected:** The resolved text contains the chosen node data; no paid request runs.
2. Choose a disposable image with Choose image. Select another node, then return. **Expected:** The first node shows its assigned scene again; another node uses its own scene/default.
3. Download the original, Clear scene, then Undo. **Expected:** The file can be backed up; Undo restores the assignment. Permanent image deletion is separate.

**Limits / unavailable behavior:** Clipboard reading may need browser permission. Atlas/workspace exports do not include local scene bytes/assignments; download images separately.

**Verification:** browser — Not recorded. Automated — See subsystem tests and PR checks; not proof of usability.

**Details:** [subsystem guide](SCENE_GENERATION.md). **Implementation:** [src/scene/ScenePanel.tsx](../src/scene/ScenePanel.tsx).

**Command IDs:** `scene.copyPrompt`, `scene.chooseImage`, `scene.pasteImage`, `scene.applyLocal`, `scene.downloadLocal`, `scene.deleteLocal`, `scene.clear`.

<a id="scene-api"></a>
## Optional API scene generation

**ID:** `scene.api` · **Status:** Implemented; paid generation gated by server configuration

**Where:** Scene → API generation (optional).

Authenticated, explicitly enabled API generation uses paid provider credit. Saved attempts distinguish running/ready/failed/uncertain; refresh does not resubmit.

**Minimal working test**

1. Expand the optional API section without enabling generation. **Expected:** Availability reflects backend capabilities; no paid request runs.
2. If already authorized and configured, inspect an existing ready attempt and Apply saved image. **Expected:** The stored image applies without submitting another generation.

**Limits / unavailable behavior:** Do not generate merely to test documentation. Requires separate server enablement/provider configuration.

**Verification:** browser — Not recorded. Automated — See subsystem tests and PR checks; not proof of usability.

**Details:** [subsystem guide](SCENE_GENERATION.md). **Implementation:** [src/scene/ScenePanel.tsx](../src/scene/ScenePanel.tsx), [supabase/functions/backend/scene-provider.ts](../supabase/functions/backend/scene-provider.ts).

**Command IDs:** `scene.generate`, `scene.apply`, `scene.refresh`.

<a id="performance-clicks"></a>
## Click responsiveness and shared rendering work

**ID:** `performance.clicks` · **Status:** Earlier lag improvements confirmed; release handoff and live validation follow-up await user testing

**Where:** Ordinary controls, including Omnic library → Objects → Structural filters.

Render-time function, anchor, owner and icon target lookups share snapshot indexes. Opening/collapsing a frame preserves appearance target metadata when ownership and captions are unchanged. Appearance adjusters reuse target calculations; hidden dock areas skip measurement. Hot function controls now subscribe to their own item, binding, selection and permission slices instead of the full UI context. Stable appearance context actions keep current handlers without broadcasting closure changes. Legacy consumers retain their existing route during incremental migration. Fields, action registrations and embedded headers use scoped subscriptions. Dock workspace geometry/context preserve identity when unchanged; appearance label invalidation follows actual customized owners, not unrelated frame registration order. Floating windows, panels, frame chrome, docking residents and labels now use scoped subscriptions. Closed frame searches and dormant popup adapters do not subscribe to unrelated UI updates. Native caption/button discovery deduplicates inserted subtrees and updates changed hosts directly; unchanged native presentation skips DOM writes and permission work. Discovered function registrations publish once per microtask while commands/history remain synchronous. With no UI controls selected, ordinary layout changes now skip UI-selection discovery and visibility measurement. Subscription snapshot checks reuse pure selector results for the same committed snapshot and selector; changed state or captured props still reevaluate. Window movement now coalesces pointer positions per frame, reuses target lists and caches ownership/pinning/context/docking reads until the layout snapshot changes. Final release refreshes the pointed destination and uses the existing single-commit history path. Newly discovered frame captions now read their initial font sizes together before symbol/tooltip styling writes. This avoids repeated synchronous style recalculation during first-use presentation; later collapse/reopen keeps existing caption state. Drag pickup excludes a frame/window’s own subtree from destination measurements, snapshots visibility before lifting, and uses an exact resident lookup. Final destination refresh and shared docking/history remain intact. Repeated activation of the current front window reuses its existing layer rather than changing z-index and rerendering the wrapper on each grab; other windows still rise. Fixed surfaces already mounted directly on the page move using their existing transform without popover promotion or geometry rewrites. Drag destination bounds are cached on demand; child-slot measurement is limited to destinations actually considered. Cursor-open windows use viewport free placement on both rendering and drop, avoiding workspace packing on release. Drag capture no longer toggles a descendant CSS selector across the whole page. Release deduplicates pointed ancestor measurements, reuses gesture candidate lists. Final placement continues to use the exact release coordinate; no inertia is implemented. Moving an already-free frame validates its new coordinates and preserves unrelated layout records instead of rerunning structural detach/prune/full validation. The held payload now receives a direct transform update from each pointer event; docking discovery/feedback alone stays frame-batched. Movement does not wait for docking calculations or interpolate toward the cursor. Release now hands direct visual ownership back to committed layout synchronously, preventing a paint of the pre-drag position between them. The interface state owner recognizes immutable coordinate-only edits and validates the changed coordinates without rechecking unchanged topology; other edits/imports retain full validation.

**Minimal working test**

1. Open Omnic library → Objects, then repeatedly expand/collapse Structural filters while observing the scene pulse. **Expected:** The section toggles without rerunning unrelated target eligibility calculations. Report any visible scene freeze; a smooth pulse is not yet verified on user hardware.
2. Move a frame/control, rename an appearance target and change its color afterward. **Expected:** Ownership/captions and applicable controls update correctly; caching does not preserve stale edits.
3. Open a frame search, type a query and exit with Esc. Expand/collapse and rename a frame; then use its controls and minimize/restore it. **Expected:** Search accepts typing and exits through the active context; frame labels, controls and window state remain current. Compare scene pulse continuity with the previous preview.
4. Clear UI control selection, then toggle Structural filters several times while watching the scene pulse. Ctrl-click an editable UI control to select it, then Ctrl-click it again to deselect. **Expected:** Ordinary toggles do not run UI-selection discovery while selection is empty. Real selection markers still appear and clear; report remaining visible pulse interruptions.
5. Reload, expand/maximize a heavy frame and drag it immediately. Compare with waiting briefly before dragging; then minimize/reopen and repeat. **Expected:** Pickup excludes invalid destinations inside the held frame and completes visibility reads before lifting. Controls, docking and Undo still work. Report any remaining brief spike; cold-caption batching is not a universal smoothness guarantee.
6. Repeatedly grab and release Omnic library, both expanded and minimized. Move it in different directions with an edge-docked panel present; then try intentional header docking and Undo. **Expected:** Free release preserves the pointer-relative position rather than workspace packing the popup. Repeated pickup avoids full destination-child measurement and popover relayout. Report whether the remaining grab pause and offset are resolved on your workspace.
7. Drag continuously, then pause/resume while holding. Compare a quick moving release with a stationary release, and repeat several grabs. **Expected:** Final placement uses the release coordinate with no intentional inertia. Pickup/release avoids page-wide descendant CSS toggles and redundant structural work. Report any remaining pulse pause or release offset.
8. Grab a window and move quickly, pause, reverse direction and release. Also try docking it onto another header. **Expected:** The grabbed point follows pointer samples directly without catch-up interpolation; docking feedback and one-move Undo still work. Report any remaining visible trailing.
9. Move a floating window quickly and release while still moving; repeat with a calm release. Then dock it deliberately and use Undo/Redo. **Expected:** Release has one committed position without an intermediate return to the old position. Ownership, invalid-geometry rejection and one-move Undo remain intact. Report any remaining two-stage pause.

**Limits / unavailable behavior:** Legacy global owners and some consumers still subscribe broadly. Synthetic headless timings are noisy and not physical input-to-display latency; no universal frame-time guarantee.

**Verification:** browser — User clarified the brief spike occurs when dragging immediately after expanding/maximizing a heavy frame. Local expand→drag checks reduced source rectangle reads 63 → 22 and observed maximum RAF gap 783 → 183 ms, with the same 50 ms median in software graphics. Cold caption diagnostics: 80 captions 82 → 3 style recalculations; Master controller first-open style recalculations 124 → 10. User hardware verification pending. Repeated-grab layer stability is verified locally; this does not prove all pickup latency is resolved. User reported the previous layer-only change insufficient/worse. No new browser trace or acceptance run for this follow-up; testing is delegated to the user. Latest report distinguishes quick releases/discontinuous movement from continuous dragging; transition-cost follow-up awaits user testing. User reports lag gone but motion feels slippery; immediate pointer movement has been separated from frame-batched docking feedback. User testing pending. User reports much better movement but two remaining pauses before stopping; atomic release/live validation follow-up is not browser-tested.. Automated — Follow-up static/build checks recorded in delivery; no new browser suite..

**Details:** [subsystem guide](PERFORMANCE_RESULTS.md). **Implementation:** [src/ui/functionIndex.ts](../src/ui/functionIndex.ts), [src/appearance/Controls.tsx](../src/appearance/Controls.tsx), [src/appearance/Context.tsx](../src/appearance/Context.tsx), [src/ui/DockArea.tsx](../src/ui/DockArea.tsx), [src/ui/context.tsx](../src/ui/context.tsx), [src/ui/selectiveStore.ts](../src/ui/selectiveStore.ts), [src/ui/DockWorkspace.tsx](../src/ui/DockWorkspace.tsx), [src/ui/EmbeddedGroup.tsx](../src/ui/EmbeddedGroup.tsx), [src/ui/renderSubscriptions.ts](../src/ui/renderSubscriptions.ts), [src/ui/mutationRoots.ts](../src/ui/mutationRoots.ts), [src/ui/registrationBatch.ts](../src/ui/registrationBatch.ts), [src/ui/NativeActions.tsx](../src/ui/NativeActions.tsx), [src/ui/NamePresentation.tsx](../src/ui/NamePresentation.tsx), [scripts/profile-ui-clicks.mjs](../scripts/profile-ui-clicks.mjs), [src/ui/useButtonSelection.tsx](../src/ui/useButtonSelection.tsx), [src/ui/dragQueries.ts](../src/ui/dragQueries.ts), [scripts/profile-ui-drag.mjs](../scripts/profile-ui-drag.mjs), [scripts/profile-ui-open.mjs](../scripts/profile-ui-open.mjs), [src/ui/UIWorkspace.tsx](../src/ui/UIWorkspace.tsx).

**Related:** [Structural filters, indexing and saved families](#library-filters), [Visual hierarchy, shared properties and Apply/Discard](#appearance-edit).

## Exact registered command inventory

Labels, descriptions and defaults are read from the same catalog as the application. A blank binding means unassigned here; it does not mean unavailable. Scope-specific overrides and saved mouse bindings remain authoritative in the running UI.

| Command / stable ID | Catalog default | Behavior | Where / walkthrough |
| --- | --- | --- | --- |
| Global UI search · `searchUI` | Ctrl+Alt+S | Search finds registered functions/settings. S uses retained scope, progressing from active frame through parents to All UI. Selecting a destination retains its reveal after pointer exit. | [Search UI and reveal settings](#interface-search) |
| UI edit mode · `ui:devMode` | Unassigned | Drag actual frame handles or supported control edges. Docking offers destinations when a dragged header reaches another header. UI selection, alignment, compaction and reset are separate from knowledge structure. Window/frame drag previews reuse gesture-local target discovery and read-only docking policy results. Visual movement uses the latest pointer position once per animation frame, with geometry reads before transform writes. Release refreshes destination geometry and commits through the existing shared history; cancellation restores the live payload. Active-context shortcuts defer to a held UI gesture, so Esc cancels the drag before a parent minimize action. Pickup snapshots exclude descendants of the held frame/window and read visibility before lifting, reducing the expand-then-drag setup burst. | [Move, dock, select and organize UI](#interface-arrange) |
| UI library · `ui:arrange` | Ctrl+Alt+U | Appearance and UI templates preserve supported settings. Custom fonts are imported through the font library. Recovery remains usable when a theme becomes unreadable. | [Themes, templates, fonts and emergency recovery](#appearance-recovery) |
| Create UI frame · `ui:createFrame` | Unassigned | Appearance and UI templates preserve supported settings. Custom fonts are imported through the font library. Recovery remains usable when a theme becomes unreadable. | [Themes, templates, fonts and emergency recovery](#appearance-recovery) |
| Reset to default · `ui:reset` | Unassigned | Appearance and UI templates preserve supported settings. Custom fonts are imported through the font library. Recovery remains usable when a theme becomes unreadable. | [Themes, templates, fonts and emergency recovery](#appearance-recovery) |
| Undo UI · `ui:undo` | Unassigned | Recent uses chronological actions across owners; Context limits actions to the active context; Selective uses categories. Configure steps and a retained maximum of 10. MS selection has a separate transient timeline. | [Chronological undo/redo and filtering](#history-global) |
| Redo UI · `ui:redo` | Unassigned | Recent uses chronological actions across owners; Context limits actions to the active context; Selective uses categories. Configure steps and a retained maximum of 10. MS selection has a separate transient timeline. | [Chronological undo/redo and filtering](#history-global) |
| Select UI buttons · `ui:select` | Unassigned | Drag actual frame handles or supported control edges. Docking offers destinations when a dragged header reaches another header. UI selection, alignment, compaction and reset are separate from knowledge structure. Window/frame drag previews reuse gesture-local target discovery and read-only docking policy results. Visual movement uses the latest pointer position once per animation frame, with geometry reads before transform writes. Release refreshes destination geometry and commits through the existing shared history; cancellation restores the live payload. Active-context shortcuts defer to a held UI gesture, so Esc cancels the drag before a parent minimize action. Pickup snapshots exclude descendants of the held frame/window and read visibility before lifting, reducing the expand-then-drag setup burst. | [Move, dock, select and organize UI](#interface-arrange) |
| Compact selected UI · `ui:compact` | Unassigned | Drag actual frame handles or supported control edges. Docking offers destinations when a dragged header reaches another header. UI selection, alignment, compaction and reset are separate from knowledge structure. Window/frame drag previews reuse gesture-local target discovery and read-only docking policy results. Visual movement uses the latest pointer position once per animation frame, with geometry reads before transform writes. Release refreshes destination geometry and commits through the existing shared history; cancellation restores the live payload. Active-context shortcuts defer to a held UI gesture, so Esc cancels the drag before a parent minimize action. Pickup snapshots exclude descendants of the held frame/window and read visibility before lifting, reducing the expand-then-drag setup burst. | [Move, dock, select and organize UI](#interface-arrange) |
| Align UI · `ui:align` | Unassigned | Drag actual frame handles or supported control edges. Docking offers destinations when a dragged header reaches another header. UI selection, alignment, compaction and reset are separate from knowledge structure. Window/frame drag previews reuse gesture-local target discovery and read-only docking policy results. Visual movement uses the latest pointer position once per animation frame, with geometry reads before transform writes. Release refreshes destination geometry and commits through the existing shared history; cancellation restores the live payload. Active-context shortcuts defer to a held UI gesture, so Esc cancels the drag before a parent minimize action. Pickup snapshots exclude descendants of the held frame/window and read visibility before lifting, reducing the expand-then-drag setup burst. | [Move, dock, select and organize UI](#interface-arrange) |
| Select visible nodes · `selectAll` | Ctrl+A | N resolves creation from the current focus/selection. Placements can share a canonical identity. Typed relationships, structural composition and visual nesting are distinct. | [Create nodes, children, reuse identities and connect](#graph-create) |
| Delete selected concepts and subnodes · `deleteSelected` | Delete | N resolves creation from the current focus/selection. Placements can share a canonical identity. Typed relationships, structural composition and visual nesting are distinct. | [Create nodes, children, reuse identities and connect](#graph-create) |
| Toggle shortcut display · `shortcuts` | Ctrl+/ | Only relevant MC settings appear. Repeated shortcut presses cycle choices; hovering/focusing an option selects the temporary choice. Release Shift applies the selected choice once. Right-click applies and locks it; left-click resets to priority 1. Hover/focus does not change the saved default. | [Universal Shift configuration](#interface-configure) |
| Frame selected front-on · `focus` | F | Front-on framing changes the camera, not the object. Fit local/all, return focus, roll, origin and zoom reset are separate explicit actions. | [Front-on centering, fit, origin, roll and focus navigation](#camera-framing) |
| Focus context only · `isolateFocus` | Unassigned | Front-on framing changes the camera, not the object. Fit local/all, return focus, roll, origin and zoom reset are separate explicit actions. | [Front-on centering, fit, origin, roll and focus navigation](#camera-framing) |
| Fit local system · `fitLocal` | Ctrl+Alt+F | Front-on framing changes the camera, not the object. Fit local/all, return focus, roll, origin and zoom reset are separate explicit actions. | [Front-on centering, fit, origin, roll and focus navigation](#camera-framing) |
| Fit entire atlas · `fitAll` | Unassigned | Front-on framing changes the camera, not the object. Fit local/all, return focus, roll, origin and zoom reset are separate explicit actions. | [Front-on centering, fit, origin, roll and focus navigation](#camera-framing) |
| Back to previous focus · `back` | Unassigned | Front-on framing changes the camera, not the object. Fit local/all, return focus, roll, origin and zoom reset are separate explicit actions. | [Front-on centering, fit, origin, roll and focus navigation](#camera-framing) |
| Reset zoom to 100% · `zoom100` | Unassigned | Front-on framing changes the camera, not the object. Fit local/all, return focus, roll, origin and zoom reset are separate explicit actions. | [Front-on centering, fit, origin, roll and focus navigation](#camera-framing) |
| Go to world origin · `cameraOrigin` | Unassigned | Front-on framing changes the camera, not the object. Fit local/all, return focus, roll, origin and zoom reset are separate explicit actions. | [Front-on centering, fit, origin, roll and focus navigation](#camera-framing) |
| Roll view left 90° · `rollLeft` | Unassigned | Front-on framing changes the camera, not the object. Fit local/all, return focus, roll, origin and zoom reset are separate explicit actions. | [Front-on centering, fit, origin, roll and focus navigation](#camera-framing) |
| Roll view right 90° · `rollRight` | Unassigned | Front-on framing changes the camera, not the object. Fit local/all, return focus, roll, origin and zoom reset are separate explicit actions. | [Front-on centering, fit, origin, roll and focus navigation](#camera-framing) |
| New node · `newNode` | N | N resolves creation from the current focus/selection. Placements can share a canonical identity. Typed relationships, structural composition and visual nesting are distinct. | [Create nodes, children, reuse identities and connect](#graph-create) |
| New child · `newChild` | Ctrl+Alt+N | N resolves creation from the current focus/selection. Placements can share a canonical identity. Typed relationships, structural composition and visual nesting are distinct. | [Create nodes, children, reuse identities and connect](#graph-create) |
| Connect from selected · `connect` | L | N resolves creation from the current focus/selection. Placements can share a canonical identity. Typed relationships, structural composition and visual nesting are distinct. | [Create nodes, children, reuse identities and connect](#graph-create) |
| Expand or collapse selected · `expand` | E | Expansion shows charted structure. Arrow-key movement previews per frame and commits once on release. Axis constraints and graph compaction affect placement, not canonical identity. | [Expansion, movement, axis constraints and compaction](#graph-layout) |
| Expand or collapse entire subtree · `expandAll` | Ctrl+Alt+E | Expansion shows charted structure. Arrow-key movement previews per frame and commits once on release. Axis constraints and graph compaction affect placement, not canonical identity. | [Expansion, movement, axis constraints and compaction](#graph-layout) |
| Toggle snapping · `toggleSnap` | G | Expansion shows charted structure. Arrow-key movement previews per frame and commits once on release. Axis constraints and graph compaction affect placement, not canonical identity. | [Expansion, movement, axis constraints and compaction](#graph-layout) |
| Move selected node left · `nudgeLeft` | ArrowLeft | Expansion shows charted structure. Arrow-key movement previews per frame and commits once on release. Axis constraints and graph compaction affect placement, not canonical identity. | [Expansion, movement, axis constraints and compaction](#graph-layout) |
| Move selected node right · `nudgeRight` | ArrowRight | Expansion shows charted structure. Arrow-key movement previews per frame and commits once on release. Axis constraints and graph compaction affect placement, not canonical identity. | [Expansion, movement, axis constraints and compaction](#graph-layout) |
| Move selected node up · `nudgeUp` | ArrowUp | Expansion shows charted structure. Arrow-key movement previews per frame and commits once on release. Axis constraints and graph compaction affect placement, not canonical identity. | [Expansion, movement, axis constraints and compaction](#graph-layout) |
| Move selected node down · `nudgeDown` | ArrowDown | Expansion shows charted structure. Arrow-key movement previews per frame and commits once on release. Axis constraints and graph compaction affect placement, not canonical identity. | [Expansion, movement, axis constraints and compaction](#graph-layout) |
| Constrain drag to X · `axisX` | X | Expansion shows charted structure. Arrow-key movement previews per frame and commits once on release. Axis constraints and graph compaction affect placement, not canonical identity. | [Expansion, movement, axis constraints and compaction](#graph-layout) |
| Constrain drag to Y · `axisY` | Y | Expansion shows charted structure. Arrow-key movement previews per frame and commits once on release. Axis constraints and graph compaction affect placement, not canonical identity. | [Expansion, movement, axis constraints and compaction](#graph-layout) |
| Constrain drag to Z · `axisZ` | Z | Expansion shows charted structure. Arrow-key movement previews per frame and commits once on release. Axis constraints and graph compaction affect placement, not canonical identity. | [Expansion, movement, axis constraints and compaction](#graph-layout) |
| Compact selected subsystem · `compactSelected` | Unassigned | Expansion shows charted structure. Arrow-key movement previews per frame and commits once on release. Axis constraints and graph compaction affect placement, not canonical identity. | [Expansion, movement, axis constraints and compaction](#graph-layout) |
| Compact current frame · `compactFrame` | Unassigned | Expansion shows charted structure. Arrow-key movement previews per frame and commits once on release. Axis constraints and graph compaction affect placement, not canonical identity. | [Expansion, movement, axis constraints and compaction](#graph-layout) |
| Compact selected / all · `compactAll` | Unassigned | Expansion shows charted structure. Arrow-key movement previews per frame and commits once on release. Axis constraints and graph compaction affect placement, not canonical identity. | [Expansion, movement, axis constraints and compaction](#graph-layout) |
| Undo · `undo` | Ctrl+Z | Recent uses chronological actions across owners; Context limits actions to the active context; Selective uses categories. Configure steps and a retained maximum of 10. MS selection has a separate transient timeline. | [Chronological undo/redo and filtering](#history-global) |
| Redo · `redo` | Ctrl+Y | Recent uses chronological actions across owners; Context limits actions to the active context; Selective uses categories. Configure steps and a retained maximum of 10. MS selection has a separate transient timeline. | [Chronological undo/redo and filtering](#history-global) |
| Cancel or close menu · `cancel` | Esc | Actions target the clicked/focused frame. Esc steps out one field/popup level before minimizing; active MS has priority. W resizes/restores, M minimizes/restores, X closes, D toggles descendants, subject to saved bindings. Resized windows retain projected bounds and themed borders across focus and minimize/reopen. W restores retained original geometry. Projection styling is independent of React/Rnd wrapper updates. | [Active context, close, minimize, resize and descendants](#interface-context) |
| Workspace settings · `settings` | Unassigned | Actions target the clicked/focused frame. Esc steps out one field/popup level before minimizing; active MS has priority. W resizes/restores, M minimizes/restores, X closes, D toggles descendants, subject to saved bindings. Resized windows retain projected bounds and themed borders across focus and minimize/reopen. W restores retained original geometry. Projection styling is independent of React/Rnd wrapper updates. | [Active context, close, minimize, resize and descendants](#interface-context) |
| Toggle neon appearance · `theme` | Unassigned | Appearance and UI templates preserve supported settings. Custom fonts are imported through the font library. Recovery remains usable when a theme becomes unreadable. | [Themes, templates, fonts and emergency recovery](#appearance-recovery) |
| Master controller · `appearance` | Unassigned | Visual roles group backgrounds, contours, text and other repeated parts. Selection becomes the exclusive edit scope. Unapplied edits are drafts; deselecting a target rolls its draft back to applied values. | [Visual hierarchy, shared properties and Apply/Discard](#appearance-edit) |
| Recover previous workspace · `omnic.workspace.recover` | Unassigned | Restore the durable local backup kept before importing or loading a replacement workspace. | [Local workspace autosave, portability and recovery](#library-persistence) |
| Save workspace to cloud · `omnic.workspace.saveCloud` | Unassigned | Explicit version-checked save of the shared library and all workspace atlases. | [Explicit workspace cloud save/load and conflicts](#cloud-snapshots) |
| Load cloud workspace · `omnic.workspace.loadCloud` | Unassigned | Replace local workspace with the cloud snapshot, preserving a local recovery copy and shared Undo. | [Explicit workspace cloud save/load and conflicts](#cloud-snapshots) |
| Edit object · `omnic.library.open` | Unassigned | Edit object through the shared workspace library. | [Shared library, multiple atlases and copy provenance](#library-objects) |
| Place shared object · `omnic.library.place` | Unassigned | Place shared object through the shared workspace library. | [Shared library, multiple atlases and copy provenance](#library-objects) |
| Create independent copy · `omnic.library.copy` | Unassigned | Create independent copy through the shared workspace library. | [Shared library, multiple atlases and copy provenance](#library-objects) |
| Export workspace · `omnic.workspace.export` | Unassigned | Export workspace through the shared workspace library. | [Local workspace autosave, portability and recovery](#library-persistence) |
| Import workspace · `omnic.workspace.import` | Unassigned | Import workspace through the shared workspace library. | [Local workspace autosave, portability and recovery](#library-persistence) |
| Omnic library · `omnic.library` | Unassigned | Browse shared objects, structural families, revisions and workspace atlases. | [Shared library, multiple atlases and copy provenance](#library-objects) |
| New Omnic object · `omnic.create` | Unassigned | New Omnic object through the shared composer and canonical object state. | [Procedural generators and parameters](#omnic-compose) |
| Open Omnic composer · `omnic.open` | Unassigned | Open Omnic composer through the shared composer and canonical object state. | [Procedural generators and parameters](#omnic-compose) |
| Show Omnic structure · `omnic.show` | Unassigned | Show Omnic structure through the shared composer and canonical object state. | [Shared save, independent copy, drafts and recipe import/export](#omnic-saving) |
| Rotate one step · `omnic.rotateStep` | Unassigned | Advance the focused Omnic rotation using its saved snap settings. Shift opens contextual rotation configuration. | [Ordered operations, role picking, target repair and count extraction](#omnic-operations) |
| Save shared · `omnic.save` | Unassigned | Save shared Omnic definition through the shared composer and canonical object state. | [Shared save, independent copy, drafts and recipe import/export](#omnic-saving) |
| Save copy · `omnic.copy` | Unassigned | Save Omnic copy through the shared composer and canonical object state. | [Shared save, independent copy, drafts and recipe import/export](#omnic-saving) |
| Play / pause · `omnic.play` | Unassigned | Play / pause Omnic motion through the shared composer and canonical object state. | [Semantic oscillation and playback](#omnic-motion) |
| Export recipe · `omnic.export` | Unassigned | Export Omnic recipe through the shared composer and canonical object state. | [Shared save, independent copy, drafts and recipe import/export](#omnic-saving) |
| Import recipe · `omnic.import` | Unassigned | Import Omnic recipe through the shared composer and canonical object state. | [Shared save, independent copy, drafts and recipe import/export](#omnic-saving) |
| Reset draft · `omnic.reset` | Unassigned | Reset Omnic preset through the shared composer and canonical object state. | [Shared save, independent copy, drafts and recipe import/export](#omnic-saving) |
| Frame selected front-on · `world.faceSelection` | Unassigned | Center and fit selected objects, looking straight at their front plane. Changes camera only; use Back or Undo to restore the previous view. | [Front-on centering, fit, origin, roll and focus navigation](#camera-framing) |
| World navigation · `world.navigate` | MB2 | Drag using the active movement mode. Hold Ctrl to lock the initial drag axis; Shift opens contextual configuration. | [Camera versus object rotation, trackball and axis lock](#camera-navigation) |
| Copy resolved prompt · `scene.copyPrompt` | Unassigned | Copy the prompt with active-node values for use in ChatGPT. Remembers this node for the returned image. | [Node-linked scenes from imported images and copied prompts](#scene-manual) |
| Choose image · `scene.chooseImage` | Unassigned | Import a PNG, JPEG or WebP, save it in this browser and apply it to the chosen node. | [Node-linked scenes from imported images and copied prompts](#scene-manual) |
| Paste image · `scene.pasteImage` | Unassigned | Read an image from the clipboard, save it in this browser and apply it to the chosen node. Choose image works if clipboard access is unavailable. | [Node-linked scenes from imported images and copied prompts](#scene-manual) |
| Apply imported image · `scene.applyLocal` | Unassigned | Use the selected local image as this node's saved scene, without generating. | [Node-linked scenes from imported images and copied prompts](#scene-manual) |
| Download image · `scene.downloadLocal` | Unassigned | Download the selected original image for backup or transfer to another website address. | [Node-linked scenes from imported images and copied prompts](#scene-manual) |
| Delete imported image · `scene.deleteLocal` | Unassigned | Permanently remove this image from browser storage and clear its node assignments. Image deletion cannot be undone. | [Node-linked scenes from imported images and copied prompts](#scene-manual) |
| Generate & apply · `scene.generate` | Unassigned | Generate one image from the saved prompt and active node input, store it privately and apply it as the background. Uses paid API credit when configured. | [Optional API scene generation](#scene-api) |
| Apply saved image · `scene.apply` | Unassigned | Apply a completed image from this workspace without generating or paying again. | [Optional API scene generation](#scene-api) |
| Clear scene · `scene.clear` | Unassigned | Return to the theme background. Keeps the private image; Undo restores its reference. | [Node-linked scenes from imported images and copied prompts](#scene-manual) |
| Refresh scene status · `scene.refresh` | Unassigned | Reload saved generation attempts without submitting a paid request. | [Optional API scene generation](#scene-api) |
| Sign in to cloud · `backend.signIn` | Unassigned | Sign in with an existing account. Local atlas data is not uploaded. | [Existing account, private workspace and image storage](#cloud-connection) |
| Sign out of cloud · `backend.signOut` | Unassigned | Sign out in this browser and clear the cloud panel. Keeps the local atlas. | [Existing account, private workspace and image storage](#cloud-connection) |
| Refresh cloud files · `backend.refresh` | Unassigned | Reload authorized workspaces and files. | [Existing account, private workspace and image storage](#cloud-connection) |
| Create private workspace · `backend.createWorkspace` | Unassigned | Create a private cloud workspace. Does not upload the current atlas. | [Existing account, private workspace and image storage](#cloud-connection) |
| Upload private image · `backend.upload` | Unassigned | Store a PNG, JPEG or WebP image in the selected workspace. | [Existing account, private workspace and image storage](#cloud-connection) |
| Download selected cloud file · `backend.download` | Unassigned | Download a ready file using your current permissions. | [Existing account, private workspace and image storage](#cloud-connection) |
| Finish pending upload · `backend.finalize` | Unassigned | Validate a previously uploaded pending image. Missing uploads can be deleted. | [Existing account, private workspace and image storage](#cloud-connection) |
| Delete selected cloud file · `backend.delete` | Unassigned | Delete the selected cloud file. Failed deletions can be retried. | [Existing account, private workspace and image storage](#cloud-connection) |
| Configure undo / redo · `history.configure` | Unassigned | Hold Shift and press your Undo/Redo mouse binding. Repeat or scroll to choose scope; release Shift to execute. Right-click an option applies and locks; left-click resets to 1. Shows only contextual history controls in Master Controller. | [Chronological undo/redo and filtering](#history-global) |
| Resize / restore active frame · `context.resize` | W | Resize the active frame to the configured surrounding-edge level, or restore it. Shift opens its adaptive configuration; hover selects and previews a level, then releasing Shift applies it. | [Active context, close, minimize, resize and descendants](#interface-context) |
| Step back / minimize active context · `context.back` | Esc | Leave one value field or popup level; minimize the active frame at frame level. Pending appearance choices remain protected. | [Active context, close, minimize, resize and descendants](#interface-context) |
| Search · `context.search` | S | Search with the retained scope. Shift configures active frame, parent frames or all UI; repeat to cycle and release Shift to search. | [Search UI and reveal settings](#interface-search) |
| Float active frame · `context.float` | Unassigned | Detach the active frame or native panel into a floating window, preserving its contents and shared UI history. | [Active context, close, minimize, resize and descendants](#interface-context) |
| Copy properties · `properties.copy` | Unassigned | Choose which resolved properties to copy from the current editing scope. All available properties start selected; mixed values are omitted. | [Choose, copy and paste applicable properties](#appearance-clipboard) |
| Paste applicable properties · `properties.paste` | Unassigned | Paste copied values into the current editing scope through shared setters, skipping unsupported, locked or bypassed properties. | [Choose, copy and paste applicable properties](#appearance-clipboard) |
| Close active context · `context.close` | X | Close the active frame or popup through its shared close action. Does not close a browser tab or intercept typed text. | [Active context, close, minimize, resize and descendants](#interface-context) |
| Minimize / maximize active frame · `context.minimize` | M | Toggle the active frame between minimized and expanded, respecting pending appearance changes. | [Active context, close, minimize, resize and descendants](#interface-context) |
| Expand / collapse active descendants · `context.descendants` | D | Use the active frame's shared descendant expansion action. | [Active context, close, minimize, resize and descendants](#interface-context) |
| ⦲ Toggle visual selector controller · `selector.open` | Q | Open selector geometry controls at the pointer; press again to resume selection. Shift opens the selected-property Master Controller instead. | [Master Selector: patterns, scope, removal and cursor parking](#selector-core) |
| Lock / unlock MS cursor · `selector.lock` | Ctrl+MB3 | Park MS at its current position and use the normal cursor. Press again to resume MS control; preserves selection and settings. | [Master Selector: patterns, scope, removal and cursor parking](#selector-core) |
| Toggle Self inventory · `selector.selfInventory` | Unassigned | Select logical meta targets such as Mouse or Selector feedback; their existing coupled properties appear in Master controller. | [Selection geometry, feedback and logical Self targets](#selector-geometry) |
| Toggle Mouse selection · `selector.selectMouse` | Unassigned | Select or deselect the logical mouse target; Master controller shows its coupled properties, including Mouse trail, while selected. | [Master Selector: patterns, scope, removal and cursor parking](#selector-core) |
| Cycle selection geometry / pattern · `selector.pattern` | E | While configuring or aiming the visual selector. Takes priority over node expansion. | [Master Selector: patterns, scope, removal and cursor parking](#selector-core) |
| Toggle Selection / Preview · `selector.feedbackView` | Unassigned | Hide or restore selection feedback without changing selected targets or their properties. | [Selection geometry, feedback and logical Self targets](#selector-geometry) |
| Deselect pointed pattern / all · `selector.deselect` | MB2 | While aiming: remove the selected pattern under the pointer using the current geometry/pattern rules. If the pointed target is not selected, clear the entire selection. Never adds targets. | [Master Selector: patterns, scope, removal and cursor parking](#selector-core) |
| Edit selected appearance · `selector.edit` | Unassigned | Shift + the selector shortcut (Shift+Q by default) opens selected-property editing; logical objects reveal Master Controller. | [Master Selector: patterns, scope, removal and cursor parking](#selector-core) |
| Disable selector and clear selection · `selector.cancel` | Esc | While the selector or its accepted selection is active. Takes priority over active-window Escape handling. | [Master Selector: patterns, scope, removal and cursor parking](#selector-core) |
| Undo visual selection · `selector.undo` | Ctrl+Z | While configuring or aiming; uses selection history, not graph/UI history. | [Master Selector: patterns, scope, removal and cursor parking](#selector-core) |
| Redo visual selection · `selector.redo` | Ctrl+Y | While configuring or aiming; uses selection history. | [Master Selector: patterns, scope, removal and cursor parking](#selector-core) |
| Redo visual selection (alternate) · `selector.redoAlternate` | Unassigned | An independently assignable alternate binding for selection redo. | [Master Selector: patterns, scope, removal and cursor parking](#selector-core) |
| Clear visual selection · `selector.clear` | Unassigned | Clear accepted parts and boundary without disabling the selector. | [Master Selector: patterns, scope, removal and cursor parking](#selector-core) |
| Aim visual selector · `selector.aim` | Unassigned | Leave configuration / editing and resume picking. | [Master Selector: patterns, scope, removal and cursor parking](#selector-core) |
| Toggle BG / empty space detection · `selector.backgrounds` | Unassigned | Include backgrounds / empty space in new selection picks. Off by default; preserves existing selections. | [Selection geometry, feedback and logical Self targets](#selector-geometry) |
| Toggle 🞅 Frame / intersections · `selector.boundary` | Unassigned | Choose the path itself independently of inside/outside and geometry mode. | [Master Selector: patterns, scope, removal and cursor parking](#selector-core) |
| Toggle ◉ In-frame inclusion · `selector.inside` | Unassigned | Independent of Outside; both or neither may be active. | [Master Selector: patterns, scope, removal and cursor parking](#selector-core) |
| Toggle ⏺ Outside frame inclusion · `selector.outside` | Unassigned | Independent of Inside; both or neither may be active. | [Master Selector: patterns, scope, removal and cursor parking](#selector-core) |
| Toggle pointed pattern / define geometry · `selector.include` | MB1 | Click toggles included/unselected, with optional Ctrl. Geometry starts with the circle baseline; neutral frames permit selective exceptions. | [Master Selector: patterns, scope, removal and cursor parking](#selector-core) |
| Finish polygon selection geometry · `selector.finishGeometry` | Enter | Commit a polygon with three or more vertices; closing on its first vertex also finishes. | [Master Selector: patterns, scope, removal and cursor parking](#selector-core) |
| Release working geometry · `selector.releaseGeometry` | Unassigned | Retain accepted selection rules and return to matching patterns across the app. | [Master Selector: patterns, scope, removal and cursor parking](#selector-core) |
| Toggle closed freehand geometry · `selector.closePath` | Unassigned | Closed paths support inside/outside as well as intersections; open paths use intersections. | [Master Selector: patterns, scope, removal and cursor parking](#selector-core) |
| Toggle finite selection line bounds · `selector.bounds` | Unassigned | While using an axis or direction; position segments are always finite. | [Master Selector: patterns, scope, removal and cursor parking](#selector-core) |
| Toggle stopping selection at color change · `selector.colorStop` | Unassigned | While using an axis, direction or position. Sample a painted part to start. | [Master Selector: patterns, scope, removal and cursor parking](#selector-core) |

## Registered native gestures

| Gesture | Binding | Behavior | Walkthrough |
| --- | --- | --- | --- |
| Open protected appearance recovery · `appearance.recovery` | Hold Esc for 2 seconds | Always available, including while editing text or using the selector; this recovery gesture is fixed. | [Themes, templates, fonts and emergency recovery](#appearance-recovery) |
| Hold initial rotation axis · `world.axisLock` | Ctrl + configured navigation drag | First clear drag chooses horizontal or vertical motion and freezes the rotation axis until Ctrl is released. Orthogonal pointer jitter is ignored; no pivot or target change. | [Camera versus object rotation, trackball and axis lock](#camera-navigation) |
| Configure that function · `function.configure` | Hold Shift + any configured shortcut; release Shift | Universal configuration modifier. Opens only that function’s adaptive controls. Repeat the shortcut to cycle or hover/focus an option to select it; release Shift to execute once. Right-click an option applies and locks its default; left-click resets to priority 1. Applies to keyboard and mouse shortcuts, present and future. | [Universal Shift configuration](#interface-configure) |
| Define geometry or toggle matching patterns · `selector.pick` | Left click / drag | One rebindable selection command. Unselected patterns become included; fully included patterns become unselected. Drag defines geometry; polygon vertices finish with Enter or its first vertex. | [Master Selector: patterns, scope, removal and cursor parking](#selector-core) |
| Rotate geometry finely / 10× faster · `selector.rotate` | Shift+Wheel / Ctrl+Shift+Wheel | Rotate the active axis/shape before placement or placed geometry while refining. Lines keep their defined origin fixed. Ctrl accelerates rotation 10×; ordinary wheel remains scrolling/zooming. | [Selection geometry, feedback and logical Self targets](#selector-geometry) |
| Change pointed owner depth · `selector.depth` | Wheel | Before placing pointed geometry: choose its containing owner. | [Selection geometry, feedback and logical Self targets](#selector-geometry) |
| Edit accepted visual selection · `selector.context` | Context-menu key / Shift+F10 | Platform context-menu gesture, independent of the assigned edit shortcut. | [Master Selector: patterns, scope, removal and cursor parking](#selector-core) |
| Open focused control's context action · `ui.context` | Context-menu key / Shift+F10 | Native context-menu keyboard gesture; appearance circles bypass/reconnect their saved styling. | [Move, dock, select and organize UI](#interface-arrange) |
| Rename focused UI label · `ui.rename` | F2 | When a renameable UI label has keyboard focus. | [Move, dock, select and organize UI](#interface-arrange) |

## Maintenance and known inventory boundaries

Every registered command and native gesture is covered by a walkthrough; the normal model/build entry points check coverage and generated-file freshness. Native controls, algorithms and workflows without a command require explicit catalog entries during implementation: their meaning cannot be inferred safely from code. The initial backfill groups some older graph workflows; subsystem guides retain their finer details. This is not a claim that every historical behavior has been independently browser-tested.

Before adding work, search this guide, the command IDs and subsystem references. Extend the existing owner when appropriate. Retire/redirect obsolete entries explicitly instead of leaving two competing instructions. Record user verification, date, source commit and reproducible failure when available.

Future workers: read [authoring contract](capabilities/README.md) and update the catalog in the same change.
