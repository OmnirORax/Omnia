# Omnic composer: current construction contract

The user explicitly retired the original procedural composer interface on
2026-10-28. It was an agent-designed interpretation, not the desired foundation.
Build tools feature by feature from user requests. The library/workspace remains
separate and retained. [The shared model](OMNIC_WORKBENCH_MODEL.md) is the broader
context; this document describes the current composer, not the historical UI.

## What is present

A compact draft/save shell and the Atomnic construction surface. No Generator
controls mode, structure dropdown, preset picker, neighbor previews, parameter
forms, role/scope panel, reusable-tool panel, ordered-operation palette/list,
interpretation-frame editor, diagnostic list, degree rotation editor or playback
control is mounted or registered by the composer. Their detached sections also
unmount, instead of being left collapsed. New window defaults are 360×440;
existing user-chosen window geometry is retained.

The recipe evaluator, stable IDs, references and revision pins, underlying operation
implementations, serialization/validation and shared infrastructure remain for
compatibility and future reuse. That does not authorize restoring the old UI or
reintroducing its assumptions. Library collections, queries, presets, placement,
revision history and workspace/cloud behavior retain their existing implementation.

## Lifecycle and identity

An Omnic object is a canonical Omnium Entity with a versioned structural recipe.
Editing uses a recoverable browser draft; previews do not create a second identity
or write canonical data. New work starts with the existing single authored-dot
seed. Save shared commits its definition (and creates the object for new work).
Save copy makes an independent object. Recipe import/export, Reset draft, shared
construction undo/redo, close/reopen recovery and library references remain.

The composer lends transient recipe/interaction references to the world renderer.
Saved objects and transitive live uses preview the edit; pinned revisions remain
frozen. Close restores saved visuals. New work has a temporary world placement
before saving. The same accepted edits reach existing history/storage owners.
Transient pointer/selection feedback never becomes canonical geometry.

Older generated recipes remain intact and render in the library/world/composer.
Current direct manipulation supports authored dots/groups with highlight operations.
Other recipes are view-only in this composer; import/export/save/copy still preserve
them. No automatic flattening, data deletion, new identity or silent conversion is
performed. There is no route back to the retired generator interface. Legacy
`atomnic.active=false` does not restore it or hide current authored-dot tools.

## Atomnic construction

Right-click the local surface or active world image to reveal functions with their
current values. Left-click uses retained settings; right-click ONE function opens
one applicable setter at a time. Next/Confirm advances; Back/Esc goes back. The
function list is not permanently displayed. Content context-menu ownership keeps
UI-edit/selected-UI menus from opening over this flow; ordinary frame chrome remains
customizable. Applicable inputs use existing property/MC/value controls.

- **D / Draw:** preview an imprint; click places a unit, held sweep places several.
  Touching mode uses triangular slots, pitch equal to diameter and no disk overlap.
  Gaps are empty slots. Free separates imprint radius and movement step, allowing
  fine steps, separated imprints or overlap. The grid is omitted above 1,024 slots;
  stroke interpolation is bounded at 64 samples per event.
- **E / Erase:** click or sweep whole units. Micro erases units; Macro their nearest
  authored groups. Hover and erasing share hit geometry. A swept-segment test catches
  units between pointer events with work bounded by unit count. Release accepts one
  history edit; Esc/cancel restores the active stroke. Unchanged samples do not
  commit. Right-click Erase configures Scope only. Intradot carving is not implemented.
- **V / Select:** click units, Shift-click adds/removes, Ctrl+A selects all. Micro
  targets members; Macro targets their nearest authored group (root units share
  the construction). Group collects selected units without reassigning IDs. Remove
  or Delete removes the selection. Selection undo/redo is transient and separate
  from construction history.
- **G / Move:** drag the selection rigidly. Touching mode snaps a common translation
  and rejects collisions; Free uses its retained movement step. Invalid samples
  keep the last valid geometry.
- **R / Rotate:** ordinary invocation uses retained values and prompts for the pivot
  before dragging. Right-click Rotate (or R with the function list open) configures
  Scope → angular halving order → step count, one at a time. Final Confirm begins
  pivot picking. Top is zero, clockwise positive; refinement gives 6/12/24/48…
  directions. Step picks a pivot then applies the retained step without dragging.
- **Pivot reference:** right-click during pivot picking reveals Exact click and
  Detected target. Right-click Detected target to configure Axis then Position.
  Right-click Axis to choose first boundary → second boundary → halving depth →
  direction only for a non-midpoint answer. The resolved axis advances to position
  halving. Position 1/2 is target center; quarter/eighth choices require a side.
  Reference geometry uses the Micro/Macro target bounding box. The cursor carries
  rotation, with a pulsing center during target picking.
- **Highlight / Fill:** right-click Highlight configures scope, fraction, mark
  orientation, color and opacity sequentially; confirmation applies the mark.
  Left-click reuses settings. Fraction 1/2 marks a horizontal half at default
  orientation; 1 marks the whole unit. Fill applies retained paint/fill. These are
  geometric operations, with no automatic part/half semantic interpretation.
  Applied marks currently rely on construction undo/reset for correction; the old
  operation-list editor is removed.
- **Property patterns:** request the list from the contextual functions. Registered
  dot descriptors rank matching sets, hover glows candidates and +/− includes or
  excludes criteria. Absolute position is excluded. Size, paint, orientation and
  evaluated highlight descriptors participate. Orientation tolerance is half a
  current angular step. This is not full MS geometry/region integration.
- **Shared ½ picker:** depth comes first. One halving accepts the midpoint without
  asking direction; other depths then request an endpoint. Enter confirms native
  input steps. Consumer validation/precision remains authoritative. Axis boundaries
  use a radial address ring (at most 48 handles) or cardinal shortcuts; exact
  addresses beyond order 6 are rejected rather than silently rounded.
- **View:** right-click its contextual entry to change construction extent. The
  viewport stays fixed while placing units and also defines saved/library scale.
  There is no automatic per-imprint fit or completed max-zoom calibration.

## Limits and verification

Recipes remain bounded to 128 components (groups included), 128 operations and
coordinates ±300. Touching mode checks authored centers/radii, not stroke thickness
or full simulated physics; unsupported rigid configurations are rejected. Finer
rotations generally need Free. World previews retain the 32-source/256px budget,
12fps coalescing and 4ms dependent batches; extra occurrences retain saved visuals.
No-op samples and feedback-only dependent assets reuse existing work.

Known unfinished contracts remain visible in the shared model: Shift+Atomnic uses
broader coupled MC inputs rather than operation-specific progressive fields;
Micro/Macro is not full contextual hierarchy traversal; exact MS carving, circular
frame/dials, node-layout grammar and reading-size calibration remain pending.
Do not claim universal completion from shared-component reuse.

The user handles browser interaction/performance acceptance. Required local
model/type/property/capability and preview checks are separate from GitHub CI and
browser acceptance. Do not run browser suites, profiling loops or CI retries to
infer usability. See [the maintained capability guide](CAPABILITIES.md#omnic-atomnic)
for a walkthrough and current evidence.
