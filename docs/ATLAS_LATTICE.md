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
