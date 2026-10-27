# Systemic performance pass: local evidence

Date: 2026-10-24. Baseline: `a91b7ac1449f6fb04936873f78175e8c7041ef38`.
Implementation: the subsequent shared-path/range/budget changes in PR #30.
Raw aggregate measurements: [JSON](performance/2026-10-24-local.json).

This pass removes measured quadratic policy/index work, reduces unnecessary state
and local-ownership work, adds shared numeric constraints and bounds decoration.
It does **not** close the user's system-wide lag report. Software-renderer traces
still show long input reactions and poor frame pacing, including effects-off and
selector cases. User hardware/workspace verification and residual profiling remain
necessary. There is no measured guarantee of sub-50ms input or 60fps.

## Measurement method and limits

The user explicitly authorized a focused local trace. No browser suite was run.
Node 24.19.0; Chromium 154.0.8037.57; Linux container with **SwiftShader software GPU**;
1366×900, DPR 1. Local production builds, external requests blocked, no credentials,
provider calls or user data. Both builds used the same profiler/fixture: 12 graph
nodes, 300 saved unmounted local text customizations, default UI template with MC
Visuals open. Most scenarios had 1,758 DOM elements/483 text nodes after the click.
Fresh context per case; 7-second warmup; 1.8-second RAF sample; CPU sampling enabled.
Baseline ran after the implementation trace, one browser at a time.

The click metric is a programmatic hierarchy-circle click followed by two RAFs,
**not physical input-to-presented-paint**. Script time covers the RAF sample and that
reaction (plus pointer moves in the selector case). Samples are single runs and
show variance; do not extrapolate ratios to the whole application. Earlier
intermediate runs varied considerably. Capture profiles and repeat on reference
hardware before setting regression thresholds.

Quality differs deliberately: broad glow input 2 is effectively capped at 0.8 for
UI text; effect resolution/source/detail budgets and overload fallback apply only
to the new build. This is a combined architectural change and quality restriction,
not an equivalent-quality animation speedup. Saved values are retained.

## Application trace

| Text scenario | Hierarchy click + two RAFs, before → after (ms) | Script time before → after (ms) | RAF p95 gap before → after (ms) |
| --- | --- | --- | --- |
| Effects off | 491 → 521 | 483 → 382 | 133 → 183 |
| Brightness 3 | 564 → 288 | 553 → 280 | 16.7 → 16.7 |
| Glow 2 / supported UI cap | 572 → 327 | 565 → 316 | 16.7 → 16.8 |
| Electric text | 653 → 434 | 761 → 415 | 183 → 183 |
| Lightning outlines | 1,654 → 388 | 1,667 → 291 | 333 → 167 |

Electric-text allowance had reduced from 24 to 3 visible UI jobs in this run;
lightning had frozen to a static result (allowance 0). These fallbacks preserve
stored choices. Even frozen lightning/effects-off cases had poor software-GPU frame
pacing: source limits do not prove the remaining rendering bottleneck is solved.
The effects-off click did not improve in this sample.

Selector pointer movement remains a separate acceptance concern. A document-root
pulse experiment reduced script work but increased style work/pointer wall time;
it was removed. The final renderer retains cached hosts, caps pulse updates to
30fps and can make feedback steady after sustained slow frames. Follow-up selector
measurements are recorded separately in the JSON artifact. Protocol-driven mouse
wall time is not a physical pointer latency percentile. The repeated final
selector cases took 1,833/1,838ms for 12 protocol mouse moves; repeated baseline
cases are retained in the artifact. This remains a regression/acceptance concern
in the software-renderer environment, not a claimed selector improvement. Cached
host feedback brought style time back down after the root-clock experiment, but
did not resolve the remaining frame/pointer delay.

## CPU scaling check

`scripts/perf-shared-paths.mjs` isolates hierarchy projection, a batch of inclusion/
connection checks and one repeated brightness edit. Cold snapshots, not browser FPS.

| Targets (including locals) | Hierarchy before → after (ms) | Policy batch before → after (ms) |
| --- | --- | --- |
| 83 | 3.712 → 0.649 | 16.187 → 1.293 |
| 184 | 5.156 → 0.937 | 39.500 → 1.711 |
| 584 | 50.232 → 2.642 | 482.737 → 4.186 |
| 1,084 | 274.002 → 2.729 | 2,353.222 → 6.142 |

Repeated equal edits now return the existing state snapshot. Local effects also
share a policy index, group locals by owner and discover ancestor owner keys per
mounted host instead of calling `closest` for every saved owner. Value/stylesheet
projections do not rebuild for targeting-only changes. Structural JSON equality
skips shared resources; live validation retains unchanged validated branches.

## Supported limits and fallback

- Shared Density domain remains 0–4; active range is 0–1 except Starfield (0–4).
- UI Glow/animation Glow: 0–0.8; UI Blur: 0–8px. These are conservative footprint
  policies, not a universally optimal visual maximum. Other scene/meta consumers
  retain their own ranges. Shared mixed-selection controls use their common range.
- Editing/typed values, accepted parts, local editors, paste, state bindings and
  final value resolution share the constraints. Imported semantic values/history
  are preserved; the renderer caps effective output without rewriting them.
- UI effects: 24 visible source jobs, 500 particles, 800 lightning segments,
  400,000 electric pixels per paint, 1 MP overlay, 20fps maximum cadence.
- After three consecutive paints costing >12ms or spaced >160ms apart, halve the
  UI source allowance; eventually freeze animation if one source remains too slow.
  Quality does not grow back during that session. Static/hidden intervals reset
  timing. Explicit edits repaint; MC displays reduced sources or paused animation.
- Selector glyph/surface and scene feedback use the same overload rule and become
  steady; scene pulses cap at 30fps. Native seam animations remain separate.
- Scene: 1.5 MP, DPR ≤1.25, no MSAA; bloom longest edge ≤512px. Motion/scene geometry
  complexity is not comprehensively governed by this pixel budget.

These limits intentionally reduce rendering freedom/detail to protect usability.
They do not make arbitrary combinations or arbitrarily large documents affordable.

## Reproduce and continue

Run `node scripts/perf-shared-paths.mjs --output=/tmp/shared.json`.
`--legacy` selects the old indexing pattern for comparison. For the browser trace,
run a production preview locally, then:

```sh
node scripts/profile-workspace.mjs --url=http://127.0.0.1:4173 --warmup=7000 --out=/tmp/omnia-profile
```

It saves CPU profiles and aggregate JSON outside the repository. `--scenarios`,
`--targets`, `--url` and `--out` allow controlled comparisons. To profile an old
checkout, copy the same profiler into its `scripts` directory and build/serve that
checkout separately; do not compare different fixture generators accidentally.

Required model suite and production build pass. Regression coverage checks index
semantics, no-op/reference preservation, live validation, history/resource equality,
mode/consumer bounds, legacy rendering without a controller, accepted-part bounds,
state adapter writes, ownership/proxy precedence, resolution and overload yielding.

Next priorities: reproduce residual click delay on reference hardware; attribute
React context/commit work and catalog/layout invalidation; measure MS All and live
slider gestures with large mounted fixtures; cover combined graph/media workloads.
Keep hardware paint/raster/compositing evidence distinct from JS sampling. Broader
context subscriptions, large-document discovery and scene/media budgets remain
incomplete; passing tests or these local gains do not close those tasks.


Neon scene edge smoothing is fused into SceneGlow's existing composite shader.
It retains the 1.5 MP base and 512px bloom bounds, without MSAA, supersampling,
additional passes or persistent buffers. Flat pixels take five neighboring base
samples; contrast edges take four more. This adds bounded GPU texture work and
can slightly soften high-contrast detail; it is not free or a hardware FPS claim.
Direct non-bloom rendering retains its existing rendering path.


Node/binder canvas labels now use bilinear minification without mipmap generation.
This avoids cross-fading blurred mip levels as soon as zoom drops below a texel’s
native scale, and removes label mip allocation/rebuild work. It does not raise the
scene pixel/DPR caps or add rendering passes. Very small text still loses detail
at finite resolution and can alias at a distance; browser quality/performance
verification remains with the user. This is not a system-wide lag resolution.


Held-arrow movement previously committed every OS key repeat through React
navigation state, collision resolution, document validation/history/autosave, and
full text/geometry replacement. The held-key path now snapshots once, previews
existing scene anchors at animation-frame cadence, and commits once on release.
Regression checks simulate a 5-second stall: one capped 32ms movement step occurs,
with no elapsed-time debt and no remaining frame/commit after release/cancellation.
OS repeat storms cause no new held-state notifications.

This removes repeated heavy commits/rebuilds from the gesture; it does not prove
browser input-to-paint latency. Existing renderer node/binder updates still scale
with mounted scene size, and final collision validation/one scene rebuild may
still be expensive in large documents. Collision checks are deferred to release
and can adjust the final position. Scene pixel/effect caps remain unchanged.
Browser smoothness verification remains with the user; no new browser suite ran.


Node selection no longer waits for the 320ms single/double-click options timer.
A dedicated immediate callback selects on the first completed click; only options/
variant revelation waits. Selection-only updates reuse scene meshes/textures,
repaint changed selection cards and update changed binder relation styling. They
no longer dispose/rebuild all text/geometry or recalculate occupied radii. Spatial
projection is memoized by actual atlas/focus inputs. Variant reveal avoids creating
a new expanded-set/atlas projection for nodes with no variants or already revealed
variants. Actual variant/topology/font changes retain their scene rebuild path.
Model tests cover immediate selection, exclusive single/double side effects and
rapid target changes. Browser input-to-paint/freeze verification remains with the
user; this is not a claim that all selection/UI rendering cost has disappeared.


Omnic Stage 1 adds explicit evaluator and shared renderer budgets. World projection
is static/derived, capped at 32 Omnic source occurrences and 256px raster edges;
excess sources show a named preview-budget placeholder, preserving recipes. Cached
SVG depends on canonical definition/dependency revisions rather than node positions.
Composer motion is explicitly enabled, capped at 256 roles / 12fps, writes the
preview DOM without per-frame React/history/storage, and pauses after sustained
expensive frames. Large structures skip neighboring previews. These policies bound
new work; no browser performance trace was run and existing system latency remains
an open verification item. See OMNIC_COMPOSER.md for structural/input work limits.

## Omnic workspace library (2026-10-27)

Stage 2 reads cached structural facts during queries, mounts 32 result rows per
page and evaluates in scheduled 4 ms batches with progress published at most
every 50 ms. It renders one inspected revision preview and keeps at most two
workspace indexes across reopening. Stable entity pools reuse scene resolvers;
position-only edits do not rescan recipes. IndexedDB stores workspace snapshots
after commits, not on pointer samples or animation ticks. Limits and remaining
whole-document validation/projection costs are recorded in OMNIC_LIBRARY.md.
No new browser trace or FPS measurement was performed; these are implementation
bounds and model checks, not evidence that earlier system-wide latency is resolved.

## Click stalls: focused follow-up (2026-10-27)

Baseline `6dce56b`. A local CPU profile reproduced long pauses while toggling
Omnic library → Objects → Structural filters. Before the patch, sampled work
included repeated `adjustmentTargets`, `FunctionControl` full-list/ownership scans,
icon target scans and dock geometry discovery. The patch shares render indexes,
keeps appearance metadata stable across unrelated collapse changes, memoizes
adjuster eligibility, and skips hidden/unrelated dock measurements. Mutable layout
transactions retain the original uncached ownership path.

[Raw timing samples and method](performance/2026-10-27-clicks.json) record two
sequential comparisons with 12 synthetic selected nodes, default UI, fresh headless
Chromium, blocked external requests and CPU sampling enabled. Each sample is a
programmatic click plus two RAF callbacks, not physical input-to-presented-paint.
Median times: before1 327 ms / after1 413 ms; after2 374 ms / before2 402 ms.
The scene-backed samples vary and do **not** establish a reliable overall latency
improvement. Broad React renders and main-thread layout/paint remain substantial;
the user's pulsing selection freezing is not claimed resolved. Empty-scene pilot
samples improved, but are not substitutes for the selected-scene workload.

`node --run test`: 273 model checks pass, including ownership/anchor/index
invalidation. Type checks pass. These checks establish correctness of the shared
lookup change, not smoothness. User hardware/workspace verification remains open.

## Scoped subscriptions follow-up (2026-10-27)

Baseline `31f24e5`. `UIProvider` now supplies a committed-snapshot subscription
projection alongside legacy context. Repeated function controls, fields, action
registration and embedded headers subscribe to narrow slices. Appearance action
closures are delegated without invalidating every consumer; data readers retain
snapshot identities. Appearance metadata depends on customized owners' actual
labels/paths rather than unrelated frame-registration order. Equal dock geometry
retains its context identity instead of waking all dock residents.

[Timing samples](performance/2026-10-27-subscriptions.json): one sequential
scene-backed headless comparison, median programmatic click + two RAFs 347 → 294 ms.
This is noisy, not physical input-to-presented-paint or proof of pulse continuity.
Remaining legacy context consumers, broad parent renders and layout/paint still
need work; no global frame-time guarantee is claimed. The sampled after build
predates a final safeguard preserving appearance reader identity on real edits.

Focused browser checks passed for editing the library search field and creating
an atlas through a current action handler after the subscription migration.
Model tests cover unchanged slices, current handlers and ownership invalidation.
The earlier attempted smoke check omitted opening Organization and timed out; the
corrected path opened the section and passed. The user subsequently confirmed
“definitely much better” after `85c1074`; remaining latency is not resolved by that
feedback alone.


## Window and DOM follow-up (2026-10-27)

Baseline `85c1074` (the subscription pass the user confirmed improved clicks).
Floating windows, panels, frame chrome, docking residents/tabs, labels and placement
previews now subscribe to their render dependencies. Closed frame search and
inactive popup adapters use empty slices. Docked function controls subscribe to
their own registry records, preserving current values/handlers without waking
all sibling residents. Native presentation compares per-entry inputs before DOM
writes/permission checks. Caption changes inspect their host directly; actual
inserted subtrees are deduplicated before discovery. Registration metadata publishes
once per microtask instead of copying the inventory for each newly found control;
source-stack operations, commands and history commits remain synchronous.

[Raw samples](performance/2026-10-27-windows-dom.json) include intermediate builds
and the rebuilt pair (before a final contour-invalidation safeguard for
same-sized docked icons). Earlier comparisons improved, but the rebuilt
pair was effectively unchanged: median click + two RAFs 373.4 ms baseline versus
373.6 ms follow-up. This noisy headless diagnostic does **not** establish a further
end-to-end latency improvement. It confirms eight successful toggles per build;
model checks establish narrowed invalidation/batched metadata, not smoothness.
The reproducible opt-in diagnostic is `node scripts/profile-ui-clicks.mjs <local-url>
<output.json>`; it blocks external requests, seeds a disposable 12-node workspace,
uses no CPU profiler and has no arbitrary timing pass/fail threshold.
`OMNIA_PROFILE_SOURCE` labels a separately served baseline; otherwise the report
records runner HEAD and dirty status. Do not compare these numbers directly to
previous profiler-enabled samples or call them physical input-to-display latency.

277 model checks passed, including render-slice invalidation, deduplicated inserted
roots and final-source registration batching. Production build and type checking
passed. Focused isolated Chromium smoke passed library field editing, atlas
creation through the current action handler, inserted native-button discovery,
caption updates with stable action identity and no page errors. Search/Esc,
minimize/restore, docking behavior and scene pulse continuity still need user
acceptance in the preview. Large-workspace commits, remaining broad global owners
and renderer/effect load remain separate performance risks; no general frame-time
guarantee is claimed.


## Residual click pause (2026-10-27)

The user confirmed `846feeb` was “significantly better”, while a brief freeze
remained. A local source-mapped CPU profile identified UI-selection reconciliation
calling `buttons()` after ordinary layout/registry changes with an empty selected-ID
set. That queried all selectable controls and measured visibility. The effect now
returns immediately when empty; the previous effect cleanup removes old markers.
Actual nonempty selection still follows the existing discovery/permission path.

React also repeatedly asks subscribers for snapshots within a commit. Subscriber
reads now cache pure selector results by committed source and selector identity,
retaining shallow-equal slice references. A new snapshot or selector (including
changed captured props) reevaluates; live event reads remain unchanged. Model
checks verify evaluation counts, equality retention and both invalidation paths.
This does not eliminate broad parent renders or notifications to all subscribers.

[Raw comparison](performance/2026-10-27-residual-clicks.json): eight ordinary filter
toggles generated 16 global UI-selection scans before versus zero after. The
empty-selection visibility stack disappeared from the mapped sampled CPU profile.
Two isolated uninstrumented timing pairs improved: median programmatic click +
two RAFs 427.1 → 283.0 ms (after-first), then 310.8 → 284.7 ms (baseline-first).
A second pair overlapped a smoke browser and is explicitly excluded, retained in
the raw report. Headless software graphics remain noisy; these values are not
physical input-to-display latency, proof that a real pulse never pauses, or a
separate measurement of selector caching's benefit.

The opt-in local diagnostic supports `OMNIA_PROFILE_CPU=/tmp/profile.cpuprofile`
for CPU attribution and `OMNIA_PROFILE_DOM=1` for UI-selection scan counting. Keep
both off for final timing comparisons. No instrumentation enters the application.
Model suite: 278 pass. Type checking and production/self-contained builds pass.
Focused local smoke passed library field editing, current-handler atlas creation,
native button discovery/caption identity, Ctrl UI selection and Ctrl deselection
marker cleanup, with no page errors. An initial single-Esc assertion timed out;
the baseline and follow-up both retain selection after the first Esc and clear
after the second (active-context stepping). No Esc behavior change is claimed.
User acceptance remains pending.
GitHub authentication initially blocked publication (HTTP 401 / missing Git
username). Access was restored and verified before delivery. Since PR #34 had
merged in the meantime, this follow-up uses a new branch/PR based on current master.


## Window-drag follow-up (2026-10-27)

The user reported that clicks were improved but moving a window still skipped
frames. Baseline `f7dd3a2`. A source-mapped CPU profile of a 36-move floating-library
drag found repeated docking ownership/context/pinning walks, global frame-slot and
drop-zone discovery, visibility reads and effects/layout work. The existing gesture
already lifted the real payload and committed saved layout only on release; the
problem was repeated secondary work, not per-pointer persistence.

Preview-only `createDragQueries` reuses read-only permission/ownership results until
the effective immutable layout snapshot changes. Mutating/final layout transactions
keep using the shared policy functions. Target lists and visibility are captured at
pickup; movement uses those snapshots, and release refreshes current frame slots,
visible zones and pointed destination/ancestor bounds. Pointer events retain only
the latest coordinates; one frame callback reads docking geometry before writing
the payload transform and publishing feedback. Final release resolves its own
coordinates even if no animation callback ran. No new settings/history store.

The cancellation check also exposed active-context Esc minimizing the source before
its drag could cancel. Active-context keyboard handling now defers while the shared
UI press owner is held. The existing drag handler cancels/restores first; physical
input ownership continues through release, protecting the scene from that press.

[Raw samples](performance/2026-10-27-window-drag.json) preserve default-effect CPU
profiles, intermediate builds and the final effects-off comparison. Whole-inventory
frame-slot queries fell 37 → 2 and drop-zone queries 76 → 2 over 36 pointer moves
(pickup/release only). With effects/bloom/atmosphere off and default panel blur
retained, median RAF interval fell 150 → 66.6 ms; max fell 1166.7 → 416.7 ms.
These headless software-GPU values are still slow, noisy and not physical
pointer-to-presented-paint latency. Default effects remained heavily graphics/paint
limited: an intermediate after run had a 10.9-second gap. Those default CPU runs
do not establish a speedup or hardware smoothness. Scene/effects/paint budgets and
real GPU/user verification remain separate work; no blanket smoothness claim.

The opt-in `scripts/profile-ui-drag.mjs <local-url> <report.json>` uses fresh local
storage and blocks external requests. `OMNIA_PROFILE_CPU` captures CDP CPU samples;
`OMNIA_PROFILE_DOM=1` counts the targeted global discovery queries;
`OMNIA_DRAG_EFFECTS=off` isolates core movement with effects/bloom/atmosphere off;
`OMNIA_DRAG_SMOKE=1` additionally checks single-step Undo, Esc cancellation,
header docking and docking Undo. Do not compare smoke/profile timing to an
uninstrumented hardware drag. The first fixture attempt lacked organized menus;
correcting the fixture exposed the library. An initial raw-string Undo equality
assertion was replaced with semantic layout equality; this then exposed the real
Esc/minimize bug above, which the corrected smoke now verifies.

279 model checks pass, including cache reuse and equivalence/invalidation under
pinning, ownership, context and missing-target changes. Focused browser checks pass
live payload, no saved layout during movement, release commit, one Undo restoring
the full layout, Esc cancellation without minimizing, header docking and docking
Undo, with no page errors. Type/build checks and the self-contained preview are
required for delivery. User hardware drag acceptance remains pending.


## First-use frame opening (2026-10-27)

The user confirmed window movement after `519169d` was much better, then clarified
that frame opening/expansion pauses only on first use. Later minimize/expand and
even close/reopen are smooth. Investigation switched from repeated toggles to a
fresh-page first-open comparison. Some first-use module/mount/layout work is real;
this change does not claim to remove all of it.

One avoidable cold path was caption setup in `NamePresentation`: each new caption
wrote attributes/styles, then read computed font size, invalidating styles again
before the next caption's read. Already decorated captions skip that font-size
read, matching the cold/warm distinction. The adapter now reads initial sizes in
one pass before symbol/tooltip/accessibility writes. Existing sizes, shared names,
visual roles, native fields, saved appearance and action/history routes are retained.

[Raw measurements](performance/2026-10-27-cold-frame-open.json): the first library
open generated 46 and 33 style recalculations in two baseline runs versus 12 after.
An isolated batch of 80 new 14px captions produced 82 recalculations before (both
runs) versus 3 afterward; all 80 symbol sizes remained 14px. First-open wall times
were 759/616 ms before versus 646 ms afterward—too noisy to claim consistent latency
improvement. These software-GPU/CDP timings include readiness and two RAFs, not
physical input-to-display latency. Module evaluation, component mounting, geometry
and paint remain separate costs. The preliminary CPU trace using a role query was
contaminated by the browser harness's accessibility scan; it is not latency evidence.

Opt-in reproduction: `node scripts/profile-ui-open.mjs <local-url> <report.json>`.
It uses a fresh disposable browser/storage, default UI and effects, blocks nonlocal
requests, measures first library open/collapse/re-expand separately and then checks
80 fresh caption sizes. `OMNIA_PROFILE_CPU=/tmp/prefix` optionally records each
phase's CPU profile; keep it off for timing comparisons. No app instrumentation or
background prewarming was added. Model/type/build checks and caption/live-control
smoke are required before delivery; user cold-open acceptance remains pending.


### Refined reproduction: drag immediately after expand

The user then identified the spike as dragging right after maximizing/expanding,
mainly on heavy frames' first use. Pickup still measured the source's entire
subtree as potential destinations, although a frame/window cannot dock into its
own descendants. Visibility/slot reads also ran after `beginLiveDrag` wrote its
popover/position styles, forcing newly expanded content through another style/layout
flush. Pickup now excludes that invalid subtree, retains ancestors/siblings,
reads visibility before lifting and finds the represented resident by exact ID.
Function payload candidate rules and final pointed-destination refresh are retained.

The drag diagnostic now supports `OMNIA_DRAG_EXPAND=1`: collapse/settle, expand and
immediately press/drag. With effects/bloom/atmosphere off (blur retained), rectangle
reads inside the library fell 63 → 22; these counts include all app observers over
the full expand/drag interval. Observed max RAF gap fell 783.2 → 183.3 ms, with the
same 50 ms median. These software-GPU results are directional, not a hardware
smoothness guarantee or an isolated measure of pickup latency. The settled drag
smoke must still pass release, single Undo, Esc cancellation and docking/Undo.

The heavier first-open diagnostic supports `OMNIA_OPEN_FRAME=master`: start the
Master controller closed in a fresh default layout, then open/collapse/re-expand.
First-open style recalculations fell 124 → 10 and sampled wall time 975 → 537 ms.
Warm timings varied. This confirms reduced cold setup work; it does not turn the
caption change into proof that all expand-then-drag latency is fixed. The raw report
includes both frames and the corrected interaction sequence. User acceptance remains
pending for the exact heavy-frame/GPU configuration.

Final focused drag smoke passed live payload, no movement persistence while held,
release, one-step Undo, Esc cancellation, docking and docking Undo, with no page
errors. One earlier attempt timed out waiting for the startup library action; an
isolated rerun passed. Native-button caption/identity and library field/current-
handler smoke also passed. The 279-model suite and production build passed;
self-contained delivery build type-checks the final source. For tab drags, pickup
excludes only the represented resident, not its shared pane/sibling payloads.


## Resize projection and repeated activation (2026-10-27)

The user reported two related issues after W resizing: Shift cycling applied on
release but pointing at a highlighted level did not, and subsequent frame/header
clicks exposed a white border and made the enlarged window alternate between its
selected position and a displaced one. They also clarified that drag lag happens
at each grab, with smooth movement afterward.

The resize defect was reproduced. React/Rnd replaced the imperatively added
projection class and inline transform during wrapper updates. With a native popover
still open, its 3px white default border became visible; a retained projected
left/top combined with the original Rnd transform to displace the window twice.
The projection now uses a persistent data marker and CSS variables independently
of React-owned inline geometry/className. It restores only its own variables and
marker. Collapsing an enlarged window also preserves original saved coordinates,
instead of clamping them against enlarged content bounds. Native control focus
indicators remain. No style-repair observer or per-pointer DOM scan was added.

`ConfigurationInteractionBoundary` now routes option pointer-entry/focus through
the shared temporary `select` adapter. Armed Shift release applies the highlighted
choice once. Pointing does not lock preferences; right-click apply/lock and left-
click priority-1 reset remain shared. Explicit unarmed configuration is unchanged.
AGENTS.md and FUNCTION_CONFIGURATION.md record this universal behavior.

Each normal window activation also allocated a new z-index and rerendered the
wrapper, including repeated grabs of the same front window. Floating windows,
user frames and detached embedded groups now share `useWindowLayer`: raising the
current front layer is a no-op, while a different window still rises. This removes
redundant activation work; it does not establish that all pickup latency is gone.
Drag-start snapshot/effects/layout costs remain subject to the earlier limits.

[Regression evidence](performance/2026-10-27-resize-viewport.json): the baseline
library re-expanded at x≈987/y≈592 with a 3px white wrapper border, versus its
selected x≈494/y≈296 rectangle. The follow-up returns to that selected rectangle
with the original zero wrapper border on every cycle, even after React replaces
its className. W restores original size and position. The focused local check
passes hover/focus release, no implicit lock, right-click lock once, left-click
reset, body-click stability, repeated floating/custom-frame collapse cycles,
original-geometry restoration, no browser border, and three re-grabs reusing one
layer, with no page errors. Existing projected-frame rigidity requires W restore
before dragging; an attempted projected-drag check was corrected to assert that
existing rule rather than waiting for an unavailable gesture.

281 model checks and type/production builds pass. Opt-in local reproduction:
`node scripts/check-ui-resize.mjs <local-url> <report.json>`. This is a correctness
and activation-work check, not physical input-to-display latency measurement.
Self-contained delivery build validates the final source; user acceptance remains
pending for resize stability and the repeated pickup pause on their workspace.

## Pickup and popup placement follow-up — user testing pending

The user reported the layer-only change did not solve pickup and felt worse.
Source inspection found two remaining unnecessary costs: eagerly measuring every
destination's child slots and promoting already-fixed body-mounted windows to
popovers, rewriting their geometry on each grab. The shared drag path now caches
bounds/child slots when needed. Already-fixed page-level surfaces preserve their
geometry and move with a composed transform; nested/tab surfaces retain lifting.

Free-drop projection also previously packed cursor-open popups into workspace
residents even though those popups render against the viewport. Rendering and
release now share the window's declared placement policy, without an Omnic-specific
exception. This addresses an identified placement mismatch; the user's exact
offset was not reliably reproduced and is not claimed verified resolved.

No additional browser profiling/testing was run for this follow-up. The user tests
repeated grabs, expanded/minimized release with edge docks, docking and Undo.
Previous white-border/resize projection fixes remain intact.
