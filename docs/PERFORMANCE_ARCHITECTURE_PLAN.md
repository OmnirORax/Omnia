# Omnia performance recovery plan

Status: investigation/implementation plan, not a completed refactor. The user
still reports severe lag in the current private PR #30 preview, including when
stationary. Earlier cache/HUD optimizations and passing model checks did not
resolve that report. Do not describe responsiveness as fixed on that evidence.

## Direction

Universality is a semantic/API contract, not a requirement to visit every target,
rebuild every index or rerender every consumer on each input/frame. Preserve MC,
MS, shared property definitions, independent consumer values and state ownership.
Treat shared registries as the source of truth and renderer indexes/plans as cached
projections of that source, never competing property or selection systems.

Performance takes precedence over maximum configuration freedom. Supported values
and combinations should be useful and affordable by default. The user should not
need to discover destructive settings by maxing sliders. Numeric validation alone
is not a performance policy. Large blurs/shadows and continuous effects also have
real hardware costs; architectural improvements cannot make unlimited work free.

## Code findings to investigate

These patterns are confirmed in source. Their relative contribution to the user's
lag has NOT been measured in an application/browser performance trace.

| Area | Current evidence | Required distinction/check |
| --- | --- | --- |
| Hierarchy indexing | `model.ts`'s ancestry helper constructs an index per call; included/connected/blocked also construct one when none is supplied. MC builds paths per target and descendants by nested target scans. | Count index construction and target visits per action/render; share one structure index across a transaction/view. |
| React notification scope | Appearance/UI contexts carry broad state; value resolvers depend on complete state/base snapshots. | Measure committed consumers for one property change; notify only affected slices while keeping one shared owner. |
| Property transactions | `applyValue` already shares an index and preserves structural references, but traverses consumers/channels and creates value records for a broad adjustment. | Resolve the eligible target set once per stable gesture/rule; batch changed values and avoid writing equal values. O(affected targets) once may be necessary; repeated O(all targets) work is not. |
| UI history/validation | Session/history paths still serialize whole snapshots for equality; changed settings are normalized and recorded, and persisted by the owning app. | Separate preview from commit; measure normalization, serialization and history separately from render. Avoid paying full-state costs for unchanged data or every drag sample. |
| MS detection | `collectVisualParts` queries registered selectors, walks text, reads visibility/rectangles; a body observer can rebuild the catalog after relevant mutations. | Separate semantic membership, geometry and paint revisions. Measure catalog rebuilds while idle, hovering, selecting All and editing a value. |
| Feedback/effects | DOM/mask/texture caches exist, but there are multiple observers, animation clocks, canvas draws and scene postprocessing. | Trace invalidation fan-out across systems, not each cache in isolation. Record actual generation/compositing/frame costs and browser paint/raster work. |
| Rendering | Text glow uses CSS text-shadow; icons use drop-shadow/filter; the scene has bloom passes. Brightness for ordinary UI ink is calculated into RGB colors. | Distinguish CPU work from style/layout, paint/raster and GPU/compositing. Brightness alone should not be assumed intrinsically expensive; broad glow/blur can be. |
| Ranges | Shared Density is 0–4, while `effectsFromValues` caps non-Starfield density at 1. Brightness is 0–3, Glow 0–2, Opacity 0–1. Numeric consumer metadata currently has no renderer-specific range equivalent to select choices. | Audit exposed range versus actual renderer behavior and meaningful/cost limits; do not assume these existing global numbers are safe budgets. |

## 1. Capture the baseline before more performance fixes

Use the same saved fixture, browser, viewport, DPR and reference hardware for each
comparison. Record the exact application SHA, settings and enabled features.
Separate steady-state cost from the initial apply and from continuous editing.

Cover: effects off; broad static color/brightness/opacity; broad glow/blur; each
lightning mode alone; MS All/pattern modes; hierarchy hover/toggle; slider dragging;
combined scene/wallpaper/effects. Scale the visible UI and local refinements with
small, medium and large fixtures. Include a simple setter case, not only VFX.

Capture input-to-next-paint, long tasks, React render/commit work, style/layout,
paint/raster/compositing, effect CPU time, allocations/memory, target/DOM counts and
invalidation causes. Use browser traces for actual interaction claims; add low-cost,
opt-in local counters/timings for subsystem attribution. Aggregate without React
updates, storage writes or console output on each sample. Turn instrumentation off
for final timing comparisons. Do not run a browser suite contrary to the user's
verification preference; agree the targeted profiling workflow before execution.

Locate the dominant cost and its scaling first. Unit assertions that a cache is
reused are useful regression checks, not proof of low frame time or low GPU cost.

## 2. Establish range and workload safeguards early

Audit every numeric property together with its consumers and renderer adapters.
For each, record units, supported domain, useful range/step, saturation/plateaus,
which other inputs change that range, and how cost scales with affected coverage.
Opacity 1 is already a valid endpoint; 1 cannot simply become the universal maximum
for Brightness, Glow, Density or other unrelated properties.

Use three distinct concepts:

- **Semantic hard bounds:** correctness/supported domain, enforced at setters,
  saved-data/import boundaries and rendering, not only by an HTML slider.
- **Effective control range:** meaningful bounds for the selected consumers and
  active mode. Exclude inert ranges such as Density 1–4 on a non-Starfield effect.
  The shared pool retains one property definition; consumer capabilities/mode
  constraints refine its range. Do not introduce private slider copies.
- **Aggregate rendering budget:** many individually valid settings can still be
  unaffordable together. Bound total visible animated coverage, blur/shadow work,
  texture work and frame time across effects, not separately per target/category.

Resolve ranges once per selection/mode/capability revision. For a mixed universal
setter, use a clearly defined common supported range; retain direct per-consumer
editing where a consumer supports more. A user's editable min/max is a working
interval inside these bounds, not a way around validation or renderer limits.
Apply the same policy to dragging, typed values, shortcuts, paste and imports.

Do not invent new magic maxima without evidence. Brightness saturation depends on
the source color and renderer; Glow changes footprint as well as appearance. Audit
these separately. Preserve old stored values/history until an explicit migration
or edit; selecting targets must not silently rewrite them. If a rendering budget
limits the effective appearance, expose that fact and the applicable range compactly
in the existing MC controls, rather than pretending the full value was rendered.

## 3. Refactor the shared execution path according to the trace

Prioritize the largest measured contributor, with small reviewable changes:

1. Share structure/ownership/capability indexes and compiled eligibility paths.
   Remove nested full-tree scans and per-row index/resolver construction.
2. Separate structure, values, geometry, selection, preview and time revisions.
   A paint change must not invalidate topology or remeasure unchanged geometry.
   Coalesce mutation notifications and invalidate affected hosts/ancestors only.
3. Give consumers selective subscriptions; keep transient pointer/feedback state
   out of the broad workspace context. Batch property changes, and commit one
   journal action per accepted gesture. Keep persistence off the animation path.
4. Give MS an indexed inventory and visible-geometry broad phase. Refine exact
   glyph/contour hits only for candidates. Store global selection intent by stable
   identities/rules; offscreen targets still belong to All even when not painted.
5. Bound visible hierarchy/editor work; reuse flattened/indexed projections and
   virtualize only where the trace shows a DOM-size problem. Discovery must not
   recursively create more work merely because an editor is open.
6. Enforce shared effect budgets and culling. Choose reusable raster layers,
   batching, shader/atlas work or a cheaper supported effect from measurements.
   GPU execution is not automatically cheaper when uploads, large blur layers or
   other renderers contend for it. Coalesce animation clocks and pause unused work.

Do not replace the whole application speculatively or add one private optimization
for each new feature. Preserve locks, bypass, exact scopes, shared properties,
Apply/discard and undo/redo semantics through each refactor.

## 4. Acceptance and prevention

Provisional goals to calibrate on the reference device: direct input-to-paint p95
under 50ms; no repeated main-thread tasks over 50ms; ordinary manipulation near
60fps with decoration allowed a lower cadence. Background effects need a shared
small CPU/GPU allowance, not the whole 16.7ms display-frame budget. These are proposed
engineering goals, not measured results or a promise for arbitrary hardware.

Require before/after traces for the representative broad-target scenarios and
report the remaining limiting stage. Input must stay usable with the supported
maximum settings, and the renderer must settle after a static edit. Scale testing
must show which work grows with targets, visible pixels and local refinements.

Add deterministic regressions for repeated index construction, no-op writes,
unrelated invalidation, range/mode resolution, import/paste enforcement and preview
versus commit ownership. Keep browser performance measurements separate from flaky
universal millisecond assertions in model tests. Document reference scenarios and
repeat them for cross-cutting features; agreeing budgets without checking them is
not a safeguard. Builds and existing tests alone never close a performance report.

Current next step: baseline/profile and range audit. No further claim that a
particular effect or global performance is fixed without reproducing the report
and measuring the complete application.
