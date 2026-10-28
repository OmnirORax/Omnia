# Omnic source alignment: Stage 1 and Stage 2

Source review, 2026-10-27. An implementation audit and continuity record, not a
finalized grammar or authorization to replace the current system.

## Source and authority

The user's cleaned [Omnic rules & system](omnic/OMNIC_RULES_SOURCE.md) is preserved
verbatim. Apply explicit user corrections first; use this source for intended
meaning, the stage contracts for agreed delivery scope, and code for what is
executable. The source includes questions, tentative findings and obsolete
passages: do not turn all of it into settled rules. Its Obsidian image references
have no accompanying image files in this upload; exact diagram-dependent geometry
cannot be verified. A separate new Codex handoff has not yet accompanied this file.

The earlier handoff already described a structural language and deferred full
interpretation beyond Stage 1/2. Missing grammar is not automatically an
implementation error. Distinguish limited foundations from incompatible
assumptions before changing saved data or UI.

## Working understanding

- Omnic derives distinctions through structure, relations, operations and active
  frames, rather than assigning arbitrary shapes to English labels.
- Difference is the stated root. First-order primitive frames are derived
  distinctions, not a finalized list of independent ontological atoms.
- Components, their contextual roles and their binding are separate. A structure
  can be operand or operator; matching drawings establish neither meaning nor
  shared identity.
- Active frames determine what is specified. Inactive is not negated; unspecified
  is not an inferred strong/default meaning. Inherited context avoids repeating
  activations on every child.
- Execution order, reading/traversal order and before/after event order differ.
  Rotation can constrain reading under a frame; it is neither always semantic nor
  always cosmetic.
- Relation/operation and topology/access conditions are distinct but composable.
  A connection stroke alone does not specify transfer, conflict or dependence.
- Compression needs a definite expansion/derivation. Generate requested
  combinations rather than pre-enumerate them. Candidate concepts emerge through
  use; recurrence can justify canonization. Database canonical identity does not
  itself establish a settled language canon.
- Actual shared structure supplies derived filtering. Manual organization can
  remain, but must not replace structural discovery with repeated tagging.
- Meaningful detail, zoom, salience and substrate interact. The user's clarification
  below separates Omnium content zoom from fixed-size Omnic reading; current
  renderer pixels/coordinates do not define the final language.
- Referential continuity/path matters. A technical ID locates stored work; it
  does not implement semantic identity through change.

## Code-grounded alignment map

Paths below are relative to `src/omnic/`. These are source-inspection findings,
not new browser acceptance results.

| Area | Current implementation | Alignment and reuse |
| --- | --- | --- |
| Canonical composition | `model.ts`, `document.ts`, `revisions.ts`: entities own recipes; references follow live definitions or explicit saved pins. | Retain. No concept-to-image assignment or forced English-word mapping. |
| Workspace/library | `workspace.ts`, `workspaceStorage.ts`, `WorkspaceCloud.tsx`: shared pool, atlases, organization, local persistence and explicit cloud snapshots. | Retain independently of grammar changes. Code availability does not prove hosted rollout/acceptance. |
| Construction | `registry.ts`, `evaluate.ts`: bounded procedural generators and ordered transforms produce dot/ring/line/group output. | Useful geometry infrastructure; general meaning-driven composition/constraint rules are missing. Coordinates must not become the grammar's authority. |
| Frames/views | `model.ts` stores scoped tri-state records; `evaluate.ts` collects them and checks scope. `Composer.tsx` offers frame properties from generator/operator parameters. | Partial scaffold. No effective frame inheritance or interpretation. Numeric property declarations are not the full meaning/question/view frame system. Extend the shared model, not a second frame store. |
| Read order/path | Operations have execution order. There is no separate semantic read-axis/start/end/path contract; `connect` walks affected primitives in evaluation order. | Missing distinction. Never treat generation/array order or execution order as authored reading order. |
| Roles/bindings | Stable generated addresses, unresolved-target repair, grouping and internal connection strokes exist. | Retain addresses/repair. General semantic role bindings and relation × topology conditions are missing; nesting/lines cannot silently supply them. |
| Motion | `oscillate` moves targets sinusoidally on X/Y with bounded playback. | Reuse mechanism. “Semantic oscillation” overstates its current meaning contract: event/read distinction, before/after comparison, trails and referent history are not implemented. |
| Discovery | `libraryIndex.ts` derives count, generators, operators, boundary/fill/motion and numeric facts, using dependency-aware cached/batched evaluation. | Retain. Extend facts from shared semantic evaluation; active frames, bindings, read order and derivation structure are not current indexed facts. |
| Expansion | Recipes, references and frozen revisions reconstruct supported structures. | Retain. Geometric reconstruction is not complete meaning-preserving expansion. A fixed expansion does not require replacing the agreed live-reference default with mandatory pins. |
| Identity/history | Stable IDs, revisions and Undo track stored work. | Retain infrastructure; source/continuity/reference-thread semantics are absent. Do not replace all IDs or claim they solve that language problem. |
| Rendering/scale | `svg.ts`, `presentation.ts` are derived adapters; scene output is static/budgeted. | Retain adapters/budgets. Omnium content zoom and fixed-size Omnic reading must be distinguished; the current renderer is not proof that separation is implemented. Motion-as-meaning remains incomplete. |

## Reading size versus content zoom

User clarification, 2026-10-28: the local-enlargement versus global-detail guidance
in chapters 3–3.2 primarily concerns Omnium itself. Omnic acts as the meta/reading
layer and stays at a fixed, maximally zoomed-out reading size, unaffected when
zooming into Omnium content. Do not automatically scale its reading size with the
content camera or apply the content's semantic zoom rules to glyphs.

This is the current design direction, not a claim about implemented rendering.
The exact Omnic–Omnium relationship and integration will emerge through using
Omnic to map Omnium. Do not prematurely fix pixel dimensions, anchoring or a
permanent separation of their underlying models. The source upload remains
verbatim; this clarification takes precedence over the audit's earlier reading.

## Constraints for further implementation

1. Stage 1/2 provide reusable construction and sharing infrastructure, not
   completed Omnic interpretation. Preserve useful work rather than restart it.
2. A property editor or rendered effect is not a declared meaning. Semantic
   activation needs applicability, scope, inheritance and evaluation contracts.
3. Separate presentation differences from changes in specified meaning. The source
   warns that nearby views/nuances are not automatically interchangeable. Do not
   merge them because of resemblance or a shared referent, or invent a new
   one-recipe/one-English-concept restriction.
4. Do not hardcode a universal hex grid, fixed dial layout or global 30°/60°
   semantic quantization from exploratory examples. Module/substrate and active
   frame conditions govern applicable rules. Numeric presets are not established
   meaning thresholds.
5. Older selection-operator dial treatment is marked obsolete; placement of view
   activations and radial interaction is also discussed. Resolve that distinction
   before a fixed dial UI. Tools, operators and view activations are not synonyms.
6. Extend the canonical model with derivation, constraints and unresolved states
   as they become executable. Reuse MC/MS, property controls, history, persistence
   and cloud paths; no parallel identity or language-editing system.
7. Future applicable features inherit registered rules/controls automatically.
   Query/generate only requested combinations, reuse caches/budgets, and avoid
   per-frame global inference or combinatorial enumeration.

## Proposed next slice

The user subsequently authorized Member/Part construction. The extension now adds
authored whole-unit/fractional highlighting, scoped rotation with snap constraints,
Member/Part presets and operation-tool snapshots through existing shared paths.
See [the current extension contract](OMNIC_COMPOSER.md#member--part-construction-extension-2026-10-28).
The audit's general frame/binding/read-order gaps remain; this extension is not
full semantic interpretation. Fixed-size reading remains the design direction
above rather than a claim about the world renderer.

The earlier, broader frame/binding proposal still needs exact rules agreed before
implementation. A possible slice is a boundary with an internal
unit, explicit content/position/part view activation and inherited scope. Expose
what is specified, inactive or unresolved without inventing English translation.
Use it to exercise shared frame/role/binding evaluation, derived library facts
and saved expansion. Read-order examples require their own explicit path contract.

This is a proposal, not a commitment to that example or a full grammar rewrite.
Diagram-dependent details remain unresolved. No application code, browser tests,
profiling or deployment changed in this audit; interaction testing stays with
the user.
