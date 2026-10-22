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

- Define visual properties once in `src/appearance/registry.ts` (`PROPERTIES`).
  Reuse the existing property when its meaning matches. A new feature must not
  introduce another Color/Opacity/etc. definition, value store or bespoke editor.
- Components expose visual parts and renderer adapters through the shared target
  registry. Target identity, selection boundary, visual role and property are
  separate concepts. HTML, SVG, canvas and 3D may need distinct adapters, but must
  share property IDs, applicability and editing rules.
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
