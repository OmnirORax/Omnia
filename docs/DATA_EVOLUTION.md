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


### Scene image VFX (2026-11-07)

`WorkspaceSettings.sceneVfx` is an additive five-field object. Its sole normalizer
in `scene/vfx.ts` whitelists audioLight/audioBounce/waves/distortion/glitching and
defines screenshot defaults for absence. Finite numbers clamp to supported bounds;
explicit false/zero survive. Existing UI/settings persistence, shared history and
UI-template/workspace-backup exports carry the branch. The historical combined
backup fixture stays frozen; its test verifies only this additive default before
comparing every older field. No image Blob, scene assignment, atlas coordinate,
canonical identity or backend format changes. Source JSON scripts are not imported
or evaluated. Capture streams, file URLs/bytes, FFT buffers and playback state are
transient and never serialized. Older clients can omit the new preference when
resaving; rollback loses only this effect preference, with original images and
scene assignments intact. No new cloud audio/media storage or migration exists.

Scene audio-pickup repair (2026-11-07): changes only ephemeral audio-session/view
ownership and input normalization. The sceneVfx object remains exactly five fields
with unchanged defaults/bounds. The readonly input meter, media element, stream,
context state and playback URL never enter settings, graph/history or exports.
No stored image, assignment, audio bytes or existing preference is converted.

Scene colour-range correction and pacing (2026-11-07): Audio Light retains its
stored RGB value but now selects a broad soft source-image hue range, as explicitly
requested, instead of global tinting. No conversion or image rewrite occurs.
Older clients apply the same saved colour globally; rollback needs no data
conversion. The 120 fps target, glow-mask capability and app-owned hidden media
parking host are runtime-only; exactly five sceneVfx fields remain serialized.

Editable scene FPS cap (2026-11-07): the user explicitly extended the earlier
five-field screenshot-only scope with maxFps. SceneVfx now serializes six fields;
old five-field settings acquire 120, values below 60 clamp to 60, and finite values
are rounded/bounded to 60–1000. Existing explicit effect choices remain intact.
The registered settings owner, shared history and export/import paths carry the
additive field. Older clients omit only the cap on resave; source images/assignments
and audio/session exclusion remain unchanged. No atlas or backend format changes.

Scene flash contrast correction (2026-11-07): Audio Light emission now weights
source radiance/highlights and removes the chroma-normalized shadow floor. No
saved values, defaults, ranges, image bytes or scene assignments change. Six-field
serialization, selected hue ranges and Max FPS remain intact. Older clients render
the former shadow-lifting response from the same preferences; no data conversion.

Prepared bright-colour headroom correction (2026-11-07): runtime flash brightness
is bounded to remaining source headroom and halo energy is separate. No six-field
sceneVfx settings, defaults, image bytes, assignments or exported formats change.
Older clients render the former unbounded gain from the same stored preferences.

Audio Light saturation correction (2026-11-07): the user explicitly replaced the
rejected brightness/bloom interpretation with saturation. The stored audioLight
RGB still selects a broad hue family; audio now changes display-space saturation
with fixed hue/HSV value. No exposure or audio bloom is added. All six stored
fields/defaults/bounds remain unchanged, with no image, assignment or atlas rewrite.
Older clients interpret the same preference using the former light-gain response;
rollback needs no data conversion. Obsolete visual tests are replaced to reflect
the requested semantics, without claiming the new visual check was run.


Audio Light emitter/halo correction (2026-11-07): the user clarified that selected
image regions should pulse as coloured light sources, rather than saturation
alone. Existing audioLight RGB selects the source hue/saturation and emitted tint;
new cached GPU masks are transient and never stored. The six sceneVfx fields,
defaults, bounds, serializer, image bytes, assignments and atlas formats stay
unchanged. This deliberately supersedes fixed hue/value saturation semantics.
Older clients render their earlier response from the same preferences; rollback
needs no conversion. No stored preferences are overwritten or discarded.


### Editable scene light tuning (2026-11-07)

The user explicitly extended the earlier screenshot-only scope to serialize the
parameters being tuned. SceneVfx adds 13 numeric preferences: lightCoreStrength,
lightNearStrength, lightFarStrength, lightNearRadius, lightFarRadius, lightGain,
lightMix, lightTintSaturation, lightHueInner, lightHueOuter, lightSourcePower,
lightAudioGain and lightAudioPower. `SCENE_LIGHT_CONTROLS` in scene/vfx.ts owns their
defaults/bounds and supplies the shared numeric property editors and UI. The same
normalizer/serializer, WorkspaceSettings, history, UI templates and workspace
exports carry them. No new store or saved-schema version is introduced for this
additive change. Missing fields acquire the preceding shader constants (radii in
percent, hue bounds in degrees); explicit finite values, including zero, survive
within bounds. Nonfinite/malformed values use those defaults. The historical
six-field fixture is retained and verifies the original choices stay unchanged.

Exactly 19 fields now serialize. Session/media state and GPU masks remain transient;
image bytes, assignments, atlas identities and backend contracts do not change.
Older clients can discard these additive tuning fields when resaving, while
keeping the original six controls. Export current settings before using an older
preview if the tuned preferences need preserving. Rollback needs no image/data
conversion; it restores the older renderer's fixed parameters. No stored source
assets or authored geometry are replaced by parameter defaults.


### User-selected light defaults and All colours (2026-11-07)

The user selected new numeric defaults in a screenshot. `SCENE_LIGHT_CONTROLS`
now supplies core 8, near 8, far 1, near radius 0.2%, far radius 0%, gain 12,
maximum mix 0.12, saturation 2, hue inner 180°/outer 0°, source power 2.78,
audio gain 8 and audio power 8. Missing fields acquire these defaults; explicit
previous values (including zero) are preserved. The frozen 19-field fixture from
the preceding revision verifies the earlier tuning remains unchanged. Hue bounds
keep the existing sorted rendering interpretation; their saved values are intact.

`lightAllColors` is an additive boolean defaulting false: true bypasses selected
hue matching and uses source-image hues for cores and cached RGB halos. The existing
settings/property/history/export boundary carries all 20 fields. Turning off
retains the selective colour and ranges. Six-field clients can drop all 14 newer
preferences; 19-field clients can drop only All colours on resave. Preserve a current
export before using older clients. Older runtime rendering remains its previous
selective model. No asset, assignment, atlas, permission or backend schema changes;
RGB masks remain transient and reuse the existing bounded GPU allocation.


### Capture-free website audio (2026-11-07)

The user rejected all browser sharing indicators and explicitly replaced shared
capture with direct website playback. Tab/screen/system capture implementation is
removed. `scene.audioConnect` now means Play audio for the app-owned file player;
`scene.audioDisconnect` means Stop audio. These retained action IDs preserve saved
shortcut/resident references while retiring their old capture semantics. Play
cannot open a sharing dialog; Stop keeps the chosen local file ready for replay.
All 20 sceneVfx fields/defaults, image bytes, assignments, atlas/settings formats
and history owners remain unchanged. Media URLs/files/analysis were already
transient, so no saved audio conversion is needed. Older clients still offer their
former sharing actions; rollback does not transfer a live session. Captures in
older open preview tabs must be ended there/by closing those tabs. No native
system-audio bridge, remote audio import or new backend service is introduced.


### Source-based Wallpaper Engine pulse (2026-11-08)

The user supplied pulse.vert/pulse.frag/common_blending.h and authorised a port.
SceneVfx adds nine fields: lightModel (pulse/legacy, default pulse), pulseTintLow,
pulseTintHigh and six numeric pulse controls. Normalization retains all 20 prior
fields unchanged; the serializer whitelists 29. Missing new fields choose the
source-based port as explicitly requested; selecting legacy restores prior knob,
colour-range and All colours behavior. No automatic numeric reinterpretation or
asset rewrite occurs. Source low tint 0.65882 uses #a8a8a8 in existing 8-bit colour
controls. Spectrum FFT mapping remains approximate; supplied response/blend math
is retained. Equal/reversed bounds are guarded for defined results. The original
low-tint rest dimming is intentional in this mode, including when disconnected.

Existing settings/history/UI templates/workspace exports carry the new fields;
there is no new persistent store/schema version. Older clients can drop the nine
new preferences when resaving, so preserve a current export. Earlier numeric
preferences remain available for rollback. Audio/media/FFT buffers and legacy GPU
masks are transient. Reference mode allocates no synthetic halo buffers. Images,
assignments, atlas identities and backend formats stay unchanged. Unit/model
checks cover shared setters, defaults, round trips and retained legacy tuning;
new GPU/browser validation remains unrun, with no inferred appearance acceptance.


### Native-detail wallpaper composition (2026-11-08)

Render-only change: the applied image is drawn after graph post-processing at its
own output density (8,294,400 pixels / DPR 2 cap). The graph/bloom targets retain
their original budgets. No saved preferences/defaults, 29-field sceneVfx format,
image bytes, references, assignments, atlas/backend contracts or history behavior
change; no migration is required. Clearing the wallpaper restores the former
output budget. Older clients render the same image/preferences through their prior
lower-resolution path. Offscreen-composite failure falls back to direct rendering
at output density, with potentially increased graph cost. No browser appearance or
performance acceptance is inferred from resolution-model/build checks.


### Pulse palette, new defaults and approximation retirement (2026-11-08)

The user explicitly requested screenshot defaults and removal of Earlier
approximation. Its renderer, model selector, properties and halo cache are removed.
The 16 historical approximation/model values remain normalized/serialized only
for settings round trips and older-client rollback; no current render/editor uses
them. Old lightModel=legacy cannot activate that renderer. This is deliberate
retirement, not reinterpretation or silent loss of prior preferences.

Three additive active fields are introduced: pulseColorMode (tint/selected/all,
absent tint), pulseColors (bounded normalized comma-separated palette, absent blue
and orange) and pulseColorWidth (absent 30 degrees). Total 32 whitelisted fields
include 16 active and 16 archived. Existing settings/history/templates/exports
remain the owners. Empty palette remains empty, matching zero pixels in Selected
mode. Invalid tokens are ignored; duplicates are case-folded; at most eight colours
are retained. Earlier 29-field clients can discard the three new fields on resave.

Numeric defaults change to bands 14–15, bounds 0.01–1, exponent 0.1, amount 2 and
Bounce 1.3. Screenshot swatches are approximated #ffe5e5 / #001438 pending exact
hex values. Existing explicit values survive; absence adopts the requested new
defaults. Assets/image bytes, assignments, atlas/backend schemas and audio-source
ownership do not change. Palette/All modes extend the pulse by selecting source
hue families and using untinted image-channel contributions, not by remapping the
archived legacy colour settings. Browser acceptance remains unverified.


### Independent coloured pulse correction (2026-11-08)

The user clarified that palette and All modes mean independent coloured responses,
not an untinted white pulse. Palette entries now retain their RGB/brightness and
are evaluated separately through the source blend, with matching/overlap weights
combining completed responses. All derives a chromatic tint per source region;
neutral regions remain neutral. Single tint is unchanged. Existing palette/mode
values retain identity; no asset or graph changes.

pulseAllBrightness is additive (0–1). If absent it derives from the saved High tint
maximum channel, rather than the former full-white strength; explicit zero survives.
It uses the same shared property/history/settings/export owner. The serializer now
whitelists 33 fields, including 16 inactive archived approximation fields. Older
clients may drop this brightness preference on resave and still render the earlier
white-pulse semantics. No saved tint/palette is overwritten. GPU appearance remains
unverified; source-response isolation/brightness migration have model coverage.


### Selected-colour retirement and separate Image tint (2026-11-08)

The user rejected Selected colours, requested its removal, and reported Single
tint stopped responding at unchanged settings after the shared palette shader.
Selected mode is normalized to tint; palette/range remain archived in JSON, with
no current editor/action/shader loop. Single uses a direct compiled source path,
All a separate variant. Audio processing/settings and exponent 0.1 are unchanged;
no zero-exponent migration or retuning was made. All ignores Low/High tints and uses
an untinted rest base; absent All brightness now uses a fixed default independent
of tint. Existing explicit brightness remains. This corrects a dependency the
user rejected; it changes rendering semantics, not authored tint identities.

The user separately requested keeping whole-image tinting. imageTintEnabled
(default false) and imageTint (default #c20000) are additive settings in the same
property/history/export owner. Tint is an optional post-pulse wallpaper-only
multiply, compiled out when disabled. Total serialization is 35 whitelisted
fields: 17 active and 18 archived. Older clients may discard the two new fields and
still expose Selected mode; retained palette values allow rollback inspection.
No image bytes, atlas/schema/backend, capture ownership or frame pacing changes.
Frame-model regression confirms live uniforms at 0.1, not actual GPU appearance.


### Omni as the high tint, with a shared low tint (2026-11-08)

The user clarified that Omni belongs to the high tint while Low tint must remain
an adjustable resting endpoint. UI labels now read High tint type → Single colour
or Omni (all colours). The existing pulseColorMode tint/all values, pulseTintLow
and pulseAllBrightness fields keep their identity. Omni now supplies pulseTintLow
to the original source blend instead of fixed white. No new settings or default
changes; 35 whitelisted fields remain. Ordinary High tint remains saved for Single
colour, while pulseAllBrightness controls Omni High strength. Image tint stays a
separate optional filter. Audio input, exponent/curve, smoothing, frame rate and
Single-colour shader calculation are unchanged. Earlier clients may render Omni
with their former fixed-white low semantics; no image/atlas/backend conversion.


### Independent Omni exposure endpoints (2026-11-08)

User requested two brightness sliders rather than chroma strength. The existing
sceneVfx owner adds pulseOmniLowBrightness (0–2, default 0.5) and
pulseOmniHighBrightness (0–4, default 1.5). Omni interpolates scalar linear RGB
exposure with the unchanged audio pulse, including amount overdrive above one.
Single Low/High tint and the audio pipeline retain their meaning. Old
pulseAllBrightness remains archived and serialized, with no active setter or
renderer use; it is not converted heuristically into exposure. Missing new fields
receive their defaults. Explicit zeros survive. Total whitelist: 37 fields,
18 active and 19 archived. Older clients can discard the new fields on resave and
render their former Omni behavior; retain a current export before rollback.
Image bytes, assignments, backend formats and audio-session ownership are unchanged.


### Restore Omni colour strength alongside brightness (2026-11-08)

The user wanted the existing colour slider retained alongside the two new
brightness sliders. Reactivate pulseAllBrightness with its existing saved value,
0–1 bounds and default 56/255, labelled Colour strength. Omni restores the prior
source-hue high tint blend against neutral low, followed by the independent scalar
brightness envelope. Single tint and audio processing remain unchanged. No new
field or migration: 37 whitelisted fields, now 19 active and 18 archived. The
preceding brightness-only preview ignores colour strength but retains it; older
clients can still discard the two brightness fields. Keep an export for rollback.


### Omni High tint uses native picker saturation/value (2026-11-08)

User clarified that Omni is the normal High tint picker with source-local hues,
not separate scalar colour/exposure sliders. Add sceneVfx.pulseOmniTint as a hex
colour: HSV saturation/value are used; hue is ignored. Existing shared colour
property/editor/history/export paths own it. Low tint applies in both modes.
The source mode-9 Low/High blend and audio processing remain unchanged.
If absent, encode old pulseAllBrightness as fully saturated red at the same value,
rounded to 8-bit; default #380000. Explicit new hex, including black, wins. The
conversion is idempotent and retains original fields without eager save writes.
Old pulseAllBrightness and two exposure endpoints remain inspectable/exportable
archives, but their sliders and exposure multiplier are retired. Their prior
rendering cannot be represented exactly by the requested High tint model; this
semantic change is deliberate. Whitelist: 38 fields, 17 active, 21 archived.
Older clients may discard the new field and render old semantics; preserve an
export before rollback. No backend/asset/identity format changes.


### Omni saturation follows the chosen High tint, not source paleness (2026-11-08)

Fix source hue extraction: remove the source-saturation-dependent mix toward
white. Pale chromatic pixels now use their full HSV hue before applying the
saved picker saturation/value, matching a normal High tint of that hue. Neutral
pixels within 0.000001 RGB delta retain neutral response because hue is undefined.
No saved field, default, conversion, ID, audio curve or backend contract changes.
Saved Omni picker positions keep their meaning and now honor saturation without
the unintended white bias. Older previews still render the former bias.
