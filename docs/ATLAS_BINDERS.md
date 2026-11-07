# Atlas binder labels and reconnection

## Perpendicular labels

All typed relationships, containment, visual nesting and variant binders use the
same camera-facing text renderer. A label attaches to its binder and extends
perpendicular to the projected local tangent, rather than sitting horizontally
between its endpoints. The label's near end touches the binder with a small gap.
Text stays upright; on the opposite side its other end can be the attached edge.

The shared screen-space owner tries both sides of seven samples along the binder,
starting at its midpoint. A single spatial index contains visible carrier bounds,
expanded node content and accepted labels. Rotated rectangles are checked using
separating axes, with viewport boundaries enforced. No node, binder path or stored
coordinate is moved, and labels retain their authored size/style. If no candidate
fits, the text is omitted rather than drawn over a node; the line/marker remains
selectable and its existing editor retains the label. Very small labels retain
the existing visibility threshold. This does not promise that every label fits
in an arbitrarily crowded view.

The work runs inside the existing coalesced camera/layout update, with bounded
candidates and indexed local obstacles. No DOM measurement or new global pointer
listener is added. Browser visual/performance acceptance remains user-owned.

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

Try a short relationship between close nodes: its label should stand out from
the binder toward a clear side instead of falling inside a carrier. Pan/rotate
and expand nearby content; text should reorient or choose another attachment.
Then click the line normally, drag near each endpoint to another node, cancel
with Escape and try an invalid/empty drop. Reload after a valid rewire, then test
Undo in a fresh session edit. Repeat for containment, visual nesting and variants.
Model/build evidence is recorded in the capability guide; browser acceptance is
pending and no browser suite was run for this change.
