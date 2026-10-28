# Omnia performance recovery plan

Status: first systemic implementation and targeted local browser profiling are
complete for the paths below. This is not a claim that all responsiveness issues
are resolved. Local software-GPU traces still expose substantial interaction and
rendering delays; decoration now yields under sustained load instead of continuing
unbounded. See [measurements and reproduction](PERFORMANCE_RESULTS.md). The user
explicitly authorized this focused local trace; unrelated browser suites were not
run.

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

## Implemented shared-path changes

| Area | Change | Remaining limit |
| --- | --- | --- |
| Hierarchy and policies | Shared structure index/paths/descendants in the appearance provider; transaction/render callers reuse policy indexes. | The public standalone ancestry helper still constructs an index; never call it per row/property in a batch. |
| Invalidation | Value readers/styles/text paint depend on values/defaults/bypass rather than targeting/locks; live normalization retains validated topology references. | Broad React contexts remain. Selective subscriptions need a further measured refactor. |
| Transactions/history | Copy only changed records, skip no-op writes and compare shared JSON-state branches without serializing unchanged assets. | Imports still fully validate; persistence and real commits can still be costly for large snapshots. |
| Local effects | Index owners once, discover ancestor owner keys per mounted host and resolve only those local candidates. Cache scope selectors and policy indexes. | Relevant DOM changes invalidate ownership/geometry; large actual mounted documents still require discovery. |
| Feedback | Cached feedback hosts paint at 30fps; slow display frames can freeze feedback at a steady visible strength. | CSS style/paint cost still scales with visible coverage; native seam animations remain separate; scene feedback also yields under load. |
| Graphics | Bounded overlay/scene resolution, lower bloom resolution, no scene MSAA, batched lightning strength bands and aggregate UI source/particle/pixel/segment budgets. | Lower rendering quality is deliberate. Complex scene animation beyond these pixel limits is not fully budgeted. |
| Overload | UI decoration decreases its source allowance after sustained expensive/delayed frames, eventually freezing; MC reports reduced/paused animation. | This is a fallback, not an equivalent-quality speedup or a guarantee of 60fps on every device. |
| Ranges | Shared conditional numeric metadata, consumer-specific UI glow/blur bounds, common mixed-selection interval, writes and rendering use the same bounds. | The full numeric catalog still needs device-specific visual/cost calibration. There is no universal meaningful maximum for all properties. |

## 1. Optional profiling when explicitly requested

Default delivery is code inspection → fix identified inefficiencies → user testing.
Do not start or repeat profiling to prove sufficiency without an explicit request.
The earlier focused trace authorization is historical, not standing permission.
When profiling is requested, use the same saved fixture, browser, viewport, DPR and reference hardware for each
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
for final timing comparisons. Any authorization is limited to the requested check;
unrelated browser suites remain outside that request.

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

Next acceptance work: verify the private preview on the user's hardware/workspace,
then profile residual input latency, React notification scope, catalog refreshes
and graph/media combinations. Keep before/after fixture measurements with future
cross-cutting changes. Do not close the overall performance report on model tests
or software-renderer traces alone.
