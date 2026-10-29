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
- ⠒❉ remains the mathematical number/control system. The user owns its future
  math-rule design and semantics; leave that part to them. Assistant work covers
  the surrounding shared infrastructure and integration interfaces, consuming
  supported Math Dial configurations as available. Do not invent rule notation,
  change recursion semantics or build a competing rule system. Current notation
  supports raw signed integers. Preserve exact entry and existing fractional values.
- Keep UI compact, contextual and radial; derive applicable controls on demand.
  A permanent/manual inventory of references and operations is not the intended UX.
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
| Mathematical representation/rules | Consume the existing Math Dial and user-defined future rules through shared interfaces; preserve derivations where supported | ⠒❉ pure model and existing property editors | Raw-number foundation exists; future math-rule design owned by user |
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
| Shared operation-context/reference integration | Proposed next area; experiment scope not yet selected | Global plan clarified after reviewing the cleaned source |

## Next experimental decision

Audit how current property edits and commands identify target, DOF and scope.
Locate the smallest shared insertion boundary for operation context and reference
resolution. Propose a small *usable* experiment there, including its interaction
entry paths, before introducing another reference UI or persistence schema.

The implementation order may change based on findings. Do not march through this
module table automatically, implement the whole system in one PR, or treat a
single dot-inside-circle demonstration as proof of universal inheritance.

## Open decisions

Exact acceptance/alternative gestures; continuous versus discrete exploration;
Math Dial integration interfaces (rule semantics/notation owned by user); soft-limit override; persistent
locking interaction; visibility of reference/DOF state; feature applicability and
coordinate transforms for supported renderers. Resolve these experimentally,
without inventing universal semantics from examples.
