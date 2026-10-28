# Omnic / Omnium workbench: shared design model

User synthesis, 2026-10-28. Read this before Omnic or Omnium node/frame work.
Its purpose is to let a new agent continue the design without making the user
explain it again. This is a working model, not a finalized grammar or a claim
that the described capabilities are implemented.

## Latest correction: the Composer itself is the radar

Further cleanup: remove the whole Selection, Transform, Fill/marking and toolbox/Inspection category projections, not merely the Select/Fill leaf actions. Remove Configure selected component and the ⠒ rim toggle. Move the existing Free/Realistic control directly beside pen/eraser at top middle; retain registered mode action/settings. Direct target selection and right-click DOFs remain. Target Fill uses ◐; target Opacity uses a 50%-faded ⬤. Reusable command/data owners are preserved.

Latest refinement: category children form a smaller ring around the clicked category itself, recursively, rather than replacing the Omnic dial’s rim. Parent rings stay in place. Remove the dedicated Select button (existing left-click selection remains), Motion category, Fill button and Operation scope picker from the radial. Preserve underlying reusable engines, stored operations and target-derived DOF adjusters.

Rim choices: permanently visible eye, 100% tools shown / 50% hidden. Top-middle pen/eraser switch displays the next action. File 📁, Selection ◌, Inspection 🧰. Motion ⇳ was subsequently removed from the radial. Remove the entire Structure category from the radial presentation, retaining reusable commands/data. Frame/navigation controls do not belong in this radial; contextual Back/Confirm still work. Target DOF discovery is unchanged. Opening right-button release must never activate/dismiss newly appeared controls.

Latest interaction clarification: right-click a target/pattern to discover its
actual writable DOFs, and show the corresponding freedom adjusters directly as
buttons around ONE circle. This is not a category tree or a row. Direction being
writable supplies Rotation; position supplies Move where the executor applies.
Left-click uses retained action settings; right-click the adjuster opens its
snap/halving configuration progressively. Start with this slice and let the user
test it before extending the design. General/file tools are not target DOFs.

Discovery now reads registered writable generator inputs and their intersection
for multi-target selections. Existing action metadata declares which properties
its executor adjusts; generic properties use the shared editor and target-scoped
recipe setter. Realistic atom radius is a substrate setting, so target size is
exposed in Free. Scalar editor intervals/steps are retained in one shared transient
Composer editing-session scope, independently of actual values; movement/rotation
retain existing recipe settings. This is adapter capability discovery, not full
MS/pixel inference or discovery of arbitrary variables. Operator-only DOFs and
additional transform executors remain future adapter work.

The user rejected the rectangular Composer and clarified: "the whole omnic composer
window should be the radial", "sort of like a dragonball radar", "inside it is the
editing environment, while tools are on its rim". This supersedes the earlier
radial-popup-within-the-Composer delivery. It also corrects the agent's unimplemented
suggestion of removing the interior in favor of world-only editing. Keep the
circular editing surface and live Omnium preview; put icon/category tools on its
rim in BOTH Atomnic modes. Category navigation changes rim contents/icon size,
never the canvas size. Text belongs in tooltips and requested editors/feedback.
Atomnic toggles tools on the same recipe, not another environment. Library stays.

The radar reuses the window identity/ownership/history, defaults to a 360px circle,
and supports square resizing and shape-aware shared viewport projection. Old
rectangular sizes project without deleting saved layout. Procedural geometry,
component properties, references/pins, scope, presets, operation tools, motion and
diagnostics have requested rim routes; generator setters are progressive. Recipes
are not stripped or made read-only. The Stage 1 rectangular markup is internal
historical scaffolding, not the app's active entry route.

The Chrome/Omnium size-sync question is PAUSED: the user said "wait nvm" and
redirected to this correction. Do not infer answers to its pending zoom/reference-
depth questions. This change does not implement pixel-size synchronization.
Model/type/build checks are distinct from user acceptance of the radar UI.

## Latest scope: narrow removal from the restored PR #36

PR #37's broad composer cleanup was rejected and rolled back. The user now
explicitly targets only the shown old operation/frame area: retain Semantic
oscillation; remove the other operation palette/list entries, search, Ordered
operations wrapper, Interpretation frames editor and footer explanation. Keep the
rest of PR #36, especially Atomnic tools, generators/presets, scope/reusable tools,
save/recovery/live preview and library. Existing operation/frame data is preserved.
Do not interpret this as authorization to remove the rest of the composer again.

The user then authorized implementing further concrete requirements while they
test. The next batch adds contextual Ungroup and corrects retained-step rotation
dragging. Ungroup dissolves only selected atoms' nearest authored group boundaries,
preserving child IDs/positions and expanding group-targeted operations/frame scopes
to the promoted children. It uses the existing action catalog and recipe history;
no permanent controls or new grouping identities. Rotation drag uses the magnitude
of the saved step count on the existing 6 × 2^order grid, accumulates pointer
direction across full turns, and avoids geometry writes inside an unchanged snap.
Zero holds orientation; one-shot Step still uses the saved sign. Touching-profile
legality is unchanged. These changes await user interaction acceptance. The broader
Shift-configuration/MS/frame/zoom gaps documented below remain open.

### Radial tools, one-space toggle and constraints

The next explicit direction replaces Atomnic's rectangular function list with
icon-only category spheres on a circular rim, matching the supplied ring image.
Opening a category replaces the active ring with a smaller one. Names/current values appear in tooltips.
The tool button opens/closes the projection; its centre shows/hides tool spheres,
and right-click/Esc steps outward. Eraser, Free/Realistic and Atomnic on/off sit
just inside the rim. Minimize gaps; no permanent file-action toolbar or full grid.
Right-click ONE function retains progressive configuration. Name/save/copy/file/
playback use existing field/action identities, discovered from catalog metadata.
The shared renderer bounds rings/items and supplies overflow categories.

Atomnic toggles tools on the same recipe/world, not another environment. Off
preserves dots while normal generators add rings/other geometry. On keeps those
rendered while authored dots remain editable. Generated geometry uses existing
generator controls; enabled non-highlight geometry operators still block direct
authored-coordinate gestures pending their adapter. Macro currently consists of
authored dot members, not arbitrary generated geometry. Full MS integration and
universal geometry manipulation remain pending.

Free/Realistic is directly available on the rim. Free permits independent imprint/
step values and overlap; Realistic is the touching-lattice profile, coupling pitch
to diameter and rejecting invalid slots/overlap/rotations. Incompatible switches
reject without changing the construction. Full physics/other constraint profiles
remain pending. This delivery needs user interaction acceptance.

## Start here

The user needs a general instrument for constructing, applying and revising
Omnic directly in Omnium. Minimize the time from imagination to manifestation.
They will develop the language by actually mapping their notes and writing
expressions, discovering missing capabilities as they work. Build that instrument;
do not substitute a collection of pre-authored concept presets for it, or require
the entire grammar and node design to be resolved before useful work can begin.

The repository is `OmnirORax/Omnia`, the app at **omnium.nexus**. The separate
Omnium-compiler repository is not the application for this work.

The user authorized this synthesis and then beginning the workbench rework. Work
incrementally, preserve useful foundations, and distinguish agreed requirements,
exploratory language rules, implementation and user acceptance. Ask about actual
blocking interaction choices, not the meanings of incidental screenshot colors
or theoretical details the user does not need engineering to settle.

## Authority and reading order

1. Explicit current user instructions and corrections take precedence.
2. This synthesis records the newer discussion and workbench direction. Read the
   [onboarding map](WORKER_ONBOARDING.md) and root [AGENTS.md](../AGENTS.md) for
   shared engineering contracts.
3. The [source-alignment audit](OMNIC_ALIGNMENT_AUDIT.md) and preserved
   [Omnic source](omnic/OMNIC_RULES_SOURCE.md) supply the earlier language context.
   The user's newer upload also included a glyph-first lexicon and the newer
   Member/Part/Whole distinctions summarized below. Neither source is a finalized
   specification of every exploratory claim.
4. [Stage 1](OMNIC_COMPOSER.md) and [Stage 2](OMNIC_LIBRARY.md) describe delivery
   agreements and existing foundations. The newer direct lattice manipulation
   requirement supersedes Stage 1's prohibition on placing/moving individual
   composition units. This does not authorize arbitrary SVG/image editing as
   canonical structure.
5. Inspect code for actual behavior; read the capability guide for entry paths,
   rollout and verification. A plan, documentation, build or preview is not browser
   acceptance or proof of hosted availability.

Do not record a new suggestion as an agreed rule. Update this document when the
user changes a cross-cutting decision, rather than leaving contradictory rules
in chat or append-only task histories.

## Product and language model

**Omnia** is the broader human/AI creation and knowledge environment. **Omnium**
is its genuinely 3D spatial, hierarchical knowledge workbench. **Omnic** is its
developing structural/computational language and reading/meta layer. Eventually
AI should read and modify the structures directly, without screenshots or English
as a required intermediate. English remains useful optional annotation and a
learning aid. Accepted shared knowledge, exploratory work and review are distinct.

Omnic aims to derive glyphs from relevant structure, relations, constraints and
operations. Learn the composition rules, then derive unfamiliar constructions.
It is not a fixed dictionary assigning arbitrary pictures to English words.
Ontology and language develop together. The user's stated root is difference;
preservation across change is a recurring organizing principle for identity,
symmetry, memory, order and macro structure. Treat this as design context, not an
instruction to build a universal inference engine now.

Components, contextual roles and bindings are distinct. A structure can act as
operator or operand. A phenomenon differs from selecting, detecting or creating
it. Operator composition inherits lower-level grammar. A displayed connection
alone does not specify transfer, conflict or dependence; relation/operation and
topological/access conditions are composable distinctions.

Frames constrain what is specified. Inactive, active-but-unspecified, specified
and explicit negation are different states. Inherited context avoids repeating
activations on every child. Matching pictures, a shared referent or implication
do not establish identical meaning, derivation or canonical identity. Nearby views
and nuances can preserve materially different constraints.

Compression must retain a definite expansion/derivation. Generate requested
combinations from rules; do not pre-enumerate all combinations or manually tag
everything a new operator could affect. Shared actual structure should supply
discovery/filtering. Concepts emerge through use; recurrence can justify a
language canon. A database ID does not itself establish that canon.

## Minimum unit, tool precision and reading scale

Chapter 3.2 is central. Keep these limits separate:

| Limit | Meaning |
| --- | --- |
| Minimum construction unit / step | The chosen substrate's movable building block. In the discussed dot mode it is **●**. |
| Operator imprint precision | Frames, operators, selectors and their marks may be much smaller and more intricate than the minimum unit. |
| Smallest visible difference | The limiting visible cue at maximum zoom-out. It is **not another atom** and can remain detectable after exact dot shape/edges become uncertain. |

Never infer that a minimum movable ● forbids selecting or marking half of it,
making a small hole, an internal stroke or an intricate stamp. A fine imprint can
be baked into a tool and applied in one minimum placement step. Repeated imprint
can affect intensity; that is distinct from allowing construction units to overlap.
Holding while stepping can make a continuous trail.

Readability depends on what the mark carries. Presence, intensity, side, position,
direction or a recognizable pattern can suffice without resolving exact edges.
Require edge/shape discrimination when it actually carries the distinction. Below
the intended visible limit a cue becomes inferred from surroundings; do not
silently treat arbitrary subpixel detail as readable authored information.

The user wants to determine the smallest ● size that retains the relevant detail,
maximizing visible context per zoom slice. Calibrate in actual rendering with
complete expressions: atoms, internal markings, holes/voids, inter-unit distinctions,
negative markers, frames and activations. A bare-dot test or a resized screenshot
cannot establish the whole system's reading size. The source discusses loss of
voids, then edges/discreteness, then intensity; useful constraints must follow the
actual substrate/display and relevant distinctions, not hardcoded universal pixels.

Omnic's intended reading size stays fixed at its maximally zoomed-out reading
scale while Omnium content zooms independently. Enlarged inspection can help edit
but does not prove the result survives reading size. Auto-fitting must not conceal
detail loss. Universal frame footprint, exact sizing, anchoring and interaction
with content levels still need actual use. No global hex grid, fixed angle list
or final pixel dimensions follow from this discussion.

## Agreed dot construction mode

The user subsequently clarified that **● is the visible discrete unit, not the
tool's minimum movement step**. Provide free and constrained modes. Tools can
place, rotate and engineer fractional configurations the units could not produce
unaided. A constrained/physical-law profile supplies the applicable limits; free
mode permits finer construction. Enlarged inspection helps engineer a result
whose relevant distinctions must survive the intended reading scale.

The earlier fixed touching lattice is one constrained profile. Imprint equal to
step gives touching discrete marks; smaller imprint leaves gaps; larger imprint
overlaps and can make continuous/fractional detail. Do not globally forbid these
configurations or impose this substrate on all future modules and operators.

Required interactions:

- A dot follows the mouse through valid positions and lands on the desired slot.
- Support both click placement and held/swept repeated placement.
- Select any number of units and move them together, preserving their arrangement.
- Preserve applicable mode constraints; stable identities survive moves.
- Count is the occupied units. Arbitrary arrangements cannot be limited to the
  existing chain/radial generators or a fixed collection of prepared patterns.
- Fine internal marks and their rotations have their own DOFs/constraints. They
  need not obey the same precision as translating whole units.

How a rotated group relates to the substrate (local lattice rotation versus
allowed landings on an existing lattice), collision feedback, region gesture
details and final shortcuts are open interaction details. Preserve the existing
shared action/input ownership paths while resolving them through use.

Later clarification permits fractional configurations in free mode; do not block
all rotation until every result lands on the earlier fixed lattice.

**Grouping:** reuse/extend MS detection over Omnic contents. Selecting a target
exposes shared-pattern choices ranked most similar to least. Hover previews the
matching set; the user includes/excludes criteria. Color can select all white
objects; direction can select an orientation range. Size participates; absolute
position is excluded from similarity matching. Touching alone is not the group
rule, and a matched set never establishes shared canonical identity. Extend
registered property/pattern capabilities, not a private Omnic detector.

**Angular picking:** user-facing rotation/axis picking uses no degrees. Start at
the top, proceeding clockwise, with six positions; increasing refinement/ring order doubles the count:
6 → 12 → 24 → 48. Three base steps reaches the opposite side. Store an order and
step/address, with renderer angle conversion internally. This supersedes the
agent's earlier interpretation of `3` as three halvings of a North–East sector.
Angular refinement and radial distance are separate DOFs. They may be coupled by a constrained/realistic profile; refinement alone does not change pivot distance.

**Contextual interaction — corrected explicitly by user:** keep construction
visually quiet. The available function list appears only on right-click. Entries
show current values; left-click (or the normal shortcut) uses retained settings.
Right-click ONE function opens its configuration, **one relevant setter/prompt
at a time**. Confirm advances; Back/Esc returns one level. Do not render a permanent
function toolbar or unfold every setting, including settings for other functions.
A full grid and a collapsed global "Configure DOFs" form do not satisfy this.

For rotation: select Micro/Macro targets and Shift-click additions; configure the
operation if requested, then prompt for the pivot, then drag. The cursor carries
rotation while configuring; its pulsing center signals pivot selection. Right-click
during pivot picking exposes exact/detected choices. Right-click detected target
reveals its reference configuration: axis, then position. Right-click Axis to set
first interval boundary, second boundary, halving depth, then direction **only if
the answer is not the midpoint**. Once the axis is resolved, repeat the method for
position. Ordinary invocation skips setters and inherits retained values. Shared
MC/action/property mechanisms own the implementation; no second durable settings
store. General halving pickers follow the same depth-before-direction principle.

## Operators, presets and selection

The user's **halving method is universal across all value-picking systems**.
Radial axis subdivision and fractional pivot positioning are applications of
that shared mechanism. The examples include 6 → 12 → 24 → 48 angular divisions
and 1/2 → 1/4 → 1/8 positions, quickly entered by depth. Exact interval/direction
and indexing semantics remain under discussion. Implement through shared value
picking, not private Atomnic controls; see SHARED_PROPERTIES.md.

The user's term is **operator presets**: reusable operator configurations with
modifiable degrees of freedom, snaps and constraints. Stamping is an application
gesture. The earlier agent's Member/Part construction presets are examples, not
the requested general system.

Upstream operations/views can act on one unit or between units without requiring
Atomnic multi-dot construction: continuity/path; trail/motion; frame and
contrast/separator/question; rotation/direction; start/end; selection/highlight/
pointer; fill; boundary; inside/outside; color; realized/not; relation/binder;
interaction mode/topology; local dial modifiers; position; commonality. This is
design context for extensibility, not a settled finite primitive ontology or an
instruction to implement them all with invented semantics in one pass.

Operator plus Atomnic construction exposes count, size, discreteness, internal
relations, microstructure, combinations and paths. Show a property through its
structure where appropriate instead of adding a redundant label/modifier.

Applicable operator inputs include target/scope, geometry, fraction, boundary/
interior, thickness, hole size, fill/intensity, pattern, position/anchor/offset,
orientation/pivot, scale, reflection, repetition, motion and combination behavior.
One region, each unit separately and the arrangement together are distinct scopes.
Do not give every operator every input; registered capabilities determine what
applies and future applicable consumers inherit shared behavior automatically.

Keep input increments, enforced allowed outcomes/snaps and meaningful thresholds
distinct. Suggested numeric buttons do not establish language thresholds. The
same applies to editable slider endpoints versus aggregate engine/render budgets.

**Reuse Master Selector (MS) and Master Controller (MC).** MS already supplies
individual/pattern/geometry selection, working scope, inside/outside/contour
rules, refinement, feedback and transient history. It needs Omnic target adapters
and actual partial-region support, not a competing selection system. The present
geometry largely decides which registered whole parts intersect; it does not
provide arbitrary clipped regions inside a dot or general 3D structure picking.

Near-term needs: whole units/subsets/groups; actual internal regions; boundaries,
interiors and holes; useful structural snaps; moving/rotating selected scopes;
applying repeatable marks. We can extend MS further as concrete needs emerge.
The primary fine-edit gesture and how exact fractions and arbitrary MS geometry
relate remain open. Do not freeze a pie-sector-only language from the current
highlight implementation.

MS feedback is transient. Authored highlights/constraints/activations are recipe
data. A temporary green selection is not automatically a claim in the glyph.
Use the existing MC/property definitions, consumer setters, contextual configuration,
shared actions and chronological history. A shared property definition never
means all consumers share one value. No separate Omnic settings/auth/history stack.

## Five immediate constructions

These are the user's constructions to make with general tools, not a request to
deliver five fixed concept presets:

| Expression | Construction |
| --- | --- |
| Member | Two ●, highlight one whole unit. |
| Part | One ●, highlight half of it as the schematic generic part construction. |
| Whole | One ●, highlight all of it. |
| All̊ | Two ●, highlight both. |
| None | Two ●, highlight both with an explicit negative/exclusion marker. |

Negative marking could use red or a minus above/inside; the final form is open.
Record its authored scope/operation; unhighlighted is not automatically excluded.
Do not conflate All̊, each/every, Whole or Member. The newer notes also distinguish
an individual value, an integrated state of values/relations and connected structure.

The user clarified **symmetry means equilibrium/non-bias** here. Engineering does
not need to debate or formalize geometric symmetry before delivering tools.
A balanced half can be the default schematic marking for unspecified partness.
Only activating the relevant degree/value view would make that exact half a
quantitative claim. The user also explored an asymmetric 25% marking supplying
its own quantitative specificity. This is **provisional**; do not hardcode automatic
quantification or geometric-symmetry inference. The degree activation's location
(e.g. 90 degrees), visible form and possible use of color are also undecided;
color may instead primarily serve salience.

## Direct world construction and saved identity

The user explicitly chose:

- Open a selected object's composer and preview changes immediately in Omnium.
- All shared uses preview the live draft together; explicit pinned definitions
  remain versioned references, not accidental live-follow.
- Without a selection, a temporary structure can preview at the creation position
  before a canonical object is created.
- Unsaved work can be reverted. Keep recoverable drafts and existing Undo paths.
- Save retains/commits the work; **Save copy** creates an independent identity when
  deliberately wanted. It must not be required just to see the result in the world.

Canonical Entity definitions, multiple placements, live reuse, explicit copies,
revision pins and workspace-wide storage are valuable foundations. Keep IDs and
portable saved work. Hover/input/drag previews must not mutate accepted knowledge,
create duplicate entities, advance revisions, archive versions or flood storage/
history. Actual commits still use the existing owners.

World changes must update affected visuals incrementally, with cached/bounded
evaluation and render work. Do not feed every slider/pointer sample into a full
document commit or whole-scene rebuild. Keep on-demand rendering and shared budgets.
The existing cached compressed renderer can remain useful for inactive objects.

## Nodes, Omnic frames and activations

The current direction is equal-sized, circularly **Omnic-framed nodes**, with
structured contents and access to their nested information. Clicking the node's
frame should expose applicable properties, filters, functions and modes through
the common controller. The frame is a target/scope with supported operations,
not only a decorative selection outline.

The user described **Omnic frame**: after composing the core, press the action
and fit a circular frame around the net composition, then apply activations.
Possible later ideas:

- Put activations on the rim itself to save space rather than outside it.
- Neighboring equal frames touch like `○○`, replacing word spaces.
- A needed binder reserves a fixed gap, e.g. `○-○`; its own modifiers are editable.
- Framing lets the referent inherit applicable mapped Omnic operations. Marking
  part of a robot's frame can express partness about that robot.

Exact frame export/visibility, clearance and fit, slot identities/positions,
activation appearance, frame/content rotation, touching layout and binder distance
are **not finalized**. They should be exercised in actual writing. Do not demand
the complete dial vocabulary before implementing extensible frame targets.

Keep Omnic node frames distinct from existing investigative knowledge frames and
draggable UI frames. Their common editing infrastructure does not make them the
same data type. Visual grouping/proximity never silently authors a knowledge edge.

## Concrete application, compression and writing

The primitive ● can be a schematic operand. A real structure/glyph replaces that
operand when the operator is concretely applied. The generic/invariant Part glyph
can be discussed on its own; an application can mark the actual variant directly,
avoiding a redundant surrounding dial activation when the structure already
expresses the operation.

Examples to preserve, without inventing final glyph grammar:

- **Robot had a destroyed part / robot's destroyed arm:** select/bind the actual
  arm or relevant substructure and apply the modifier to that target. Literal
  half of the drawn robot does not identify an arm unless structurally bound.
- **Part/some of the currency goes to X:** partness applies to the relevant
  currency quantity/collection. An unspecified part need not assert exactly half.
- **Some currency immediately/speedily goes to X:** the modifier applies to the
  transfer relationship/binder. Nodes are not the only operator targets.
- `((part(currency)) -> (X))` can be one compressed expression and also expose its
  participant nodes and relationship at a deeper level. Compression/expansion
  preserves identities, bindings, modifier scope and reconstruction.

A selected substructure's screen area is not automatically its physical amount,
count, value or another quantity. Keep target, displayed marking and declared
frame/degree distinct. Supply manipulable structure without forcing every new
concept into a finalized semantic interpretation engine.

The intended user loop is: look at a sentence; find concepts/operators lacking
glyphs; construct those glyphs; immediately write the expression in Omnic in
Omnium; inspect it; revise the language/tools from the encountered needs. The
user intends to map the supplied Omnic notes this way. Support reuse at the point
of writing, rather than repeated export/import or Save-copy cycles.

## Expansion, 3D and temporal/reference distinctions

The node and its expanded contents can be different levels of the same structure.
The user considered focused/layer-level zoom, temporarily invisible surroundings
and depth-separated expansion. The final policy is open. Avoid making global
neighbor displacement the default; 3D provides room but does not eliminate layout,
occlusion or computation. Preserve authored positions and canonical knowledge.

Keep operator execution order, reading/traversal order and before/after event
order distinct. Rotation can constrain a reading under a frame and is not always
semantic or always cosmetic. A static report may describe a dynamic event.
Motion/trail/history should support these distinctions as needed; the present
oscillation mechanism is not a full language meaning contract.

Technical IDs/revisions help locate saved objects. They do not implement semantic
referent continuity through change. Source/path/reference threads are a separate
future capability; identical configuration does not establish identical history.

## Engineering sequence and implementation boundaries

The user agreed to a progressive node presentation/interaction rework while
retaining canonical identity, relationship, storage, shared UI and history cores.
Authorized sequence:

1. Direct live world drafts, shared preview, temporary new work and reversible
   save lifecycle; update affected visuals without per-sample global rebuilds.
2. Common selectable Omnic frame/content targets and contextual controller paths.
3. Fixed-lattice placement/sweep/subset movement plus shared MS whole/region
   targeting and modifiable operator presets.
4. Actual-size readability calibration, framed composition/reuse, editable
   relationship targets and useful expansion as real writing needs emerge.

The first usable workbench must let the user construct the five examples and
immediately use them in an expression. General applicable behavior should be
inherited through registries/adapters, not handwritten per concept. This sequence
does not promise every item is implemented in the first PR. Keep the progress
section honest; never stop at preparatory docs while claiming the system works.

Existing code entry points:

| Area | Entry |
| --- | --- |
| Canonical graph and placements | `src/graph/structural.ts`; `src/graph/coordinates.ts` |
| Recipe and evaluation | `src/omnic/model.ts`; `registry.ts`; `evaluate.ts` |
| Composer draft/history | `src/omnic/Composer.tsx`; `draftHistory.ts`; `propertyAdapter.ts` |
| App creation/save integration | `src/App.tsx`; `src/omnic/document.ts` |
| Derived glyph representation | `src/omnic/presentation.ts`; `svg.ts` |
| World renderer and hit testing | `src/SpatialWorkspace.tsx`; `src/textScene.ts`; `src/visualScene.ts` |
| MS and its geometry | `src/appearance/VisualSelector.tsx`; `visualSelection.ts`; `selectionGeometry.ts` |
| Function/property inheritance | `src/properties/function.ts`; `src/omnic/omnic.function.ts`; [shared properties](SHARED_PROPERTIES.md) |
| Workspace, pins and storage | `src/omnic/workspace.ts`; `revisions.ts`; `workspaceStorage.ts` |

At the starting source `0706d642` (2026-10-28), Stage 1/2 and the Member/Part
construction extension exist. They include highlighting, scoped rotation/snaps
and copied operation tools. They do not implement direct live world drafts,
fixed-lattice mouse construction, exact MS region editing, the circular dial
interface, fixed reading size or full frame interpretation. The world consumes
saved definitions as derived images. Scoped frame records are metadata, not the
proposed visible node-frame system. Binder operators are presently annotations.

## Progress and handoff

Every preview delivery includes the implemented feature/function inventory, entry
paths, usage steps, material limits and verification status, with a link to the
complete maintained capability guide. Explain both newly changed and already
available functions relevant to the workflow, and clearly identify planned work.
The user explicitly requested this to stay aligned; links alone do not satisfy it.

- Mental-model synthesis and onboarding links: recorded in this change.
- First implementation slice: live world draft preview and temporary construction
  lifecycle are implemented for review in this change. Opening without a selection
  starts/resumes a single-dot unsaved draft; Save shared creates the object. Selected
  objects and transitive live uses preview without canonical commits; pins remain
  frozen. Close restores saved rendering and keeps recoverable drafts. The shared
  32-source/256px world budget, 12fps input cap and 4ms dependent batches apply. Type,
  capability/property and self-contained preview checks pass; browser acceptance
  and responsiveness remain user-tested. The first slice originally exposed composer-only editing; the Atomnic extension below now adds direct construction gestures to the edited world image.
  See [actual behavior and limits](OMNIC_COMPOSER.md#live-world-drafts-first-workbench-slice-2026-10-28).
- Atomnic construction extension (2026-10-28): authored dot/group recipes have
  click/sweep placement, slot ghost/grid, Micro/Macro multi-selection, rigid movement,
  grouping, deletion, shared-property matching with include/exclude and hover,
  fractional highlights, retained settings and two-phase pivot/drag rotation.
  Top/clockwise base-six refinement uses shared halving math; all shared numeric
  range controls expose an interval-halving picker. Selection timelines reuse the
  shared transient timeline mechanism; geometry uses existing draft action history.
  Free and the first touching-lattice constraint profile are explicit. The profile
  couples pitch to imprint diameter, enforces slot membership/non-overlap, and
  rejects illegal rigid transformations. It is not a full physical simulator.
  Type/property/capability checks, the existing model suite and self-contained
  preview build pass (2.88MB); browser acceptance remains pending.
  See [the actual controls and limits](OMNIC_COMPOSER.md#atomnic-construction).
- Remaining work: arbitrary MS clipping/region tools inside dots, deeper pattern
  descriptors, authored array/reference conversion, the broader frame/dial/node
  model, richer physical profiles, full world-space radial boundary gestures and reading-size
  calibration. The current sector highlight is a geometry tool with no automatic
  semantic interpretation. Not all agreed future grammar is implemented.
- Verification: the user performs browser interaction/design testing. Run required
  focused static/build checks for a preview; do not add unsolicited browser suites,
  repeated profiling or speculative testing. A build does not establish smoothness.
- Publication: the user explicitly confirmed the standing baseline on 2026-10-28:
  push authorized changes to `OmnirORax/Omnia`, create/update the open PR, publish
  the self-contained visual artifact and provenance to `preview/githack`, and give
  a fresh commit-pinned GitHack link. Routine delivery needs no repeated permission
  question. Use an open PR from current master. The merged PR #35 is historical;
  do not keep pushing follow-up source into it. Preserve private Cloudflare Access
  and existing backend boundaries; a GitHack visual artifact does not deploy a
  cloud/AI backend or imply hosted cloud snapshot availability.


### Constraint audit after the progressive correction (2026-10-28)

The documented rules are requirements, not a claim of complete conformance.
Current Atomnic right-click configuration is progressive, and action/property
registration, numeric controls, draft history and render budgets reuse shared
systems. Browser/performance acceptance is user-owned; no browser suite or trace
was run for these deliveries.

Known gaps: Shift+Atomnic shortcuts still use the generic coupled MC fallback,
which exposes the broader Omnic input set rather than the selected operation's
progressive fields. Micro/Macro scopes cover a unit and nearest authored group,
not the complete universal contextual hierarchy. Property matching covers authored
dot descriptors, not full integration with MS geometry/region selection. These
must not be described as finished universal inheritance. Fix at shared applicability,
configuration and hierarchy boundaries; do not add private Shift listeners or
independent settings stores. The initial full-grid/permanent-toolbar delivery
violated compactness and progressive interaction; its right-click path was corrected.


### Reuse decision and eraser extension

Keep the procedural engine and reusable capabilities: dot/group/line/ring and
chain/radial generation, references/revision pins, count/size/rotation/fill/marking,
selection/count inspection/connections, bounded motion, copied operation tools,
property adapters, history, library/storage and renderers. Retire duplicate UI only
when its contextual replacement covers its behavior. In particular, Generator
controls still handles generated arrays/references that Atomnic cannot directly
manipulate. Different interfaces do not create different concept identities.

Erase adds a pointer tool using the same removal transaction as selected deletion.
It sweeps whole authored units (Micro) or their nearest groups (Macro), accepts
one edit on release and reverts an active stroke on cancel. It does not invent
region-carving semantics. The user withdrew the additional operator-menu request after clarification;
this extension delivers Eraser only. Existing reusable operators stay available
through their current routes. Do not infer a broader operator rollout or invent
settled frame/binder/dial semantics from the earlier illustrative list.
