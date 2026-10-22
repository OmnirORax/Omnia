# Shared appearance controller

Open **Master controller → Visuals**. Choose a property above the tree; branches that support it light up. All color inputs are round swatches.

**Animation is an adjuster, like Color.** There is no VFX target branch. Choose **Animation**, target Text, Icons, window surfaces, nodes, binders or the workspace background, then choose an effect. **Lightning text / icons** fills glyphs with moving electric ink; **Lightning outlines** traces their contours. Glyph-only effects exclude incompatible surface targets. Animation speed, density, intensity and color use the same hierarchy, selections and locks.

Animation color/brightness/opacity/glow can be adjusted separately on the same branches. The general Color/Brightness/Opacity/Glow adjusters also update their unlocked animation channels. Selecting an effect never rewrites a branch's ordinary color, font or opacity.

- **Left-click the circle** to include or exclude a branch: filled means included, hollow means excluded. This selects what the next adjustment affects without erasing formatting.
- **Right-click that same circle** to bypass or reconnect stored appearance: bright means connected, dark means bypassed. Filling stays independent of brightness. Bypass preserves saved values and targeting; parent bypasses still apply to descendants. Shift+F10 or the context-menu key offers the same bypass action with the keyboard. UI rigidity keeps its ordinary fixed/movable circle without an appearance bypass.
- **🔒** protects a branch and its descendants from adjustments originating above it. Click for all properties; hover for individual property locks. Deliberate edits at a locked row remain possible. Lower locks still protect descendants.
- Named **appearance sets** remember targeting, exclusions, isolation and last adjuster values. Switching sets does not replay their values. Theme templates save the complete controller and its current presentation.

The shared adjuster applies to included, applicable descendants, respecting lower locks. Leaf swatches/sliders directly edit that target. A category can be isolated to adjust its subtree. Changing color leaves brightness, glow, animation, and other properties alone.

The MB3 visual selector is another entry to this controller. With accepted parts
selected, use RMB, the controller's edit button or platform keyboard context-menu
gesture to open **Selected appearance**, which reuses PropertyTree/PropertyEditor
and edits only those parts. Inspection is read-only; an actual edit creates scoped
local references in the same controller state. Previews, the recoverable draft,
Apply/discard, locks, bypass, inherited values and theme export remain shared.
Partial text runs support exact paint and text-node effects; complete text hosts
also support typography. Surfaces, input text and icons expose their adapters'
supported properties. Selecting empty 3D-world background resolves the existing
Workspace background consumer in the same editor. It edits scene values directly
and never creates a CSS-local instance for the canvas. See
`VISUAL_SELECTION.md` for the exact scope and current limits.

Right-click a frame handle or button and open its existing appearance editor for local refinements. Choose the part and property there. A stable reference to the resident appears under the corresponding category → **Individually customized**, marked **◆** for each locally refined property. An eligible categorical edit replaces that refinement; lock it to protect it. Hover its master entry to reveal and pulse the actual resident, restoring transient expansion and scrolling afterward. Search uses the same reveal mechanism.

**Show individuals** is off by default. Enable it in Visuals → Visual hierarchy to display individually customized entries and their groups, including eligible individual rigidity entries. The setting is saved with the UI layout. Hiding these rows preserves their customizations and keeps category targeting and hover behavior intact.

Fields has one shared Background and one Contour control covering single-line, multiline, search, numeric and dropdown fields. Existing type-specific paint, locks, exclusions and local customizations remain supported internally; they do not generate repeated field-type branches. Shared edits reach the existing bindings, while local editors offer the two shared field parts. Checkboxes, sliders and swatches retain their distinct controls.

## Data and ownership

`appearance.controller.version = 1` is optional in older saved settings. Normalization adds an empty controller while retaining legacy colors, fonts, animation choices and values as the baseline. Existing detached controls keep their IDs and edit the shared registry. Default controls use the tree instead of the former color/animation category dropdowns.

The former `vfx.*` controller entries migrate into animation properties on their corresponding real targets, including local resident references, refinement markers, locks and plugs. VFX-only target selections map to the corresponding branches; saved formatting is retained. The migration is idempotent and preserves existing target colors.

Targets and UI instances reference stable IDs; appearance never changes canonical entities, relationships, placements, frames or coordinates. Instances store their shared target and UI owner; live ownership and titles determine navigation after rearrangement. UI undo/redo covers committed appearance changes; picker/slider previews avoid persistence and history writes until acceptance.

**Omnium settings are defaults.** Authored node/binder appearance wins over default colors. Graph SVG/PNG/GLB assets keep their source palette rather than receiving the node's tint. Brightness, opacity and effects remain independent. This supersedes the earlier SVG tint behavior. UI icons can still receive an explicit UI icon tint.

Theme/UI templates retain target sets, values, local references, locks and plugs. Referenced custom fonts are embedded within the existing template size limits. Instance-specific entries require the corresponding UI resident in the destination layout.

## Extension points

- `src/properties/catalog.ts` supplies existing shared definitions; actual inputs in `*.function.ts` modules reuse them or define unique properties once. Discovery handles registration/coupling. `src/appearance/registry.ts` projects visual targets and adapters; editors, search and property locks consume the shared metadata.
- `model.ts`: pure targeting, propagation, rules and validated state normalization. Values are materialized on registered leaves so changing selection does not change presentation.
- `resolve.ts`: resolve saved values, baseline fallbacks, bypass and computed renderer defaults. Computed defaults are never persisted.
- `Styles.tsx`: declarative CSS target bindings and UI icon styling.
- `textScene.ts`, `visualScene.ts`, `structuralSparkles.ts`, `localEffects.ts`: Three.js and animation adapters. A new property still needs an adapter for its rendering behavior; do not advertise unsupported properties on a target.
- `appearance/graphEffects.ts` and `appearance/uiEffects.ts` route actual visual parts to their target properties. Text masks exclude surrounding controls and unrelated text categories. Animation changes keep graph data intact and reuse the existing bounded particle, contour and electric-ink renderers.
- `ContextualEditor.tsx` and `MasterController.tsx` reuse `Controls.tsx` and `LockControl.tsx`.
- `ui/transientReveal.ts`: temporary location reveal shared by search and local master entries.

No backend, new UI framework, graph-schema migration, automatic ontology, or changes to authored knowledge are involved.

## Property nodes and preview recovery

Appearance adjusters are UI nodes, separate from both the target hierarchy and the canonical knowledge graph. The declarative tree in `src/appearance/propertyTree.ts` groups the existing property registry into Color, Lighting, Opacity, Blur, Font, Animation and Styling. Animation remains a property of actual targets; it is never a VFX target branch. Multiple control trees can stay open. Click a property button to select its applicability highlight and expand/collapse one level, or use the configured subtree modifier (Shift by default) to toggle all descendants. There are no disclosure arrows; hierarchy guide lines attach below the property buttons. Expansion and ownership live in the shared UI window records and survive layout/template saves; earlier panel expansion preferences remain a fallback. Property groups move as complete embedded windows, including their editors and descendants. Search temporarily reveals the current UI ancestors, including regrouped properties, without saving that reveal.

Numeric adjusters offer a slider and bounded precise input, committed on Enter/blur. Empty or invalid numeric input restores its prior value. Effect and font choices are visible child choices rather than another property dropdown; effects include Off, and gradient has an on/off switch. Additional styles are registered once with supported renderer adapters: UI contour width/style, rounding, gradient second color/direction, shadow strength/spread/offset, UI text size/weight/spacing and UI icon saturation. Binder path thickness uses its existing Three.js line material; UI pixel sizing is not applied to 3D text or canonical geometry. Native graph assets retain their authored colors.

`src/appearance/session.ts` separates committed interface history from a recoverable appearance draft. Controller changes (including local UI instances, locks, plugs and targeting sets), theme changes, imported themes and fonts all enter the draft. Other UI layout, mouse and keybinding changes retain normal persistence. Live picker/slider previews remain transient; finishing a gesture adds one draft history entry. Shift+MB4/MB5 undo/redo the pending draft while it is open, including Alt's existing five-step variant. Apply records the complete appearance as one ordinary UI history step; discard restores the last applied appearance without changing layout or knowledge. Reload drops unapproved drafts, with the browser's unsaved-change prompt where supported. Theme/UI export explicitly exports the candidate theme, even while temporary safe view is active.

The fixed Apply/recovery bar and emergency dialog use a Shadow DOM root attached outside `body`, with independent colors, font, opacity and stacking. Appearance selectors/effects cannot style them. Holding Escape for two seconds opens recovery even while typing; an ordinary Escape keeps its normal workspace meaning. Key release, browser blur and tab hiding cancel an incomplete hold. Recovery traps keyboard focus while open.

Recovery actions:

- Discard unapplied appearance changes, after explicit selection of that action.
- Temporarily render a readable standard theme without changing the saved or pending theme. Return to custom appearance at any time.
- Preview default appearance or any saved checkpoint; Apply is still required to persist either.
- Save a named checkpoint of the applied appearance. Every Apply also creates an automatic checkpoint; the first Apply additionally backs up the starting appearance. The newest ten checkpoints are retained in `omnium.appearance.checkpoints.v1`, independently of templates and undo history.
- Start with `?safe-ui=1` if a saved theme makes ordinary controls unreadable.

Checkpoints contain theme appearance only, not canonical graph knowledge, authored placement/binder overrides, UI layout, imported font binaries or mouse/keybindings. Imported font references keep using the existing browser font library; portable theme export embeds the referenced fonts. Checkpoints are local to this browser, so export a theme JSON for a portable backup. Storage errors leave the draft open and are shown in the independent recovery dialog; Apply does not report success when browser settings cannot be saved.

## Shared customization rule for new UI actions

`src/ui/NativeActions.tsx` runs once inside the shared UI workspace. Ordinary buttons in any existing or newly mounted frame/window automatically join the same function registry as explicitly registered actions. Right-click edits the individual action, even inside a registered field; the owning frame is not selected instead. Display mode, characters, Iconify/imported assets, geometry, contextual appearance, shortcuts and local UI templates use the existing customization flow. The source button keeps its original click and double-click handlers; visual icon conversion leaves React's children intact. Newly mounted buttons are discovered by one batched mutation observer; paint/style-only changes do not trigger discovery.

IDs are scoped to the owning frame and structural anchors, with displayed text excluded so renaming/toggling does not change identity. Native buttons retain their customization when remounted. Use `data-ui-id` for a stable action key when introducing dynamic/reorderable lists or changing markup; property nodes and effect/font choices provide these keys. Existing registered controls are not registered twice. Frame handles retain their frame-specific menu. Search results keep their navigation behavior, and the customization editor and protected recovery UI are not recursively customized.

The focused `tests/ui-customization.browser.mjs` regression checks actual Theme buttons and choices, then creates a new window with a plain button to verify automatic discovery, individual customization, preserved actions, persistence and stable remount identity. It can be run alone against a development/preview server using `ATLAS_URL`; it does not run the broad browser suites.


## Complete embedded UI groups

Expandable property groups use the shared `EmbeddedGroup` window component rather than draggable action proxies. Optional `WindowState.inline` metadata records the native home, detachment and compatibility identities; actual docking remains ordinary window membership. Ownership, pinning, cycle checks, JSON persistence and UI undo therefore apply to future embedded groups as well as current properties. The same FrameChrome customization and window stacking rules are reused. Nested controls remain mounted when collapsed, and moved groups project through DockHost without copying their live editors. A closed originating feature yields an explicit unavailable-context placeholder in its destination.

Old customized headers retain their icons and local appearance compatibility identities. Former button-only placements are recovered as complete group placements. The metadata is UI layout only; graph identities, knowledge, coordinates and appearance property values are unaffected. Current ownership drives subtree expansion and search revelation. New feature code must follow [the shared UI component contract](UI_COMPONENT_CONTRACT.md); adding a draggable header without a complete payload is not a supported group implementation.

`tests/ui-group-drag.browser.mjs` is a focused Vite-dev-server regression (`ATLAS_URL`): actual Opacity/Blur payloads, collapse/reopen, cycle rejection, UI undo/redo, reload and a fixture-only newly introduced group using the same component path.

## Selection inspection in Master controller

Accepted visual-selector selections and selected UI functions bring up Selected
properties in Master controller. A closed controller is revealed transiently, with
no UI history/persistence write for inspection. Closing it dismisses that reveal
until a new selection. Show all controls dismisses the current inspection without
clearing the selection or changing values. Hover-only candidate previews do not
replace the accepted selection's properties.

The inspector and contextual Selected appearance dialog share SelectedProperties,
PropertyTree and PropertyEditor. Exact selected-part capabilities determine the
available visual controls, and explicit function-to-consumer declarations add
coupled nonvisual controls (currently the placement radius/clearance functions).
Edits retain selected-part scope, protections, shared drafts and state-owner
transactions. Merely inspecting does not create local instances. Inspector controls
are tool chrome and preserve the active UI selection while being used. Focusing
them pauses selector picking and holds the last feedback context while its pulse
and live paint values continue updating.
Complete selected text hosts use scoped CSS typography; partial runs support exact
paint and text-node effects, while unsupported partial typography stays unavailable.
Color edits do not reset fonts, and typography-only edits preserve unrelated paint.
The effect renderer builds local resolver/ownership caches per appearance state;
paint-only edits with no visible animation do not activate effect scans. General
3D/graph selection and unmigrated function fields still need their own capability
and state-adapter integration; they are not inferred from a screenshot or label.

## Shared function/property integration

The master panel now groups existing appearance controls under Visuals and
nonvisual coupled properties under generated categories (currently Spatial).
The shared `PROPERTY_REGISTRY` contains the canonical definitions; appearance
`PROPERTIES` is a compatibility view. Registered visual targets join the coupling
graph while preserving their IDs and existing persistence. Features define actual inputs once in co-located `*.function.ts` modules.
Automatic discovery loads them and derives property coupling, category/target
projection and state-adapter coverage; no second consumer list is maintained. See
[Shared properties](SHARED_PROPERTIES.md) before adding another setter/editor.

## Mouse trail

Mouse trail is a general pointer effect independent of selector activity. Find it
in Visuals → Visual hierarchy → Windows / frames / controls → Mouse. It reuses Animation:
Off, Lightning outlines (Light) and Stars (Stardust), with shared speed, intensity,
density, size, length and animation channels. Ordinary Color/Brightness/Opacity/
Glow automatically couple to its animation channels; its renderer reads that same
mapping. The separate feature-specific editor section is removed. Values retain
the appearance draft, locks, bypass, Apply/discard and theme serialization. The
pointer-transparent renderer is bounded and respects reduced motion.

## Self inventory

Press MB3 to open the stationary selector, then ◎ → Self inventory → Mouse.
The logical Mouse group is selected; Master controller reveals Mouse trail with
Animation open and shows its other registered paint/motion properties. Edits use
the existing values and appearance draft, and Apply still commits them. Clear/Esc
releases the logical selection; selection undo/redo restores earlier targets.
Selecting Mouse again deselects it through the shared logical-target selection
API, clearing its pressed state and selected-properties inspector. This toggle
behavior applies to all logical targets. Invoking Edit reopens inspection of the
current selection without changing values.
Self inventory also exposes Selector feedback → Included / Boundary, with a live
pulsing sample while editing its existing paint values. These are contextual views
of the shared properties and independent target values; inventory selection itself
creates no settings or local overrides. Meta groups declare `self: true` on their
existing coupling path, and new descendants appear automatically. Hidden compatibility
entries stay out of the visible list. Self inventory and the preserved Mouse
selection command are listed in shortcuts and can be assigned bindings.


Parameter editing temporarily activates supported inactive effects while their
shared controls are hovered/focused. Animation and gradient dependencies are
shared property metadata; Mouse trail declares whole-function activation through
its existing coupling. The projection is renderer-only and restores authored Off
on exit without saving it or entering the appearance draft/history. Explicit Off,
active effect choices, bypass and narrow selected-part scope remain authoritative.
See SHARED_PROPERTIES.md for extending this contract.


Master controller editing now retains the preceding selector hover/feedback context
instead of canceling its pulse. The shared editor marker covers the main controller,
selected appearance and moved property controls. Visual target membership and logical
pointer position are held while ordinary UI input and the animation clock remain
live. Clear/resume/dismissal and focus-loss cleanup release transient context. See
VISUAL_SELECTION.md; native browser hover and arbitrary event sources are outside
this registered-feedback hold.
