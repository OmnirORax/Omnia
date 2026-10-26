# Omnic composer: Stage 1 contract

Status: **Stage 1 implemented for review; browser acceptance pending**. This
document records the current user agreement and the first implementation. Model
and build validation are recorded below; browser usability and smoothness remain
user-verified.
The grammar remains unfinished; Stage 1 is a construction and discovery instrument,
not a finalized ontology or an English-to-symbol translator.

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
management is outside this Stage 1 agreement unless a concrete core requirement
is approved. Existing document history and exported atlas JSON must retain enough
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
them prematurely. Explicit version-pin/follow UI is also future work; current
references are live by default.

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
A new object is a canonical entity with an initial procedural definition. Opening
an ordinary object starts a recoverable composer draft; Save shared adds/revises
its structural definition without changing identity. Save copy creates another
canonical entity and a normal placement in the current creation context.

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
No private undo stack, authentication or cloud atlas store was added.

Runtime addition of an operator reuses registry behavior and control metadata;
new property definitions still follow normal function discovery/build reload.
The grammar, semantic equivalence, full frame interpretation/inference, audible
language, translation tooltips and persistent library organization remain unresolved
or deferred. Stage 2 is not started.


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
Resolve observed usability/performance issues before starting Stage 2.
