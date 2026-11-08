# Data evolution and compatibility contract

Adopted 2026-11-04. This is a project-wide development requirement. It applies to
browser saves, recovery slots, drafts, exports/imports, cloud snapshots, database
schemas, assets and saved settings. Developers own compatibility as part of each
change; users must not have to request a migration after discovering lost work.

## Before changing a system

Identify its persistent owner and all readers/writers, including older clients,
other tabs, import/export and backend consumers. Trace changes to IDs, references,
units, defaults, interpretation and limits as well as field structure. A UI-only
or internal refactor can still change the meaning of a saved value.

Record in the PR: affected formats/versions and owners; intended treatment of old
values; migration or compatibility route; evidence; failure/recovery behavior.
For no persistence impact, state why. This is contextual engineering judgment,
not a requirement to bump versions or write migrations for every edit.

| Change | Required treatment |
| --- | --- |
| Internal implementation changes without changing stored meaning | Keep the existing format and verify affected readers/writers |
| Additive field/default | Define behavior for absence; retain older explicit choices, including false, zero and empty/cleared bindings |
| Restructured fields, IDs, units or meaning | Provide a versioned conversion or compatibility reader; preserve references and authored intent |
| Retired preference with no remaining purpose | Document its deliberate retirement and what replaces it, if anything |
| Retired feature containing authored work | Convert or preserve an inspectable/exportable archive; retiring the implementation does not erase the value of its content |
| Unknown/newer or damaged data | Refuse replacement safely or preserve an opaque original; do not normalize it to defaults and overwrite it |

No private credential values or user workspace contents belong in fixtures/logs.
Use representative synthetic data or explicitly authorized, sanitized examples.

## Persistence boundaries

Use the domain's existing parser, validator and persistence owner. Share portable
migration/validation logic between local storage, import and cloud paths where
they represent the same format. Keep storage schemas distinct from incidental
component state. Do not build a universal converter which guesses domain meaning.
Explicit format versions are distinct from content revisions and cloud conflict
versions. Preserve existing IDs and reference identity, or remap them consistently.

For incompatible changes, the required transition is:

1. Read the source without modifying it; identify format and version.
2. Preserve a recoverable original before any destructive replacement.
3. Convert a separate candidate through supported, explicit version steps.
4. Validate the candidate's structure, references and relevant semantic invariants.
5. Write and confirm successful storage before switching authority to the new copy.
6. Retain a documented recovery route; report unsupported conversion without
   silently discarding content. Failure at any stage must leave the original safe.

Conversions must not accumulate changes when retried. Handle interrupted writes,
storage-full/denied errors, stale tabs and concurrent saves at the affected owner.
Older clients must reject incompatible newer saves rather than clobber them. Keep
cloud/database changes compatible during rollout (expand, migrate, then retire),
including backend validators. Do not edit already-applied database migrations.
Rollback must account for data already upgraded, not just restore older app code.

Preserve unknown payloads only within validated size/security boundaries; never
execute or trust them. Explicitly distinguish partial restore from complete
restore. External asset references are not backups of the actual bytes.

## Verification and delivery

For each changed persistent contract, retain representative historical fixtures
and add meaningful assertions to the existing domain suite. Test supported older
versions, current round trips and unsupported newer versions as applicable.
Check authored text, identities, references, glyph definitions, units/settings
and asset availability, not just successful parsing or object counts. Exercise
migration retries, failure before activation and original preservation where the
change affects those paths. Test selected retirement behavior explicitly.

Preserve historical fixtures when adding a new schema version. Document the
supported compatibility range and an archival/conversion route for retired
versions. Do not claim indefinite backwards/forwards compatibility.

Run the affected checks and the existing required source pre-push gate. It runs
model/architecture tests, the preview build and backend checks on a clean commit.
That gate catches only cases encoded in tests: it does not infer which semantic
changes need migration. PR authors and reviewers remain responsible for the
impact assessment. Browser restore/performance acceptance follows AGENTS.md;
never infer it from a passing build. Report deployment requirements separately.

## Current owner map and evidence boundaries

This is a starting map, not certification that every row meets the contract.
Update it when adding or changing an owner. There is no complete audit yet.

| Saved state | Existing boundary / routes | Existing checks |
| --- | --- | --- |
| Atlas documents and legacy atlas migration | `src/graph/structural.ts`; `src/App.tsx` initial load and atlas import/export | `tests/structural.test.mjs`, `tests/model.test.mjs` |
| Workspace-wide entities, atlases, lexicon and library | `src/omnic/workspace.ts`, `src/omnic/workspaceBackup.ts`; JSON workspace import/export in `src/omnic/Library.tsx` | `tests/omnic-workspace.test.mjs`, `tests/omnic-document.test.mjs` |
| Active and before-replacement local workspace slots | `src/omnic/workspaceStorage.ts`; IndexedDB with localStorage fallback; `src/App.tsx` autosave | `tests/omnic-storage.test.mjs` |
| Glyph definitions, revisions and recoverable Composer drafts | `src/omnic/model.ts`, `src/omnic/Composer.tsx`, `src/omnic/draftHistory.ts` | `tests/omnic.test.mjs`, `tests/omnic-draft.test.mjs`, workspace tests |
| UI layout, shortcuts, settings and UI-template import/export | `src/ui/layout.ts`, `src/workspaceActions.ts`, `src/App.tsx` | `tests/ui-layout.test.mjs`, `tests/shortcuts.test.mjs` |
| Metrics timer preferences (mode/duration); scores are transient | `src/metrics/timer.function.ts` through existing functionValues/settings adapters and UI-template/combined-backup routes; absent preferences use Stopwatch/10 seconds | Shared settings/template suites; `tests/metrics.test.mjs` covers transient timing lifecycle |
| Account click attempts, one-time star claims and rankings | Additive `20261104000100_click_quests.sql` / `20261104000200_quest_authoring.sql`, authenticated RPCs, `src/metrics/cloud.ts`; independent of workspace/UI exports | `scripts/test-metrics-db.mjs`, `tests/metrics.test.mjs`; hosted rollout pending |
| Local quest records, best results and stars | `metrics/localQuests.ts`, versioned `omnium.local-quests.v1`; distinct from account cloud ledger and workspace exports | `tests/local-quests.test.mjs`: round trip, unsupported data preservation, stale-write refusal |
| Themes, embedded fonts and local assets | `src/themeTemplates.ts`, `src/fonts.ts`, `src/graph/assets.ts`; respective template/document routes | Existing appearance/model tests; complete asset restore coverage not established |
| Explicit cloud workspace snapshots and private assets | `src/omnic/WorkspaceCloud.tsx`, `supabase/functions/_shared/contracts.ts`, `supabase/functions/backend/index.ts`, versioned SQL migrations | `tests/backend.test.mjs` requires a running backend; `backend:check` is type checking, not hosted verification |

Observed safeguards include guarded initial workspace-load failure (autosave is
paused), validation, UI-layout legacy conversion, explicit before-replacement
workspace backups, and cloud version conflict checks. These are local safeguards,
not proof of complete environment recovery.

Known gaps and next bounded work:

- Combined workspace/UI export now covers the current layout/settings, icons and referenced fonts (see OMNIC_LIBRARY.md). No full-environment backup/restore covers all drafts,
  saved themes and asset bytes together. Define coverage and restore reporting
  before presenting such an archive as a full backup.
- No comprehensive released-version fixture corpus or general downgrade/stale-tab
  write protection has been established. Build these around existing owners.
- Some settings/theme/draft recovery paths default or omit invalid entries.
  Audit their treatment of newer versus corrupt formats before relying on them
  for lossless upgrades; retain recoverable originals when changing those paths.
- Local backups share browser/profile/origin failure modes. Cloud snapshots are
  explicit workspace saves, not automatic full-environment synchronization.
- Hosted deployment/restore state, including the reported Supabase pause, has not
  been verified by this documentation change.

The initial contract change established developer instructions and review requirements only. It
adds no new runtime migration engine, full backup, cloud sync or automatic
compatibility-impact detector. Close the gaps through bounded changes with
historical fixtures and recovery evidence, starting before the next affected
storage change.

### Reference-threshold fill (2026-11-05)

Owner remains the version-1/2 Omnic recipe and existing Fill application adapter.
New optional `clipped`, `left`, `top`, `right`, `bottom` parameters describe an
accepted coordinate-region snapshot; absence preserves whole-fill behavior.
Explicit legacy `fill: false`, zero opacity, identities and targets are unchanged.
Clip bounds must be finite, ordered and within existing numeric/extent budgets.
Rendered clip polygons are transient evaluation data, never another saved owner.
Undo, drafts, library, workspace exports and backend validation use existing recipe
paths. No database migration or new storage slot is required. Older clients reject
these unknown parameter keys; do not edit new clipped-fill work with an older
client. Keep the original export when moving between versions; no downgrade
conversion or universal stale-tab protection is claimed. Historical whole-fill
fixtures and new region round trips are covered in `tests/omnic.test.mjs`.

## Exact fill snapshots and attachment ownership (2026-11-06)

Composer recipe versions 1/2 retain their existing parser and journal owner. New
internal `region` generator data stores bounded circle/convex-clip snapshots;
Fill operations may store `attachment:true` and normalized `shape` against one
explicit owner. Missing fillMode means Continuous; the preference is saved in the
existing atomnic bag only on acceptance and does not create viewport defaults.
No new storage key, backend schema or selection store is introduced.

Unchanged legacy `clipped:true` fills render using the historical world mask.
Before ordinary Composer edits, the evaluator's per-owner snapshots convert
untouched old paint operations into owner-frame attachments. Multi-target paints
split by their existing provenance, preserving the first operation ID and issuing
collision-safe IDs for additional owners. Old clipped fills historically painted
even when `fill:false`; conversion therefore sets true to preserve visible ink.
Whole-fill false/zero values retain their original meaning. Empty legacy paints
remain unchanged. Explicitly modified paint parameters/targets bypass conversion;
full file import bypasses comparison with the former document.

Conversion creates and validates a candidate before replacing the committed
recipe. Budget/validation failures leave the original intact; history retains the
before recipe and supports Undo. Loading alone never rewrites the original.
Fixtures cover legacy movement, multi-owner conversion, retry idempotence, empty/
false/zero handling, invalid shape data, round trips and budget failure. This is
not a complete backup or stale-tab conflict solution: existing save/recovery
limits remain. Older clients reject the new generator/parameter keys and cannot
edit these new recipes. Rollback needs the retained pre-conversion recipe/export;
do not assume downgraded software reads new snapshots. Hosted production is
unchanged until separately merged/deployed; portable backend validation is checked
alongside frontend changes.


## Composer baseline interaction (2026-11-06)

Baseline MS, active DOF, initial Environment reference and retained/canceled preview
are transient interaction state. No recipe/storage version, saved shortcut ID,
selection store or rule format changes. Existing explicit bindings/clears remain
in the shared action router; Q's Composer behavior now toggles settings rather than
turning selection on/off. Saved Composer geometry is not migrated. Explicit Draw
and Erase remain commands; Draw is no longer the local initial tool. Escape keeps
previous committed recipe edits while canceling pending previews/target membership.
Multi-owner vector Position now translates the authored set with preserved offsets
instead of assigning every owner the same coordinate. Existing scalar equal-value
setters and stored coordinates retain their meanings. Older clients still read the
same recipes, but retain their old interaction behavior. No hosted schema change;
portable validation/backend checks remain required for changed shared modules.


### Input ownership and immediate Color entry (2026-11-06)

Selection session scope and auto-open Color requests are transient. No stored recipe, UI setting, identity, binding ID or color value format changes. Ending a registered session now means inactive rather than implicit global targeting; explicit standalone entry retains global UI selection. Existing ColorInput preview/commit/cancel behavior remains the persistence boundary, and opening the picker alone commits no color. No migration or backend schema change is required; existing browser activation restrictions and saved-value validation remain.

Detachment (2026-11-06): explicit Continuous-fill detachment converts one local
attached `fill` application into an existing `region` component in recipe v1/v2.
It reuses the application ID and `:region:<index>` primitive roles and keeps frame
references. Exact current circles/clips and per-piece paint are snapshotted;
existing operations keep their effective pre-detachment scopes and exclude baked
paint. New evaluation attachment provenance/effective scopes are transient, not
saved fields. The entire candidate validates and reevaluates before the existing
draft/history owner commits once. Unsupported effects, motion or changed primitive
geometry reject without altering the source; Undo retains the original authored
attachment. Save/restore and primitive-reference identity have model coverage.
Older clients already supporting `region` read the result; pre-region clients
retain the previously documented rejection boundary. No new recipe version,
backend schema or silent load migration. Group splitting has ordinary independent
object compositing; it is not a destructive union or a promise of pixel-identical
overlap blending. See Composer's Detach continuous fill walkthrough.

Node-document Markdown (2026-11-06): Markdown styling is a source-preserving
projection of existing version-1 string/glyph content. No stored tags, new fields,
format version or silent document rewrite. Existing Markdown strings now render
semantically; literal HTML still escapes. Editing wrappers restore their original
Markdown markers during serialization, including around canonical glyph references
and linked English. Clipboard, workspace/atlas imports and exports keep the same
owners and shape. Older clients display the retained Markdown as plain syntax.
Current model fixtures cover source-marker and glyph-reference round trips and
untrusted/malformed input; browser editing/native undo acceptance remains pending.

Child detachment (2026-11-06): an explicit graph edit within existing atlas v2 and
workspace formats. `detachPlacement` clears the chosen occurrence's visual parent
and variant visibility owner, freezes its current world XYZ as root coordinates,
and rebases that occurrence in every stored layout view. IDs, descendants,
presentation and node documents stay intact. `detachNodeConnection` additionally
removes only the current parent-entity → child-entity canonical composition edge;
other relation types remain separate. Existing canonical workspace synchronization
therefore shares that relation removal across its uses. The Inspector's existing
None/root choice uses placement-only detachment without a spatial jump. Both
validate the candidate before shared history/persistence; no automatic migration,
new schema/version or backend deployment. Old clients read the ordinary root
placement/remaining composition records. Models cover historical fallback
coordinates, views, identity/round trips and variant visibility ownership.

Document essentials (2026-11-06): semantic lists and native bold/italic operations
still serialize into existing version-1 Markdown string/glyph content. Untouched
list prefixes remain source-preserving; native inserted/moved/indented items derive
their marker from actual list position. Turning formatting off removes the saved
markers even when the browser retains projection attributes on a plain span.
No stored HTML/schema/version change or load migration. The shared node-document
window uses ordinary UI layout/window records (separate from atlas document data)
and inherits existing export/restore and history. Older clients display Markdown
syntax and may ignore this new window's UI record. Models cover native list
counters, type/depth changes and removed-style round trips; browser evidence is
bounded and recorded separately.

Document formatting/list commands are declared in the shared action registry,
including their existing-dictionary shortcut bindings. Default scope/conflict and
explicit-clear handling come from workspaceActions, with no private aliases.
Indent/Outdent default to Ctrl+] / Ctrl+[ so the app's Shift configuration rule
remains intact; Tab retains native focus traversal.


### Uniform atlas cells and cursor creation (2026-11-06)

Settings owner: `workspaceActions.normalizeSettings` and existing interface
state/history/persistence. Additive optional `spatial.nodeCellSize` defaults to 1
world unit when absent; finite explicit values from 0.1 through 5 survive saves.
Existing `sphereDiameter`, per-placement `Visual.size`, labels, XYZ coordinates,
legacy 2D positions, IDs and saved layout-view snapshots retain their meaning.
The render/layout interpretation now uses a uniform organizational cell instead
of deriving a node frame/collision envelope from content. Content rendering stays
independently sized. No load-time movement/repacking or atlas schema conversion
occurs; only explicit arrange/move actions write changed positions. N/Create node
here now honor exact explicit view-plane points, including overlaps, via the
existing validated placement/history owner. No new saved geometry store exists.

Historical settings fixtures verify absence/default, explicit snap/content
values, custom cell-size roundtrip and invalid-cell-size rejection. Geometry and
arrangement regressions compare identical coordinates with different labels and
visual sizes. Old clients ignore the added setting and render with their former
content-derived frames; saving settings in an older client can lose the new cell
preference, but not authored node coordinates or content. Rollback requires no
content conversion. Existing storage/recovery/concurrency limitations still apply;
no cloud atlas synchronization or stronger settings recovery is added here.


### Atomic presentation correction (2026-11-07)

The fixed-square-frame presentation above was rejected. Cells remain logical
organization footprints, but visible nodes are uniform atoms; content is a
separate camera-facing expansion. Existing XYZ, IDs, authored child visibility,
content sizes, assets and document formats are unchanged. Existing showText values
remain stored; expanded presentations and explicit Names views now reveal node
names regardless of that visual-only legacy flag. No load-time reflow occurs.
`spatial.nodeNames` is additive (expanded/all/selection), defaults to expanded for
historical settings and uses shared settings history/normalization/persistence.
Older clients ignore it and can omit this preference on resave. Click-retained
expansion/close overrides are transient per atlas session and never saved into
canonical knowledge, placement coordinates or authored parentage. Rollback needs
no authored-data conversion. Historical fixtures stay frozen and explicitly
verify the new default alongside unchanged existing settings. Dense presentation
layout can overlap when independent content cannot fit; it never shrinks content.

Names discoverability correction (2026-11-07): the registered control now has a
native home in the upper-right atlas controls, directly below Focus context only.
The proposed View-menu home was superseded before preview delivery. Existing
customized layouts remain intact; no placement/settings migration or reset occurs.
Names remains available through Spatial settings and shared UI discovery.

Discrete atlas nudge correction (2026-11-07): existing nodeCellSize (default 1)
now owns arrow step size, independently of drag snap and visible sphere diameter.
Held gestures emit only integer cell steps and commit exact requested coordinates
through existing document history/validation. No load-time rescaling, saved-value
conversion or coordinate rewrite occurs; camera-relative step directions remain.

Fixed atomic carrier radius (2026-11-07): visible atom radius is now 0.5
(diameter 1), enforced by the renderer constant. The diameter control and blank
carrier visual-size control are retired. Legacy spatial.sphereDiameter and
blank Visual.size remain stored for compatibility but cannot alter carriers.
Actual content visuals retain authored sizes/editors; logical cell size remains
separate. Defaults now use diameter 1; historical explicit preferences still
roundtrip, but only older clients apply them. No coordinates or IDs are rewritten.


### Atlas lattice compatibility (2026-11-07)

The exact-overlap/camera-relative-nudge/fixed-radius interpretations above are
superseded by [ATLAS_LATTICE.md](ATLAS_LATTICE.md). `latticeScale` and
`showVacantCells` are additive settings defaults, independent of historical
`nodeCellSize`, radius, clearance and visual sizes. Logical addresses are derived
as safe integers from existing coordinates; scale never resizes stored coordinates.
Reads project historical overlaps without writing. An explicit geometry edit
settles the shared lattice and preserves pre-alignment local XYZ in an ordinary
manual view with additive `preservePositions: true`. The existing validation,
autosave, history, atlas/workspace export and ID remapping owners remain in use.
Protected snapshots are not overwritten by view switching/active autosnapshot;
view-budget exhaustion fails the edit before originals are discarded. View
switching itself keeps the old view's coordinates. Frozen fixtures are unchanged;
assertions cover added defaults. Older clients can ignore/drop these settings or
overwrite protected snapshots, so concurrent old-client editing is not guaranteed.
No schema-version bump, new data store, cloud synchronization or backend deployment.


### Binder reconnection and parent rebasing (2026-11-07)

No schema/version changes: reconnectBinder edits the existing canonical relation,
composition, visual-parent or variant-reference fields with stable binder IDs and
existing validation/history/autosave/export owners. No entity is replaced. Variant
reference changes preserve prior node content as ordinary detached occurrences;
existing variant materialization can create additional placements for new owners.
coordinates.rebaseParentage preserves live and saved-view world XYZ by converting
local coordinates when parentage changes, including protected recovery views.
Legacy 2D fallbacks convert too, with existing child-header minimums enforced;
this can clamp their local 2D placement without moving actual 3D coordinates.
Invalid/cyclic/conflicting candidates reject before commit; hover checks never
write or rebase saved views. Label orientation is transient rendering only.
No new store, migration, backend rollout or stronger cross-client sync guarantee.

### Live visual glyph references and binder actions (2026-11-07)

Visual adds optional omnicEntityId, referencing an existing canonical entity with
an Omnic definition, mutually exclusive with assetId/character. Absence retains
all old visual behavior; no load-time rewrite or schema-version bump. Validation
checks all placements, nesting binders, relationships, compositions and variants.
Atlas import remaps references through the existing canonical identity map;
workspace/atlas export retains the canonical pool, with no generated glyph assets
persisted. Source removal rejects while a surviving visual references it. Existing
source dependency/revision resolution owns live saved-recipe updates. Old clients
can render a default marker and may lose the field if they replace a visual; no
cross-version concurrent editing guarantee is added. Preserve a current export.

Binder reverse/delete edit existing relationship participants, containment,
visual parents and variant references, preserving entities and authored content.
Parent conversions use coordinates.rebaseParentage for live and saved XYZ;
legacy 2D header constraints still apply. Variant materialization retains existing
semantics and can add new-owner occurrences. Candidate validation rejects stale,
cyclic or conflicting edits before the existing atomic history/save transaction.
UI menu availability is transient and retains authored menu members/geometry.
No new storage owner, migration pipeline, cloud protocol or backend deployment.

### World navigator and drive previews (2026-11-07)

No saved entity/placement/format/schema fields are added. Navigator position,
camera-aligned frame, held depth and driven preview remain transient. The existing
canonical UUID/name system is unchanged. Parking uses latticeMove and the existing
document commit/history/autosave/recovery path; previews are renderer-only and
cancellation restores their captured anchors without saving. Prepared occupancy
includes hidden descendants. Camera-follow uses existing camera history, separate
from the one placement transaction. Incompatible document/context replacement
cancels a preview before replacing renderer objects; compatible visual refresh
reapplies preview geometry to current hosts. Live scale changes cancel before
rescaling the cursor. New world-scope commands acquire standard declared binding
defaults without colliding with authored Composer/content shortcuts; clears and
rebindings remain authoritative. Plain world click semantics are now drive/park;
right-click retains inspection/expansion, and selection modifiers retain ownership.
Older clients keep their older interaction behavior; no load-time coordinate
rewrite or backend rollout is introduced by the navigator.

Navigator compass/locate follow-up (2026-11-07): compass geometry and Ctrl-click
positioning are transient; locate cancels unparked placement previews and uses
existing camera history. No graph/schema migration. Depth action IDs and saved
key assignments are unchanged; their forward/backward semantics are corrected.
CI retry logs are private ephemeral files, not application data or credentials.

Atlas paint strokes use existing entity/placement/composition formats and document validation/history/autosave; no new saved schema. Copies get new entity/placement identities; existing text and Omnic references retain their original canonical targets. No descendants or relations are copied. Stroke preview is transient and discarded on cancellation/stale document.

Sphere translucency adds an optional property value to the existing version-1 appearance controller settings; no graph/backend schema change. Absence resolves .82, preserving the prior bubble appearance approximately. Explicit 0/1 survive shared validation/serialization. Older clients do not know this property and may discard it when rewriting settings; cross-version retention is not guaranteed. Existing appearance undo/persistence remain authoritative.

UI translucency applicability follow-up: existing controller translucency values are preserved. Missing UI values resolve 0 to preserve historical UI alpha; missing sphere-body values still resolve .82 explicitly. No graph/schema migration. Existing unknown-property rewrite limits on older clients remain.

Full-viewport world composition changes CSS layout only. No saved graph coordinates, camera values, UI arrangement, settings or schemas are rewritten. The visible camera aspect changes with its full viewport host; existing resize/render-budget owners apply.

Carrier wallpaper isolation is transient render composition only: no graph, camera, settings or saved schema changes. The existing sphere material/translucency values remain authoritative; backing geometry is derived from current visible carrier transforms and never participates in picking or exports.

Opaque carrier wallpaper isolation was removed after user rejection. Configured soft edge glow is derived rendering using existing colour/glow/opacity/translucency values, without saved-schema changes. Existing settings and placement data remain unchanged.

Adaptive sphere comparison introduces no authored graph/settings schema. Enable, strength, sample background, count and timing rows are transient component state and never update the live atlas. Window placement alone uses existing UI layout persistence/unknown-ID retention. Optional shader sampling uniforms are per comparison view; absent experimental input preserves the existing sphere shader path. Existing wallpapers share a cover-UV sampling helper without changing stored image references or assets.

Live adaptive controls are additive version-1 appearance-controller values: adaptiveBlend defaults false when absent; adaptiveBlendStrength defaults .65 with explicit 0 preserved. Shared validators/readers and existing appearance Apply/Discard/history/autosave own them. No graph/backend migration. Older clients can drop unknown properties on rewrite. Retiring ui:blendComparison/window:sphere-blend-comparison removes runtime availability only; existing saved UI records are retained by unknown-ID compatibility, not erased. Existing images and graph coordinates are unchanged.

Whole-node blending adds version-1 controller properties adaptiveBlendMode (absent contrast) and adaptiveBlendCoverage (absent 1, explicit 0 retained). Existing enabled sessions intentionally gain interior coverage; set coverage 0 for their earlier bubble profile or disable blending for original rendering. Coverage is bounded by existing authored Opacity/Translucency and scales with strength. Mode/coverage persist through the same shared controller reader/validator, targeting and Apply/Discard/history as enabled/strength. No graph, image, backend or format migration; older clients may discard these unknown fields on rewrite. Preserve a current export before older-client edits.

Sphere translucency radius adds the version-1 controller property translucencyRadius (absent/neutral 1, explicit 0 retained), applicable only to omnium.nodes.body. Radius 1 preserves historical alpha semantics, including fully clear Translucency 1. Explicitly reducing radius changes Translucency to centre transmission with a smooth stronger shell; Opacity remains authoritative over the entire sphere. Existing shared validation/settings Apply/Discard/history owns serialization. No graph/image/backend format migration or destructive data conversion. Older clients may ignore/drop the radius and render the historical profile; preserve a current export before older-client editing.

User-selected sphere defaults supersede previous absent/default values: shared sphereVisualDefaults defines orange #ffb000 (approximate screenshot match), Glow .35, Opacity 1, Translucency .70 and Translucency radius .76. Fresh workspace node style, MS base resolution and actual/preview carrier fallbacks inherit this definition. Saved explicit styles/controller values, including zeros and radius 1, remain authoritative; missing transmission fields intentionally pick up the new defaults. Radius 1 still selects historical all-surface transmission. UI translucency and adaptive blending defaults are unchanged. No graph/schema migration or browser acceptance is inferred.

Scene normalization adds settings functionValues['scene.normalize'] entries through
existing discovered property adapters (enabled, preferred metric ranges and bounded
correction limits). Absence resolves global enabled=true and documented broad
starting ranges; explicit false/zero is retained. No settings/schema version change
or graph/image-reference conversion. Existing original scene blobs remain untouched.
Disposable normalization results/reports use a new local IndexedDB cache, keyed by
source SHA-256 + algorithm version + constraints, bounded to 8 results/32 MiB. Cache
failure falls back to originals; algorithm/key changes recompute from originals.
Private cloud derivatives are transient only. Original deletion purges derived
keys first and retains the source if purge fails. Original downloads/assignments
and existing auth guards remain the authorities. Settings use existing UI exports;
local images/cache/scene assignments are still not included in atlas/UI backups.
Older clients do not apply these controls and may drop unknown settings on rewrite.
No hosted migration, paid generation or new cloud persistence is introduced.

Live normalization slider previews are transient candidate settings, validated by
existing shared property adapters and routed through active context ownership.
Dragging never writes settings/history or the derivative cache; restoring the
stored value cancels and release commits normally. Reduced previews/source samples
are memory-only; full-size derivatives retain the existing SHA/version/constraint
cache and authored formats. Source/account guards still clear previous imagery;
only same-source updates retain the last visible texture until replacement loads.
No migration or change to saved image bytes, constraints or graph fields.

Direct-canvas normalization previews are transient renderer inputs, never saved or
cached as derivatives. Full PNG output, algorithm/cache keys, authored constraints,
image bytes and graph settings retain their formats. Scalar kernel optimization
is checked against frozen historical pixel-byte hashes. The shared wallpaper owner
now accepts URL or canvas sources; source/account clear and resource disposal are
preserved. No data migration/version bump or cloud deployment is required.
