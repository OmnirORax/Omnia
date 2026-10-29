# Omnic mathematical relationships: living master plan

Status: working design, revised through experiments. Updated 2026-10-29.

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
| E02: reference-measurement operation context | Implemented for testing, not accepted. Pure shared numeric context/candidate contract; committed-geometry adapter; session ⟴ context and contextual one-time Match through existing target/preset numeric editors. | Current branch; capability omnic.operation-context |

## Next experimental decision

E02 is now implemented for user testing (see its record below). Review its
reference/Match separation, quantities, scope and responsiveness before broadening
it. Value/Increment still use E01 self/previous-value semantics; only Match consumes
the retained reference in this experiment. The following audit is recorded as the
work leading to E02, not a mandate to repeat it:

Audit how current property edits and commands identify target, DOF and scope.
Locate the smallest shared insertion boundary for operation context and reference
resolution. Propose a small *usable* experiment there, including its interaction
entry paths, before introducing another reference UI or persistence schema.

E01 exercises only the additive-generator integration and explicit-control layer.
It is implemented for user testing, not accepted as the final workflow. Do not
continue by merely adding more rule buttons. After its feedback, the next shared
experiment should connect target/active DOF, scope, actual reference measurement,
geometry and limits to candidate generation/preview at the common property/action
boundary. Audit that boundary first; do not introduce per-gesture context stores.

The starting-value anchor in E01 is a self/previous-value snapshot. It is not yet
an object/feature reference with a maintained derivation. A future candidate must
carry its reference and measured quantity, DOF, generator parameters and validity;
a persistent binding additionally retains that derivation and its dependencies.
Transient calculation and persistent locking remain separate.

Keep the default interaction immediate/contextual, with explicit dial configuration
as refinement. Use applicability and valid geometry to reveal the next meaningful
freedom, preserving the active operation family. Show few alternatives on demand.
Use stable proximity-based snap activation/hysteresis without reintroducing an
operation-ranking or learning system. Limits distinguish hard invalidity from
soft overridable stopping points; rendering visibility alone does not delete DOFs.

The implementation order may change based on findings. Do not march through this
module table automatically, implement the whole system in one PR, or treat a
single dot-inside-circle demonstration as proof of universal inheritance.

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


## E02 — reference-measurement operation context

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
