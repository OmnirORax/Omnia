# Universal properties, coupling and generated controllers

## Universal halving method (user requirement, 2026-10-28)

The user explicitly clarified that the **halving method applies to all value
picking systems**. It is not confined to Omnic, rotation, pivot selection or
radial axes. Build the applicable mechanism once in shared property/value picking
and let current/future consumers inherit it through their declared domains.

The interaction uses a chosen interval/reference and a quickly entered halving
depth, with direction/endpoints where needed. Radial examples start with six
divisions and can refine to 12, 24, 48; position examples include half, quarter
and eighth along an axis. These examples do not yet settle all indexing and
direction rules. The exact interpretation of depth, interval branching, valid
thresholds and mapping to discrete/non-numeric domains remains open. Preserve
consumer constraints and distinguish picking precision from actual allowed values.
Do not create separate halving implementations or settings stores per feature.

Status: **shared core implemented; migration is incremental**. Updated 2026-10-22.
The general registry now drives canonical property lookup, compatible consumer
coupling, category discovery and generated controller/target projections. Existing
visual targets join the pool; mouse trail and placement settings are the first
consumers using the new declaration/adapter path. Other existing feature-specific
settings are not automatically migrated. This is not inference from arbitrary
JavaScript variables, function names or pixels.

## Purpose

A new function can have properties unique to it and properties shared with other
functions. Shared properties must be defined and implemented once, with consumers
coupled to the shared machinery rather than recreating settings and setters.
This applies across the project, not just to visual features.

The master controller groups properties into categories such as Physical and
Visual. Examples include speed, gravity, rate, weight, color and brightness.
These examples do not imply that physical simulation or its properties already
exist. The category vocabulary and complete property inventory remain extensible.

## Agreed behavior

1. When a new function introduces a property, first check whether the compatible
   property already exists in the shared pool.
2. If it exists, couple the consumer to it. Do not create a second definition,
   setter or parallel control system for the same property.
3. If it does not exist, add its definition and shared editing support once,
   under the relevant category. Create a category when none fits.
4. Established couplings drive inclusion in the hierarchy of controllable things.
   Do not independently maintain a list and hope the property path is wired later.
5. A unique property can later be reused by additional compatible consumers.
6. **Consumers retain independent values. Changing one does not change the others.**
   Explicitly targeting several consumers permits a shared adjustment to that set.
7. Existing shared fields should remain shared. Add and serialize only genuinely
   new property definitions/fields; use the established path for existing ones.

Here “shared” means a common definition, setter/editing machinery and supported
contract. It does not mean one global mutable value, synchronized instances,
identical defaults, or that every consumer supports every property.

## Example: two functions with color and rate

Suppose functions A and B both support compatible Color and Rate properties.
The controller has one Color definition and one compatible Rate definition. A
can have blue and rate 2 while B has red and rate 5. Editing A changes only A.
Selecting both and applying a compatible adjustment explicitly changes both.

A third function with a genuinely new property adds it to the pool once. A later
function can couple to that property without adding another editor. The same
identity should appear consistently in discovery, editing and serialization.

## Implementation constraints

Bounded text inputs are supported through the shared `text` property kind with
`maxLength` and optional `multiline`, including the scene prompt. The generic
editor keeps a cancellable draft and commits on blur; normalization preserves
registered text lengths instead of dropping values above the legacy 200-character
unknown-field limit. Reuse this editor/validation for future text consumers.

The following remain the integration contract. The first implementation uses
explicit property declarations and canonical IDs; a user-facing category/coupling
authoring UI and broader inference remain future work:

- Names alone are insufficient for matching. Meaning, value type, units and
  supported ranges/operations matter. Playback rate and particle emission rate
  must not be merged merely because both contain the word “rate.”
- Prefer explicit machine-readable capability/property declarations over guessing
  from pixels, CSS names or arbitrary implementation variables. Automatic lookup,
  validation, coupling and inclusion can operate on those declarations. This is
  an implementation recommendation, not a claim that the user specified a schema.
- A property definition and its application adapter are separate. Text, a light
  source and a physics object may require different application logic while
  sharing compatible editing and validation. Each advertised coupling must reach
  real behavior; displaying a control is not sufficient.
- Property identity, category, consumer identity, value, coupling and current
  targeting are separate. Labels and category organization must not change IDs.
- Categories organize the property pool; hierarchy inclusion describes coupled
  consumers. Do not treat every function as an appearance target or mix this with
  canonical knowledge containment.
- Preserve independent values, overrides, locks, bypass, history, serialization
  and defaults when migrating existing consumers. Reuse existing state owners;
  a universal registry does not make all state graph data or all state UI styling.
- Preserve working old routes until their supported behavior is covered, then
  remove redundant definitions/editors rather than leave two active systems.

## Current implementation

- `src/properties/registry.ts` is renderer/state-owner independent. A property
  definition supplies stable identity, kind, units, bounds/options, defaults and
  category. `define` reuses a compatible existing ID and rejects conflicting
  contracts. `couple` accepts shared IDs or new definitions, discovers new
  categories and publishes a consumer only after validation succeeds.
- Functions define their real inputs once in co-located `*.function.ts` modules
  through `defineFunction` (`src/properties/function.ts`). Input keys reference
  existing property identities; new inputs include their definition inline. State
  readers/writers are part of that same input, not repeated in another registry.
- `scripts/discover-functions.mjs` automatically finds those modules and generates
  the loader before dev, typechecking, model CI and both builds. Vite also discovers
  additions/removals and reloads changed input modules. No central consumer list or
  hand-maintained settings-adapter map remains. Definitions initialize before
  coupling, including channel dependencies, so references do not depend on filename
  order. Do not edit `functions.generated.ts` by hand.
- Built-in definitions in `src/properties/catalog.ts` seed `PROPERTY_REGISTRY`; `PROPERTIES`
  is a compatibility view, not a second pool. Existing renderer target declarations
  also join the coupling graph automatically. Their IDs and fallback resolution
  remain intact.
- `channelOf` declares a specialized channel of a shared property. A consumer
  supporting only animation color gains the canonical Color capability coupled to
  that channel. If it explicitly supports both ordinary and animation color,
  those channels remain separately addressable. No values are synchronized
  between consumers.
- Appearance target paths/capabilities for new consumers are generated after
  coupling, including the mouse trail's Mouse branch. Unknown properties are
  appended to their declared property category automatically; established property
  tree IDs and paths stay stable.
- `CoupledProperties.tsx` generates nonappearance property categories, shared
  editors and consumer inclusion controls from couplings. The existing visual
  controller is grouped under Visuals. Spatial is supplied by the real placement
  settings; Physical will appear when an actual property declares that category.
- `preparePropertyChanges` validates one adjustment and prepares writes only for
  selected compatible consumers. State adapters apply them to the existing owner.
  `settingsAdapter.ts` retains `settings.spatial`, normal UI history and settings
  serialization. Mouse trail keeps the appearance draft/Apply/discard path. No
  third value store is introduced. Existing placement control IDs now use the
  shared setter/editor rather than copied limits and validation.
- A build-time property contract check covers one controller node per definition,
  appearance hierarchy/coupling coverage and the settings adapter channel map.
  Registration rejects duplicate consumers, incompatible definitions, unknown
  properties, invalid defaults and unsupported select choices. New state owners
  must extend adapter coverage rather than bypass it.

The original mouse-trail gap is addressed by generated Color/Brightness/Opacity/
Glow couplings and a reader that resolves the same channel map used by editing.
The separate hardcoded Mouse trail editor section was removed. Find Mouse trail
under Visual hierarchy → Windows / frames / controls → Mouse, choose a supported
property, and edit it through the shared visual controls.

## Adding a consumer

Implement a configurable function in a `*.function.ts` module near the feature.
Default-export `defineFunction({ id, label, owner, group, inputs })`. The function's
runtime uses those same inputs (`readInputs` for resolved appearance, generated
state adapters for other owners). Existing input keys couple automatically. For a
new property, its input's `definition` supplies the type, units/category, bounds and
default once; discovery adds it to the shared pool and controller. Other functions
reference its key without repeating that definition. Legacy UI control identities
can be associated through `controls`; generated master controls need no duplicate
registration. Supply any actual state-owner integration once; do not add another
consumer registry entry, setter map, hierarchy row or private editor.

For example, a future function can declare a new numeric `physics.gravity`
property in category `{ id: "physical", label: "Physical" }` with acceleration
units and valid bounds. That creates the pool entry/category. A second compatible
function references `physics.gravity`; each adapter reads/writes its own value.
This example does not add a physics simulator or gravity setting to the product.

Actual function input definitions are the detection boundary. Every future
configurable function uses that path; discovery does not guess arbitrary local
variables or assign semantics from names alone.
Adapter validation establishes declared coverage, not a proof that every renderer
is visually correct. User interaction checks still determine behavior and fit.

## Acceptance examples for future implementation

A newly declared compatible consumer should automatically become controllable
through existing properties and enter the appropriate hierarchy. It should not
require a second hand-written hierarchy row or copied editor. An unknown property
should follow the new-property/category path. Incompatible properties must not
silently couple.

A change to one consumer must leave another consumer's value untouched. A targeted
group edit must reach only included compatible consumers and respect the relevant
protections. Saved independent values and established identities must round-trip.
A declared capability with no application path must be detectable, rather than
silently passing because its panel rendered.

These are behavioral requirements, not authorization to run extra tests now.

## Selection-driven discovery

Master controller follows accepted visual-selector and UI-function selections.
Selected parts expose the capabilities of their registered adapters; consumer
`controls` IDs associate a function with its additional nonvisual couplings.
The selection inspector reuses the contextual selected-part editor and generated
coupled controls. Inspection is transient and does not customize an instance.
Unregistered graph/functions require migration before their fields can appear.

## Logical objects and self-selection

A logical target is resolved by an existing coupled consumer ID or group ID through
`resolvePropertyTarget`. There is no separate device/target property inventory.
The selector's ◎ **Self inventory** projects existing consumer group paths marked
`self: true`. Mark the owning logical/meta group in its co-located input declaration
or existing target definition; the registry carries that metadata into coupling.
All coupled descendants join the inventory automatically. Do not add a second
handwritten target list, capability table, value store or per-target editor.

`selfInventory` and `resolvePropertyTarget` share consumer/group identities. The
normal property contract check verifies that every inventory node resolves to the
same consumers. Mouse → Mouse trail and Selector feedback → Included / Boundary
are the first paths. Hidden compatibility targets are omitted in the visible list,
while their saved IDs and values remain valid. Other state owners can use this same
projection once they have their normal state/property adapters.

Rows toggle through the selector's generic logical-selection API. Master controller
reveals ConsumerProperties and existing coupled editors without creating instances
or values. Feedback inspection shows a live sample using the real feedback renderer
and its existing shared paint. Native cursor/trail/feedback graphics remain
pointer-transparent. Logical picks share transient selection history, clear and
undo/redo; inspection/reopening never writes values or adds a transaction.


## Temporary activity while editing

`PropertyEditor` requests a scoped activity preview while its controls are hovered
or keyboard-focused. The shared property definition can declare `previewActivation`
(a controlling property, inactive value and active sample value). Animation
parameters use this to run an Off animation; gradient parameters show a disabled
gradient. Consumers whose entire function can be inactive declare the same contract
once in their co-located function definition (Mouse trail is the first consumer).
Discovery validates the capability and allowed values; restricted effect choices
use a supported sample. There is no target-specific editor or new value store.

`appearance/activityPreview.ts` projects only the render source. Editor reads,
commits, Apply/discard, export, drafts and histories retain authored values. It
preserves existing active effects, bypasses and exact selected-part scope. Editing
the activation switch itself remains authoritative: choosing Off actually shows
Off. Leaving/defocusing the editor, deselection, unmount, blur, hidden tabs or safe
view releases the preview. Feedback self-inspection already supplies a live sample
using the real pulse renderer. Other state owners still require an actual runtime
preview adapter before an inactive function can be temporarily activated; a
registry declaration alone cannot start arbitrary behavior.


Selector feedback's Pulse function is also discovered from co-located inputs. It
reuses `speed` and `intensity`, and introduces `pulse` once as a reusable visual
toggle. Its values are independent from Included/Boundary paint and other effects.
The runtime reads those exact couplings for native UI feedback, the scene adapter
and the live controller sample. No separate pulse store or bespoke editor exists.

## Action configuration projection

Every configured shortcut has Shift-to-configure through the universal router;
future features inherit that input rule automatically. Its adaptive MC projection
finds consumers through the existing `controls`/consumer IDs and uses their shared
editors. Specialized configuration content attaches to existing action metadata;
it must use the same property values and setters. `ui/resize.function.ts` is the
first Interface operation using the shared ordinal Level input and the normalized
extensible `settings.functionValues` store. Read FUNCTION_CONFIGURATION.md.

Temporary contextual choices are local drafts, not saved defaults. Generic actions
read invocation-only overrides through `bindStateProperties`/`withFunctionInputs`;
read bound inputs synchronously and capture them before async work. Right-click
locks through the existing validated commit path; Shift release invokes once
without persisting temporary choices. See FUNCTION_CONFIGURATION.md for the shared
interaction adapter contract. Do not duplicate input stores or per-feature Shift
listeners.


Numeric definitions can declare `numericRange: { by, otherwise, cases }` referencing
another declared input (for example Density depends on Effect). Discovery orders
that dependency with channel/preview dependencies. `properties/numericRange.ts`
resolves the intersection of semantic and active-mode bounds; editors and state
adapters reuse it. Appearance target metadata can narrow a renderer's range without
creating another property definition. Final writes/rendering enforce the range,
not only the slider. Imports retain valid values in the semantic domain; a render
fallback does not rewrite saved state. New numeric consumers must declare meaningful
bounds and join appropriate aggregate rendering budgets. See PERFORMANCE_RESULTS.md
for current limits and their calibration limitations.


Visual-role grouping is generated, not a maintained component/category list.
`appearance/visualRole.ts` is the shared semantic detector used by MS discovery
and `roleHierarchy.ts`. Registered background fills and contour/edge bindings
enter Backgrounds/Contours/Text/Icons/Indicators → detected system → type
automatically. Existing Text subtypes keep their established IDs. CSS adapters
supply that meaning through their actual paint channel; non-CSS adapters expose
`binding.role`. New DOM function consumers can expose their real adapter through
`visual` + `locator` in their existing function declaration. A selector or Color
capability alone does not prove that something is a background or contour.
Do not add per-component grouping exceptions or another target inventory.
The build contract checks every classified visible target's generated membership.

Stable leaf IDs/values remain unchanged. Old component branches are retained as
compatibility policy ancestry, including selection, locks, bypass and saved MS
patterns. New role selections override old type baselines; explicit leaf rules
remain narrower, and toggling a role clears its descendant exceptions. Old type
locks continue protecting their members from role-wide edits. The value resolver,
policy index and MS pattern index share this ancestry. Grouping compiles from the
registry at initialization, with no new DOM/pointer scans or animation work.


## Active Omnic parameter owner

World draft preview subscribes to the existing composer-owned recipe through
`omnic/worldPreview.ts`. The transient store carries a render projection only;
MC setters, draft recovery and chronological history still use the same owner.
It does not publish parameter samples to App state or commit workspace snapshots
on pointer movement. See the live draft section in OMNIC_COMPOSER.md.

`omnic/omnic.function.ts` projects generator/operator input metadata into the same
property pool and declares pure read/write adapters for the `omnic` owner.
`omnic/propertyAdapter.ts` scopes those inputs to the active component/application;
Color and Opacity reuse existing definitions, while geometric extent/count/angle
have their actual structural domains instead of reusing Star size or effect density.
Editors and setters enforce active ranges, including aliases such as size/length.

`contextBindings.ts` lends active owner binding references to subscribed MC controls.
It is not a durable value store: the recoverable recipe draft remains the owner.
Unmounted owners are hidden; settings adapters remain mandatory. The property
contract build check covers Omnic's channels as well. Specialized consumers should
use this existing extension path, not add a second setter registry or publish
parameter samples into application-wide settings/React state.
