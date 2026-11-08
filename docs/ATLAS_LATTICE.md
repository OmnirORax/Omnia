# Atlas lattice

## Operating model

The atlas uses one sparse, fixed XYZ lattice across all placements in the active
atlas document. Parentage, collapse, hidden state, frames and focus filters never
create another occupancy field or free a hidden node's slot. Relationship labels
becoming nodes and contextual summoning remain future work; this change does not
introduce another knowledge store or author semantic relationships.

`graph/lattice.ts` prepares safe-integer cell addresses and a cell-to-placement
index from the existing shared world-coordinate resolver. One cell is one logical
unit. Historical `nodeCellSize` remains the coordinate-unit conversion (default
1); it is retained for compatibility. New `latticeScale` changes rendered pitch
and O diameter together without changing addresses or stored coordinates. The
former Node cell size resident now edits Lattice scale; historical values are not
silently reinterpreted. Expanded text/images/glyphs retain independent world sizes. Selected nodes replace
their atomic O with full content while retaining the pulsing selection ring;
deselection restores the carrier.
Their invisible picking slot stays available. Existing retained expansions, hover
previews and Names modes remain independent, so deselection does not discard a
separately retained expansion.

Creation picks the nearest unoccupied cell to the requested world point, including
N/Create node here and library placements. Distance is Euclidean; ties are stable.
Dragging finds a nearby legal landing for the entire descendant branch. Arrow
movement chooses distinct signed world axes nearest the camera axes at gesture
start, then repeats whole cells; a blocked landing is rejected instead of allowing
an overlap or silently choosing another arrow destination. Hidden descendants move
with the branch and remain part of collision checks. Inspectors, compaction and
committed object-layout transforms settle through the same occupancy owner.
Object-layout rotation prepares its occupancy adapter once per gesture; previews
snap to cells and reject duplicate/occupied targets, then commit through the same
lattice owner. Carrier expansions can still overlap
when their independent content cannot fit; the carrier cells themselves stay unique.

No global cell volume is allocated. Occupancy is cached per immutable document and
legacy unit. Nearest-free search uses a sparse distance-prioritized frontier,
sharing frontiers for coincident historical nodes. Movement prepares descendant
membership/offsets once per document/target, not once per pointer move. Queries
use map lookups and have a 250,000-candidate safety budget; failure leaves the edit
uncommitted. This is bounded work, not a claim of tested interactive performance.

## Controls and a practical scale experiment

The upper-right atlas stack, below Focus context only/Names, exposes **Lattice
scale** and **Empty lattice cells**. Both also live in Spatial settings and shared
UI discovery. The existing UI registry, field arrangement, settings history and
UI/workspace backup owners remain authoritative.

Enter a positive finite scale such as `0.1`, `0.001` or `1e-6`, then press Enter or
leave the field. It applies on commit so partially typed scientific notation is
not lost. Invalid/nonpositive input restores the current value. Scale multiplies
cell spacing, O geometry, picking boxes, outlines and arrow steps together. The
camera target follows the same logical area while its viewing distance remains;
zoom stays independent. Near clipping and minimum dolly distance follow pitch,
and wheel redraws do not depend on OrbitControls' fixed change epsilon. Revert
scale to 1 or use settings Undo to reverse the experiment.

There is no authored minimum radius or Photoshop-style world pixel. Finite-number
underflow/overflow, GPU precision, depth behavior, rendering and very distant
coordinates still impose practical limits. No floating-origin system, arbitrary-
precision coordinates or GPU/browser acceptance is claimed. Very small scales
can become invisible or unreliable; this is an experiment to identify those
boundaries, not a promise that all positive JavaScript numbers render correctly.

**Empty lattice cells** covers the visible screen horizontally and vertically at
its current zoom. A bounded screen-space sample grid casts into the same real
lattice-aligned creation slice through the camera target. Resizing updates the
sample grid; zoom, pan and rotation update its world intersections. Real-cell
addresses deduplicate repeated samples, and occupied cells remain omitted. One
instanced draw holds at most 16,384 markers. The screen sample spacing is at least
eight CSS pixels (larger for budgeted large viewports). Fine cells at overview
scales are sampled, without enlarging cell diameter; unsampled empty cells remain
available for creation. No fixed world patch or artificial distance horizon is
used. Unchanged camera/projection/viewport state reuses instance data.
The slice chooses
the closest fixed lattice orientation to the camera. Occupied cells, including
filtered-out nodes, have no empty marker. The field follows panning and is a
bounded creation aid, not a full infinite or fully drawn 3D volume. Aim at an O
and use N or Create node here; with the field shown, creation intersects that same
slice. Plain node click now mounts the navigator driver; an empty-slot click parks
or relocates it with camera follow. See WORLD_NAVIGATION.md.

## Existing saves, recovery and persistence

Loading or renaming historical content never rewrites coordinates. The renderer
projects old off-grid/overlapping positions onto unique cells; exact existing
cells have priority, followed by stable placement order. IDs, parentage, content,
relationships, authored 2D positions and saved layout views stay intact.

On the first geometry edit, historical coordinates may need alignment so moving
or deleting an old overlap cannot shuffle unrelated displayed carriers. Before
writing that alignment, the same document transaction creates an ordinary manual
layout view named **Before lattice alignment**, with `preservePositions: true`.
It retains the original local XYZ positions and is not overwritten by switching
away from it or by the active-view autosnapshot. Equivalent recovery snapshots
are reused. If the view budget is exhausted, the edit fails without dropping the
original. Undo reverses the whole transaction during the session. Recovery view
positions persist in the existing atlas/workspace export and save formats.

Selecting the recovery view restores its source coordinates; the current lattice
renderer still projects them onto cells. Exported saved positions remain available
for inspection or use in an older client. There is no automatic conversion back
into free-space rendering. Original saved views are not aligned merely by switching
to them; a later explicit geometry edit uses the same recovery rule.

Settings add `spatial.latticeScale` (default 1) and `showVacantCells` (default false).
Layout views add an optional boolean `preservePositions`; document version stays
2, with existing validators and reference-remapping owners. Unknown invalid flags
reject validation. Older clients ignore the additive fields: they can render the
old free-space behavior, drop settings on resave or overwrite a recovery snapshot
when editing/switching views. Avoid editing the same save through an older client
when recovery retention matters. Existing storage/recovery concurrency limits
remain; no cloud atlas sync or backend rollout is introduced.

## Verification

Model regressions exercise global hidden occupancy, nearest-cell distance,
serialized legacy recovery, protected snapshot switching, subtree collisions,
source immutability, nongeometry edits, tiny-scale arrow commits, dense coincident
nodes, settings normalization and bounded instanced empty fields. Required full
model/build/backend checks are recorded in the capability guide. No browser suite
or performance profiling is run for this change; the user owns visual/interaction
acceptance and the scale threshold experiment.

Drag landing preview uses a camera-facing circular cell outline at the current
lattice diameter, independent of content size. It retains cyan valid/red invalid
feedback, snapping, nesting targets and existing cancellation/disposal. This is a
transient renderer change; saved coordinates, formats and history are unaffected.
Visual confirmation is user-owned.

Atomic carrier visual update: actual translucent SphereGeometry (.5 radius before the existing diameter scale), Phong material using existing lights, opacity .28 times authored opacity, depthWrite false. Do not billboard spheres; selection ring and text still face camera. Existing picking, occupancy, selection/content replacement, data and paint previews remain unchanged. No new rendering/depth pipeline in this first pass.

Paint preview/saved carrier parity: use atomicCarrier geometry/material for both. Bubble surface alpha ranges from .0045 at centre to .18 at rim times authored opacity; supersedes flat .28 opacity. Commit world points against stored parent worldPositions, not projected latticeWorld parent cells, before shared reconciliation; otherwise off-grid historical parents shift confirmed strokes. Existing recovery remains intact.

Sphere translucency is a shared numeric property on omnium.nodes.body (MS → Visuals). Range 0–1, absent default .82, independent of opacity. Both saved and preview carriers read renderDefaults; atomicCarrier owns material alpha and live uniform updates. Use existing targeting sets/locks/controller history, not a separate slider or graph field.

Carrier visibility trial: shared atomicCarrier shader adds a thin neutral light outer/dark inner rim, measured using screen derivatives of sphere facing. It strengthens edge alpha while respecting authored opacity and full translucency, retaining coloured translucent centres. Saved and preview materials share it. No background dimming, extra render pass or saved fields; visual acceptance remains user-owned.

Contrasting-rim trial rejected by user: restore the smooth shared bubble surface, preserving translucency controls, preview parity and sidebar/HUD fixes. Do not reintroduce the screen-derivative light/dark contour. Busy-background readability remains unresolved; discuss the next direction before another styling experiment.

User reference: keep the existing smooth spheres as against a plain dark background, unaffected by wallpaper detail. Use carrierBackdrop neutral footprint isolation ahead of all graph ink; do not change sphere material, add rims or dim the entire wallpaper. One instanced batch tracks visible saved and preview sphere transforms; opacity-zero, selected/hidden and absent-wallpaper cases leave no patch. Backdrop excludes picking/depth writes and shares the scene render owner/disposal. Node-to-node transparency remains. Visual acceptance is user-owned.

Backing masks rejected: remove carrierBackdrop entirely. Current approach strengthens soft sphere edges using authored colour/Glow, honoring Opacity and Translucency; wallpaper remains visible through them. atomicCarrier attaches the same smooth surface coverage to derived bloom masks through materialCoverage, preventing filled-disc glow. Saved and preview materials share settings. No neutral rims, backdrop discs, extra scene pass or independent input/property controls. Visual acceptance remains user-owned.

Whole-sphere adaptive blending is a temporary View → Sphere blending comparison experiment, disabled by default and isolated from the live atlas. Shared sphereBlend wallpaper sampling drives both controlled backgrounds and the trial material. Per-view uniforms avoid global state; base fragments sample wallpaper once when enabled, bloom retains authored edge glow. Preserve hue via scalar RGB gain and bound alpha by authored settings. No universal contrast promise, no full-scene/node sampling, and no hardware performance claim from software timings. The user’s go authorizes one focused synthetic comparison/measurement at 100/1,000/5,000 spheres, not broad suites or repeated profiling. Trial settings/results are transient; use existing floating UI and render budgets/owners.

Comparison evidence (2026-11-07): focused local Chromium checks compile actual base/adaptive/bloom paths and verify linked orbit, off/zero parity, four backgrounds, a paired 100/1,000/5,000 run, and unchanged authored state. A separate untimed synthetic texture probe verifies exact sampling and off/zero parity for wide/tall viewports. Both default and explicitly software browser contexts expose SwiftShader and no GPU timer; CPU/driver call durations do not establish hardware GPU cost. See performance/adaptive-spheres-2026-11-07.json. Instanced transparent ordering and submission costs differ from the full atlas; user visual acceptance and hardware measurements remain pending.

User correction: retire the separate adaptive comparison UI/synthetic scene/timing controls. Keep shared wallpaper sampling, shader hooks and useful parity tests. Live sphere-body properties adaptiveBlend (false default) and adaptiveBlendStrength (.65 default, 0–1) use normal MS Visuals applicability/controller serialization/history. Per-world uniforms update actual spheres and paint previews; viewport sizing/texture lifecycle remain existing owners. Adaptive brightness must not change alpha/opacity. No new browser authorization or performance claims are inferred from the earlier comparator check; live-scene acceptance remains user-owned.

Whole-node blend controls supersede the brightness-only fixed-alpha rule above: keep shared serialized adaptiveBlendMode (Auto contrast/Screen/Multiply/Difference/Soft light/Normal colour) and adaptiveBlendCoverage (0–1, absent 1) under Adaptive blending. The explicit Body coverage floor is authoredOpacity × (1−Translucency) × coverage × strength, never an opaque backing. Off/strength0 retain original rendering; coverage0 retains legacy bubble alpha. Modes act across the base surface; only Auto contrast promises hue-preserving brightness, and saturated channels limit it. Reuse the portable mode descriptors for UI and shader indices, per-world uniforms, actual carrier/paint materials, existing Apply/Discard/history. Do not recreate a comparator. User chose preview testing; no new browser or hardware-performance acceptance is inferred.

Radial sphere transmission: Translucency → Translucency radius is a shared sphere-body-only numeric property (0–1, absent/neutral 1). Radius 1 preserves previous all-surface transmission; below 1, centre transmission remains authored inside that projected radial fraction and smoothly falls to zero at the silhouette. Shared base/bloom coverage uses an authored-opacity uniform so fully clear centres can retain shells; zero authored opacity clears everything. Adaptive blending uses local transmission. Actual nodes/live theme updates/paint factories inherit the same radius. No UI transmission radius, physical refraction, backing mask or new pass. Existing controller Apply/Discard/history owns persistence; preview acceptance stays user-owned.

User-selected sphere defaults supersede previous absent/default values: shared sphereVisualDefaults defines orange #ffb000 (approximate screenshot match), Glow .35, Opacity 1, Translucency .70 and Translucency radius .76. Fresh workspace node style, MS base resolution and actual/preview carrier fallbacks inherit this definition. Saved explicit styles/controller values, including zeros and radius 1, remain authoritative; missing transmission fields intentionally pick up the new defaults. Radius 1 still selects historical all-surface transmission. UI translucency and adaptive blending defaults are unchanged. No graph/schema migration or browser acceptance is inferred.


Wallpaper-to-sphere blending retirement (2026-11-08) supersedes the adaptive
comparison/live blending notes above: the user discarded that feature during
PR #58 conflict resolution. Remove its wallpaper sampler, shader hook, controls
and comparator fixtures. The four former adaptiveBlend* fields remain validated
archive-only controller values; they have no applicability or resolved renderer
values. Normal sphere material, edge glow, Translucency and Translucency radius
remain independent of wallpaper. Keep master's newer orange sphere defaults as
explicitly confirmed by the user. Paint strokes and full-viewport layout remain.
