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
