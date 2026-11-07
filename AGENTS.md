Composer interaction update (2026-11-06, supersedes earlier Composer-only selection/entry rules): baseline MS is active without Q. Q toggles selection settings → baseline aiming. A plain target pick uses the configured selection mode and opens the retained compatible DOF, defaulting to Position against Composer space. Confirming a single value by click or Enter commits it and closes its preview, returning to baseline selection; outside canvas clicks choose a compatible reference without changing the edited target. Esc cancels the uncommitted DOF preview, clears target selection and returns to baseline (previous commits stay). Right-click selects immediately and opens DOF choices. Modifier membership gestures stay selection-only; explicit Draw/Erase and borrowed requests retain gesture ownership. Other app surfaces retain opt-in MS. This supersedes the earlier Composer prohibition on automatic DOF entry. No browser acceptance is inferred.

# User operating rules (required)

Explicitly opened MS remains aiming after each pick, including Ctrl/Shift picks; its selector cursor stays visible until Esc or editing, and parking anchors it. Completing a native modifier gesture begun while MS is off leaves MS off. Accepting a requested reference ends that temporary session. MS opening shortcuts route with selector priority even after exit, ahead of retained DOF/resident bindings, while explicit rebinding/clears, native text entry and blocked input remain authoritative.

Before implementing or modifying behavior:

1. Classify its applicable behavioral categories and identify the state/behavior
   owner. Inspect the nearest working analogue and the shared infrastructure
   supplying its integrations, customization, persistence and history. Inherit
   those connections; adjust only for meaningful contextual differences, not
   accidental limitations or defects in the analogue.
2. Challenge the framing: identify the underlying need and whether related
   requests reveal one missing general rule. Use the smallest observation that
   distinguishes possible causes; a plausible explanation is not a diagnosis.
   Where verification is warranted, establish the reported failure first and
   check that verification cannot miss it.
3. Consider entry, continuation, reversal, cancellation, completion and recovery.
   Repeated corrections require durable operating rules; recurring failures are
   evidence to revisit ownership or the model rather than accumulate local fixes.
4. Match planning depth to propagation and reversal cost. Optimize total effort
   across the user and agents, including explanation, waiting, manual work,
   integration and expected rework—not just local implementation speed.

The performance, compactness, shared inheritance and user-owned interaction
acceptance rules below remain authoritative. A narrowly authorized browser check
is not standing permission for further checks or suites.

For warning/error/diagnostic work, read [the diagnostic contract and current
limits](docs/DIAGNOSTICS.md). Classify the behavior and remedies at the shared
boundary; do not add warning-specific repair UIs. Current Composer operation
repairs are shared within Composer, not a completed global warning system.

The assigned MS opening shortcut (Q by default) cycles off → aiming → MS configuration → off, then repeats. Closing through Q retains accepted membership/history and releases targeting; it never clears the selection. Esc retains its separate behavior: from configuration return to aiming, then cancel/clear normal MS selection; canceling a borrowed reference restores its prior selection. Existing explicit clear/removal commands remain available. Automatic Master Controller selection inspection is unchanged.

# Saved-data compatibility (required for all contributors)

Read [the data evolution contract](docs/DATA_EVOLUTION.md) before changes that can
alter saved data/settings, identities, references, defaults, interpretation,
validation, persistence, exports/imports, recovery or backend formats. Assess
persistence impact for every change; explain unaffected changes briefly in the PR.
Reuse existing owners and shared format logic. Provide contextual compatibility
or versioned migration with historical fixtures for affected contracts. Preserve
originals until conversion validates and saves successfully; unknown/newer or
unreadable data must never become defaults that overwrite the original. Account
for older clients/tabs, failures, rollback and hosted deployment separately.
Retired implementation does not make authored content disposable; deliberate
retirement of irrelevant preferences must be documented. Update the owner map
when boundaries change. These are development requirements, not a claim that
all current systems already implement them. Do not claim automatic full backup,
lossless migration or cross-device sync without implementing and verifying it.

# Capability discovery and delivery (required)

Before implementing a feature, read/search [docs/CAPABILITIES.md](docs/CAPABILITIES.md)
and the relevant subsystem reference. Reuse or fix existing capabilities instead
of duplicating them. Every new/changed/retired user-facing behavior must update
[docs/capabilities/catalog.json](docs/capabilities/catalog.json) in the same change,
including exact entry path, behavior/options, minimal steps with expected outcomes,
limits, deployment status and evidence-based verification status. Native controls
and workflows without catalog actions are included. Follow the
[authoring contract](docs/capabilities/README.md); regenerate with
`node --run docs:capabilities`. Test/build entry points check registry coverage and
freshness. Do not mark a feature finished with a generic placeholder walkthrough.
Final handoffs link the changed guide sections and state what the user still needs
to test. Browser acceptance and deployment are never inferred from builds.

# Worker entry rules

The user's standing delivery workflow is to push authorized implementation to
`OmnirORax/Omnia`, create/update its open pull request, publish the self-contained
visual build and `source.json` to the existing `preview/githack` artifact branch,
and provide a fresh commit-pinned GitHack preview. The user explicitly confirmed
this baseline on 2026-10-28; do not ask again for routine PR/preview publication.
Preserve the existing public-artifact/private-backend boundary and never include
workspace data or credentials. Merging/deploying production is a separate action.
Use a new PR when the preceding PR has merged.

Batch completed work into a single delivery push; do not use incremental pushes or
CI reruns as a local development loop. Before pushing, run applicable local checks,
including `backend:check` when shared portable modules change: backend contracts
import Omnic validators, and Deno resolves type-only imports too. Portable modules
must use explicit TypeScript extensions. Local frontend success does not imply CI
success. Check the latest run status once for a delivery, report failures accurately
and fix their cause locally before another push. Never disable checks or alter user
notification preferences merely to hide failures. The user handles browser and
interactive performance acceptance; existing optimization/testing constraints apply.

Every preview handoff must include an inventory of implemented features/functions,
where to find them and how to use them, distinguishing new changes from existing
capabilities and planned work. Give the user practical first steps, material limits
and verification status. Link the complete maintained capability guide; a preview
URL or change summary alone is insufficient. Keep the user aligned on what the
particular preview actually contains.

For Omnic or Omnium node/frame work, also read
[the current workbench mental model](docs/OMNIC_WORKBENCH_MODEL.md). It synthesizes
the user's 2026-10-28 decisions, open ideas and implementation sequence. Build the
general world-integrated construction instrument; concept presets do not satisfy
it. The minimum movable atom, finer operator imprints and smallest visible cue
are different limits. Preserve the distinction between confirmed behavior and
exploratory grammar. Direct lattice placement/movement is now explicitly desired.

Read [docs/WORKER_ONBOARDING.md](docs/WORKER_ONBOARDING.md) once when starting work
or resuming with a fresh context. It supplies the project mental model, system
boundaries, status map and links to task-specific contracts. Do not reconstruct
the project from source or chat history for every task; inspect the affected code
after loading the shared model. Keep this brief and the relevant subsystem docs
current when changing a cross-cutting contract or its implementation status.

For hosting, CI, domains or release work, read
[docs/CLOUDFLARE_DEPLOYMENT.md](docs/CLOUDFLARE_DEPLOYMENT.md). Production is private
Cloudflare Pages at `omnium.nexus`, deployed from `master`; automatic deployment is
enabled. A merge to `master` can publish after checks pass. Preserve Access on
production/preview hosts and the release preflight; never restore public GitHub
Pages publication. Manual workflow dispatch verifies only and does not deploy.

For backend work, read [docs/BACKEND.md](docs/BACKEND.md). Reuse workspace
authorization, private asset lifecycles, and portable contracts; keep credentials
server-side. Cloud atlas synchronization is not implemented. Read the backend guide
for current hosted deployment status and remaining frontend configuration.

For AI music/wallpaper generation, playback or media services, also read
[docs/AI_MEDIA_HANDOFF.md](docs/AI_MEDIA_HANDOFF.md). It records current backend/asset
limitations, state ownership and performance constraints; it is not a feature spec.

# Live node-document lexicon (2026-11-03)

Glyph matching is automatic during typing, paste, opening existing content and
saved lexicon changes. Lexicon opens the existing library; it is not an activation
switch. Keep one mixed document with inline canonical Composer references.
Automatic occurrences may link to their English source (`word`); deleting English
detaches and preserves the glyph (`word: null`). Do not introduce a second text /
glyph node store. Preserve composition, caret, undo, independent deletion, shared
workspace history/portability and bounded typing work. See [NODE_DOCUMENTS.md](docs/NODE_DOCUMENTS.md).

# Universal Master Controller signature

**MS correction (2026-11-03):** Q starts targeting; Q again while MS is active
opens selection settings. Esc from settings returns to aiming with selection
intact; Esc outside settings cancels MS. Ctrl + the assigned MS opening shortcut
(Ctrl+Q by default) toggles the pointed object. Shift + that shortcut (Shift+Q)
adds objects intersecting the projected rectangle between anchor and endpoint.
Ctrl-click toggles and Shift-click extends the range on registered Composer/atlas
surfaces, including before MS opens. The shared MS capture owner claims the entire
modifier press/drag/release/click tail; normal tools must not replace membership.
On release, finish the native selection gesture without clearing its membership.
Selection itself never opens dials: ordinary target/edge clicks, Ctrl/Shift picks,
select-all and releasing modifiers only select. Right-click the selected target to
open its compatible DOF dial for the full set. Explicit DOF controls/shortcuts still
open the requested editor. Do not add automatic Position-reference entry or
rotation-wheel opening to selection callbacks or modifier release.
Release native gestures without an extra completion key. Preserve an explicitly opened MS session; modifier selection begun while MS is off remains off.
A fresh pointer press ends suppression of the preceding press's tail. Declared
context-menu owners receive a whole secondary press after selection (including
standalone MS); ordinary UI retains MS removal. Pending geometry stays protected.
Owner onStart cleanup and precise area hits belong in the existing surface adapter;
do not restore a private Composer Ctrl-selection path. Active MS still respects its
configured selection click; blocked/capture/editor chrome remains protected.
Renderer adapters supply actual owners, hit tests and bounds; do not confuse
spatial range with document order. Shift-click uses the adapter where available,
retaining source-order fallback in ordinary UI. Derived chords follow rebinding;
explicit assignments/clears and existing same-scope bindings remain authoritative. Standalone keyboard/pattern picks keep MS
aiming for continuation; borrowed single-reference acceptance still restores and
closes its request. Shift+Q is no longer selected-property editing. Use shared
selector commands, scoped range discovery and transient selection history.

Q always starts ordinary MS, even with a numeric editor open. Only an explicit reference request borrows MS for a one-target reference; the ⟴ control and DOF reference entry retain that workflow. Numeric information registration must never override the selector opening command. After Q → hold Shift+Q or Ctrl+Q → successive target clicks, Q must still configure MS rather than reopen a property setter.

Modifier marquee feedback is live while held: Ctrl/Shift-drag previews the current intersected owners as the rectangle grows or shrinks, before release. Preview does not change accepted membership, anchors, geometry or selection history. Release commits once; Esc, blur or pointer cancellation removes the preview. Reuse the registered surface snapshot and area-hit adapter, prepare geometry once per gesture, and coalesce feedback to animation frames. Snapshot adapters may return a cached elements resolver for native-ink preview; otherwise projected unit boxes provide feedback. Do not call geometry discovery or layout measurement from each area query.

Normal MS sessions opened on a registered content surface are bounded to that source root/context. The selector cursor and hover/wheel targeting apply there; a primary/secondary press or focus change on other controls ends normal targeting without consuming the control input or clearing accepted membership. Selector-owned configuration remains usable. ActiveContext preserves the source only for pointer picks inside that boundary. Standalone UI MS remains global. Explicit borrowed reference requests retain their rejection/cancel contract and navigation context.

**Interaction ownership:** read [the current lifecycle and regression route](docs/OMNIC_INTERACTION_LIFECYCLE.md)
for selection/editing work. Resolve ownership from the physical event path, not
mutable SVG ancestry; keep the registered root/context for the whole gesture.
Accepted membership alone must not capture an editor's or held gesture's Esc.
Use the shared press-state subscription; actual gesture cancellation precedes rim
navigation and cannot leave a preview to commit on mouse release. Active MS lends
picking without activating its pointed frame; remote contextController windows
must not steal context on inspection refresh. Only numeric properties enter the
numeric reference workflow. Preserve the complete select → right-click → DOF →
configure/reference → edit → Back/cancel → select sequence before delivery.
The user explicitly authorized the focused browser investigation on 2026-11-03;
its opt-in script is not standing permission for unrelated future browser suites.

**Composer DOF correction (2026-11-03):** a selected target's assigned DOF
shortcut opens its editor; pressing that same shortcut again while the same DOF
and targets are active opens its configuration. Shift+R is no longer Rotation
configuration. Ctrl/Alt/Shift combinations are assignable to Composer DOF commands;
do not invent per-DOF modifier meanings before the user specifies them. Other
functions retain their existing Shift configuration. Generate Composer DOF shortcut
rows from registered input/vector metadata, reuse existing action IDs, and preserve
active MS, native text entry, capture, blocked-dialog and contextual MC ownership.
This explicit correction supersedes the universal Shift rule below for these DOFs.

**Shift + any configured shortcut opens that function's adaptive Master Controller
configuration. Repeated presses cycle choices; hovering/focusing an MC option
selects that temporary choice. Releasing Shift executes the selected choice once. Right-click an MC option applies and locks its future default; left-click
resets to priority 1. Temporary cycling never overwrites the locked default.**
This applies to keyboard/mouse commands, existing and future. Shift is reserved for
configuration, not an alternate executable shortcut. Preserve ordinary text entry
and protected recovery. Read [docs/FUNCTION_CONFIGURATION.md](docs/FUNCTION_CONFIGURATION.md).

Use the single router in `ShortcutConfiguration.tsx`; do not add per-feature Shift
listeners, modifier conditionals or separate configuration windows. A feature's
normal action remains in the action catalog. Declare settable inputs once through
`*.function.ts`; matching consumers/controls automatically supply generic editors.
A specialized configuration/preview may attach to the existing function/action
metadata (`configuration`), reusing its inputs and setters. No second settings store
or per-shortcut registry. Contextual MC shows only relevant controls; explicit MC
shows general categories. Keep previews transient and configuration compact.

## Universal contextual priority order

Choices progress from the nearest relevant scope to the broadest/global scope.
Start at the nearest relevant boundary and progress upward or downward along the
contextual hierarchy, according to that function's applicable hierarchy. This is
a universal ordering rule for existing and future functions, not just resizing.
Derive the levels from the active context and shared hierarchy; do not hardcode
feature-specific scope lists or treat the order as an arbitrary list of options.

# Systemic implementation and future inheritance (all agents)

The user's **halving method** is a universal value-picking requirement, not an
Omnic-only or radial-selector feature. Implement it through shared value/property
selection mechanisms so applicable current and future consumers inherit it.
Radial axes and positions are examples. Exact indexing, endpoint/direction and
threshold behavior remain to be resolved with the user; do not freeze guessed
formulas into individual controls. See SHARED_PROPERTIES.md.

Fix the underlying cause in the shared system, not the individual symptom with
hardcoded IDs, per-component exceptions, duplicated logic or one-off patches.
Inspect the affected ownership and contracts, consider other affected systems and the
long-term system, and make the correction at the appropriate shared boundary.
Keep the change proportional to the cause; this is not permission for unrelated
rewrites or speculative frameworks.

**Future consideration & inheritance:** implement shared behavior so any future
system or feature to which it applies inherits it automatically, without manually
implementing or wiring that behavior again. Use the existing registry, discovery,
adapters or shared component contracts to provide that inheritance. Future systems
declare their actual capabilities and unique behavior; universal controls,
configuration, selection, history, hierarchy grouping and performance safeguards
must follow automatically wherever applicable. Extend the common mechanism when
it is incomplete, preserve existing systems and saved data, and document the
extension contract so future workers use it. Do not maintain parallel lists or
repeat feature-specific wiring where the shared system can derive it.

# Active tool cursor inheritance (all agents)

An active tool's cursor inherits the icon the user activated, including custom
appearance. Declare its default `toolIcon` in `FEATURE_ACTIONS` and its active
`cursor` state in `useFeatureActions`; alias buttons identify their canonical
command with `UIAction tool`. The shared FunctionControl captures the clicked
rendered icon once, and `ToolCursorLayer` supplies website-wide transport and
priority. Each active tool MUST declare its applicable `zone`. Register DOM
surfaces with `useToolCursorZone`; canvas/3D adapters publish their existing hit
result with `setToolCursorZone`. Leaving that zone or entering controls restores
the native cursor. Function/zone changes choose the applicable tool, rather than
retaining the last clicked icon globally. Only page-wide operations declare
`zone: "*"`; settings/selector chrome stay excluded. Keyboard/default activation
uses the same declared icon. Specialized
live composite tools use `useToolCursor` with their existing symbol component;
MS keeps its precision anchor/parking and priority above other active tools.
Never add private cursor emoji/portals, duplicate icon definitions, or per-tool
pointer listeners. Ordinary motion must not trigger React, layout/style reads,
storage or history; operation/zone transitions update only the cursor layer. Clicked custom appearance refreshes on the next activation.

# Compactness is a product requirement

**UI Compactness:** smallest practical layout + contents, neatly arranged,
minimal wasted space, minimal text — defer explanations to tooltips.

Every new or changed UI feature must use the smallest practical layout that fits
its controls neatly and readably. Size containers to content, use tight consistent
spacing, group related controls in rows, and avoid large minimum dimensions,
full-width fields, redundant headings, decorative padding and empty space.
Put secondary explanations in accessible tooltips instead of permanent paragraphs.
Contextual Master Controller projections show only relevant controls. Preserve
readable labels, keyboard access and usable pointer targets; enlarge a surface
only when its actual interaction or content needs the space. Apply this by default,
not only after the user requests a compactness pass.

Numeric slider controls use `ui/RangeControl.tsx`, the shared spectrum widget.
Reuse it instead of adding private ranges, arrow steppers or duplicate min/max
fields. See the UI component contract for its left/right-click semantics.

Omnic contextual interaction is progressive: keep the function list hidden until
right-click; left-click uses retained values; right-click ONE function reveals one
relevant setter at a time. Confirm advances and Back/Esc goes back. Pivot, axis
bounds, halving depth, optional direction and position appear in sequence. A
permanent toolbar or a full settings grid violates the user's explicit correction.
See OMNIC_WORKBENCH_MODEL.md for the exact contract.

Latest Omnic correction: the **entire Composer is a circular radar**. Editing is
inside it; icon/category tools live on its rim. Do not retain a rectangular
Composer containing a separate radial popup, and do not remove the interior in
favor of a headless world-only controller. Atomnic toggles tools on the same
recipe/canvas; both on/off modes keep the radar. Only requested setters open
compact contextual controls. Preserve the library and reusable engine/data paths.

Target right-click specifically discovers writable DOFs from the active target's
registered adapters. Present the corresponding adjusters directly around one
circle, without category/file actions. Left-click uses retained settings;
right-click that adjuster configures its snaps/halving progressively. Do not
replace this with another static inventory of tools.

# Responsiveness is a product requirement

## Optimization delivery baseline (all agents)

When the user requests an optimization or performance fix, inspect the affected
code and fix the concrete inefficiencies and problems found. Then hand the change
to the user to test whether it is sufficient. The user reports back if more work
is needed. Do not extend the task into repeated profiling, browser testing,
benchmarking, CI reruns or speculative optimization rounds to prove sufficiency.
Only perform that additional investigation when the user explicitly requests it;
authorization for one focused trace/check is limited to that check, not future
tasks or broader testing. Keep any required static/build/model checks focused;
they do not establish interactive acceptance. Report what changed and what remains
unverified, without claiming user-observed lag is resolved before their feedback.
This is the default operating rule for every agent and future session.

For cross-cutting performance changes, start with
[docs/PERFORMANCE_ARCHITECTURE_PLAN.md](docs/PERFORMANCE_ARCHITECTURE_PLAN.md).
Numeric controls need meaningful consumer/mode ranges and aggregate render budgets;
editable slider endpoints do not override those constraints. Validate all entry
paths. Do not claim a performance fix from model tests/cache assertions alone. Shared
mode-dependent numeric constraints belong in `numericRange` on the property
definition, refined by renderer target capabilities; use the same resolver in
editors, setters and rendering. Reuse `renderBudget.ts` for graphics limits and
decoration overload handling. New animation/media must have bounded aggregate
work and yield under load, preserving saved values when rendering degrades.
See `docs/PERFORMANCE_RESULTS.md` for the local trace, restrictions and unresolved
latency; do not treat that first pass as a completed performance recovery.

Performance takes priority over maximum configurability/freedom. Prefer bounded
work and supported combinations; restrict effect complexity, concurrent animated
sources or costly options when necessary instead of allowing settings that make
the app unusable. Explain material restrictions and preserve stored user choices
when applying a temporary rendering fallback. This is an explicit user preference,
not a request to add unlimited options and optimize only after regressions.

Every feature and fix must preserve interactive responsiveness. Before implementing
an approach likely to cause substantial lag, tell the user what could become slow
and suggest practical alternatives (for example bounded work, caching, incremental
updates or an explicit expensive operation). Prefer the responsive approach within
the authorized scope; do not silently ship a costly design and wait for the user
to discover it. Consider pointer movement, selection, live property/color dragging,
large documents and concurrent effects. Keep full-app scans, layout reads, expensive
matching and broad React updates out of per-pointer/per-frame hot paths. Assess
cost as part of implementation and report unresolved performance risks honestly;
a successful build is not evidence of smooth interaction. Respect the user's
preference to perform browser testing themselves; do not add unsolicited suites.

Essential invariants for every worker:

- Knowledge identity/relationships, visual placements and UI organization are
  separate. Appearance or containment in the UI never asserts canonical facts.
- Stable IDs survive renaming/rearrangement; preserve user values and migrations.
- Reuse shared actions, UI residents, property editors, ownership and state/history
  paths. Selection/hover/pointer previews do not persist edits.
- Property coupling means shared definitions/setters with independent consumer
  values. It never means changing one automatically changes other consumers.
- The general function/property registry and generated category/hierarchy paths
  are implemented, with incremental migration of existing features. Read [docs/SHARED_PROPERTIES.md](docs/SHARED_PROPERTIES.md)
  before adding adjustable function inputs. Define their actual input/read/write
  contract once in a co-located `*.function.ts` module using `defineFunction`.
  Discovery loads those modules automatically; input keys reuse shared property
  IDs and genuinely new input definitions join the pool/categories automatically.
  Never maintain a second consumer/channel list or edit `functions.generated.ts`.
  Native button discovery is not property detection. The property contract check
  runs in normal builds; extend coverage for new state owners.

# Shared visual editing architecture

Shortcut commands must use the shared `ACTIONS` catalog. For a component-owned
feature, declare its commands in `src/featureActions.ts` and install behavior with
`useFeatureActions`; do not add private key/button literals or a separate shortcut
list. The catalog supplies both shortcut screens, defaults, saved bindings and
conflict scopes. New feature handlers must respect capture mode, blocked dialogs,
typing, availability and UI pointer ownership. Native gesture descriptions belong
in `FEATURE_GESTURES`; ordinary widget Enter/Escape/arrow behavior stays native.
Read `docs/SHORTCUTS.md` before adding input controls. The shortcut architecture
check runs in the normal model suite and rejects common private hotkey literals;
do not weaken or expand its legacy protocol exceptions to ship a feature.

Read `docs/VISUAL_SELECTION.md`, `docs/APPEARANCE_CONTROLLER.md` and
`docs/UI_COMPONENT_CONTRACT.md` before changing appearance, inspection, selection,
component presentation or their editors.

- Define properties once in the shared property pool (`PROPERTY_REGISTRY`); the
  existing definitions seed it in `src/properties/catalog.ts`.
  Reuse the existing property when its meaning matches. A new feature must not
  introduce another Color/Opacity/etc. definition, value store or bespoke editor.
- Logical/meta features belong in Self inventory: mark their existing coupled
  group `self: true`; discovery projects descendants automatically. Do not add a
  second target list or property store. See `docs/SHARED_PROPERTIES.md`.
- Components expose visual parts and renderer adapters through the shared target
  registry. Target identity, selection boundary, visual role and property are
  separate concepts. HTML, SVG, canvas and 3D may need distinct adapters, but must
  share property IDs, applicability and editing rules.
- Mounted appearance editors/renderers share `useAppearance().read` (or `renderRead`
  for renderer-only activity projections). Never rebuild `createValueResolver` or
  call standalone `valueFor` once per row/icon/property in a render loop. Pure batch
  transactions share a `createTargetIndex`; paint-only setters preserve unchanged
  instance/policy references. Text binding discovery and feedback geometry must not
  rebuild for every color sample. See the performance contract in
  `docs/APPEARANCE_CONTROLLER.md`.
- The existing master controller and `PropertyEditor`/`PropertyTree` supply property
  editing. Local actions should target/reveal the shared editor rather than copy
  its controls. Registered capabilities determine which properties are applicable.
- The visual selector composes include/exclude with boundary/item/pattern. Reuse
  the registered bindings to find parts; do not maintain a competing inventory of
  components or infer arbitrary properties from their pixels.
- Selection and hover previews are transient. They must not write appearance,
  layout, graph data, storage or interface/graph undo history. Selection operations
  have their own transient undo/redo timeline. New parts become instances only
  after an actual local customization, and individuals remain opt-in in the tree.
- Accepted-part editing reuses controller instances/values and the appearance
  draft. Persist normalized part addresses, not DOM nodes or raw selector source.
  Preserve their narrow scope across reload; reject invalid addresses rather than
  falling back to owner-wide styling. Glyph capabilities must reflect the exact
  renderer adapter, not all properties advertised by the broader text category.
- Replace obsolete editors and routes when the shared path covers their behavior.
  Until then, keep the working path available. Preserve stable IDs, stored values,
  locks, bypass, inheritance and migrations; do not leave two independent active
  implementations of the same setting.
- Preserve the common UI ownership, docking, pinning and undo contracts. Reuse
  shared frame/action/field components; an individual handle is not its frame.

The current user performs browser interaction testing. Build the self-contained
preview with `node --run build:preview`; do not run browser suites unless asked.
When fixing a failing CI check, run the relevant existing model checks and the
required model suite. Keep CI enabled and update assertions when requested UI
organization changes their valid expectations.

GitHack previews must remain self-contained (startup assets previously received
HTTP 429 when requested separately). Production Pages builds remain code-split.

UI frame commands belong in Master Controller's shared Active context panel and
the action catalog, not repeated header tools. Activation is click/focus based
and transient. Draft controls use `useCancelValueEdit`; popups use the shared
active-layer adapter. Preserve close/minimize vetoes and avoid hover polling.

Committed state owners must integrate with `ui/actionHistory.ts` for chronological
Undo/Redo; keep previews and selection timelines transient. Reuse owner adapters
and patch conflict checks. Contextual Master Controller activation exposes only
relevant controls; explicit activation exposes the general controller.

Before publishing follow-up work or linking a PR, verify its live GitHub state.
A merged PR does not include commits pushed to its head branch afterward. Put
post-merge work in a new open PR against the current default branch; do not keep
updating the merged PR description as if it were the active review.


Visual-role grouping is generated by the shared semantic detector in
`appearance/visualRole.ts` and registry compiler `roleHierarchy.ts`, also used by
MS. Never maintain per-component category lists. Real renderer bindings determine
Backgrounds/Contours/Text/Icons/Indicators membership; new types inherit grouping.
Preserve stable target IDs and compatibility ancestry for saved selection/locks/
bypass. The build verifies generated membership. See SHARED_PROPERTIES.md for the
adapter declaration and compatibility contract.


For Omnic work, read [docs/OMNIC_COMPOSER.md](docs/OMNIC_COMPOSER.md) and the
[source-alignment audit](docs/OMNIC_ALIGNMENT_AUDIT.md) against the user's cleaned
[language document](docs/omnic/OMNIC_RULES_SOURCE.md). Distinguish executable Stage
1/2 scaffolding from missing semantics, preserve reusable infrastructure, and do
not finalize exploratory or obsolete source passages. The cleaned source guides
meaning; stage contracts still record agreed delivery scope. Stage 1
stores a renderer-independent structural recipe on the canonical Omnium object
(`Entity.omnic`); placements/reused components reference it. Do not reintroduce
concept-to-glyph asset assignment or infer semantic equivalence from matching
renderings. Shared edits update references; explicit copies create identities.
Keep provisional grammar/frames explicit, preserve unresolved role references,
reuse MC/property/history owners, and respect evaluator/render budgets. English
translation, audio and full radial grammar remain deferred. Stage 2 adds the
workspace-wide canonical library, explicit pins and version-checked cloud snapshots;
read [docs/OMNIC_LIBRARY.md](docs/OMNIC_LIBRARY.md). Use its shared workspace owner,
IDs, IndexedDB persistence and dependency resolver. Never make per-atlas copies of
shared objects or treat the local document revision as a server concurrency token.

Repeated UI controls should use scoped `useUITracked` subscriptions rather than
subscribing to the full UI context. Preserve current event handlers and actual
render dependencies; appearance readers keep snapshot identity. Read the scoped
subscription section in UI_COMPONENT_CONTRACT.md before extending this path.

# Shared MC targets and child-stage placement (2026-10-29)

Reuse `ui/contextTargets.ts` / `useContextTargets` for active geometry and future non-frame targets. Existing catalog commands retain IDs/shortcuts; declare `contextual` routing and MC presentation metadata, then expose actual capabilities/compatible DOFs from the adapter. Multiple compatible DOFs MUST go through the shared ambiguity prompt before execution; do not create private pickers or shortcut handlers. One compatible DOF may run directly. Reuse shared property bindings, Shift configuration and history; MS/held-gesture priority remains authoritative. Omnic Close is unsupported; Delete is the existing `deleteSelected` command. The user's final correction retains nearest-edge Minimize/Maximize; Expand/Compress changes a numeric DOF, not visibility or marker compression.

Every next-stage/child application popup opens at the invoking cursor point through `ContextStage`/`usePopupAnchor` and shared popup widgets. Field/page identity changes may reanchor; value/hover updates must not, and held slider gestures suppress it. Same-title custom stages declare a stable stage key. Do not add pointer tracking, update-time discovery or private positioning. Browser-native dialogs and resident-window placement are separate. New construction presets insert alongside existing contents through `insertConstruction`, preserving earlier geometry and canonical references while remapping fresh internal IDs/scopes.

Popup dials use the single `radialLayout` / `RADIAL_GEOMETRY` policy through `RadialMenu`; adapters provide contents and metadata, never feature-specific radii/overflow rules. All entries stay direct unless explicitly categorized. Numeric setters are hidden at rest and appear while pressing/dragging the owning DOF icon via shared RangeGestureTarget/RangeControl; release commits and hides, cancel restores. The size slider stays only on the highest popup parent. Setters are outward spokes; `RangeAxis` captures their displayed drag axis at gesture start, with no per-motion measurements. Appearance inputs declare the shared ✨ Appearance group once in freedom metadata; preset, target and MC projections inherit it. Full-opacity popup dials drag by their centre via `ContextualMasterController`, retaining child Back clicks and transient placement. The resident canvas rim is an explicit shared variant, not another popup layout.

Editing surfaces declare `data-ui-gesture-owner="content"`; the shared interface selector must yield ordinary modifier presses within that boundary unless interface-selection mode is explicitly enabled. Reuse `contentOwnsPointer`; preserve MS priority and already-prevented events. Do not fix content selection by adding more per-feature global pointer listeners.

Preset DOFs declare applicable shared property inputs; discover with editableDegrees and reuse shared target setters/editors. Never add a separate adjustment handler for each preset when the property already exists. Contextual popup opening presses must not activate newly appeared controls on release.

Direct manipulation and property editing are complementary. A draggable property must remain discoverable in shared DOF editors; do not hide writable position inputs merely because a drag gesture also edits them. Position X/Y reuse the shared coordinate definitions, Relations grouping and target setter for every generator.

Before every implementation delivery push/preview, run the existing model/architecture suite (`node --run test`) and wait for its exit status, alongside the required build/backend checks. Requested behavior changes must update stale assertions in the same delivery. A successful frontend build is not sufficient to publish. Do not rerun GitHub workflows as a development loop or silence notification settings; fix the underlying failed checks locally.

Install the checked-in source pre-push gate with `node --run hooks:install` on each checkout. Never bypass it with --no-verify or a temporary hooksPath. It blocks source pushes until model tests, preview build and backend type checks pass on a clean HEAD. GitHack artifact-only refs skip repeated source checks. Local failures never reach GitHub or send workflow emails. User-confirmed handoff: once local checks pass, push and hand over the preview without waiting for CI. Report CI as pending when applicable. Remote infrastructure/deployment failures cannot be ruled out by local checks.

Shared popup navigation is owned by MC: Alt+MB4 previous level, Alt+MB5 next applicable stage, Enter confirmation, Esc cancellation/outward stepping. Editors register useContextNavigation callbacks on their own DOM scope so nearest nested stage wins. Preserve MS/native field/held-gesture priority. Do not reintroduce Back/Confirm/checkmark buttons on Omnic dials; centres drag only. Plain side-button history remains unchanged.


⠒❉ is the shared raw-number system/control, with Count as its first test consumer.
Current rollout is restricted to Omnic Composer through NumericEditorScope and
PropertyEditor; keep it compact and requested, and retain outside editors. All
numeric Composer DOFs inherit the shared state field and existing owner setters;
the dial configures its variables and exact entry. Signed
whole-number notation is enabled; decimal notation, reference equations/rules and
action/candidate ranking are deferred. Preserve existing exact fractional entry.
Do not restore count-only picker flags or implement private math per preset/DOF.
See OMNIC_COMPOSER.md and UI_COMPONENT_CONTRACT.md for the current scope.


Global mathematical relationships follow the living experimental master plan in
[docs/OMNIC_RELATIONAL_SYSTEM_PLAN.md](docs/OMNIC_RELATIONAL_SYSTEM_PLAN.md). Keep
it current after each experiment and user correction. PR #41 is discarded; restart
from PR #40. Build through shared property/action boundaries for all applicable
DOFs/entry paths. Dragging through geometry is only one example. Keep experiments
small, reviewable and reversible; user usage decides their acceptance. Do not
implement the entire module roadmap at once or expose another manual reference
form as a substitute for the shared architecture. Initial rollout stays Composer
only; ranking remains excluded.

“Leave math to the dial” means editing rules are configured through ⠒❉ (e.g.
increments, halving, doubling, double every N steps). Shared code implements and
evaluates those rules; the user is not responsible for coding them. Reuse the
dial's configuration/mode interaction and one shared rule model/evaluator through
the existing property setters. Do not create competing slider-rule settings or
change existing numeral semantics implicitly. Iterate bounded rule experiments.

Global-system UI experiments use minimal text without ambiguous icons. Keep
short icon-plus-label controls where needed (e.g. ⟴ Reference). Put secondary
explanations in tooltips/accessibility metadata; omit redundant captions, repeated
headings and instructional paragraphs. Icon-only remains a long-term direction,
not a requirement to remove useful labels now.

E02's mandatory Reference → Rule → Match numeric UI was rejected. E03 tested
Rotation selection; E04 now generalizes the interaction into a universal available-
state field. Read the latest E04 record in the living master plan. All Composer
numeric DOFs inherit generator → constraint filter → projection → nearest state →
preview → commit through DofStateField and existing owner setters/history. Domains
and constraints drive manifestations; never implement copied field/preview logic
per preset/DOF. Coordinates/lengths/cyclic and raw quantities use reusable projection
adapters. Math dial configures variables/limits and exact entry. Count has no
physical axis: radial positions are addresses. Current constraints cover numeric
bounds/integer validity and existing legality; missing geometry solvers are not
inferred. Keep prepared work bounded and outside pointer motion. Shared fields are
not yet browser-accepted, and general 2D/vector fields/persistent constraints remain
pending. Preserve physical press-origin context ownership; E06 supersedes DOF Alt parking. Do not
revive automatic invitations/Space acceptance or the discarded manual E02 flow.


Latest E05 correction: ⠒❉ is the rule maker; the value slider executes generated
values. Do not replace execution with a circular/axis value dial or standalone
halving picker. DofStateField lends prepared rule values to shared RangeControl.
Min/max controls belong at the slider ends. Drag previews, release commits;
arrows/wheel/keyboard traverse adjacent generated values, without interpolation.
The math dial edits rule variables and bounds only. The standalone RangeControl
½ picker is removed; geometric pivot/axis halving remains separate. See E05 in
the living plan before extending the system.


Latest E06: Composer top always displays clickable active DOF, mode/rule and ⟴ reference. During a DOF-changing gesture the same information echoes beside the cursor without intercepting input. MB3 (catalog/rebindable) toggles the existing settings radial; DOF Alt parking is removed. Gesture activation, reference/rule configuration and slider execution share the existing numeric scope/owners. MS owns precise authored-boundary reference picking; temporary requests restore previous selection on accept/cancel. See E06 for implemented limits.


E06 presentation correction: the information strip exists only while a DOF is active. It uses icons/numeric expressions with descriptive tooltips and accessible labels; no inert default placeholder or visible text labels. The radar strip is inset inside its circular clipping boundary. The noninteractive cursor echo uses the same compact symbols.


Latest E06 correction: remove the DOF-information cursor echo entirely, including its numeric-editor cursor zone plumbing; ordinary tool cursors remain. The active icon strip is the information location. A button-triggered editor must open below its actual button, not above/to its side: shared cursor tracking captures its bounds on activation before stage replacement, and shared popup placement centers the editor below it. Ancestor overlap may only move it further down in that column; explicit hover-branch radial anchors retain radial placement. Canvas/shortcut openings without a button keep cursor placement. Rule/reference settings and MS picking do not render the value slider alongside them; returning from configuration restores the numeric value editor. A readout such as 10.2949 is simply the current position value. These corrections supersede gesture-echo and lateral-separation descriptions above. Browser visual acceptance pending.


Active-edit sub-setters: right-click during a move/authored-rotation gesture or a held numeric-slider edit settles the current preview and summons the registered active DOF settings at the cursor. Mouse-only right-button chords while left remains held join the same secondary-release path, without duplicate activation. Use the shared ContextLayer dismissOutside capability for these settings: clicks outside registered popup interiors dismiss and consume that press, including outside controls/objects; MS retains priority. The requested settings view contains no companion value slider. Button-triggered settings still use below-button placement.




Reference entry correction: “MC” here meant the existing selector invoked by Q (selector.open). The mistaken MC selection list/request store/window-opening path is removed. The top ⟴ button invokes that same selector action directly; no reference options list or intermediate radial. Composer SVG primitives declare data-selection-boundary plus data-selection-id inside data-selection-scope, so ordinary Q can select authored Composer objects and reconnect boundaries after SVG replacement without crossing surfaces. A temporary reference request consumes the chosen object inside the current Composer: compatible other object sets the reference, the active object restores Self, empty Composer space selects Environment when supported. Acceptance/cancel restores previous selector selection/configuration. Configuration stays with the Q selector; no duplicate selector UI or hardcoded shortcut. Current authored/single-target/SVG reference limitations remain. Browser confirmation pending.


Actual rotation-edge correction: remove outsideBoundary and the 2–8 scene-unit/object-size activation margin. Rotation hover and primary press both use rotationEdgeHit over a prepared index of selected evaluated primitives. Exact segment/circle distances include stroke width and fill; visible ink stays a move grab, empty space near actual rims (including hollow inner rims) qualifies. Bounding boxes only accelerate the search and retain the existing pivot calculation; they never decide activation. The band is eight CSS pixels in the local Composer via its existing coordinate adapter; the world-preview adapter supplies local projected-plane pixel scale. Geometry/index preparation happens when the selected evaluated snapshot changes; pointer queries do no scene discovery or DOM measurement. Future rendered primitive kinds need their geometry adapter, not preset-specific rotation zones. Hover state clears on view changes. Model regressions cover slanted/circular edges, false box corners, interiors, overlap, hidden geometry and zoom scales. Browser acceptance pending.


Unselected hover correction: interaction previews must not require prior selection. Prepare rendered-geometry ownership and registered DOF capabilities per displayed snapshot; preview Move over applicable visible ink and Rotation near actual edges only when the target declares rotation. Hover never commits selection or geometry. An edge press on an unselected object selects the canonical authored owner and starts rotation in the same gesture; selected-group scope is preserved for its members. The common authored-node resolver is reused by reference measurements and hover discovery, including reused geometry. No per-preset hit handlers, per-motion registry discovery or new cursor renderer. Existing MS/Ctrl/Erase priority and geometry-only hit tolerance remain. Browser confirmation pending.


Scalar grab correction: geometry chooses the DOF/tool before a press; once grabbed, scalar value execution is a virtual slider in free space. Shared createValueScrub serves relative RangeControl/DOF-icon drags and Composer edge rotation. The first meaningful movement (three CSS pixels) locks its arbitrary axis for that gesture. Continuing along it increases, reversing decreases, perpendicular motion is ignored. Screen displacement traverses the prepared value sequence/bounds; it does not follow the shape or compute cursor angle about its center. Press/jitter leaves the value untouched; release commits once and cancellation restores via existing owners. Edge rotation uses the generic value gesture; obsolete shape-following center/field gesture state is removed. Explicit legacy Step/pivot rotation remains separate. Two-axis direct placement keeps its existing spatial translation behavior. No extra floating slider is introduced. Browser acceptance pending.


Latest Rotation correction: hovering actual edges shows the cue; a primary edge click only selects its owner. Right-click the target to choose Rotation, or use its assigned DOF shortcut; selection does not open the wheel. Rotation is no longer a scene drag/scrub/orbit gesture. Shared DofStateField projects all declared cyclic domains through DofAxisWheel: hover previews generated states, click commits and stays open, leaving cancels preview, and the centre is neutral/drag-only. R and preset/target Rotation inherit the same metadata-driven projection. Reuse existing state-field generation, preview sessions, captured-click activation, setters/history, rule/⠒❉ configuration, Q references, shared dial scale/appearance and outside dismissal. No private rotation math or extra scalar bar. Scene scrub state and its virtual default span are removed; createValueScrub remains only for existing relative DOF-button sliders. Ordinary noncyclic numeric DOFs retain RangeControl. Explicit legacy Step/pivot remains separate. This supersedes earlier rotation-edge scrubbing descriptions. Browser confirmation pending.

Window onInteract callbacks commit on confirmed click, never mouse-down: raising/focusing is separate from pinning/toggling. Reuse the shared drag activation guard for physical tails across reparented surfaces; preserve keyboard/programmatic clicks and actual preview gestures. See UI_COMPONENT_CONTRACT.md.

Selection relations (2026-11-06): containment, physical continuity and authored
parentage are independent. Reuse MS configuration/matching/history; the configured
rule defines selection and the pointer defines the target. Individual/Exact picks
one registered part. Inside requires full containment, with the pointed boundary
controlled separately by Contour. Continuity follows actual touching/intersecting
ink including stroke thickness and supported clipping; nested-but-disjoint parts,
matching paint and shared parentage are not connections. Do not create parent
objects or candidate-object cycling to implement this. Renderer adapters expose
geometry through the shared relation layer; unsupported geometry must not become
filled bounds. See VISUAL_SELECTION.md for implemented adapters and limits.

Fill ownership correction (2026-11-06): Continuous extends one existing component;
Object retains an independent exact filled intersection. Transform the source
circle and clip together; bounds are never replacement geometry. With several
actually touching contributors, borrow MS to choose the attachment owner on canvas
after choosing the region; this is not a chat question. One touching owner resolves
automatically. No contact cannot invent continuity. Ownership, physical contact,
containment and authored grouping remain independent. See OMNIC_COMPOSER.md and
DATA_EVOLUTION.md for snapshot and legacy compatibility limits.


Interaction visual priority (2026-11-06): native top-layer order is opening order,
not CSS z-index. Reuse topLayerOrder for contextual previews/settings and the
shared tool cursor; later content must not cover them. Keep layer ordering off
the pointer-motion path. Priority alone cannot make same-color transparent
controls legible: coordinate previews need contrast backing and the selector a
contrast edge. Preserve cursor applicability, focus and existing gesture owners.


Baseline input ownership (2026-11-06): use inputOwnership's nearest-owner rule,
not per-widget exceptions. MS owns registered content; native/accessibility and
shared UI control declarations own their entire input tail. Releasing a canvas
session means inactive, never implicit global UI selection. Standalone global MS
requires explicit entry. Explicit Color DOF entry uses the shared picker seeded
with the current value, after popup layout and native listener registration.


Selection snapshot ownership (2026-11-06): synchronous baseline entry must advance
catalog, measurements, lens geometry and continuity together via
prepareSelectionSnapshot. Never update catalog wrappers while retaining a map
keyed by the previous wrappers. The approved coordinate-click/library diagnostic
found this exception before confirmation; do not patch affected widgets instead.

Borrowed content requests (2026-11-06): pass the live content surface to requestPick;
apply the nearest-input-owner rule during pending reference picking too. Yield
outside input without canceling or reparenting the editor. A missing scoped root
is inactive, never an implicit global MS session. Verify controls before accepting
a referent as well as coordinate confirmation after acceptance.

Confirmation acceptance (2026-11-06): for single-value Composer projections,
verify both the write and completion. Click/Enter must close the preview so later
pointer motion cannot keep sampling. "Click then Esc retains, Esc alone cancels"
can mean the write succeeded but the editor failed to finish; inspect completion
before patching input capture. Preserve explicitly accumulating controls.

Detachment (2026-11-06): attachment ownership, containment and contact remain
independent. Use componentAttachments for explicit detach capabilities; UI must
not guess provenance from role-prefix strings. Detach snapshots exact current ink
through the existing region generator, retains authored/primitive IDs, validates
the whole pipeline before commit and uses shared draft/history. Unsupported
lossy conversions preserve the original. Do not silently detach when moving.

UI edit-mode correction (2026-11-06): normal controls, field editing, minimize,
restore and close never require edit mode. Off fixes individual control layout;
whole frame/window movement and resizing stay available by default. Preserve
explicit saved rigidity and pins. Drag-tail suppression must require actual
drag capability at the nearest owner; pointer drift on fixed controls is not a
drag. Reuse the shared rigidity and activation guards.

UI right-click correction (2026-11-06): UI-customization context menus and
right-click UI label renaming require UI edit mode, regardless of saved movement
exceptions. Domain-specific right-click remains available in either mode. Reuse
contextMenuOwnership at shared entry points; do not block secondary input globally.

Node document formatting (2026-11-06): basic Markdown renders directly with markers
hidden, while the existing mixed document stores the original source and canonical
glyph references. Use textHTML/readTextDOM rather than saving HTML or adding a
second document store. Preserve bounded live edits, caret/IME/native history and
shared clipboard/portability. Do not claim full CommonMark or browser acceptance.

Atlas child detachment (2026-11-06): detachPlacement preserves world XYZ and saved
layout coordinates while clearing visual/variant visibility parentage. The
separate detachNodeConnection also removes the current canonical containment edge.
Containment, typed relationships, variant definitions and visual placement remain
independent. Reuse shared document history/persistence and keep descendant IDs
and local offsets. The node menu uses connection detachment; Inspector None/root
uses placement-only detachment. Do not silently repack a detached branch.

Document essentials (2026-11-06): editable authored content is not UI-caption
content; NamePresentation must not inject icons into semantic document tags.
NodeDocument inherits FloatingWindow/FrameChrome rather than a private anchored
shell. Its live DOM owner lives inside the portal payload for safe host changes.
Use native editable list/formatting transactions and preserve their semantics
in readTextDOM; stale source attributes on an unformatted span must not resurrect
styles. Shared UI rigidity/pinning and document-save guards stay authoritative.
Document formatting/list commands must register with featureActions and use
useFeatureActions. Keep Shift configuration policy intact; native editing is not
a reason to add private executable hotkeys. Registry availability follows actual
editor/list ownership, with updates only when that classification changes.

Default-home recovery (2026-11-06): accidental UI moves must be recoverable after
saving/reload without Undo. Use residentHome's shipped/native-home resolution and
the existing UI transaction; preserve styling, settings, identities and unrelated
organization. Unknown custom homes cannot be guessed. Local frame arrangement
cleanup and whole-layout reset remain separate actions.


Atlas lattice (2026-11-07): one sparse occupancy field includes hidden/filtered
placements across all parents. Use graph/lattice for safe-integer addresses,
nearest-free creation, fixed-axis whole-cell movement and commit reconciliation.
Scale changes rendering, not stored coordinates or independently sized content.
Keep old coordinates read-only on load; first geometry alignment preserves an
existing-format protected recovery layout view. Read docs/ATLAS_LATTICE.md before
changing atlas placement, scale, empty-field rendering or recovery. This atlas
rule does not impose a lattice on Omnic construction modes.

Atlas selected presentation (2026-11-07): selection hides only the atomic O
carrier and shows full content until deselection. Preserve the pulsing selection
ring as the selection indicator, separately from the carrier. Keep the invisible
picking slot and retained/hover/Names behavior; no coordinate or scale change.

Atlas binders (2026-11-07): labels attach perpendicular to their projected binder
toward free screen space; shared rotated-label packing never falls back over nodes.
Drag-to-reconnect uses graph/reconnectBinder's actual relationship/containment/
visual/variant owners, preserving IDs/content/positions and committing only after
validation. Reuse coordinates.rebaseParentage for live and saved-view parent
conversion. Keep source connections intact during preview and honor shared cancel/
input ownership. Read docs/ATLAS_BINDERS.md for semantics and limits.

Binder rotation correction (2026-11-07): use true projected carrier circles and
selection-pulse annuli in label packing. If a rooted perpendicular label is
blocked, keep its binder root and advance a short stem into clear space. Wrap
long phrases without dropping text; validate complete rotated bounds rather than
clipping glyphs or disabling depth tests. Preserve the selection pulse. The
authorized local rotation diagnostic is opt-in, not standing browser permission.

Atlas binder anchoring correction (supersedes packing/stem rules above): labels
start directly at the fixed binder midpoint and extend along its directed screen
normal. No leader line, obstacle packing, side/sample switching or hover-driven
relocation. Upright glyph rotation preserves attachment side. Expansion-space
realignment is deferred; overlap/viewport clipping is possible for now.

Atlas incoming binder visibility: use the downstream placement's selection or
explicit transient open state for every binder kind. Source selection, hover,
Names and structural expansion alone must not expose outgoing relations. Hide
all line/marker/text/hit objects together; do not merely dim unrelated binders.
Reuse nodePresentation expansion state; no saved graph mutation for visibility.

Empty lattice field span follows the viewport/frustum, not a fixed cell radius.
Reuse the shared render lifecycle for zoom/resize updates and cached camera state.
Bound overview work with screen-based sampling of real cells, never enlarged
fake cells or dense world allocation. Preserve hidden occupancy and creation slice;
no saved-data or coordinate changes. See docs/ATLAS_LATTICE.md for sampling limits.

Lattice sparse-field correction: sample the visible screen in both axes and
intersect the actual creation slice, deduplicating real cell addresses. Do not
budget from a far-plane world bounding box, which starves tilted nearby views.
Do not impose a fixed world patch or a view-distance horizon. Keep screen work
bounded, cell diameter/occupancy/creation unchanged, and reuse camera/viewport
invalidation in the render owner. Supersedes world-anchored power-of-two sampling.

Composer context selection: right-click a selected component/selected-group
member without replacing accepted membership; empty editing space opens the
selection's compatible DOFs while a selection exists, otherwise creation presets.
An unselected component becomes the new context target. Reuse componentTargets
context scope, selectedEditorDegrees, existing selection and property writers;
no color-specific menu, duplicated setter or new global input owner. Active DOF
settings/reference gestures retain priority. See docs/OMNIC_COMPOSER.md.

Composer wheel correction: an opted-in selection surface may declare nativeWheel
in the shared selection registry. Plain wheel over Composer retains existing
view zoom even during MS/reference aiming, before selector lens resizing. Shift
retains explicit selector geometry rotation; Ctrl retains native browser zoom.
Do not use a Composer CSS exception or another global listener. Lens geometry
opt-in and wheel ownership are independent. Update docs/VISUAL_SELECTION.md.

Omnium UI-context actions must use shared uiContextEnabled even within content
menus; recheck the live layout at execution. Hide availability without deleting
saved menu residents/positions/customization. EntityMenu/DockArea provide this
transient projection. Graph context actions remain usable outside UI edit mode.

Binder selection/actions use graph/binderActions with real domain owners and
shared coordinate rebasing/validation/history. Click/right-click visible binder
ink selects its occurrence key and opens its existing editor; selected ink stays
visible and thickens. Reverse/Delete/Focus endpoints reuse registered actions.
Live glyph visuals use optional visual.omnicEntityId, shared Omnic renderer/budget,
strict canonical validation and atlas-import identity remapping. Source changes
follow saved shared recipes; no new unsaved binder preview protocol. Preserve old
asset/character visuals and reject deleting in-use sources. Read ATLAS_BINDERS and
DATA_EVOLUTION for exact semantics and older-client limits.

World navigator (2026-11-07): its transient internal frame follows camera
orientation like a compass. Mouse controls camera-facing XY; Up/Down step local
Z toward/away by one rendered lattice pitch. Reuse registered world-scope held
commands and the bounded held scheduler; OS repeats never queue. Scoped feature
owners get first refusal before legacy keys, independent of listener order.
Plain node click mounts/selects a driven branch; empty-slot click parks/unmounts.
Use navigatorDrive's prepared occupancy/renderer preview and one normal document
commit. Another-node click parks the old car at its last valid preview. The driven root
cannot mask parking hits; descendants retain normal detection. Invalid targets keep last valid geometry; Esc/capture/
context replacement cancels. Right-click retains actions. Camera follow translates
camera/target without fit/rotation and rebases the local grab offset. Navigator
previews/depth never enter data or undo; camera and placement commits retain their
existing separate history owners. Picking remains ordinary projected hits, not
plane-only. Independent rotation controls are deferred. Read WORLD_NAVIGATION.md.

Navigator follow-up: Up is forward/camera-negative Z (away), Down is backward/positive Z
(toward); saved key assignments retain their IDs. The camera-facing ring contains
a single cyan end-to-end diameter, not XYZ axes. Project the world X direction
into camera view, retaining full diameter and last direction when exactly end-on;
inherit the ring appearance. Ctrl/Meta-click positions navigator and
camera target at a node without mounting/moving it; cancel an unparked drive. Reuse
the selection surface optional modifier-click owner, capture press hit, retain
Ctrl-drag marquee and fresh geometry validation on release. No new global listener.
The user chose preview testing for this compass follow-up; no new browser run authorized.

Camera follow retired: node mounting, parking, empty clicks and Ctrl-click navigator positioning must leave camera position/target unchanged. Only explicit navigation/framing actions move the view. Pointer grab rebasing remains; no click writes camera history. This supersedes earlier follow semantics.

Alt-left-drag atlas painting inherits the Composer-owned paintStroke sampler; do not duplicate sampling policy. Start empty for blanks or on a node for independent content/visual copies (no subtree/relationship copy). Atlas adapters own camera-plane conversion, sparse occupancy, transient instanced outline preview (256 max), and one existing document/history commit on release. Skip occupied/hidden/repeated cells. Esc, capture loss and document replacement cancel. Camera stays fixed. No browser acceptance inferred.

Atomic carrier visual update: actual translucent SphereGeometry (.5 radius before the existing diameter scale), Phong material using existing lights, opacity .28 times authored opacity, depthWrite false. Do not billboard spheres; selection ring and text still face camera. Existing picking, occupancy, selection/content replacement, data and paint previews remain unchanged. No new rendering/depth pipeline in this first pass.
