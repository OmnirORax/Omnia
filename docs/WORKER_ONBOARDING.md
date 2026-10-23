# Worker onboarding: Omnia's shared mental model

Read this once at the start of work, including after a context reset. It explains
what the systems mean before you need to inspect their implementation. Read only
the relevant subsystem reference afterward; do not rediscover the whole project
for each task. Repository entry rules live in [AGENTS.md](../AGENTS.md).

This is a map and a set of contracts, not proof that every feature implements them
correctly. Check the affected path when changing it. Update these documents when
a decision or implementation changes; do not leave the next worker to infer it
from a long chat, an old PR or a contradictory comment.

## Product and direction

Omnia is an environment for humans and AI to construct and explore structured
knowledge. **Omnium** is its spatial, genuinely 3D nodegraph workbench. **Omnic** is
a proposed structural/visual language whose grammar is not yet designed. Do not
invent that grammar, infer truth from appearance, or rebuild a 2D editor as part
of unrelated work. [Project direction](../PROJECT_DIRECTION.md) gives the broader
product constraints.

The interface itself is user-arrangeable and customizable. A newly added feature
should inherit shared behavior rather than arrive as a fixed, isolated widget.
Stable identity, stored values and user customization must survive rearrangement,
renaming, renderer changes and upgrades.

## Responsiveness

The user requires features to preserve responsiveness. Flag an approach likely to
cause significant lag before implementing it, explain the cost and offer practical
workarounds. Account for selection, pointer movement, live editing and large scenes
from the outset. Follow the performance rule in `AGENTS.md`; do not rely on the
user repeatedly discovering regressions. Builds alone do not verify smoothness.

## Essential distinctions

| Concept | Meaning and boundary |
| --- | --- |
| Entity | Canonical knowledge identity; several representations can refer to it. |
| Composition / relationship | Authored structural or typed knowledge; visual proximity is not evidence of either. |
| Placement | A representation referencing an entity, with independent visual parent, coordinates and visibility. |
| Investigative frame | A scoped view of knowledge references; distinct from a UI frame. |
| UI resident / UI frame | A live action, field, group or window and its presentation container. Nesting these does not assert knowledge. |
| Function / action | Behavior exposed to the UI. Its stable ID is independent of caption, icon, location or assigned shortcut. |
| Property | A reusable definition of something adjustable. A definition is distinct from a consumer's value and from its editor. |
| Coupling, agreed general design | A consumer uses a shared property/setter. Consumers retain independent values; coupling does not synchronize them. |
| Target | The object or part an operation can affect. Its identity is separate from its visual role and selection boundary. |
| Selection | A transient choice of targets. Selecting or inspecting must not edit their stored values. |
| Renderer adapter | Applies a supported property to a particular representation or behavior; a shared definition alone cannot do this. |

Do not confuse the knowledge hierarchy, UI ownership tree, property categories,
target hierarchy or current selection. They answer different questions.

## What exists and what is agreed next

| System | Current status | Reference |
| --- | --- | --- |
| Canonical knowledge, placements, relationships, investigative frames, reviewed AI proposals | Implemented; version-2 document and legacy migration paths | [README: data contract](../README.md#data-and-ai-contract) |
| Shared UI residents, ownership, movement, pinning, docking, customization, templates and UI history | Implemented, with detailed interaction contracts | [UI component contract](UI_COMPONENT_CONTRACT.md) |
| Shared actions, contextual shortcuts, discovery, rebinding and shortcut search | Implemented; architecture check covers common private hotkeys | [Shortcuts](SHORTCUTS.md) |
| Shared appearance properties, editors, target capabilities, draft/recovery and local refinements | Implemented for registered visual targets | [Appearance controller](APPEARANCE_CONTROLLER.md) |
| Symbolic visual selector and accepted-part appearance editing | Implemented for registered UI parts; not arbitrary pixel understanding | [Visual selection](VISUAL_SELECTION.md) |
| Universal function/property registry, compatible automatic coupling, generated categories and target inclusion after coupling | Implemented shared core; migration underway (visual targets, mouse trail and placement settings) | [Shared properties and coupling](SHARED_PROPERTIES.md) |

Automatic native-button discovery is not automatic property detection. An action
being searchable or movable does not establish its property capabilities. The
shared property registry now connects initial appearance and nonvisual consumers;
other legacy functions/settings still need migration.

## Knowledge, presentation and state ownership

Version-2 documents separate entities, compositions, typed relationships,
placements, investigative frames and portable assets. A visual parent is not a
semantic parent. Moving, compacting, focusing, styling or regrouping should not
invent knowledge or change entity identity. Variants reference normal entities
through explicit ownership; displaying them does not create structural facts.

Graph edits have graph history. Interface arrangement/settings have UI history.
Unapplied appearance edits have a recoverable appearance draft with Apply/discard.
The visual selector has its own transient selection history. These are separate
transactions; pointer motion and hover must not create persistent history entries.

Graph data autosaves locally and exports as atlas JSON. UI/theme templates carry
presentation and settings, not replacement knowledge. Assets and fonts use their
existing shared resource paths; do not duplicate their bytes in every consumer.
Preserve format validation, normalization and migrations when adding saved fields.

External AI changes use revision-checked, validated proposals and human review
before atomic application. Structural validity does not establish truth.

## Shared UI: residents, placement and input

Use the established components: actions through the function registry/UIAction,
fields through UIField, sections through UISection, complete expandable payloads
through EmbeddedGroup, and windows through FloatingWindow. A draggable label is
not a substitute for the live contents it represents. Stable IDs must not depend
on editable captions. Dynamic native buttons should supply stable data-ui-id keys.

Ownership governs nesting, moving, pinning, search revelation and persistence.
Portals project the existing resident; do not duplicate a live editor for docking
or previews. Reject cycles and respect context restrictions and explicit pins.

**Stacked versus Freeform** is internal arrangement. **Floating versus docked** is
placement. They are independent. Sidebar section wrappers are not ordinary full
frame docking targets; actual frames, handles, tabs and outer edges have their
own established target rules. Use shared geometry for feedback and commit.

Placement is fixed by default outside UI edit mode, with explicit movement-policy
exceptions through UI rigidity. Ordinary action clicks, editing, collapse and tab
activation remain available. UI rigidity is a UI policy, not an appearance value.

A UI press belongs to UI for the physical gesture. It must not transfer to camera
navigation just because an overlay closes, a preview cancels or capture changes.
Reuse pointerOwnership, capture, liveDrag and activation guards. Preserve the grab
offset, move the intended resident, and commit one operation on release. A drag's
trailing click must not activate its button. Cancellation restores the original.

## Shared commands, shortcuts and search

Declare behavior commands once in ACTIONS. Component-owned commands belong in
featureActions and useFeatureActions, rather than private key listeners and a
second shortcut list. Both shortcut screens, defaults, hints, conflict scopes and
function invocation must resolve the same command identity.

Respect typing, binding capture, blocked dialogs, repeats, contextual priority and
UI pointer ownership. Listed bindings must be rebindable/clearable where intended.
Search reads live bindings: a command bound to MB3 must be found by MB3 even when
its name omits those characters. A feature is not fully integrated merely because
its key listener works. Native gestures have shared descriptive metadata too.

## Master controller and appearance

Master controller (formerly Theme / aesthetics) is the window for shared controls.
Its top-level categories currently include Visuals and Spatial, collapsed by
default for new layouts. Visuals contains the appearance controls, theme tools and
templates; Spatial contains coupled placement settings. Categories follow actual
registered properties; Physics is not an empty placeholder. Stable window/action
IDs remain unchanged, and saved user labels still take precedence. Accepted
selector and UI-function selections reveal a Selected properties inspector,
using discovered capabilities and independent values. The stationary selector
also has ◎ Self inventory: logical object/group selection resolves existing consumer
couplings, exposing Mouse trail without clicking the native cursor. Reveal is transient;
Show all controls restores the general panel. Hover-only candidates do not
replace the accepted selection, and unmigrated graph/function fields still need
capability/adapter integration.

## Appearance: definitions, capabilities and independent values

PROPERTIES is a compatibility view of the shared property pool seeded in
properties/catalog.ts. Co-located *.function.ts input modules are discovered
automatically; there is no manually maintained central consumer list. PropertyTree/PropertyEditor and
the master/contextual controllers provide shared editing. Targets declare which
properties their adapters actually support. General paint, glyph ink, icons and
surfaces are distinct; text styling must not accidentally recolor icon artwork.
Graph assets retain source palettes unless the supported path explicitly changes
them. Authored graph presentation can override theme defaults.

The property tree organizes adjusters; the target tree organizes what an adjuster
can affect. Do not reproduce Color, Opacity or another existing property definition,
editor or independent settings store for each new consumer.

Appearance targeting is an inherited include/exclude mask. Parent changes reset
subtree exceptions; children can establish new exceptions. Left-click a row's
circle changes targeting (filled/hollow); right-click changes stored-appearance
bypass (bright/dark). Exclusion, bypass and locks are separate. Merely excluding
something does not erase its appearance. Locks protect against edits from above;
a deliberate local edit remains possible. Changing selection does not replay past
adjustments. Hover feedback belongs to that circle, not the entire row, and the
Everything branch does not highlight the whole app.

Individual rows are opt-in and represent actual local customizations, rather than
a catalog of every mounted component. Inspection alone must not create instances.
Local edits use stable, normalized part addresses and shared values/drafts. Invalid
addresses must not silently broaden the operation to the entire owner.

The universal extension of these principles is [SHARED_PROPERTIES.md](SHARED_PROPERTIES.md).
It supports categories for physical and other nonvisual properties while
preserving independent values. Register capabilities and connect the real state
adapter; adding a UI row alone is not a working integration.

Self inventory projects consumer groups tagged `self: true` and their coupled
descendants. Mouse/trail and Selector feedback/Included/Boundary are the initial
meta paths. Future meta features declare this on their existing group path, rather
than maintaining another target list. Selection only reveals shared editors and
existing values; actual individual edits create local overrides. The feedback
inspector includes a live sample using the actual renderer. See SHARED_PROPERTIES.md.

## Visual selector and feedback

The stationary meta-selector configures the tool; the compact aiming symbol is
pointer-transparent. MB3 is the current default toggle between these states.
The circle controls 🞅 Frame, ◉ In-frame and ⏺ Outside frame independently;
it never blocks the geometry mode. Each includes its region; In-frame leaves the
frame itself out. One LMB action toggles membership; RMB opens editing. With all
three off, a click establishes a neutral frame, then pattern detection follows
the pointer inside or outside it without changing inclusion. Previews are automatic
before a boundary/selection; then hold Ctrl: additions green, removal preview hides
green; no red exclusion paint.
E cycles pattern, individual, pointed-owner, axis/ray/segment, rectangle, ellipse,
polygon and freehand modes. Shift+Wheel finely rotates an armed drawing mode
before placement or the current geometry while refining (Ctrl accelerates 10×).
Line origins stay at their defined start/cursor hotspot; ordinary Wheel changes
pointed-owner depth before placement. New geometry intersects the current
set; release returns subsequent picks to app-wide matching. Geometry, region
baselines and exceptions share transient selection history. Pattern recognition
uses registered parts and mathematical intersections, not regex or arbitrary pixels.
Blank UI space currently means an owned background surface, not independent gaps.
Its green pulse paints the actual rounded surface below the contents. The world
background has a scene adapter with raycast rejection of nodes/binders; its shared
consumer values are edited directly without DOM-local instances. Green scene
feedback changes only the background and shares the existing scene registration.

Accepted selection, hover preview and property edits remain separate. Editing
uses the controller's edit action, native keyboard context gesture or Master
controller. Focusing its selected-properties controls pauses picking and holds the
last feedback context. Selection / Preview hides marks only through its explicit
toggle, without deselecting; entering an editor leaves the view alone. Complete text hosts support typography; partial text
runs keep exact-node paint/effect scope and do not advertise unsupported fonts.
Effect plans cache local ownership/styles and skip inactive paint-only edits.
Current limitations include arbitrary negative-space patterns, general
3D selection adapters, fine letter/word selection and saved automatic matching of
future targets. Consult `VISUAL_SELECTION.md` for the actual modes and contracts.
Phone controls remain deferred.

The general mouse trail is independent of the selector. It is now a declared
consumer whose hierarchy inclusion and ordinary Color/Brightness/Opacity/Glow
couplings derive from its animation channels. Placement settings demonstrate a
nonvisual consumer using the same pool while retaining UI settings/history.
See SHARED_PROPERTIES.md for the current registration/adapter path and remaining
migration work.

## Performance, recovery and delivery

Pointer feedback and animation must be bounded, transient and pointer-transparent
where decorative. Avoid application-wide React renders, full DOM scans, geometry
rebuilds or persistent writes on each pointer move. Reuse measured geometry and
frame-batched work; clean up on end, cancellation, blur and unmount. Respect
reduced motion and hidden tabs. Keep the existing protected appearance recovery
path readable even under a broken theme; holding Escape for two seconds is the
fixed emergency gesture.

The user currently performs interaction testing. Do not run browser suites or add
extra tests without a request. Follow the task-specific root instructions for CI
failures and required model checks. Documentation-only changes need no app build.
For a preview, node --run build:preview produces self-contained dist-preview HTML.
GitHack previously returned HTTP 429 for separate startup assets; keep previews
self-contained and preserve the canvas error boundary. Production Pages uses the
normal split build. Never claim a check ran when it did not.

## Focused structure inspection

Inspect the relevant structure when first working in that subsystem, or when its
contract/version has changed. Do not read every row for every task. These are
entry points, not a replacement specification; follow dependencies only as needed.

| Task | Inspect these structures and establish this boundary |
| --- | --- |
| Knowledge edits / proposals | [structural.ts](../src/graph/structural.ts), [changeset.ts](../src/graph/changeset.ts): entity vs placement identity, revision preconditions and atomic validation. The older graph/model.ts is not the version-2 document contract. |
| Positions / spatial behavior | [coordinates.ts](../src/graph/coordinates.ts): canonical parent-local storage vs projected/world coordinates. |
| UI containers / arrangement | [layout.ts](../src/ui/layout.ts), [UIWorkspace.tsx](../src/ui/UIWorkspace.tsx), [docking.ts](../src/ui/docking.ts): ownership, live residents, pinning and committed layout. |
| Drag / resize / camera interference | [pointerOwnership.ts](../src/ui/pointerOwnership.ts), [liveDrag.ts](../src/ui/liveDrag.ts), [transientStore.ts](../src/ui/transientStore.ts): physical gesture ownership vs temporary preview. |
| Actions / shortcuts / discovery | [workspaceActions.ts](../src/workspaceActions.ts), [featureActions.ts](../src/featureActions.ts), [useFeatureActions.tsx](../src/ui/useFeatureActions.tsx): declarations vs runtime dispatch, saved bindings and live search metadata. |
| Shared properties / coupling | [properties/registry.ts](../src/properties/registry.ts), [function inputs](../src/properties/function.ts), [appearance registry](../src/appearance/registry.ts), [model.ts](../src/appearance/model.ts), [resolve.ts](../src/appearance/resolve.ts): definition/capability, targeted write, independent values, read/application path. Read SHARED_PROPERTIES.md before generalizing these. |
| Appearance controls / persistence | [propertyTree.ts](../src/appearance/propertyTree.ts), [Controls.tsx](../src/appearance/Controls.tsx), [session.ts](../src/appearance/session.ts), [themeTemplates.ts](../src/themeTemplates.ts): shared editors, draft lifecycle and portable values. |
| Selector behavior | [VisualSelector.tsx](../src/appearance/VisualSelector.tsx), [visualSelection.ts](../src/appearance/visualSelection.ts), [selectionGeometry.ts](../src/appearance/selectionGeometry.ts): accepted state, candidate feedback, matching and boundaries. |
| Undo / settings | [ui/history.ts](../src/ui/history.ts), [appearance/session.ts](../src/appearance/session.ts), [App.tsx](../src/App.tsx): verify the actual commit path and which history owns the requested change. |

A useful durable finding records the relevant structure, invariant, reason and
known limitation. A temporary task handoff should record the commit/revision
examined, changed files, important decisions, checks actually run and unfinished
work. Do not copy large source dumps or tentative guesses into the shared guide.

## Context and memory

There is no reliable number of turns or tasks after which a worker forgets.
Inspected code is usable while present in its active context. Long conversations
may be compacted into summaries that omit details. New chats/workers must not be
assumed to inherit earlier inspection, and even an inherited summary can be stale.

The repository is the shared memory. A fresh worker loads the entry rules and
mental model, reads the relevant reference, and verifies affected implementation
paths as needed. After a context reset, do not claim to remember a structure that
is no longer available: reload the concise contract or handoff. Reinspect source
when correctness depends on details, especially after intervening changes. The
purpose of documentation is to avoid repeated architectural discovery, not to
forbid necessary verification or promise permanent model recall.

## Keeping the shared model current

Before implementation, identify the state owner, property/action identities,
existing extension path and relevant subsystem contract. Inspect the affected
code for details; this guide eliminates rediscovery, not implementation review.

When behavior changes, update the relevant subsystem reference in the same change.
When a cross-cutting contract or implementation status changes, update this map
and AGENTS.md if necessary. Record open design choices as open; distinguish agreed
design from working behavior and verified results. Keep current task findings in
a handoff/PR without turning this guide into a chronological chat transcript.

Read the brief plus relevant references once per fresh worker/context, then consult
specific sections as needed. No documentation can guarantee model recall forever;
short entry rules, durable decisions and appropriate automated checks work together.


Recent integration: shared property controls have renderer-only activity previews
for inactive effect/gradient parameters and declared inactive consumers. Never
send the activity-projected controller to a commit/editor path. Frame × now hides
custom frames intact. Normal launchers reopen closed panels directly through
`reopenContainer`; custom frames also appear under UI library → Closed frames
and panels. Closing and minimizing are separate.
See the shared property and UI component contracts for these paths.

Selector hover previews remain enabled while aiming; automatic editor-entry
feedback holds and Ctrl-preview gating are removed.
`selector.lock` (Shift+MB3 by default) explicitly parks MS and restores the normal
cursor while retaining its pointed preview; pressing again resumes MS. Selection / Preview and accepted membership
remain independent. See VISUAL_SELECTION.md.

Performance integration: mounted appearance consumers share context `read` /
`renderRead`; do not build value resolvers per row/icon. Paint-only setters retain
instance/policy structure so exact text ranges and overlay bounds survive picker
samples. Target metadata tracks actual captions/ownership, not changing React
elements. See APPEARANCE_CONTROLLER.md for the shared invalidation contract.

Selector BG detection is off by default; enabling BG permits owned backgrounds in
new picks without rewriting accepted membership. Current pattern feedback
uses layout-revision measurement snapshots and incremental visible-host pulses.
Accepted contours have hairline moving seams; drawing guides remain visible. Opening
editors never automatically hides selection. See VISUAL_SELECTION.md.

Selector sparkles are removed. Both pending and accepted contour/geometry seams
are hairlines. Selection / Preview and BG now have visible labels below the
stationary circle and live shortcut hints; the commands remain unassigned by
default. Selector feedback → Pulse uses discovered shared inputs for speed,
intensity/depth and on/off, saved through existing Controller.values/Apply/export.

Selected items temporarily become Master Controller's exclusive editing scope;
Visual hierarchy switches refine that scope and Properties hosts the shared
setters. Preserve the saved global targeting set when selecting/deselecting.
Shared frame headers support descendant expand/collapse through the existing
ownership graph, with local expansion adapters for transient trees; do not add
per-feature bulk controls or per-render graph scans.

Pointed pattern selection defaults to the registered subtype in every visual
hierarchy, not the broad text/background/etc. role. Parent selection is explicit
in Master Controller and retains the active work area. Keep subtype identity in
selection constraint/cache keys; do not classify by current color/font values.
Pending Master Controller minimize/close queues the requested action and blinks
the existing Apply / Discard / Cancel choices in place, without a popup/focus jump.
Apply/Discard completes the queued action; Cancel keeps the draft and controller open.

## Active context actions

Frame tools live once in Master Controller → Active context, with cataloged
shortcuts. `ActiveContext.tsx` tracks clicks/focus in a transient context stack;
Esc exits one field/popup/frame level. Controller clicks preserve the target.
Use shared frame actions, `useCancelValueEdit` for uncommitted drafts and
`useActiveLayer` for popup levels. Do not restore duplicated header tools or
track context through pointer polling. See SHORTCUTS.md for bindings/migration.
