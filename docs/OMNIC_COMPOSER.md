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
- **V / Select:** click a unit; Shift-click adds/removes. **Scope** Micro addresses
  units; Macro addresses their nearest authored group (ungrouped root dots share
  the construction). Ctrl+A selects all authored units. Context **group** gathers
  selected units preserving IDs and coordinates; **remove** / Delete deletes them.
  Context selectionUndo/selectionRedo changes only transient selection. Ordinary
  shared Undo/Redo changes accepted construction, not each pointer preview.
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
- **R / Rotate:** ordinary invocation skips setters, prompts for a pivot, then
  permits dragging. Right-click → right-click Rotate (or R with the list open)
  configures Scope → angular halving order → rotation step count, one at a time.
  Confirm at the last step enters pivot picking. The retained one-step function
  follows the same pivot prompt and applies the step without dragging.
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
- **Property patterns:** right-click a unit, then choose Property patterns. Candidates
  come from registered dot properties, ranked by shared-property similarity;
  absolute position is excluded. Hover glows candidates; click selects that set;
  + includes a criterion, − excludes it, Clear criteria removes criteria without
  discarding the chosen selection. Size, fill, color, opacity, stroke, orientation and evaluated highlight descriptors
  participate. Orientation include/exclude uses half a current angular step as
  tolerance, with cyclic wrapping. The shared matcher is renderer-independent;
  full integration with the global MS geometry/region UI is still pending.
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

## Mathematical count dial prototype

The ⬤ Mathematical count preset uses `count-grid`, sharing count/size/paint/position
properties and owner setters. Its count input declares `picker: "mathematical"`;
the requested preset field projects the reusable `MathematicalDial`. Existing
sliders remain in place elsewhere until interaction acceptance. Six slots default
to top/clockwise, with base buttons 1/2, direction toggle and a start-slot cycle.
Each slot independently cycles ● addition / ◉ multiplication / ◎ recursion on
right-click. For slot n: addition is base*n; base-2 multiplication is n*n; base-2
recursion is 2^n. Hover is transient, click commits, leaving restores committed
count. Generated dots fill 20 columns, with each subsequent row above; their stable
indexed roles survive count changes. Base/direction/start/modes are session-local.
