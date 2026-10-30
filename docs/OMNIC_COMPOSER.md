# Omnic composer: Stage 1 contract

**Current presentation:** the whole Composer is the circular radar: editing inside,
tools on its rim. It is not a rectangle containing a radial popup or a headless
world-only editor. Atomnic on/off shares the same canvas and recipe. Presets and reusable tools retain rim entry routes; scalar properties are available from target right-click. Structure/construction, Motion, Selection, Transform, Fill/marking, Inspection/toolbox, Configure selected component and Operation scope are removed from the radial; reusable commands and saved data remain. Data/evaluation/history/library/
live preview are retained. See the capability guide's current circular-composer
walkthrough; later Stage 1 layout descriptions below are historical. Browser
acceptance is pending. Zoom sync is paused following the user's correction.

Earlier narrow UI change after restoring PR #36: remove the screenshot's Ordered
operations frame/search/non-oscillation palette and list entries, plus the
Interpretation frames editor and footer explanation. Semantic oscillation was retained then; its Motion category is now removed from the radar while saved operations/evaluation remain. Preserve existing operation/frame recipe data. Subsequent presentation changes are described above; library and saved-data compatibility remain. The broader cleanup in
closed PR #37 was rejected and reverted; do not reapply it. Earlier descriptions
of those removed controls below are historical implementation context, not their
current availability. See CAPABILITIES.md for current entry points.

Atomnic follow-up: right-click → Ungroup dissolves the nearest authored groups
containing selected atoms. Children retain positions/IDs; explicit operations and
frames scoped to a removed group retain its former children. Undo restores the
group. Rotation dragging honors the retained step-count interval and tracks
successive angles across full turns; zero holds orientation, negative step counts
set the one-shot Step direction while dragging follows the pointer. Unchanged
snaps skip geometry work. The existing Free/touching constraints still apply.

The function projection is now icon-only and radial: category spheres along the
rim open progressively smaller child rings around the clicked category itself, recursively. Parent rings and the canvas stay in place. Tooltips name tools/current values; right-click a tool opens one setter at a time. Root tools hide by default and reveal by hovering their common circular axis, remaining visible through tool/category/editor interaction. There is no eye button; Esc/child-centre steps back. Presets combines construction presets with reusable operation tools. The active cursor now inherits the selected tool icon via the shared website cursor layer; the private purple cursor is removed. The last-position pen/eraser switch shows the next action using the reference silhouette (Erase upper white/lower black; Pen upper black/lower white). Free/Realistic, ⠒ Atomnic on/off and promoted tools sit adjacent along the rim; pen/eraser is last. Left-grabbing targets moves them, with right-click during movement opening position settings. Wheel over the interior replaces the View zoom button. The Object wrapper is flattened; child categories still open around their clicked button. Color uses a circular rainbow-wheel symbol. Object categories reuse name/save/copy/file actions. The radar replaces the inline toolbar in both modes. The underlying recipe remains
shared: toggling Atomnic off preserves its dots while other generators add geometry;
returning keeps that geometry rendered and allows authored-dot gestures. Enabled
geometry-transform operators still need their evaluated-coordinate adapter before
direct gestures are safe. Free/Realistic uses retained settings; Realistic denotes
the touching-lattice profile, not a full physical simulation.

The user's subsequent direction is synthesized in
[OMNIC_WORKBENCH_MODEL.md](OMNIC_WORKBENCH_MODEL.md). It authorizes progressive
world-integrated construction, temporary/shared live drafts and lattice-constrained
mouse placement/movement. This Stage 1 document remains the record of existing
delivery scope; its procedural-only interaction restriction does not prohibit
that newer work. See the mental model's progress section for actual delivery.

Status: **Stage 1 implemented for review; browser acceptance pending**. This
document records the current user agreement and the first implementation. Model
and build validation are recorded below; browser usability and smoothness remain
user-verified.
The grammar remains unfinished; Stage 1 is a construction and discovery instrument,
not a finalized ontology or an English-to-symbol translator. Stage 2 library/workspace
extensions are now implemented for review; see [OMNIC_LIBRARY.md](OMNIC_LIBRARY.md).

## Canonical objects and sharing

An Omnic object is an existing canonical Omnium **Entity** with an optional
versioned `omnic: Recipe` structural definition. Ordinary placements refer to that
entity. The recipe is not an image attached to a separate concept, and there is no
concept-to-glyph assignment workflow. Its generated glyph is one view of the
canonical object. Identity is stable and independent of English labels, appearance,
position, generated SVG IDs and temporary renderer objects.

Multiple placements of an entity share the same recipe. **Save shared** edits that
canonical definition and updates its representations/references. **Save copy**
creates a new canonical identity for independent experimentation; duplicating a
placement does not create an independent recipe. Placement presentation overrides
remain presentation, not a competing structural definition.

Composition references follow their referenced objects' current definitions by
default. Editing a reusable object therefore updates its live uses. Do not quietly
introduce immutable version pins as the default: revision-pinned dependency
management was outside Stage 1; Stage 2 now adds explicit pinned revisions with
frozen dependency snapshots while retaining live references by default. Existing document history and exported atlas JSON must retain enough
state/references to reconstruct the saved work; live references must not make an
export depend on an unavailable external library.

This initial representation is compatible with Omnic/Omnium converging through
usage. It does not establish a permanent one-word/one-object/one-glyph ontology.
English remains optional annotation, search and accessibility text.

## First usable workflow

Planned shared entry actions are:

- `omnic.create` — **New Omnic object**: create/open a structural object in the
  composer directly, using existing canonical identity/placement paths.
- `omnic.open` — **Open Omnic composer**: edit the selected placement's entity. An
  existing ordinary entity without a recipe starts with a draft; opening alone
  does not change its canonical definition.
- `omnic.show` — **Show Omnic structure**: clear an explicit visual override on the
  selected placement so its structural representation is shown. This is a local
  presentation change, not a recipe edit or new canonical identity.

These commands belong to the shared `omnicWorkspace` action owner. Planned entry
surfaces include Create and the selected object's Inspector, reusing existing
registered action controls rather than adding a separate launcher system.

The composer is an existing `FloatingWindow` resident, `omnic-composer`, with the
same moving, docking, collapse/close, customization and active-context behavior as
other complete UI frames. Its shared `omnicComposer` actions include **Save
shared**, **Save copy**, **Play / pause**, **Export recipe**, **Import recipe** and
**Reset preset**. Exact shortcut assignments follow the action catalog and saved
bindings; do not create private keyboard listeners or imply a shortcut is assigned
before registration. Reopening must recover the canonical recipe and preserve an
unfinished local draft through the supported recovery path.

The workbench is currently genuinely 3D and rendered with Three.js, not React Flow.
Keep it operational. SVG is the first composer output adapter; a generated static
node view integrates with the current world renderer. Do not recreate an obsolete
2D editor to satisfy wording in the original plan.

## Stage 1 scope

Deliver one small integrated construction workflow containing:

- A versioned, validated, reconstructible recipe with stable component identities.
- A declarative generator/operator registry and deterministic evaluator independent
  of React, SVG DOM and Three.js objects.
- Dot/disk, ring/boundary, line/path, chain, radial and group generators, with basic
  nesting and live object references for reuse.
- Count, size, fill, rotation, selection, internal connection and simple oscillation
  operations, with explicit operation order and supported target scopes.
- Automatically generated contextual parameter controls, working presets, precise
  numeric entry and keyboard-accessible commands. A polished radial interface is
  not a prerequisite.
- Basic scoped frame activation and a minimal nonvisual property inspection, such
  as generated count or selected-component count.
- A live preview, bounded semantic oscillation with play/pause, local draft
  preservation, shared undo/redo, and recipe/atlas JSON import/export integration.
- Direct creation/open/save/copy of canonical objects and their generated node view.

A registry addition should become discoverable and receive its compatible controls
without redesigning the composer. The renderer and evaluator must not introduce
separate authoritative recipes or per-control value stores.

All geometry arises from generators, relationships, parameters and constraints.
No freehand drawing, manual SVG editing or dragging individual compositional units
into place. Procedural coordinate parameters and numerical input are allowed.
This rule governs composition construction; it does not remove ordinary spatial
placement or camera navigation elsewhere in Omnium.

## Structural meaning, frames and references

Keep structural state, transformations, interpretation and presentation distinct,
without making them permanently exclusive object types. Operators may eventually
accept other operators or return scalar/property/relation/history results. The
minimal inspection result is already nonvisual; SVG markup is never the canonical
result type.

A frame/property has three distinct states: **inactive**, **active but unspecified**,
and **active with a value/constraint**. Explicit absence/negation is separate. Do
not treat an omitted value, visible orientation, color or animation as an authored
semantic claim. Frame activation and scoped targeting are explicit; unresolved
interpretations are valid research states, not evidence of an application error.
Computed structural properties and user-declared interpretations remain labeled
separately.

Internal recipe connections describe the composition. They do not automatically
create external Omnium composition/relationship edges or claim knowledge facts.
Those remain explicit authored operations through existing canonical graph paths.
Do not encode every relation/topology combination as an unrelated glyph.

Generated roles and stable IDs must preserve targeting through parameter changes.
If reducing count removes a referenced role/component, retain an explicit unresolved
reference or apply a declared identity rule; never redirect it to an unrelated
array index. Expose the problem and a repair path. Detect missing references,
cycles and unsupported/invalid operations without unbounded recursion or silent
semantic strengthening. Identical rendered output does not prove shared identity,
meaning or derivation.

## Reuse the existing universal interface

Read [shared properties](SHARED_PROPERTIES.md), [function configuration](FUNCTION_CONFIGURATION.md),
[visual selection](VISUAL_SELECTION.md), [UI components](UI_COMPONENT_CONTRACT.md) and
[shortcuts/history](SHORTCUTS.md) before changing the integration.

Generator/operator metadata declares applicable properties, constraints, ranges,
input/output contracts and parameters. Reuse compatible definitions and editors
from the shared property pool; add genuinely new properties once through the
existing registration/coupling system. A shared property definition does not make
all consumers share one mutable value. Units, meaning and supported renderer
capabilities must match before coupling.

Contextual MC exposes only the relevant generator/operator/function controls;
explicit MC retains its general categories. Shift plus any configured action uses
the existing adaptive configuration router, including repeat/cycle, release/apply,
right-click lock and left-click priority reset. Structural-role selection and MS
must use the existing selection boundary/capability rules rather than infer grammar
from pixels or add a competing universal selector.

Editing controls modify one canonical editor state. Pointer/hover previews and
temporary UI selection remain transient; authored selection operations, scopes and
frame states inside a recipe are durable structural data. Completed recipe edits and canonical saves participate
in the existing state-owner/action-history route; no independent active undo stack
or shortcut priority scheme. Persist canonical data through the existing local
atlas/JSON paths and preserve ordinary graph/UI ownership distinctions. Never add
parallel authentication, backend or asset stores for this feature.

## Performance is required from Stage 1

Performance is not deferred to a future optimization stage. Preserve the standing
bounded-work/render-budget constraints and the user's preference for responsiveness
over unrestricted freedom. Declare useful ranges, aggregate expansion/operation
budgets and supported combinations; editable parameter endpoints cannot override
evaluator/renderer safety limits.

Bound generated units, nested reference expansion, path/connection work, geometry
and import size. Validate before expensive evaluation. Cache stable evaluation and
geometry projections; avoid broad graph scans, full scene rebuilds, storage writes,
React updates or texture regeneration for each animation tick or pointer sample.
Actual budget values and behavior belong to the shared engine/renderer policy,
not duplicated UI-only clamps.

World/node views show a static structural representation by default. Semantic
motion is stored in the recipe but paused in atlas views; presentation decoration
must not imply or erase semantic motion. The active composer alone may animate a
bounded preview using one shared animation-frame clock, explicit evaluation time,
visibility/pause handling and reduced-motion behavior. Do not animate every object
or create an independent loop per component. Reuse existing render budgets and
on-demand scene invalidation.

A fixed recipe, referenced definitions and explicit evaluation context/time must
produce deterministic structural/output results. The animation clock and current
UI layout are not hidden canonical inputs. Pausing changes playback, not the saved
meaning or declared operation.

## Deferred work and completion reporting

Do not automatically proceed into persistent cloud libraries, collections/tags,
full grammar, automatic semantic discovery, English translation, the complete
radial matrix, audio/phonetic output or speculative ontology/runtime infrastructure.
Stage 1's recipe and evaluator should leave room for these without implementing
them prematurely. Explicit version-pin/follow UI was deferred in Stage 1; the Stage 2 extension now
supplies it. Current references remain live by default.

Before marking Stage 1 complete, verify the agreed workflow end to end: generate
and parameterize structures without drawing; target whole/substructures; reorder
operations; handle count changes without reference corruption; reuse nested objects;
activate frames; inspect a nonvisual property; preview oscillation; save/reload and
reconstruct JSON; display/reopen the canonical object's node; and add an operator
without replacing the control system. Record actual commands/checks, missing
capabilities, performance restrictions and user browser-verification limits.
Build success alone is not evidence of responsiveness or completed acceptance.
Stop after Stage 1 and report the smallest useful next step.


## Implemented paths and current limits

Open **Create → New Omnic object**, or select an existing node and use
**Inspector → Open Omnic composer** (also searchable/rebindable catalog actions).
New work now starts as a recoverable unsaved draft with one procedural dot and
a temporary world preview; it creates no canonical entity until saved. Opening
the composer without a selected object uses that same route. Opening an ordinary
object starts a recoverable composer draft; Save shared adds/revises its structural
definition without changing identity. For unsaved work Save shared creates the
object at its creation context; Save copy deliberately creates another identity.
See the live-world slice below for bounds and remaining limitations.

The composer supplies procedural dot, ring, line, chain, radial and nested-group
generators, shared-object references, count/scale/fill/rotation/selection/connection/
oscillation operators and ordered count extraction. Parameter metadata supplies
shared editors and active ranges; registered parameter presets do not assert
verified semantic thresholds. Role picking and target repair are within the
composer. General MS can inspect existing registered UI controls; this stage does
not implement arbitrary semantic SVG-part editing through MS.

Shared references follow current definitions. To revise a reused source, open its
canonical node; embedded references are not edited by silently copying them.
Ordinary Identity reuse creates another placement of the same object. A placement
with an explicit imported asset/character keeps that visual override; **Show Omnic
structure** clears that occurrence's override without changing the canonical
object. Size and text visibility remain presentation settings.

Only a bounded static representation is projected into the 3D world, using cached
generated SVG as derived input to the existing visual renderer. SVG is not stored
as canonical data or duplicated in saved assets. At most 32 Omnic occurrences get
256px static textures per scene build; further occurrences show an explicit
Open Omnic / preview budget placeholder. This deliberately preserves responsive
rendering rather than pretending a simplified graphic is the complete structure.
The composer retains the full validated recipe. Semantic motion is paused in
world views; active composer playback is capped at 256 roles / 12fps, stops when
hidden/reduced-motion applies, and pauses after repeated expensive frames.

Engine policy limits: 128 authored components, 128 operations, 64 frames, combined
nest/reference depth 12, 1,024 generated roles, 200,000 matching/work units, and
absolute geometry extent 1,000,000. Oversized/nonfinite intermediate results are
rejected, not silently clamped. Imports are limited to 1MB per recipe and the
existing atlas limits. Whole-atlas JSON carries referenced definitions; recipe-only
JSON preserves reference IDs and needs those objects in the destination atlas.

Drafts are preserved locally by canonical object ID. The shared action journal
records completed draft edits and canonical saves/copies, including closed-draft
undo/redo through a storage-backed owner. A recovered draft whose base revision
changed is clearly marked; Reset draft reloads the current shared definition.
Stage 1 added no private undo stack, authentication or cloud atlas store. Stage 2
now integrates workspace history, IndexedDB autosave and explicit cloud snapshots
through the existing backend; see OMNIC_LIBRARY.md.

Runtime addition of an operator reuses registry behavior and control metadata;
new property definitions still follow normal function discovery/build reload.
The grammar, semantic equivalence, full frame interpretation/inference, audible
language, translation tooltips and persistent library organization remain unresolved
or deferred. Stage 2 library organization and workspace persistence are now
implemented for review; their contract and rollout limits are in OMNIC_LIBRARY.md.


## Live world drafts: first workbench slice (2026-10-28)

**Create → New Omnic object**, or **Open Omnic composer** with no selection,
opens one recoverable unsaved draft for the active workspace/atlas. Its seed is
one procedural dot. A temporary structure appears in the world at the creation
context without adding an entity, placement or canonical history entry. The
existing composer supplies the editing controls in this slice. Enter **Glyph name**
and **Save shared** to create the canonical object there. Completing that draft
releases its recovery slot; the next new draft has a fresh history owner. An
unfinished draft reopens/reloads through its own workspace/atlas recovery ID.

Opening a selected object previews its recipe immediately on visible uses and
transitive **live** dependents. Pinned revisions and paths through frozen pins
retain their saved definitions. Previews temporarily show the structural view
over local asset/character overrides; closing restores the original presentation.
Save shared changes the canonical recipe, not those explicit presentation choices;
**Show Omnic structure** remains the way to clear an override permanently.

Input samples, draft Undo/Redo, presets, imports and Reset draft update the world
without writing canonical state. Closing removes the world draft and restores
saved rendering while retaining the recoverable draft. Reset reloads the saved
definition (or the single-dot seed for unsaved work). Invalid evaluations retain
the last valid world preview while the composer reports the error. Save/copy still
use the existing validated workspace, archive and shared history paths.

The bridge is a session-owned transient store, not another recipe owner. Renderer
plans use immutable-pool indexes for live dependencies and visible occurrences.
Updates are coalesced at the existing 12fps Omnic budget, spread dependent work
over 4ms batches, reuse generated assets,
replace only affected visuals and retain the last decoded visual until its
replacement loads. A draft sample does not rebuild the entire scene or pass a
projected document through graph commits. Pending loads and proxies are disposed
on replacement, close, atlas switch and scene rebuild.

The shared world budget remains 32 structural sources at 256px. Preview can use
existing reserved occurrences and free slots; additional occurrences retain saved
rendering. A new temporary uses a free slot or displays the existing preview-budget
placeholder. The world remains static at evaluation time zero; Play animates only
the composer. This is not fixed-size Omnic reading or readability calibration.

Temporary world drafts are edited through the composer and become normal
selectable graph placements after saving. This slice does not yet implement the
fixed touching-lattice mouse/sweep interface, arbitrary subset movement, exact
MS internal-region selection, an Omnic frame/dial UI or the complete node rework.
Those follow the shared [mental model](OMNIC_WORKBENCH_MODEL.md), rather than
being inferred as delivered by the preview bridge.

Type/capability/property checks and the self-contained preview build pass (2.85MB).
No browser suite or performance trace ran; user acceptance is pending. Focus user testing on new draft → world edit →
close/recover → save, shared uses/live dependencies versus pins, Reset/Undo,
asset override restoration and atlas-switch cleanup. Build/static results are
recorded at handoff and do not establish interactive smoothness.

## Member / Part construction extension (2026-10-28)

**Create → New Omnic object → Preset → Member · one of two / Part · half a unit**
loads ordinary procedural recipes. The registered **Highlight units / region**
operator chooses a 1-based unit or all scoped units, with fraction, start angle,
color and opacity. It preserves unit identity/count. Fractions are exact angular
sectors of filled disks or arcs of unfilled circles; fractional lines report
inapplicable. One highlight layer per primitive is supported; a later highlight
replaces it. This is durable authored data, separate from temporary editor picking.
Count regeneration diagnoses removal of an earlier highlight; put highlight after
count when its result must survive regeneration.

**Rotate structure** now supports Region → Each unit → Together. Region changes
the authored highlight orientation; Each unit rotates primitive geometry/marks
about its own center; Together preserves relative positions about a shared pivot.
Pivot is target-bounds center, composition origin or explicit offset. New operators
use target center; legacy recipes retain origin/offset behavior. Saved snap step
(0 = free), snap origin and optional allowed-angle list constrain actual rotation.
The applied angle is shown. Angles remain bounded ±1080°, snap 0–360°, with at most
32 allowed angles. These are editor constraints, not proven semantic thresholds.

**Rotate one step** is a catalog action with no default binding. Its configured
shortcut advances the focused rotation. Shift uses the existing generic MC input
configuration/gesture adapter, with scope choices in contextual priority order.
Temporary changed inputs stamp a rotation step while preserving the focused
settings; locking writes those settings before execution. No private Shift handler
or independent settings store is added. Registry applicability metadata hides
irrelevant controls in both the composer and contextual MC.

**Save operation as tool** saves the focused operation as an ordinary independent
canonical object with scope-relative targets and no components. **Reusable tools →
Stamp copy to scope** copies its operations into the current draft's picked/flow
scope, with fresh operation IDs. Stamps are editable snapshots, not live executable
dependencies. Shared glyph reuse remains the Reference generator. Tool objects
retain visible labels in world presentation. Existing save/copy, drafts, Undo,
workspace persistence and export/import paths own these edits.

The extension does not implement general frame interpretation, read-order grammar,
physical substrate simulation or fixed-size world reading. See the
[walkthrough](CAPABILITIES.md#omnic-operations). User interaction testing is pending;
no browser suite or new performance trace was run. The normal model command
passes, 20 focused Omnic engine cases pass directly, and production/type/property
checks plus the self-contained preview build pass.

## Validation for the first implementation

- `node --run test`: 254 model/architecture checks pass, including 28 new Omnic
  cases across core, document, properties, draft history and derived presentation.
- `node --run build`: production/type/property-contract checks pass.
- `node --run build:preview`: self-contained preview builds (2.59MB).
- Existing large-chunk build warning remains. No browser suite or new performance
  trace was run; the user's browser acceptance and smoothness checks remain pending.

Focused coverage includes deterministic generation, ordered transforms/count
extraction, registry behavior extension, count shrink/unresolved roles, Unicode
canonical references, dependency cycles/depth, aggregate work/extent bounds,
frame tri-state, oscillation, JSON compatibility, shared-vs-copy identity, cache
invalidation after shared dependency revisions, shared property adapters and closed
composer undo/redo. Numeric bounds/model timings do not establish interactive FPS.

Smallest next step: user-test New Omnic object → radial count/rotation → nested
reuse → Save shared across two placements → Save copy → reload/export/import.
Resolve observed usability/performance issues as Stage 2 is reviewed. Stage 1
frame authoring remains explicit scoped records; full interpretation is Stage 3.


## Atomnic construction

Implemented for review on the workbench PR; browser interaction and smoothness
remain user-tested. This extends the first live-world slice. New Omnic object opens
Atomnic by default. Existing recipes use **Atomnic mode** / **Generator controls**
to switch. Saved data is preserved. Authoring supports explicit dots and nested
groups with highlights; arrays, references and other enabled geometry operators
remain in Generator controls. There is no automatic destructive flattening.

- **D / Draw:** move to preview the next imprint; click places one, hold and sweep
  places a bounded stroke. The touching-lattice profile uses triangular slots,
  fixed diameter pitch and no overlap; leave empty slots for gaps. Free separates
  imprint radius and movement step, permitting gaps, overlaps and fractional steps.
  Slot grid is omitted above 1,024 visible slots. A stroke samples at most 64 points
  per event; recipe limits still apply.
- **E / Erase:** choose Erase from the right-click function list or press E.
  Click removes a touched unit; sweep erases all crossed units. Micro addresses
  units, Macro their nearest authored group. Right-click Erase configures only
  Scope. Hover previews the addressed set. Release accepts one draft-history edit;
  Esc/cancel restores the pre-stroke recipe. A direct swept-segment test bounds
  work by unit count and catches units between pointer events. Erasing is whole-unit
  removal, not intradot carving; explicit dangling operator targets stay diagnostic.
- **Selection:** MS owns membership, feedback and transient history. Click/drag
  selects through MS; Q opens its configuration (V is an alias). Use MS for
  multi-selection, not private Shift toggles or rectangle sweeps. Ctrl+A routes
  authored targets into the same owner. Selection undo/redo uses MS history;
  recipe undo/redo remains separate. Complete selected owners feed existing edits.
- **G / Move:** drag selected units rigidly. A clicked unselected unit becomes the
  selection. Touching mode snaps the common translation and rejects overlap;
  Free uses its retained movement step. Invalid samples retain the last valid one.
- **Right-click:** reveals only the function list, with retained values. No
  permanent function toolbar appears above the construction. Left-click a function
  uses its retained settings. Right-click ONE function reveals only its first
  relevant setter; Next/Confirm advances to the next, Back/Esc goes back. Draw
  configures constraints, paint target, imprint, step (Free only) and paint inputs
  in sequence. Select/Move configure their own relevant inputs. View configures only
  construction extent. Other functions' fields never appear alongside the current one.
- **R / Rotate:** opens the rule-configured value slider for selected compatible
  authored Rotation inputs. Drag previews and release applies. Its explicit mode
  starts at ✣ Symmetry · 2³. See E03 below. The separate Step action retains the
  older pivot workflow described next.
- **Pivot/reference:** during pivot picking, right-click exposes Exact click and
  Detected target. Left-click selects that retained mode and returns to picking.
  Right-click Detected target exposes its Axis step; left-click retains the axis
  and advances to Position, while right-click Axis opens boundary picking. Choose
  first boundary, second boundary, then halving depth. Midpoint accepts immediately;
  deeper choices ask direction. The resolved axis advances to position halving.
  Position 1/2 is target center; quarter/eighth positions request a side. The cursor
  shows rotation throughout and a pulsing center during target selection. The
  reference uses the current Micro/Macro bounding box. Top is zero, clockwise
  positive; order 0/1/2 yields 6/12/24 directions. Exact supported axes are retained;
  angular precision beyond order 6 is rejected, never silently rounded.
- **Halving:** shared numeric ranges expose **½**. It first asks depth; depth 1
  accepts the midpoint with no direction question. Depth 2/3 then asks which endpoint
  to approach for quarter/eighth. Input Enter confirms each native input step.
  Consumer validation/resolution still applies. Atomnic axis boundaries can be
  picked on the radial address ring (up to 48 handles) or cardinal buttons; the axis
  itself is derived from the bracket and depth, not manually guessed.
- **Highlight:** right-click Highlight to configure Scope, fraction, mark orientation,
  color and opacity one at a time, then confirm to apply. Left-click Highlight
  applies those retained settings immediately. Fraction 1/2 paints a horizontal half
  at the default orientation; 1 marks the entire unit. Paint values stay
  independent of canonical semantics. **Fill** applies retained paint/fill to units.
  Existing Ordered operations shows/removes/reorders marks. Generator controls
  also supplies reusable copied operation tools, export and detailed operations.
- **Selection settings:** the retained pattern command opens Q/MS. The private
  Composer property-pattern panel is retired; rules and patterns belong to MS.
- **World:** the same gestures address the active edited image in Omnium, including
  unsaved temporary work. Shared uses continue previewing together within the
  existing 32-source budget. Selection/pivot/grid/ghost are transient editing
  feedback, excluded from saved/exported glyph geometry. Close restores saved
  rendering; unsaved draft recovery and Reset keep their existing behavior.

The construction view extent is fixed while editing and adjustable in DOFs; it
does not auto-fit each placement. That retained viewport also applies after saving
and in library thumbnails, so saving does not silently rescale the composition.
This is not yet the final calibrated reading
size/max-zoom system. World rendering still uses a 256px texture and 12fps draft
budget. Direct hit testing addresses the edited identity's image plane; generated
reference users show live results but are not alternate atom-editing surfaces.
At most 128 components (groups included), 128 operations and coordinates within
±300; finite bounded ranges are enforced. Touching mode checks authored centers
and disk radii, not stroke thickness or arbitrary simulated physical laws. Illegal
pivots/rotations do not deform individual atoms to make them fit. Finer rotations
usually require Free. No automatic meaning, equal-node relayout, visible circular
frame/dial authoring or complete MS intradot carving is claimed in this version.


The construction surface and contextual MC own their right-click workflow.
Opening functions, configuring one function or using blank popup space must not
also open UI-edit menus, including when a containing UI frame is selected. The
shared function renderer preserves original contextual handlers; normal frame
chrome and unrelated controls retain their UI customization route.

## ⠒❉ shared raw-number dial (Composer refinement)

⠒❉ is the shared number system/control surface, initially editing raw values.
Count was its first test consumer; reference-derived rules and equations remain
future work. The existing property editor now projects this dial throughout the
Composer via NumericEditorScope, including preset DOFs, stationary target DOFs
and numeric operation/brush configuration. Outside this scope the ordinary
property editors retain their existing behavior. No second property/value owner
or per-preset math handler is introduced; the old count-only picker flag is removed.

Right-click a target, hover its existing category and click a numeric DOF to open
the compact dial. Presets show their DOF radial first, including ⬤. Small inline
value buttons open requested dials for progressive controls. Full dials are never
mounted permanently alongside every field. They retain the half-size geometry;
meta controls overflow below the ring, keeping its centre at the invoking cursor.
Right-clicking a numeric DOF opens the experimental dial editing-rule configuration.

± is available when the domain permits negatives. It reverses the active raw
number/sign; subsequent marks use that sign. Slot notation currently represents
whole numbers. Decimal notation controls are explicitly deferred. Clicking or
right-clicking the compact value readout retains exact native-number entry,
including existing fractional property values. Existing whole-number domains
(count, index, angular order/steps/axis) are declared in input metadata and reused
by property validation and the number editor. Invalid candidates are disabled;
consumer limits and Realistic legality still govern final writes.

⌫ clears scratch marks while preserving the property's realized value, allowing
a fresh numeral. Opening an editor preserves its current raw value. External
owner changes/Undo discard stale scratch marks, and preview cancellation restores
the current owner rather than an older local number. Closing a preview clears
only the Composer sample; accepted values remain in recipe/history/storage.

The ⬤ test preset uses the same path as every other numeric DOF.
Right-click in the drawing area changes only the active cursor brush ●/◎. It
must never change a slot, mode assignment or count. Moving previews applying that
brush; left-click fills a slot and stamps its mode, and holding left-click sweeps
that mode across crossed slots. Painting an existing mark replaces its mode;
same-mode painting is idempotent, not deselection. Other marks retain their modes.
The obsolete per-slot right-click cycling and click-toggle paths are removed.

Normal slot n contributes base*n; recursive slot n contributes base^(n+1).
Base2: slot1 recursive=4, slot3 recursive=16, slot6 recursive=128. Contributions
add; normal slot4 plus recursive slot6 totals136. All paths use the shared pure
slot/sum/brush policy in properties/mathematicalDial.ts. Geometry is cached at
stroke start, fast segments collect intervening slots, and release commits one
history edit. Cancelling restores the numeric property. Current expression and
brush remain session-local; Undo/reopening does not yet restore the full marked
representation. Do not imply otherwise from numeric-owner history coverage.

The shared website cursor resolver renders ●/◎ only in the explicitly registered
popup drawing zone, returning to ordinary pointing over settings/outside. Other
popups remain blocked from tool cursors unless they explicitly opt in.

Slots start empty; unused positions reveal on hover/keyboard focus, while marks
remain visible. Rings are fixed by enclosing equal-size base units, not manually
resized. Base2 is default, fitting9 slots; outer orders fit15,21,… according to
maximum non-overlapping circle capacity. An invisible outward candidate band has
no rim. Painting a mark outside the current outer rim unlocks Add ring; enclosing
it preserves the mark and hides the button until another outward mark is painted.
At most four orders. Each ring shares the base and restarts local ordinals; exact
cross-order algebra remains exploratory. Start/direction arrows default top/CW.

The count-grid renderer uses shared count/size/paint/position properties, with20
columns and rows upward. Domain0–512 bounds rendering; higher results cannot be
painted. Base1 recursion remains unsupported. Scope-only rollout preserves editors
outside the Composer; color spectrum gestures, dial-size controls and snap-step
configuration keep their specialized working paths.

Original exploratory context is archived in
[Mathematical dial exploration](omnic/MATHEMATICAL_DIAL_EXPLORATION.md).

### ⠒❉ appearance and discovery

The picker is named ⠒❉ (aliases mathematical dial/count dial). It is displayed at50% of its earlier linear size, with a matching12px scoped cursor. Hover previews glow on the slot rim; only committed marks fill. Shared Fields/⠒❉ renderer bindings project automatically into role-based Contours (slot/ring outlines, hover rims) and Indicators (selected marks, base units, direction). Native generic button fills/contours exclude mathematical slot geometry. Search aliases are shared metadata, inherited by visual parts and indexed by global search.

All dials now share the Dials appearance family, with automatically detected role children and individual Radial menus/⠒❉ parts. Select the family for common edits, or right-click a specific dial/part for normal scoped overrides. Original mathematical target IDs and semantic role ancestry are retained.

The advance-start-position button is removed. Meta controls are32px logical/16px displayed and sit below the outward candidate band; start remains top, with direction independently switchable.

### MC hierarchy navigation

Composer dials no longer render Back, Next, Confirm or checkmark navigation buttons. Alt+MB4 steps outward and Alt+MB5 advances through the nearest registered stage. Enter confirms via context.confirm; Esc cancels the current gesture/field/preview before stepping outward. Radial centres only drag; returning inward can restore the last stepped-out radial branch. Shared active-layer adapters and nested navigation registration supply these behaviors to applicable systems; no private mouse/key handler is added per dial. Plain MB4/5 history is retained.


### E01: shared increment editing rule

Composer numeric editors configure Value or Increment through the same dial.
Increment uses `anchor + signed index * amount`; numeral slot arithmetic itself
is unchanged. Rule/amount use the existing per-property session working-step
scope, and the amount is edited by a requested child math dial. No property
changes merely from configuration; hover and paint use existing previews/setters.
Clear marks, exact entry, rule change, external owner updates and reopening
rebase the anchor. Repeated previews do not increment the previous sample.

Target and preset numeric DOF right-clicks now open rule configuration instead of
the legacy jump-value field. Other numeric DOFs inherit the same PropertyEditor
projection. Active adapters lend their real resolution alongside limits. Existing
sliders outside Composer retain their behavior. The experiment is not yet a
reference/rule binding system, does not affect direct dragging/commands, and
does not persist mathematical expressions. See the living master plan and
capability omnic.editing-rules for exact steps, limitations and pending acceptance.


### E03: rotation state selection and mode configuration

R on a compatible authored selection, or target/preset Rotation, opens the shared
cyclic state wheel. Default ✣ Symmetry · 2³ offers eight states from north clockwise;
hover previews, click applies, leaving restores the last committed angle. Click
2³ to edit state count with the math dial; right-click mode chooses Symmetry,
Halving or + Step, while left-click configures its variables. Settings remain
open after a parameter commit until dismissed. Hold Alt to park the active
DOF/mode/reference cursor indicators, click one, release Alt and configure.

Reference → ⨮ Match starts a canvas object pick. Compatible authored orientation
becomes the wheel reference; no geometry changes until a state is chosen. Self
restores north. Missing references remain unavailable. Initially single-target,
no active rotate/oscillation operators, no persistent constraints. Existing owner
setters, legality, samples and chronological Undo/Redo remain authoritative.
R edits authored orientation values; the separate Step action retains the older
pivot/orbit workflow. Other numeric DOFs retain their existing editor.

The older E02 Reference → Rule → Match numeric UI is removed. Its pure measured
context models remain groundwork. See E03 in the living master plan and capability
omnic.dof-state-wheel for test steps and explicit experiment limits.


### E04: available-state fields across numeric DOFs

Every numeric target/preset DOF now projects DofStateField from its registered
Parameter domain. The shared numeric PropertyEditor projection also opens that
field. Coordinates X/Y and length quantities use spatial/magnitude axes, cyclic
rotation uses directions, and raw quantities such as Count/Opacity use radial
addresses. Count has no implied physical axis. The same prepared-field nearest
query, temporary owner preview, captured click commitment and history serve all.

Right-click mode chooses Partitions/Symmetry, Halving or Step. Left-click mode
configures divisions, step, working limits or exact '=' entry via the math dial.
Integer domains default to unit steps; other fields to partitions. Limits filter
available states and never bypass hard domains; invalid/empty fields cannot apply.
Reference picking now uses property/measurement/unit compatibility for numeric
DOFs. The reference itself is a candidate when valid; Halving and Step derive
further states from it. Alt parks indicators through the existing shared cursor.

This supersedes the rotation-only editor and E01 Value/Increment presentation.
No new per-DOF preview code is needed. Constraint preparation is bounded and target
legality uses the existing setter; pointer motion only picks prepared candidates.
The current spatial fields are single axes; arbitrary 2D regions, containment,
collision, equations, nonnumeric field adapters and persistent bindings remain
future domain/constraint work. See E04 and capability omnic.dof-state-wheel.


### E05: rule maker and value slider

Numeric DOF activation now opens the shared arrow/end-bar value slider, including
Rotation. It traverses the current rule's generated values; drag previews and
release commits. Arrows/wheel/keyboard step through the same sequence. Click the
mode expression to configure the rule with ⠒❉. Right-click the left/right slider
end bar to configure its lower/upper limit. Rule/bound configuration does not edit
geometry. The previous selectable value-panel UI and standalone slider ½ picker
are removed; Halving remains a rule. Alt indicators, references, validation and
owner/history paths remain shared. See the E05 record and maintained walkthrough.


### E06: clickable DOF information and gesture activation

The Composer top always shows compact active DOF, mode/rule and ⟴ reference controls. Click one to open its existing editor; mode right-click chooses the generator and the expression opens ⠒❉ variables. During an edit the same information follows the cursor as a noninteractive echo. This supersedes earlier DOF Alt-parking descriptions; MS parking remains separate. MB3 (rebindable atomnic.dofOptions) toggles the settings radial at the cursor; MS/Shift priority is retained.

Dragging detects Position; left-holding just outside a selected object's boundary activates a registered Rotation DOF. Self is the default reference. Coordinate DOFs also offer Environment boundaries or a compatible authored target through a temporary MS request, restoring the previous selection on accept/cancel. Return to the shared value slider: drag previews, release commits, wheel/arrows traverse generated values. Limits stay on its ends; the mathematical dial configures rules/variables. Canonical evaluated boundary axes account for parent coordinates. Retained single-target coordinate fields guide subsequent drags; unconfigured/multiple-target drags keep their previous movement behavior.

Current limits: authored SVG reference boundaries and single coordinate axes, not arbitrary 3D feature picking, containment or persistent geometric constraints. Browser acceptance remains pending; see the living E06 record and capability omnic.dof-state-wheel.


E06 presentation correction: the information strip exists only while a DOF is active. It uses icons/numeric expressions with descriptive tooltips and accessible labels; no inert default placeholder or visible text labels. The radar strip is inset inside its circular clipping boundary. The noninteractive cursor echo uses the same compact symbols.


Latest E06 correction: remove the DOF-information cursor echo entirely, including its numeric-editor cursor zone plumbing; ordinary tool cursors remain. The active icon strip is the information location. A button-triggered editor must open below its actual button, not above/to its side: shared cursor tracking captures its bounds on activation before stage replacement, and shared popup placement centers the editor below it. Ancestor overlap may only move it further down in that column; explicit hover-branch radial anchors retain radial placement. Canvas/shortcut openings without a button keep cursor placement. Rule/reference settings and MS picking do not render the value slider alongside them; returning from configuration restores the numeric value editor. A readout such as 10.2949 is simply the current position value. These corrections supersede gesture-echo and lateral-separation descriptions above. Browser visual acceptance pending.


Rotation discoverability: hover the existing outer edge band of a selected target with a registered Rotation DOF to switch to the same Rotation tool cursor used during the gesture. Hover and press share prepared bounds/margin, with only enter/leave transitions changing React state. No separate rendered handle, cursor text echo, preset-specific hit zone or per-motion geometry discovery is introduced. Browser confirmation pending.




Reference entry correction: “MC” here meant the existing selector invoked by Q (selector.open). The mistaken MC selection list/request store/window-opening path is removed. The top ⟴ button invokes that same selector action directly; no reference options list or intermediate radial. Composer SVG primitives declare data-selection-boundary plus data-selection-id inside data-selection-scope, so ordinary Q can select authored Composer objects and reconnect boundaries after SVG replacement without crossing surfaces. A temporary reference request consumes the chosen object inside the current Composer: compatible other object sets the reference, the active object restores Self, empty Composer space selects Environment when supported. Acceptance/cancel restores previous selector selection/configuration. Configuration stays with the Q selector; no duplicate selector UI or hardcoded shortcut. Current authored/single-target/SVG reference limitations remain. Browser confirmation pending.


Actual rotation-edge correction: remove outsideBoundary and the 2–8 scene-unit/object-size activation margin. Rotation hover and primary press both use rotationEdgeHit over a prepared index of selected evaluated primitives. Exact segment/circle distances include stroke width and fill; visible ink stays a move grab, empty space near actual rims (including hollow inner rims) qualifies. Bounding boxes only accelerate the search and retain the existing pivot calculation; they never decide activation. The band is eight CSS pixels in the local Composer via its existing coordinate adapter; the world-preview adapter supplies local projected-plane pixel scale. Geometry/index preparation happens when the selected evaluated snapshot changes; pointer queries do no scene discovery or DOM measurement. Future rendered primitive kinds need their geometry adapter, not preset-specific rotation zones. Hover state clears on view changes. Model regressions cover slanted/circular edges, false box corners, interiors, overlap, hidden geometry and zoom scales. Browser acceptance pending.


Unselected hover correction: interaction previews must not require prior selection. Prepare rendered-geometry ownership and registered DOF capabilities per displayed snapshot; preview Move over applicable visible ink and Rotation near actual edges only when the target declares rotation. Hover never commits selection or geometry. An edge press on an unselected object selects the canonical authored owner and starts rotation in the same gesture; selected-group scope is preserved for its members. The common authored-node resolver is reused by reference measurements and hover discovery, including reused geometry. No per-preset hit handlers, per-motion registry discovery or new cursor renderer. Existing MS/Ctrl/Erase priority and geometry-only hit tolerance remain. Browser confirmation pending.


Scalar grab correction: geometry chooses the DOF/tool before a press; once grabbed, scalar value execution is a virtual slider in free space. Shared createValueScrub serves relative RangeControl/DOF-icon drags and Composer edge rotation. The first meaningful movement (three CSS pixels) locks its arbitrary axis for that gesture. Continuing along it increases, reversing decreases, perpendicular motion is ignored. Screen displacement traverses the prepared value sequence/bounds; it does not follow the shape or compute cursor angle about its center. Press/jitter leaves the value untouched; release commits once and cancellation restores via existing owners. Edge rotation uses the generic value gesture; obsolete shape-following center/field gesture state is removed. Explicit legacy Step/pivot rotation remains separate. Two-axis direct placement keeps its existing spatial translation behavior. No extra floating slider is introduced. Browser acceptance pending.


Latest Rotation correction: hovering actual edges shows the cue; one primary click selects its owner and opens the axis wheel on release, without editing the angle. Rotation is no longer a scene drag/scrub/orbit gesture. Shared DofStateField projects all declared cyclic domains through DofAxisWheel: hover previews generated states, click commits and stays open, leaving cancels preview, and the centre is neutral/drag-only. R and preset/target Rotation inherit the same metadata-driven projection. Reuse existing state-field generation, preview sessions, captured-click activation, setters/history, rule/⠒❉ configuration, Q references, shared dial scale/appearance and outside dismissal. No private rotation math or extra scalar bar. Scene scrub state and its virtual default span are removed; createValueScrub remains only for existing relative DOF-button sliders. Ordinary noncyclic numeric DOFs retain RangeControl. Explicit legacy Step/pivot remains separate. This supersedes earlier rotation-edge scrubbing descriptions. Browser confirmation pending.


### Shared MS selection ownership

Composer no longer stores UI selection or a selection timeline. Rendered primitives
opt into the generic `geometry.rendered` MS adapter with `data-selection-geometry`
and stable scoped `data-selection-id`. Native SVG stroke hits and screen-scaled
stroke bounds participate in shared selection/feedback, including zero-height lines.
Ordinary click/drag publishes geometry through `useVisualSelection().setElements`;
Q uses the existing selector rules/configuration. Programmatic selection uses the
same history and does not replace an unchanged selection’s rules/scope. Temporary
reference requests checkpoint and restore MS, while editing consumes the last
accepted selection. New renderers should declare these shared boundaries instead
of keeping their own membership, matching panel, feedback or history.

The edit projection admits only complete authored owners. Partial generated-member
MS selection stays exact/visible; whole-owner operations cannot broaden it silently.
Per-member property overrides and arbitrary clipping remain future work. Drawing,
erasing, recipe-authored selection operators and draft history remain distinct.
Browser acceptance is pending; no browser suite run for this change.


### Reference lens → on-spot possibility space

An active numeric reference request now returns its chosen viewport point as well
as the existing compatible reference. DofStateField opens the prepared limits,
thresholds and fractional candidates there immediately. Cyclic values retain the
axis wheel; scalars use a hover/click linear field. Registered two-component DOFs
compose their component fields into the shared DofPlaneField, including threshold
lines and default fractions. Tuple previews and commits remain atomic through the
existing owner/session; no Position-specific centre action or new selection state.
The nearby expression opens the existing math dial; generation stays in code.

The active setter owns interpretation. Bounds/Match value picking previews and
commits geometry; Step reference picking previews a proposed snap amount and
commits its measured ratio/working step, without moving the object. Ordinary
fractions retain integer numerator/denominator math-dial configuration where
representable. No region menu follows a numeric source pick. Ordinary MS selection
without a numeric request does not invent a DOF. Higher-dimensional projections,
scene-aligned constraint overlays and exact clipping remain pending. Browser
acceptance of this experimental interaction remains with the user.
