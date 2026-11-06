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
