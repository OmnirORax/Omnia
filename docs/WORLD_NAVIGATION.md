# Explicit world navigation

`world.navigate` defaults to MB2 on the world canvas. Shift plus its configured
binding opens only World navigation in the contextual MC. Repeat/scroll cycles
modes; release Shift arms one drag with the draft. Right-click a mode or shared
parameter choice applies and locks the configuration. Left-click a mode restores
priority 1 (Orbit); other draft parameters remain independent. The camera guide
and existing mouse-settings resident expose the same command for clickable use.
The former right-drag Pan preference reads as Pan view; an explicit Off preference
migrates to an unbound command. Rebinding/clearing is honored. MS retains its higher
priority while aiming. No per-feature Shift listener exists.

| Mode | What moves | Center / constraint |
| --- | --- | --- |
| Orbit pivot | Camera | Focus point, selection center, pointed node or world origin |
| Look around | Camera facing | Camera's fixed position |
| Walk / strafe | Camera and its focus point | Ground plane with fixed height, or camera forward/right |
| Pan view | Camera and focus point | Camera view plane; facing stays fixed |
| Turn nodes | Node presentation orientation | Each target's own center |
| Rotate layout | Target positions | The chosen pivot; node facing stays fixed |

Node targets explicitly choose Selected or Pointed. Include descendants expands
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
gesture readout. No selection/pointed-node fallback is silently guessed.

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
camera focus/look/pan does not traverse the node inventory or raycast it. Native
context-menu picking is deferred until a real click. Node transforms support up
to 256 targets per gesture and reject larger sets explicitly. Pointer cancellation,
page suspension, document/selection changes and teardown restore unfinished node
previews; the original expanded data/resources remain intact. These bounds reduce
new work; they do not establish a fix for the remaining system-wide lag report.

Model checks cover radius/camera-origin/translation constraints, orientation
round trips, selected/descendant layout invariants, cancellation, exactly-once
commits, legacy settings and camera-only inventory avoidance. Browser interaction
verification remains with the user under the existing repository preference.
