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

# Universal Master Controller signature

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
numeric Composer DOFs inherit the same dial and existing owner setters. Signed
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

E02's manual Reference → Rule → Match numeric UI was rejected and removed.
Its pure measurement/candidate models remain reusable infrastructure. E03 is the
current unaccepted interaction experiment: activate a DOF → select its generated
states; current mode and expression explicit; Alt parks cursor DOF/mode/reference
indicators for configuration. Rotation is the first cyclic domain adapter. See
the living master plan and capability omnic.dof-state-wheel. Do not revive the
abandoned automatic invitation/Space-acceptance or mandatory Match-menu proposals.
Math dial configures rule variables; it does not replace the state selector.
