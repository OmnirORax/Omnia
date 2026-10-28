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
