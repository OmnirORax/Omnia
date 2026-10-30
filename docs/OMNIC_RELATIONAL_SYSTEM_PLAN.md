# Omnic mathematical relationships: living master plan

Status: working design, revised through experiments. Updated 2026-10-29.

## Current architectural correction: references supply measurements (2026-10-30)

This section supersedes older assumptions that Self means no reference, that
selecting another object automatically constrains the editing interval, or that
pivot/origin needs a separate DOF interaction.

A reference is a source of meaningful measurements, including Self. A measurement
can supply a step distance, a limit, an anchor, a significant threshold or an exact
match. Selecting its source and choosing its use are independent decisions. For
example, Position can use Self width, Self height or another object's compatible
extent as a step distance. Width is not assumed to be the correct choice for every
movement; the measurement must be identifiable and configurable. This is one
example of the general contract, not a special Position snapping feature.

Target shared contract (implementation status below):

- Reference source: Self, another authored target, or Environment. Self is an
  explicit source resolved against the active owner, not deletion of a choice.
- Measurement feature: stable identity, quantity/unit, coordinate frame, evaluated
  value and owner. Geometry adapters expose applicable measures and significant
  thresholds through capabilities, without per-preset editor implementations.
- Measurement use: anchor, step, lower/upper limit, threshold or match. Uses remain
  separate from source selection and from the mathematical generator. A source may
  support multiple uses and multiple DOFs; quantities require compatible units and
  an explicit conversion/response adapter where applicable.
- Rule: transforms the selected measure (fractions, multiples, halving, etc.).
  The math dial configures this; execution surfaces consume its generated states.
- Constraints and thresholds: valid significant states survive fractionalization;
  hard constraints can exclude them. Context boundaries become limits only when
  configured for that use. Never promote arbitrary numeric presets to semantic
  thresholds merely because they are present in the old registry.
- Evaluation lifetime: gesture previews use a stable source snapshot, especially
  for Self, so the preview does not change its own step underneath the cursor.
  Refresh on a new operation/external edit. Durable dependency binding is separate
  from a one-time calculation and must define feedback/cycle handling explicitly.

Implementation sequence:

1. Introduce the portable measurement/source/use contracts and a shared resolver;
   extend the existing evaluated geometry adapter rather than creating another
   object inventory. Include Self in the same path as external sources.
2. Route current reference selection through that context; separate anchor/step/
   limits and replace implicit bounds. Keep Q spatial selection, compact contextual
   controls, existing setters/history and existing owner identity.
3. Merge domain/reference thresholds into shared field generation, with stable
   provenance and deduplication. Test invariant preservation across rules, units,
   Self/external sources, constraints and source refresh.
4. Connect existing Position and Rotation execution to the same prepared context;
   extend scalar editors by capability. Prove Self/external extent-driven steps
   before adding more geometry adapters. No new behavior outside Composer.
5. Migrate legacy pivot/snap configuration into reference relations, then extend
   spatial fields and feature selection. Future adapters inherit the same resolver,
   rules, threshold handling, projection selection and preview/commit contract.

Implemented first pipeline slice (browser acceptance pending): Self resolves through
fieldReferenceFor like external sources; picking Self retains its identity.
Coordinate sources supply centre/boundary thresholds and default intervals. Shared
fieldLimits applies overridable defaults under hard domain bounds; DofStateField
and direct Position field preparation both use it. Shared generation preserves
valid declared thresholds across mathematical rules. Cyclic adapters declare
quarter-turn axes; opacity declares transparent/opaque states. Arbitrary old
numeric presets are not imported as semantic thresholds. Future numeric adapters
inherit the merge/filter behavior, and may declare their own significant states.

The existing DOF radial → Q reference → field workflow remains; selecting a new
source resets previous working limits while retaining the rule. Refine either
limit using generated values/thresholds via the slider ends or ⊢/⊣ in the mode
configuration radial. Limit configuration changes working settings, not geometry;
Enter/close returns to execution. Reset restores the reference defaults. Existing
unconfigured direct dragging remains free; retained single-target Position fields
consume the shared context. Self/reference geometry is evaluated from committed
geometry, not hover samples.

Remaining after the measured-use implementation below: full stable operation
snapshots across repeated commits and broader evaluated matching adapters,
arbitrary frames/features, multi-target fields, persistent bindings and migration
of legacy pivot/snap settings. Do not describe these as delivered. This slice
retains reference-context controls and existing UI rather than inventing a wizard.

## Measured-reference use implementation (2026-10-30)

Source, measurement and use now have separate shared contracts in referenceUse.ts.
The existing OperationReferenceScope retains source identity across a target's
DOFs and independent relation settings per consumer. referenceMeasures.ts derives
compatible features from the existing evaluated geometry/registered parameters,
not preset-specific editors. Self and external sources share this adapter.

Left-click ⟴ retains Q/MS source picking. Right-click ⟴ opens compact Bounds/Step/
Match, measurement and ×/÷ configuration. The header shows the selected use. Bounds
uses reference intervals; Step uses the chosen magnitude without source bounds;
Match exposes exactly the derived value. Ratios are numerator/divisor through the
existing mathematical dial. No configuration click mutates authored geometry.
Shared createReferenceField serves numeric editors, cyclic wheels and prepared
single-target Position movement. Exact matches are not required to occur in an old
generated sequence. Hard bounds, working limits, units, integrality and setters
still govern legality. Coordinate ratios precede authored-frame conversion.

Several consumers can derive from one source feature; changing that committed
source refreshes their editing contexts. This is not durable geometry binding:
previously committed consumer geometry is unchanged until execution. Settings are
transient to the Composer session. Persistent dependencies/cycles, arbitrary frames,
symbolic equations and multi-target spatial fields remain future work. Unsupported
measurement choices remain explicit/unavailable rather than silently using bounds.
Ordinary numeric operations without a measured geometry adapter retain raw editing.

Browser acceptance pending: position step = another line's length, half-length
steps, another DOF matched to the same source length, Self width/height, source
refresh, independent bounds and direct gesture/slider parity. Model tests cover
these derivations plus incompatible units, exact/cyclic matching and future integer
domains. No browser suite is run; local gates precede source delivery.

## Combined Position implementation (2026-10-30)

Position is now the default composed-vector editor entry. Registered input vector
metadata groups scalar capabilities in targetEditorDegrees; targetDegrees and the
underlying stored coordinates remain intact. Existing action adjusters do not
swallow vector axes in this editor projection. Shared vectorMatchCandidate composes
scalar measured-reference conversions, then validates the tuple atomically.
writeTargetDegree accepts validated component patches and writes the tuple through
one recipe transaction. The existing numeric preview session is generalized with
an equality predicate so vectors inherit preview/restore/commit behavior.

Flow: right-click target → Position → ⟴ reference → hover ◎ Centre → click/Enter.
Both coordinates preview/commit together. Optional X/Y open the existing scalar
editors, preserving the companion coordinate. Centre matching uses visual bounds
and per-axis authored-frame offsets, including asymmetric groups. Vector metadata
supplies match labels/symbols; future components reuse the same tuple engine.

Current vector execution is joint centre Match, not a full joint spatial field.
Bounds/step editing is still available per optional axis. Collective multi-target
centring, arbitrary frames/features and durable bindings remain pending. Local
regressions cover atomicity, centring, source preservation, session restoration,
optional-axis patches and future three-component vectors. Browser confirmation
remains with the user; no browser suite run.

## Accepted baseline and sources

The accepted implementation baseline is merged PR #40, commit
817f0fdb9465535cc1a75c49682c04ba36fa7848. It retains the shared Composer number
dial, scoped rollout, normal property owners and MC navigation. The user confirmed
raw-number editing as the completed initial step; interactive acceptance still
belongs to the user for future changes.

PR #41 was explicitly discarded in full. Its manual reference dropdown workflow,
recipe extension and auxiliary popup changes are absent from this baseline.
Do not silently recover its implementation as an accepted foundation.

The [cleaned exploration](omnic/RELATIONAL_SYSTEM_EXPLORATION.md) preserves the
source discussion. It contains suggestions, questions and examples; explicit user
corrections and experimental findings govern decisions. Existing language meaning
and implementation boundaries remain in OMNIC_ALIGNMENT_AUDIT.md and
OMNIC_WORKBENCH_MODEL.md.

## Destination and current constraints

Build one upstream system shared by all applicable DOFs and operation entry paths:

Objects + DOFs + references + mathematical configuration + constraints
→ valid candidate configurations → contextual interaction → preview → commit.
Persistent relationships additionally maintain their dependencies.

The architecture is global; initial implementation/refinement stays inside Omnic
Composer. Dragging one object through another is one interaction example, not the
system boundary. Count, size, rotation, position, spacing, fill and future freedoms
use the same applicable mechanisms through actual capabilities/adapters.

Confirmed constraints:

- Reuse the property/function registry, setters, action routing, MC/MS, rendering,
  state owners, history and persistence. Introduce no competing property inventory.
- ⠒❉ is the mathematical number/control interface, including configuration of
  rules governing editing: increments, halving, doubling, or doubling every N
  steps. The dial chooses the rule and its parameters, following its existing
  configurable-mode interaction. Shared code implements/evaluates the mathematics
  and applies it through existing setters. “Leave math to the dial” describes
  where the user configures it; it does not assign coding to the user or eliminate
  the mathematical engine. Keep one shared rule representation/evaluator and no
  competing slider-rule settings. Existing numeral/recursion semantics remain
  unchanged unless deliberately revised. Preserve exact entry/fractional values.
- Keep UI compact, contextual and radial; derive applicable controls on demand.
  A permanent/manual inventory of references and operations is not the intended UX.
- UI direction: use the minimum text needed for clear meaning. Retain short
  icon-plus-label controls where an icon is ambiguous, e.g. ⟴ Reference. Remove
  redundant captions, repeated headings and instruction paragraphs; put secondary
  explanations in tooltips and accessible labels. Icon-only is a longer-term
  direction, not a reason to sacrifice clarity now. Keep exact-value entry when
  needed. Apply this to experiments as well as final surfaces.
- Reference/target symbol: ⟴. A reference may contextualize several DOFs while
  individual DOFs can independently use, override or ignore relationships.
- Separate establishing a reference, committing a one-time value and locking a
  persistent constraint. Discovery alone does not establish a binding.
- Derivations preserve the measured quantity: half an area differs from half a
  radius. Candidate geometry accounts for the manipulated object's extent too.
- Preserve realized geometry when a relationship is disabled; return to self-based
  manipulation. Missing references/conflicts must remain explicit and repairable.
- Eight partitions and specific gestures are examples/provisional conventions.
  Keep generators, base/depth/index, domains and reference selection extensible.
- Action/candidate ranking, preference learning and opaque intent prediction are
  excluded. Validity filtering and deliberate contextual selection are necessary.
- Bound interactive work. Cache relevant structure/geometry; no background polling,
  per-pointer full-app discovery, repeated layout scans or unbounded candidate lists.

## Shared modules and their responsibilities

This is a responsibility map, not a mandate to implement every module upfront.
Each experiment adds only what is needed along the shared path.

| Module | Shared responsibility | Existing boundary to reuse | Status |
| --- | --- | --- | --- |
| DOFs and domains | Actual writable values, units, measurements, capabilities and limits | Property/function registry, editableDegrees, target setters | Existing; extend as experiments require |
| Operation context | Target, DOF, scope, reference, mathematical configuration and established relationships, independent of input gesture | Shared actions/context targets/property invocation | Proposed; insertion point needs source audit |
| Reference resolution | Resolve self, parent, another object, selection/group or frame; expose applicable features and missing identities | Existing scene/recipe identities and geometry adapters | Pending; #41 approach discarded |
| Mathematical representation/rules | Dial configuration selects editing rules/parameters; shared code evaluates generators and indexed candidates, retaining derivations | ⠒❉ pure model and existing property editors | Raw-number foundation exists; shared editing-rule integration is experimental |
| Validity and thresholds | Domains, geometric legality, hard limits, soft stopping points and stable snap sensitivity | Existing numeric ranges, legality checks and render budgets | Existing pieces; universal integration pending |
| Contextual discovery | Find applicable references/features from current scope and operation, including crossing between samples | Existing selection/hit-testing/geometry | Pending; not restricted to dragging |
| Interaction projection | Small relevant cues/radials and mathematical refinement across entry paths | Shared MC, RadialMenu, active cursor and ownership | Shared infrastructure exists; relational UX pending |
| Preview and commit | Evaluate candidates in actual Omnium, cancel reversibly, commit once through the owner | Composer/world preview and chronological history | Existing; relational integration pending |
| Dependency maintenance | Persistent derivations, stable addresses, deterministic updates, cycle/conflict handling and safe detachment | Recipe/workspace validation/evaluation/history | Pending; context alone must not imply locking |

Adapters describe unique capabilities/measurements and apply values. Shared
behavior must be inherited through these boundaries rather than reimplemented
for every preset, DOF or gesture. An existing API is reused only where its actual
contract fits; do not stretch it into a misleading parallel system.

## Iteration loop

1. Select one small experimental question against this map. State the hypothesis,
   affected modules, reused boundary, exact user entry paths and visible result.
2. Implement a bounded, reversible experiment in the shared path. Include a real
   Composer use and a second applicable DOF or entry path where useful to verify
   inheritance. A disconnected model demonstration is insufficient for UX review.
3. Run appropriate focused checks and the required local test/build/backend gate
   before publication. Publish one reviewable preview; do not wait for remote CI.
4. The user exercises it. Record observed behavior and friction separately from
   model/build success. Do not infer interaction acceptance from automated checks.
5. Revise, retain, narrow or discard the experiment. Update this plan and the
   capability guide before broadening the behavior or moving to the next module.

A module's first experiment is not a finalized global interaction contract.
Keep the stable shared boundary where it proves useful; replace an experiment
that disproves its assumptions. Avoid accumulating incompatible legacy paths.

## Experiment record

For every experiment record:

- ID, question/hypothesis and intended user outcome.
- Shared modules touched and existing mechanisms reused.
- Scope: DOFs, reference types, entry paths and explicit exclusions.
- PR/source/preview, local check results and how the user can exercise it.
- User feedback, responsiveness observations and unverified behavior.
- Decision: proposed / testing / accepted / revise / discarded.
- What the finding changes in this master plan and the next experimental question.

| Experiment | Finding/decision | Evidence |
| --- | --- | --- |
| Raw numeric ⠒❉ integration | Accepted initial step; keep Composer-only rollout and current signed/raw scope | PR #40; user: “1 already fixed” |
| Manual object/per-DOF reference form | Discarded in full; reference discovery and contextual interaction need global design | Closed, unmerged PR #41; explicit user rollback request |
| E01: dial-configured increment rule | Implemented for testing; user acceptance pending. Shared rule context contains anchor, signed index and rule/amount; preset and target numeric editors consume it through existing setters. Full operation context/reference integration remains pending. | Current branch; see capability omnic.editing-rules |
| E02: reference-measurement operation context | Manual Reference → Rule → Match interaction rejected and removed. Pure measurement/candidate infrastructure retained. | User feedback; capability omnic.operation-context |
| E03: activate DOF → select generated state | Rotation trial; common interaction retained and generalized by E04. Browser acceptance pending. | Current branch; capability omnic.dof-state-wheel |
| E04: constraint/value field across numeric DOFs | Shared generator/constraint machinery retained; its execution panel superseded by E05. | Current branch; capability omnic.dof-state-wheel |
| E05: rule maker versus value slider | Current correction: ⠒❉ configures the rule; shared arrow/end-bar slider traverses its generated values. Limits belong at the ends. Standalone ½ picker retired. | User clarification; current branch |

## Next experimental decision

E05 below records the latest rule-maker/value-slider correction; E04 supplies its shared generator/constraints. Test representative
domains through the same machinery; do not implement separate workflows per DOF. Do not add more automatic invitations
or revive mandatory manual Reference → Rule → Match steps.

The shared operation/reference/rule/preview architecture remains the destination.
A cyclic rotation slice is a test of that structure, not the definition of every
DOF. Each domain must declare how its valid states are generated and rendered.
Math-dial numeral encoding remains separate from the editing rule being configured.

## Open decisions

Exact acceptance/alternative gestures; continuous versus discrete exploration;
Math Dial rule configuration and integration interfaces; precise step/anchor semantics; soft-limit override; persistent
locking interaction; visibility of reference/DOF state; feature applicability and
coordinate transforms for supported renderers. Resolve these experimentally,
without inventing universal semantics from examples.


## E01 — first bounded editing-rule experiment

Hypothesis: one editing-rule evaluation can govern different DOFs through the
shared numeric editor, configured in the dial instead of a separate jump field.
Value mode retains the existing numeral semantics. Increment mode evaluates
`anchor + selected signed numeral * amount` from a frozen anchor, using the same
pure evaluator for preview and commitment. The existing Composer working-step
scope retains rule choice/amount per property for the session. No document schema
or reference dropdowns from PR #41 are reintroduced. The amount is edited through
a child math dial; metadata resolution comes from the active target adapter.

User entry paths: target DOF and preset DOF editors. Right-click the numeric DOF,
or use Rule within its number dial. Choose Value or Step, then configure Amount
when Step is selected. Text is limited to those short labels and values; tooltips
explain formulas. Configuration does not edit the object. Hover previews actual
results; paint commits through existing setters/history. Invalid results remain
unavailable. Clear marks, external owner changes, exact entry, rule changes and
reopening establish a new anchor without accumulating preview drift.

Tests cover position and size, signed indices, unchanged unrelated targets,
preview cancellation and property Undo/Redo. Actual compactness and interaction
acceptance remain the user's test. Do not broaden this experiment automatically.

Explicit limits: session configuration rather than saved rule constraints; only
Value/Increment; no rule consumption in direct dragging/commands yet; no reference
discovery, persistence dependencies or ranking. General operation-context wiring,
reference resolution and more rule families remain separate experimental work.


## Alignment audit against latest cleaned source

- Aligned E01 subset: one additive generator across actual numeric DOFs, dial
  configuration backed by shared arithmetic, domain checks, real outcome preview,
  existing setters/history and compact explicit controls.
- Pending: reference/feature-derived candidates; finite target/container geometry;
  universal operation-context entry paths; contextual discovery; stable snap
  activation; geometric/perceptual/representational/user/context limits; persisted
  derivations and dependency maintenance preserving established constraints.
- Explicit configuration (current Rule menu) is level 3 of the source interaction
  model. The final ordinary workflow should expose immediate/contextual freedoms
  through geometry and current action. A growing list of configurable operations
  alone would miss the intended direction.
- Universal architecture remains gesture-independent. Positioning inside a circle
  is an experimental validation example, not a specialized system definition.
- Experimental gesture proposals and the source's ranking passages do not override
  earlier explicit user corrections or constitute accepted implementation results.

The source/alignment review itself introduced no runtime changes; E02 below is the subsequent authorized experiment.


## E02 — reference-measurement operation context (superseded UI)

The following records the original experiment. Its manual numeric Reference/Match
UI has been removed after user rejection; pure measurement models remain. E03
below records the current interaction. Do not implement this older workflow again.

Hypothesis: a shared operation context can connect the same target/property owner
to actual reference measurements and a reproducible mathematical candidate across
different DOFs, without reference forms or per-preset arithmetic.

`properties/operationContext.ts` defines renderer-independent target/property
addresses plus state-owner identity, scope, domain, measured quantity/unit, reference identity/measurement
and transient binding mode. Candidates retain that context and a Match rule.
`omnic/operationContext.ts` adapts existing editableDegrees/setters, input
measurement metadata and evaluated geometry. The current declarations cover
center X/Y, circle radius and line length. Radius and area are not interchangeable;
size/length aliases preserve their actual renderer measurement.

Committed evaluation is shared between rendering and one cached geometry snapshot.
Discovery considers compatible overlapping component bounds when a DOF is active,
independently of whether it was reached from a preset or stationary target. This
is relevance, not an assertion of containment or user intent. Accepting the small
⟴ Reference cue retains the component identity in session context only. Other
DOFs on that component reuse it. A retained reference is preserved even when a
closer alternative appears or the object becomes unavailable. Clearing preserves
realized geometry. No recipe relation schema from rejected PR #41 is restored.

With a valid active measurement, the existing dial Rule radial offers ≡ Match.
Hover previews the actual result and leaving cancels. Clicking re-evaluates the
reference against the latest committed recipe and commits through the existing
setter/history. The UI performs no feature lookup or arithmetic of its own.
Bounded probes account for writable local coordinates versus evaluated parent/
transform coordinates, and the resulting render must satisfy the measurement.
Reference choice and one-time Match remain independent; no persistent lock.

Acceptance to test: two overlapping lines with different lengths; retain reference
through Length → Position X/Y; distinguish cue acceptance from Match preview and
commit; cancel/Undo/Redo; disable or remove the reference. Model tests additionally
exercise transformed circle radius and local parent-coordinate conversion.

Restrictions are deliberate for this experiment: one authored component, declared
quantities only, overlapping-bounds discovery, static scenes and at most 256
evaluated roles for calibration. Probes/final results must pass existing setters,
domain/legality and floating-point measurement verification. Unsupported/singular
responses produce no Match. Snapshot/probe work does not run on pointer movement.

Not delivered: persistent rule storage/dependency evaluation; aggregate/external
references; arbitrary feature inference; direct-drag/MC-command consumers; magnetic
snaps, soft/perceptual thresholds, additional generators or alternative UI. The
shared pure contract is the extension point for those future experiments. Do not
claim full global integration or promote E02 to accepted before user feedback.


## E03 — DOF activation, generated states and cursor configuration

Latest confirmed interaction replaces the intervening suggestions, Space-acceptance
and right-click Dial/Match-menu proposals. Users already know their active DOF.
Activate it directly (R or Rotation): immediately show the states generated by its
current mode. Self is the default reference. For cyclic rotation, north is the
origin and positive steps proceed clockwise; eight equal states are explicitly
shown as **✣ Symmetry · 2³**, not just 8. Hover/focus previews geometry; left-click
commits the state. The state selector remains available for further choices.

The active DOF, mode and relation reference are compact cursor indicators. Hold
Alt to park them, click one, release Alt and configure; settings remain open until
dismissed. Right-clicking the mode chooses another rule. Left-clicking it edits
its variables, and clicking 2³ directly opens the mathematical dial for state
count. The current number dial produces numeric parameters; it is not a general
expression AST. Powers of two are displayed as 2 with a superscript exponent.

First modes: symmetry (`i / count`), halving (`0, 1/2, 1/4, ...`) and + Step, the
initial configurable rule (`i * step` modulo period). The latter is not arbitrary
equation authoring. All share one pure generator and domain validation. Metadata
on actual registered inputs declares a cyclic period and the scalar representing
north; no list of preset IDs chooses the editor. Target/preset Rotation and R use
the same DegreeValueEditor/DofStateWheel and existing writes/preview/history.
Other numeric inputs retain the existing math editor until their domain adapters
are designed. No universal semantics are guessed for them.

Reference configuration offers Self or ⨮ Match, then an actual geometry click.
The reference-picking bridge reuses the Composer/world-preview click adapter;
no reference dropdown, hover-time discovery or background scanning. Initial
reference scope is a single authored target and compatible declared orientation.
Choosing context preserves geometry; choosing a state later applies its offset.
No persistent dependency. Missing references remain unavailable and can be cleared.
Scenes with enabled rotation/oscillation operators are conservatively unavailable
for reference matching until evaluated orientation measurement is implemented.

Rendering/interaction limits: 64 symmetry/step alternatives, 8 halving alternatives
so dense fractions remain distinguishable. Angular spacing sizes marks; rule
changes compute layout, pointer movement only previews a changed alternative.
R now edits the selected authored orientation; the old pivot/orbit path remains
through the separate Atomnic Step action. Multi-target common Rotation applies
one scalar to those owners; multi-target reference picking is pending.

Acceptance experiment: create two differently oriented lines, select one and R;
preview north/south and commit/Undo; configure 2³ and modes; park indicators with
Alt; pick the other line as reference and choose its zero-offset state; clear
reference. Repeat Rotation through preset/target DOFs. Test popup lifetime,
Esc/outside cancellation and cursor/native-field behavior. Model checks validate
generated states and actual north/south rendering, but do not establish usability.

Long-term: active DOF → reference/domain → configurable mathematical generator
→ selectable valid states → actual preview → explicit commit, shared across
appropriate DOFs and input paths. Persistent derivations, rules/equations and
richer geometric domains remain later iterations, not hidden assumptions here.


E03 first user feedback: R was intercepted by a saved node-button shortcut, and
clicking a preview did not reliably apply it. The follow-up makes arbitrary saved
keyboard residents yield to available scoped features through shared arbitration;
it also captures a wheel preview before native focus/blur can clear hover. Added
model regressions exercise both failure paths. Both require user retest; neither
is recorded as browser-accepted from local checks.


Further E03 user feedback: Alt appeared conditional; the opener still sometimes
activated Dial size; a blinking caret appeared during Atomnic pen and object drag.
The follow-up removes fresh zone/focus gates from explicit Alt parking, captures
settings-control ownership from the physical press path independently of release
timing, and styles caret paint off non-text surfaces while restoring native fields.
These changes await user confirmation; they add no pointer-frame discovery.


## E04 — universal field of available states (latest direction)

User clarification: count has no physical axis; radial positions can address its
values. Spatial editing is a constraint field. First constrain where a DOF may go;
its field updates available states, and hovering highlights the nearest state.
This interaction is universal; manifestations differ. Preview is inherited from
existing setters/rendering, rather than written per DOF. Most variation is domain,
quantity and constraint data—not custom feature UI. Do not return to implementing
Size, then Position, then Count as independent features.

One pure `properties/stateField.ts` pipeline now generates, filters and projects a
bounded set of states; its projection-independent nearest-state query only consumes
prepared candidates. Domains declare numeric bounds/integer validity/resolution,
optional cyclic period/north, quantity/unit and projection. Configuration carries
mode, divisions, step, reference and working limits. Each candidate retains its
source rule/reference/index and parameters; the exact reference is an additional
valid landmark when needed. No durable binding is implied.

`omnic/stateFieldAdapter.ts` derives these capabilities from existing registered
Parameter inputs. Coordinates project X/Y axes, lengths a magnitude axis, cyclic
values actual directions, and other quantities radial addresses. This is one
projection adapter per domain manifestation, with no preset-ID switches.
`DofStateField` supplies the same nearest highlight, temporary preview, click
capture, commit, cancellation, mode variables, limits and Alt cursor indicators.
It replaces the rotation-only editor and is also projected by the common Composer
numeric PropertyEditor path. Nonnumeric controls/outside-Composer editors retain
their previous behavior.

Current generators: partitions across the constrained interval (Symmetry for a
cycle), halving the reference, and signed centered steps around it. Integers default
to unit-step exploration; other domains default to partitions. Interval partitions
include both endpoints, while cyclic partitions do not duplicate the seam. An
integer candidate must be integral; fractional candidates are excluded rather than
rounded. Count is divisions, not a universal claim of exactly N displayed states:
constraints remove states, intervals add endpoints, and a reference may add a
landmark. Working limits are mathematical-dial parameters bounded by actual hard
input domains. Empty/conflicting fields are explicit and cannot apply; limits can
be reset. Exact continuous/fractional owner entry remains available under '='.
The older E01 Value/Increment menu is superseded by the shared field Step rule;
its pure arithmetic helpers remain groundwork.

Target/preset operation context prepares candidates through the existing legal
setter once when configuration/committed context changes. Preview motion only
queries those candidates, then uses the same existing temporary setter/render path.
Generic progressive numeric fields inherit numeric-domain constraints and retain
normal owner validation. There are no per-pointer scene scans, background polling,
new value/history owners or per-DOF preview implementations. At most 64 divisions
(65 interval endpoints plus an optional reference) or 8 halving samples bound work.

Numeric references use actual shared property/measurement aliases and units.
This generalizes the earlier orientation-only picker to count, opacity, coordinates
and size/radius/length without copied reference UIs. Different measured quantities
remain incompatible even if they share a property alias. Picking only chooses
context. Partitions use the interval; Halving/Step derive from the reference;
the exact reference is offered when valid. Initial references remain authored,
single-target and conservatively unavailable in active rotation/oscillation scenes.

Implemented constraint sources: hard/working numeric limits, integrality and the
existing target owner's legality. General containment/collision solvers, arbitrary
2D/vector/product fields, paths, symbolic equations and persistent dependencies
remain pending. The architecture can consume new supplied constraints; it does not
infer missing geometry semantics or finalize universal defaults from examples.
Self references use the opening value (north for cyclic domains); external owner
changes refresh the anchor, while ordinary commits avoid moving the candidate
field underneath the pointer.

Review: exercise Count, Size/Length, Opacity, Rotation, Position X/Y and a progressive
numeric field; constrain intervals, preview and commit/Undo, configure modes, pick
compatible/incompatible references and use exact entry. Tests validate those shared
paths and prove picking does not rerun validation, but browser acceptance and
responsiveness still belong to the user.

Long-term destination remains one declarative system: DOF + reference + domain +
mathematical rule + constraints → valid-state field → projection → nearest-state
preview → explicit commitment, optionally followed by durable dependency binding.
New geometry contributes domains/measurements/constraints, not another interaction.


## E05 — rule maker versus value slider (latest correction)

The user clarified that the dial is the rule maker, not the surface used to drag
through object values. The value slider is just a value slider. Its minimum/maximum
controls belong at its ends, as shown by the user's end-bar/double-arrow reference.
The older standalone halving slider/picker was a misunderstanding and must stop
replacing that slider. This supersedes the E03/E04 selectable value-panel UI;
the underlying shared rule/domain/constraint engine remains.

DofStateField now projects the existing RangeControl as the execution surface for
all numeric Composer DOFs. A sorted, bounded sequence of generated values is
prepared once. Slider movement addresses sequence indices; arrows/wheel/keyboard
traverse adjacent values, including nonuniform halving/exponential sequences.
It never invents linearly interpolated values between them. Dragging previews
through the owner, release commits, and cancellation restores the original value.
There is no DOF-specific slider or property preview implementation.

The math dial configures only rules/variables/bounds. Click a mode expression to
configure its number. Right-click either slider end bar to configure that limit;
limits are no longer buried in a separate mode-menu branch. A bound editor can
reset working limits. The end caps show constraints, which need not themselves be
generated values; clicking a cap selects the first/last available value. Native
track value entry, when requested, accepts an exact generated member; off-rule
values are rejected instead of silently changing the rule or the object.

The standalone ½ button and popup have been removed from shared RangeControl.
Halving remains a mathematical rule. Existing geometric pivot/axis halving prompts
are separate and retained. Non-Composer sliders retain ordinary numeric behavior;
no new math editor is imposed outside Composer. Alt indicators, reference context,
owner legality and previous opening-press/caret fixes remain shared infrastructure.

Acceptance: configure a halving rule, close configuration and traverse it with the
slider; verify only generated values appear. Move minimum/maximum through the end
controls; verify rule configuration alone preserves geometry. Drag/release/Undo,
drag/Esc, arrows, keyboard and wheel on Count/Size/Opacity/Rotation must share the
same contract. This is awaiting user testing; model checks do not prove visual feel.


## E06: DOF information, gestures and reference selection

Latest user correction: information is always visible at the top of Composer and clickable; it also appears near the cursor during DOF-changing actions. A shared DofInformation descriptor supplies both views, with the cursor echo noninteractive. This supersedes hidden-by-default settings and DOF Alt parking from earlier experiments. MB3 remains a catalog-backed, rebindable settings-radial toggle. No parallel value/rule editor or settings store is introduced.

Flow: drag detects Position, or left-hold just beyond a selected object's boundary activates registered Rotation. Existing configured movement stays usable; top controls expose the current DOF, mode/expression and ⟴ reference. Self is default; coordinate inputs can select Environment or invoke MS for an authored reference boundary. MS requests preserve prior selection, reject unsupported references without editing it, and restore on cancellation/acceptance. The reference center and extents are read from canonical evaluated bounds and converted into the target's coordinate frame. Configuration preserves geometry. The shared slider executes generated values by drag/release or wheel; ⠒❉ remains the rule/variable maker.

Position gestures reuse prepared single-target coordinate fields when a rule/reference is retained. Without one, existing Free/Realistic movement remains. Multiple-target movement is unchanged. Boundary axes are landmarks, not containment constraints; arbitrary 2D/vector solvers, transformed/animated matching, persistent bindings and exact 3D MS features remain deferred. No new numerical editor is applied outside Composer.

The shared context guard now rejects unknown physical origins and context events retargeted onto a control absent from the original press path, regardless of the event's button representation. Explicit keyboard context remains supported; release-time menu activation stays separate from primary drawing/dragging. No timing suppression or withheld release is added.

Verification: local models cover press ownership, pointer binding/rebinding/surface priority, compatibility dispatch once, temporary MS restoration, canonical parent-space reference bounds, edge bands and shared generated-field projection. Required local model/build/backend gates precede the delivery push. Browser acceptance pending: verify top strip and gesture echo, end-to-end MS return, scrolling and repeated empty-space right-clicks without a spurious Dial size value field.


E06 presentation correction: the information strip exists only while a DOF is active. It uses icons/numeric expressions with descriptive tooltips and accessible labels; no inert default placeholder or visible text labels. The radar strip is inset inside its circular clipping boundary. The noninteractive cursor echo uses the same compact symbols.


DOF layout correction: base/exponent expressions render as one inline box even inside radial grid buttons. Mode/reference choices use icons and tooltip labels. Shared RangeControl readouts display at most six significant digits; exact numbers stay unchanged in owner state/native input and hover metadata. This is presentation only, with browser visual acceptance pending.


Shared popup overlap correction: ContextualMasterController retains the invoking data-ui-popup-boundary and inherited contextual ancestor refs. Opening/resize placement uses actual control bounds; if the child overlaps, it moves outward to the nearest separating edge and avoids older ancestors. Internal stage changes retain the external invocation boundary. Already separate positions are preserved. Explicitly anchored radial branches keep radialLayout placement. There are no per-DOF offsets or pointer-motion layout reads. The DOF strip and shared RangeControl declare compound boundaries; future contextual children inherit the placement contract automatically. Browser visual acceptance remains pending.


Latest E06 correction: remove the DOF-information cursor echo entirely, including its numeric-editor cursor zone plumbing; ordinary tool cursors remain. The active icon strip is the information location. A button-triggered editor must open below its actual button, not above/to its side: shared cursor tracking captures its bounds on activation before stage replacement, and shared popup placement centers the editor below it. Ancestor overlap may only move it further down in that column; explicit hover-branch radial anchors retain radial placement. Canvas/shortcut openings without a button keep cursor placement. Rule/reference settings and MS picking do not render the value slider alongside them; returning from configuration restores the numeric value editor. A readout such as 10.2949 is simply the current position value. These corrections supersede gesture-echo and lateral-separation descriptions above. Browser visual acceptance pending.


Active-edit sub-setters: right-click during a move/authored-rotation gesture or a held numeric-slider edit settles the current preview and summons the registered active DOF settings at the cursor. Mouse-only right-button chords while left remains held join the same secondary-release path, without duplicate activation. Use the shared ContextLayer dismissOutside capability for these settings: clicks outside registered popup interiors dismiss and consume that press, including outside controls/objects; MS retains priority. The requested settings view contains no companion value slider. Button-triggered settings still use below-button placement.


Rotation discoverability: hover the existing outer edge band of a selected target with a registered Rotation DOF to switch to the same Rotation tool cursor used during the gesture. Hover and press share prepared bounds/margin, with only enter/leave transitions changing React state. No separate rendered handle, cursor text echo, preset-specific hit zone or per-motion geometry discovery is introduced. Browser confirmation pending.




Reference entry correction: “MC” here meant the existing selector invoked by Q (selector.open). The mistaken MC selection list/request store/window-opening path is removed. The top ⟴ button invokes that same selector action directly; no reference options list or intermediate radial. Composer SVG primitives declare data-selection-boundary plus data-selection-id inside data-selection-scope, so ordinary Q can select authored Composer objects and reconnect boundaries after SVG replacement without crossing surfaces. A temporary reference request consumes the chosen object inside the current Composer: compatible other object sets the reference, the active object restores Self, empty Composer space selects Environment when supported. Acceptance/cancel restores previous selector selection/configuration. Configuration stays with the Q selector; no duplicate selector UI or hardcoded shortcut. Current authored/single-target/SVG reference limitations remain. Browser confirmation pending.


Actual rotation-edge correction: remove outsideBoundary and the 2–8 scene-unit/object-size activation margin. Rotation hover and primary press both use rotationEdgeHit over a prepared index of selected evaluated primitives. Exact segment/circle distances include stroke width and fill; visible ink stays a move grab, empty space near actual rims (including hollow inner rims) qualifies. Bounding boxes only accelerate the search and retain the existing pivot calculation; they never decide activation. The band is eight CSS pixels in the local Composer via its existing coordinate adapter; the world-preview adapter supplies local projected-plane pixel scale. Geometry/index preparation happens when the selected evaluated snapshot changes; pointer queries do no scene discovery or DOM measurement. Future rendered primitive kinds need their geometry adapter, not preset-specific rotation zones. Hover state clears on view changes. Model regressions cover slanted/circular edges, false box corners, interiors, overlap, hidden geometry and zoom scales. Browser acceptance pending.


Unselected hover correction: interaction previews must not require prior selection. Prepare rendered-geometry ownership and registered DOF capabilities per displayed snapshot; preview Move over applicable visible ink and Rotation near actual edges only when the target declares rotation. Hover never commits selection or geometry. An edge press on an unselected object selects the canonical authored owner and starts rotation in the same gesture; selected-group scope is preserved for its members. The common authored-node resolver is reused by reference measurements and hover discovery, including reused geometry. No per-preset hit handlers, per-motion registry discovery or new cursor renderer. Existing MS/Ctrl/Erase priority and geometry-only hit tolerance remain. Browser confirmation pending.


Scalar grab correction: geometry chooses the DOF/tool before a press; once grabbed, scalar value execution is a virtual slider in free space. Shared createValueScrub serves relative RangeControl/DOF-icon drags and Composer edge rotation. The first meaningful movement (three CSS pixels) locks its arbitrary axis for that gesture. Continuing along it increases, reversing decreases, perpendicular motion is ignored. Screen displacement traverses the prepared value sequence/bounds; it does not follow the shape or compute cursor angle about its center. Press/jitter leaves the value untouched; release commits once and cancellation restores via existing owners. Edge rotation uses the generic value gesture; obsolete shape-following center/field gesture state is removed. Explicit legacy Step/pivot rotation remains separate. Two-axis direct placement keeps its existing spatial translation behavior. No extra floating slider is introduced. Browser acceptance pending.


Latest Rotation correction: hovering actual edges shows the cue; one primary click selects its owner and opens the axis wheel on release, without editing the angle. Rotation is no longer a scene drag/scrub/orbit gesture. Shared DofStateField projects all declared cyclic domains through DofAxisWheel: hover previews generated states, click commits and stays open, leaving cancels preview, and the centre is neutral/drag-only. R and preset/target Rotation inherit the same metadata-driven projection. Reuse existing state-field generation, preview sessions, captured-click activation, setters/history, rule/⠒❉ configuration, Q references, shared dial scale/appearance and outside dismissal. No private rotation math or extra scalar bar. Scene scrub state and its virtual default span are removed; createValueScrub remains only for existing relative DOF-button sliders. Ordinary noncyclic numeric DOFs retain RangeControl. Explicit legacy Step/pivot remains separate. This supersedes earlier rotation-edge scrubbing descriptions. Browser confirmation pending.


Interaction experiment: geometry hover/edge tool activation is temporarily parked
behind HOVER_TOOL_DETECTION_ENABLED=false. Keep the adapter/tests intact for later
review; it is not part of the current user-facing entry path. Right-click target →
DOF is the explicit entry, with existing R and ordinary dragging retained. This
supersedes earlier hover activation guidance. Standalone DOF dials reveal immediate
category rows automatically; attachment follows actual parent-button centres and
edges rather than outer dial radii. Browser acceptance remains pending.
