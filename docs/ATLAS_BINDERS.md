# Atlas binder labels and reconnection

## Incoming context visibility

Binders are hidden until their downstream (target) placement is selected or
explicitly retained open by the existing content toggle. All its incoming parent
binders then appear together. Selecting/opening a source does not reveal every
outgoing child relation; open each downstream node to continue. Hover, Names,
and a structurally expanded parent alone do not expose relations. Hidden lines,
markers and labels are also excluded from pointer picking. Deselecting hides
incoming context unless explicitly retained open. Closing that retained content
hides it after deselection. This rule is shared by relationship, containment,
visual-nesting and variant binders. It covers direct displayed parents; ancestry
is explored incrementally. Existing structural filters still determine which
nodes/endpoints are available. No saved state, identity or migration changes.

## Perpendicular labels

All binder types share camera-facing text anchored directly at the binder midpoint.
Text extends perpendicular to its directed projected tangent. It keeps that side
and root as the camera rotates; upright glyph orientation does not switch sides.
There is no extra stem, obstacle search, alternate sample or hover-driven packing.
Long phrases wrap at 14 columns. Nearby content can overlap text and viewport
edges can cut it off; expansion-space realignment is deferred. Existing depth,
relationship visibility and minimum readable size checks remain.

## Drag to reconnect

Press an existing binder line, marker or label, then drag onto another node.
The endpoint nearest the initial press follows the gesture; the other stays
fixed. A four-pixel line hit tolerance makes thin lines easier to grab. Visible node content keeps hit priority; binder ink wins over invisible atomic
picking boxes so touching lattice cells cannot block the line. A normal
click still opens the existing binder editor. The drag threshold distinguishes
reconnection from a click, and camera panning stays suspended during the press.

The original connection remains intact during preview. A colored preview line
and the existing feedback readout show the candidate. Validation is refreshed
when the hovered node changes, not on every pointer motion. Hover checks omit
saved-view rebasing; drop repeats full validation against the current document.
A valid release commits one existing document/history transaction and reveals
the new visual parent/variant owner so its connected branch stays visible. Empty/invalid
release, Escape, lost capture, input suspension or stale document state cancels;
no provisional relationship is saved. Releasing after cancellation cannot open
the binder editor. Pointer capture and the existing shared camera/input lifecycle
own cleanup; no separate global gesture listener is introduced.

## Domain ownership and compatibility

`graph/reconnectBinder.ts` updates existing owners, preserving binder ID, text,
appearance and unrelated records. Entity identity/content is never overwritten.

- Typed relationship: replace the displayed first/second participant's entity,
  preserving that participant's role and all other participants/qualifiers.
  Canonical relationships are shared across placements; choosing another placement
  of the same entity does not change that canonical relationship's display policy.
- Containment: update the canonical parent/child pair. For a binder drawn from a
  particular nested occurrence, also replace that occurrence's visual parent link;
  the former target is detached when the target endpoint changes. Non-nested
  canonical edges do not change independent visual parentage elsewhere. Other
  occurrences retain their visual nesting even when the shared canonical edge
  changes. Duplicate pairs and containment cycles reject the whole edit.
- Visual nesting: replace the selected visual parent link without creating a
  canonical composition. Target replacement retains the prior binder styling.
- Variant: update the canonical owner/variant reference while retaining its ID
  and presentation. Prior occurrences no longer owned by that reference detach
  as ordinary nodes; their entities/content and positions are retained. The chosen
  new endpoint receives the reference, and existing variant materialization supplies
  occurrences for other placements of the new owner. This can add placements,
  never replacement entities. Duplicate owner/variant pairs and visibility cycles
  reject validation.

For nested/variant target replacement, a target already owned/nested elsewhere
must first be detached; the gesture does not silently replace its unrelated
owner. Collapsed/projected endpoints that no longer identify the actual canonical
participants must be expanded before reconnection. Missing or stale endpoints,
self-drop on the fixed endpoint, cycles and conflicting ownership are rejected.

`coordinates.rebaseParentage` is the shared conversion for reconnection and the
existing Detach action. It preserves live and saved-view world XYZ while rebasing
parent-local coordinates, including protected lattice recovery views. Existing
2D fallback coordinates also rebase, subject to their historical minimum child
header offsets. These legacy 2D constraints can clamp a newly nested fallback;
actual 3D positions remain unchanged. The normal lattice owner handles newly
materialized variant occurrences at commit.

No new save schema, migration, identity store or backend deployment is introduced.
Existing document validation, autosave, undo/redo and atlas/workspace export remain
authoritative. Undo reverses one reconnection transaction; reload retains the
committed connection. Hover/label layout never changes saved data.

## Verification route

Select its downstream node to reveal the binder first. Try a short relationship, rotate the view and hover nearby text: the label stays
rooted directly at its midpoint without a leader or obstacle-driven relocation.
Then test normal editing, both reconnect endpoints, cancellation and Undo/reload.
Model checks cover a full rotation of fixed-root geometry and degenerate tangents.
The earlier authorized browser diagnostic covered the superseded packed layout;
its viewport-fit assertions do not validate this fixed-root behavior. No new
browser check was run. Full workspace interaction acceptance remains user-owned.
