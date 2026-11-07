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
- Drag empty space with a selection: orbit the current branch anchor while preserving the current radius/zoom.
  The active parent/child center is the pivot; rotation never automatically fits
  the subtree or resets the zoom.
- Drag empty space with no selection: look around from the camera's own position.

Camera / Object overrides what moves for that target context. Camera on a node
orbits it; Object over a selected graph rotates selected positions about the
branch anchor. With no object selected or pointed, the camera turns itself.
Free object rotation uses a virtual trackball centered on its pivot. Grabbing near
its center tilts/turns; dragging tangentially near its rim spins about the view axis.
The camera frame, projected center and size are measured once at pointer-down.
The virtual sphere continues over its back hemisphere instead of flattening at
the rim, so straight vertical/horizontal drags permit repeated full turns.
Hold Ctrl during navigation to choose horizontal/vertical motion from the first
clear drag and freeze its rotation axis, ignoring perpendicular jitter. Release
Ctrl to resume free movement without a jump; a new Ctrl hold chooses a fresh axis.
This is native gesture metadata on the existing action, not a separate shortcut.
Incremental quaternions permit repeated turns; explicit X/Y/Z constraints retain
axis-only dragging. This applies to node facing and selected-layout rotation,
with the existing pivot, target limits, cancellation and one-commit history path.
No DOM geometry reads or bounds scans occur during trackball movement.

Target and pivot freeze at pointer-down; moving over another node
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
Context rotation raycasts once for its frozen target. Rotation does not scan
subtree bounds or alter zoom. MC → Active context → Frame selected front-on explicitly
fits up to 256 selected mounted objects once and aligns the camera with the active
object’s front/up plane. Object orientation stays unchanged; Back/Camera undo
restores the view. The existing Focus command/shortcut (F by default) invokes this same framing action. Front-on framing
stays perspective: flat node/text planes face the camera without perspective
skew, while volumetric assets remain 3D. Picking refreshes the camera matrix before
ray setup and initializes new scene matrices before accepting hits. Node text
remains a hit surface alongside sphere/asset body proxies. Native
context-menu picking is deferred until a real click. Node transforms support up
to 256 targets per gesture and reject larger sets explicitly. Pointer cancellation,
page suspension, document/selection changes and teardown restore unfinished node
previews; the original expanded data/resources remain intact. These bounds reduce
new work; they do not establish a fix for the remaining system-wide lag report.

Model checks cover radius/camera-origin/translation constraints, orientation
round trips, selected/descendant layout invariants, cancellation, exactly-once
commits, legacy settings, contextual target freezing, active branch pivots,
explicit front-on framing, zoom preservation and camera-only inventory avoidance. Browser interaction
verification remains with the user under the existing repository preference.

New node uses the shared current-context creation path for its catalog command
and clickable control: a selected placement is its parent; otherwise a single
focused branch is its parent. With no unambiguous parent it creates at root.
Explicit Create node here remains a world-position/root action.


## Atlas lattice movement (2026-11-07)

Atlas arrow axes now choose the nearest distinct signed fixed-world axes at the
start of a gesture. They do not rotate the lattice with the camera. Each repeat
moves one rendered cell (legacy coordinate unit × Lattice scale); occupied branch
landings are rejected and hidden/filtered nodes still reserve their cells. The
held gesture keeps one commit/cancel lifecycle, including sub-microunit rendered
steps without a fixed world-distance completion epsilon. Node orientation remains
separate from lattice occupancy. Layout rotation previews snap to cells and reject occupied/duplicate targets
through a prepared shared gesture adapter; commits use the same lattice owner. See
[ATLAS_LATTICE.md](ATLAS_LATTICE.md) for placement, scale and precision limits.

## World navigator and driving a node

The cyan ring/centre with a single end-to-end orientation line is a transient
navigator, not a knowledge node. On first world interaction it starts on the
camera-facing XY plane through the current camera target. Its internal frame
matches the camera orientation like a compass: mouse rays resolve local XY at
the chosen depth, and camera rotation updates that frame. Positive local Z points
toward the camera (Down); negative Z points away (Up). The ring faces the camera,
while its single cyan diameter projects world X through the inverse camera
rotation. It stays end-to-end rather than shrinking; an exactly end-on projection
retains the last direction. Orbit/roll update its orientation without adding XYZ
axes, independently of the movement frame;
independent navigator rotation controls are deferred. Parallel/behind rays
cannot invent a usable destination.

Up/Down (Navigator forward/backward, rebindable) step one rendered lattice pitch along
local Z. Holding uses the existing bounded held-movement scheduler, rather than
OS repeat queues. Plain arrow ownership is local to the world canvas, including
when a node is selected. UI/text/blocked input, active selectors' higher-priority
commands and explicitly rebound shortcuts retain shared arbitration. Left/Right
retain existing selected-node movement outside a drive; they cannot start a second
geometry gesture while a node is controlled. Leaving the canvas or losing capture/
focus stops held motion; no catch-up steps occur after a stalled frame.

A plain left-click on a node selects and mounts it as the driven object. The
camera translates with its target to the node while preserving view angle,
offset and zoom. The grab is rebased after camera follow so the first movement
cannot jump the node. Mouse/depth then preview the branch on the navigator plane.
The driven root is ignored for drive-target clicking, so its own marker cannot
mask an empty parking slot. Other nodes, including its descendants, retain normal
detection and can become the next controlled node. All other world selection remains ordinary projected hits;
there is no new depth-only selection restriction.

Ctrl/Meta-click a node to position the navigator and camera target there without
mounting or moving it. The node becomes the selected context; mouse and depth
movement then move only the navigator. Any unparked drive is canceled, restoring
its starting placements. Ctrl-drag still adds a marquee; Shift-click keeps spatial
range selection and other surfaces keep their modifier-click behavior. The shared
selection registry captures the original hit before renderer changes and dispatches
the optional surface modifier-click action only on a non-drag release.

Click an empty slot to park and unmount. The last valid snapped placement commits
once through normal document/history/autosave ownership; the camera follows it.
Click another node to park the first at its last valid preview and mount the next.
Blocked destinations show a red navigator and retain the last valid node preview;
invalid empty-slot parking is rejected. Esc cancels and restores starting
placements. UI capture, pointer cancellation, document/context replacement and
scale changes cancel incompatible previews. Hidden descendants still reserve
cells and move with their branch. At most 256 visible preview hosts are allowed;
geometry preparation uses existing sparse occupancy and renderer adapters.
No scene object is added to picking or persisted as an entity.

Right-click retains node/binder actions, including inspection and expansion.
Plain node clicks now drive instead of the prior delayed options/double-click
entry; existing explicit subtree/selection modifier gestures keep their ownership.
Dragging before mounting still uses the navigator's plane and existing constraints.
Creation (N and Create node here) reads the navigator location, then uses ordinary
nearest-free placement. After first world interaction, creation controls also use
its last world point while the mouse is over UI. Node creation, insertion, Omnic
drafts/copies and library placements share parent-local lattice conversion; saved
draft locations remain authoritative. Camera movement is camera history; parking is document
history; pointer/depth previews never write either. Navigator location/orientation
and the mounted state do not persist or enter graph undo. Browser interaction and
performance acceptance remain user-owned.

2026-11-07 authorized focused local Chromium check passes mount/camera follow,
mouse preview, camera-relative depth preview, empty-slot parking/save and Esc
cancellation. It also checks that the first one-pixel movement does not jump the
node and camera offset/direction/zoom stay intact. That earlier check used the old
arrow direction. The subsequent compass, reversed arrows and Ctrl-click changes
have model/build coverage only; the user chose to test the new preview.
No page errors were reported. Disposable synthetic data, local server and blocked
external requests only. Opt-in: OMNIA_URL=http://127.0.0.1:5182 node
tests/world-navigator.browser.mjs. This is not standing browser-suite permission
or full workspace/undo/reload/performance acceptance.

Camera follow retired: node mounting, parking, empty clicks and Ctrl-click navigator positioning must leave camera position/target unchanged. Only explicit navigation/framing actions move the view. Pointer grab rebasing remains; no click writes camera history. This supersedes earlier follow semantics.

Alt-left-drag atlas painting inherits the Composer-owned paintStroke sampler; do not duplicate sampling policy. Start empty for blanks or on a node for independent content/visual copies (no subtree/relationship copy). Atlas adapters own camera-plane conversion, sparse occupancy, transient instanced outline preview (256 max), and one existing document/history commit on release. Skip occupied/hidden/repeated cells. Esc, capture loss and document replacement cancel. Camera stays fixed. No browser acceptance inferred.

Paint preview/saved carrier parity: use atomicCarrier geometry/material for both. Bubble surface alpha ranges from .0045 at centre to .18 at rim times authored opacity; supersedes flat .28 opacity. Commit world points against stored parent worldPositions, not projected latticeWorld parent cells, before shared reconciliation; otherwise off-grid historical parents shift confirmed strokes. Existing recovery remains intact.
