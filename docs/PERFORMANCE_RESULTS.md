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
corrected path opened the section and passed. User hardware acceptance is pending.
