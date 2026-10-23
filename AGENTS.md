# Worker entry rules

Read [docs/WORKER_ONBOARDING.md](docs/WORKER_ONBOARDING.md) once when starting work
or resuming with a fresh context. It supplies the project mental model, system
boundaries, status map and links to task-specific contracts. Do not reconstruct
the project from source or chat history for every task; inspect the affected code
after loading the shared model. Keep this brief and the relevant subsystem docs
current when changing a cross-cutting contract or its implementation status.

# Universal Master Controller signature

**Shift + any configured shortcut opens that function's adaptive Master Controller
configuration instead of executing it. Releasing Shift finishes configuration.**
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

# Compactness is a product requirement

Every new or changed UI feature must use the smallest practical layout that fits
its controls neatly and readably. Size containers to content, use tight consistent
spacing, group related controls in rows, and avoid large minimum dimensions,
full-width fields, redundant headings, decorative padding and empty space.
Put secondary explanations in accessible tooltips instead of permanent paragraphs.
Contextual Master Controller projections show only relevant controls. Preserve
readable labels, keyboard access and usable pointer targets; enlarge a surface
only when its actual interaction or content needs the space. Apply this by default,
not only after the user requests a compactness pass.

# Responsiveness is a product requirement

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
