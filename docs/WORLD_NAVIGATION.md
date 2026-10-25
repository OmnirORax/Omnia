# Contextual world navigation

`world.navigate` defaults to MB2 on the world canvas. Shift plus its configured
binding opens only World navigation in the contextual MC. Repeat/scroll cycles
Camera / Object; release Shift applies the draft to the current navigation context.
Right-click an option or shared parameter choice applies and locks the configuration.
Left-click an option restores priority 1 (Camera); other draft parameters remain
independent. The camera guide and existing mouse-settings resident expose the
same command for clickable use.

Default rotation resolves at pointer-down:

- Drag directly on a node: turn that node at its own center.
- Drag empty space with a selection: orbit the current branch anchor, fitting its
  visible subtree once as the drag starts. The active parent/child center is the
  pivot; bounds determine distance, never the pivot. Fitting only moves outward.
- Drag empty space with no selection: look around from the camera's own position.

Camera / Object overrides what moves for that target context. Camera on a node
orbits it; Object over a selected graph rotates selected positions about the
branch anchor. With no object selected or pointed, the camera turns itself.
Free object rotation uses a virtual trackball centered on its pivot. Grabbing near
its center tilts/turns; dragging tangentially near its rim spins about the view axis.
The camera frame, projected center and size are measured once at pointer-down.
Incremental quaternions permit repeated turns; explicit X/Y/Z constraints retain
axis-only dragging. This applies to node facing and selected-layout rotation,
with the existing pivot, target limits, cancellation and one-commit history path.
No DOM geometry reads or bounds scans occur during trackball movement.

Target, pivot and fit membership freeze at pointer-down; moving over another node
never retargets an active drag. The optional descendant expansion remains explicit.

The former right-drag Pan preference reads as Pan view; an explicit Off preference
migrates to an unbound command. Rebinding/clearing is honored. MS retains its higher
priority while aiming. No per-feature Shift listener exists.

| Mode | What moves | Center / constraint |
| --- | --- | --- |
| Orbit pivot | Camera | Focus point, current branch anchor, pointed node or world origin |
| Look around | Camera facing | Camera's fixed position |
| Walk / strafe | Camera and its focus point | Ground plane with fixed height, or camera forward/right |
| Pan view | Camera and focus point | Camera view plane; facing stays fixed |
| Turn nodes | Node presentation orientation | Each target's own center |
| Rotate layout | Target positions | The chosen pivot; node facing stays fixed |

Navigation retains separate session choices for pointed nodes, selected graphs
and empty world in each focus/branch context. Reopening configuration or dragging
again restores that context's options; global locked defaults remain the fallback
for a new context. These session choices do not survive reload. Explicit advanced
navigation modes remain available through the shared property editor:
Include descendants expands
that set once, including hidden descendants, with stable placement IDs. Selected-
only layout rotation holds unselected children's world positions fixed by adjusting
their local offsets. No identity, relationship, composition or visual-parent edges
change. Plain spheres are rotationally symmetric; their facing is still stored.

All modes expose Free or a world X/Y/Z axis and shared Drag sensitivity (0.1–2).
Camera rotation transports its up/right frame continuously through the poles,
with unrestricted full turns and reversible diagonal drags. The former upright
pitch clamp is removed; the retained `navigation.upright` flag now controls only
ground-plane walking. Explicit world axes permit axis-constrained turns. Orbit reports/enforces the
actual OrbitControls radius limits (1.2–100,000 world units), instead of silently
jumping to a clamped radius. Walk has explicit ground/fixed-height or free-forward
translation; An explicit world axis overrides the plane restriction, including vertical movement. Pivots and axes are marked in the
scene where visible, with coordinates and affected objects in the controller/
gesture readout. The contextual defaults above are explicit; invalid explicit targets report an error.

Inputs are declared once in `navigation/navigation.function.ts` through the
shared property/function registry. Controller, setters, saved functionValues and
rendered gesture options reuse them. Sensitivity is a dimensionless pointer gain,
not animation Speed. `visualRole` discovery and canonical appearance are unrelated
to world transforms; target capabilities never imply knowledge semantics.

`Placement.orientation` is an optional normalized quaternion `{x,y,z,w}` describing
visual facing. Document import validates it; export/undo preserve it. It rotates
the node's existing world objects/text/asset together, independently of its child
positions. Selection rings compensate parent orientation to remain camera-facing.
Both node modes commit once through the existing document/journal path on release.
Completed camera gestures and native pan/zoom use the shared `world.camera` view
adapter, with Camera as a selective history category. Focus/roll/origin/back view
commands also record their completed pose/context changes. Existing Back navigation
remains available. Previews and canceled gestures never enter the journal.

Preview uses existing Three.js transforms and one reusable axes helper. There is
no animation loop, per-pointer React update, persistence or DOM discovery. Context
membership/pivots are cached for the configuration/gesture snapshot; ordinary
explicit camera focus/look/pan does not traverse the node inventory or raycast it.
Context rotation raycasts once for its frozen target. Graph fitting snapshots the
subtree once and bounds only mounted node hosts on the first actual movement;
subsequent pointer moves do not rescan it. Native
context-menu picking is deferred until a real click. Node transforms support up
to 256 targets per gesture and reject larger sets explicitly. Pointer cancellation,
page suspension, document/selection changes and teardown restore unfinished node
previews; the original expanded data/resources remain intact. These bounds reduce
new work; they do not establish a fix for the remaining system-wide lag report.

Model checks cover radius/camera-origin/translation constraints, orientation
round trips, selected/descendant layout invariants, cancellation, exactly-once
commits, legacy settings, contextual target freezing, active branch pivots,
once-only fitting and camera-only inventory avoidance. Browser interaction
verification remains with the user under the existing repository preference.
