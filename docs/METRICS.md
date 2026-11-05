# Current offline Questboard behavior

Questboard now runs without a connection/account, including GitHack: create local
quests, attempt them with the existing timer, hand in for once-only local stars,
and use the same category/status/search filters. The local owner is
`metrics/localQuests.ts`, stored under `omnium.local-quests.v1`. It validates its
version, references, bounds and size before activation/writes; unreadable/newer
originals block edits and are never defaulted into an overwrite. Saves compare
the original before writing; Refresh reloads another tab’s newer state. This is
best-effort stale-write detection, not a cross-tab transaction lock.

Local quests, best results and stars survive reload in this browser/origin, with
up to 500 quests. They are not account-specific, synced or included in workspace
exports. Browser site-data deletion removes them; no full-backup claim is made.
A local run interrupted by pause/close does not qualify; repeat claims are no-ops.
Only Leaderboard requires cloud sign-in and uses authenticated online attempts.
Offline quest results are never automatically submitted as verified online scores.
Existing cloud quest records/claims remain unchanged on the server; this update
changes the default board source and does not migrate or delete that old ledger.
Cloud accounts switching cannot erase a local run or its local result history.

The historical cloud setup and implementation references below describe the
retained online infrastructure; they are no longer prerequisites for Questboard.

# Metrics

Open **♾️ → 📊 Score tracker** next to View, or use UI library → ♾️.
The ♾️ system contains the tracker, Questboard and Leaderboard.
All timer commands start unassigned and use the shared shortcut/action registry.

The dedicated area counts genuine primary clicks and native keyboard activations
only during a running timer. Other app/control clicks do not count. Double-click
counts twice; synthetic events are ignored. Stopwatch and countdown (1 second to
24 hours) support pause/resume, finish, reset and lap splits. Readouts show active
time, total clicks and average CPS. Pauses do not contribute to elapsed time.
Countdown uses an absolute monotonic deadline checked on every operation, so
background callback throttling cannot admit late clicks or lengthen the result.
The centisecond display is presentation precision, not a latency measurement.
OS/device sleep follows the browser's monotonic-clock behavior.

Finish/expiry adds one completed result. Reset intentionally discards the current
run; completed results remain. Closing pauses and preserves the run in memory;
minimizing leaves it running. Reopen with the normal launcher. Retain at most
100 lap splits per run and 20 recent completed results. Reload clears measurements.
Runs and measurements are not edits and do not participate in undo.

## Owners and extension path

`src/metrics/model.ts` owns the transient score/timing lifecycle. New metrics
should declare their measurement boundary and reuse this timer owner where its
lifecycle applies. Do not install an app-wide click listener for this tracker.
`ScoreTracker.tsx` mounts the shared commands and one normal FloatingWindow;
only its visible readout refreshes at 20 Hz, with no storage/history writes or
parent workbench updates. Hidden/closed/collapsed readouts stop interval redraws;
the countdown deadline and action checks remain authoritative. Laps/results use
stable snapshots and bounded tables, separate from timer redraws.

`timer.function.ts` declares mode and duration once. Existing function discovery,
PropertyEditor/RangeControl, settings adapters and Shift configuration supply the
editors and bindings. The start command reads invocation-scoped inputs immediately.
Each new run captures its options; changing preferences does not alter a paused
or running session. Resume always retains the captured options.

## Saved-data impact

Mode/duration are additive preferences under existing
`WorkspaceSettings.functionValues['metrics.timer']`, using the current template
and backup formats. Absence means Stopwatch / 10 seconds; existing explicit
settings and other function inputs retain their identity and meaning. The shared
normalizer, settings history and UI/combined-workspace export/import remain the
read/write owners. The ordinary `metrics-score` window stores arrangement using
existing layout metadata. No atlas, recipe or backend schema changes are needed.
Live scores, unfinished runs, laps and results are intentionally not persisted or
exported; no full-session recovery or cloud synchronization is claimed. Older
clients do not implement the tracker; general stale-tab protection remains a known
project gap from DATA_EVOLUTION.md. No destructive migration is introduced.

## Acceptance

See [the maintained walkthrough](CAPABILITIES.md#metrics-score). Deterministic
model checks exercise countdown boundaries, throttled updates, pause/resume,
captured settings, exactly-once completion, reset and bounded retention. Browser
interaction and visual acceptance remain with the user; builds do not establish it.

## ♾️ quests and online rankings

The top-level **♾️** menu sits immediately after View. It contains Score tracker,
Questboard and Leaderboard. The library also shows ♾️; the former Metrics library
resident ID is retained for saved layout compatibility, while its default display
label changes. Shared property IDs and the `metrics-score` window remain stable.
Existing customized labels/arrangements retain the shared layout behavior.

Quests are server-defined: 20 clicks/5 seconds, 50/10 seconds, 150/30 seconds.
Attempt runs the existing tracker countdown with a server-issued attempt identity.
Only genuine primary clicks count online; free practice still supports keyboard
activation. Let the timer finish uninterrupted. Pausing/closing, resetting or
finishing early prevents ranking; use Reset before starting another attempt.
A completed result submits automatically; a lost response can be retried from the
board with the same attempt/count. Quest hand-in awards **+1 star once per quest
per account**. Stars are derived from immutable claims, never a client balance.
A qualifying earlier submitted attempt can complete its matching quest.

The leaderboard has separate 5/10/30/60-second primary-click benchmarks, each with
its own versioned identity. It ranks each account's best result, uses shared ranks
for equal scores, shows the first 50 accounts and your own rank, and uses anonymous
Player labels rather than emails. Boards refresh every ten seconds while open
and expanded, with no hidden-tab polling requests; Refresh is also available.
Cloud submissions happen only on completion, never on each click/timer tick.
Account switches invalidate pending UI work and clear online scores/attempt state.
The existing Auth session is the only identity owner; no separate account system.

### Deployment and verification

Apply **supabase/migrations/20261104000100_click_quests.sql** to the existing
Supabase project through its normal reviewed migration path. This adds tables,
RLS and authenticated RPCs; it does not require an Edge Function code update or
change existing workspace schemas, grants, assets or Auth/signup configuration.
Hosted application of this migration is not performed/verified by the source PR.
Frontend builds need the existing public Supabase URL/key; visual GitHack builds
without those values remain local-only. Do not sign into private accounts on the
public GitHack origin. Use the configured protected frontend for account testing.

Public signup remains disabled. Create two confirmed test users in Supabase Auth
administration and set their passwords there. Sign in A, attempt a quest and hand
it in; verify one star and a ranked result. Sign in B in another browser profile,
complete the same benchmark, then refresh both boards: both scores should appear
in the same order, while claims/stars remain separate. A duplicate hand-in must
not award a second star. A 5-second score must not appear on the 10-second board.

`node scripts/test-metrics-db.mjs` runs the migration and real SQL checks against
a disposable network-isolated PostgreSQL 17 container with synthetic Auth IDs.
It checks grants/RLS, two-account ownership, early/late submission, idempotent
completion, changed replay rejection, benchmark separation and unique rewards.
It is not hosted Supabase/Auth/browser verification. Never run its synthetic Auth
bootstrap against a real project. The ordinary model suite covers interruption
and account-reset handling; user browser acceptance is still pending.

Server attempt limits are 10/minute and 100/day/account; submissions must arrive
after the configured duration and within a further 30 seconds, with at most 100
reported clicks/second. These bounds and authenticated ownership do not prove
physical input: scores are client-reported and this prototype is not tamper-proof
competitive anti-cheat. New quest now publishes immutable shared goals with 1–3600-second benchmarks.
Editing/deletion are deferred so existing claims keep their meaning.

### Persistence boundary

Attempts and one-time claims persist in Supabase, independently of workspace
membership and UI undo. Rankings are shared among authenticated app accounts;
private attempts and claims are readable only by their owning account. No
workspace content is published. No browser-local persistent progress mirror is
created, so unavailable cloud storage never silently becomes a second authority.
An additive migration preserves existing data and older clients can keep using
the former features. Roll back frontend code without dropping authored attempts
or claims; do not amend or reverse the applied migration to revert the UI.
Workspace/UI exports do not contain this account-level cloud ledger; server
backups must include these tables. No full-environment restore is claimed.


## Adding quests and connecting the preview

Use **♾️ → Questboard → New quest**, choose Click target / Time limit and Publish.
An unconfigured GitHack preview shows the form but publishing requires the existing
configured cloud app and its Auth session. **Open cloud app** links to omnium.nexus;
the signed-out configured view exposes the existing Workspace settings launcher.
No private runtime/backend credentials are added to public preview artifacts.
See [the SQL Editor walkthrough](setup/README.md) for the recommended token-free
installation using the existing project and [the exact SQL bundle](setup/questboard-setup.sql).

The second additive migration adds guarded authoring and a single board-read RPC.
Equal target/duration goals share one identity, including the original three seed
quests. Retrying creation preserves its request identity; changed reuse rejects.
New integer durations have canonical `primary-{seconds}s-v1` benchmark identities.
Targets are bounded to 100 reported clicks/second, with 20 authored quests/account
and 500 shared quests. Authors' account IDs live in a private RLS-enabled ledger;
public quest records expose no author IDs. No direct client table writes are added.
Each account can claim a matching quest once, including after prior qualifying
attempts; creating a duplicate does not provide another reward opportunity.

Board requests remain two RPCs per refresh regardless of benchmark count: one
bounded board/profile aggregation and one selected leaderboard. Only 12 quest
cards and their shared controls mount per page, and publishing reveals the page
containing the new goal. No pointer/timer hot-path scans or network calls are added.
Creation preferences live in existing `functionValues['metrics.questAuthor']`
through discovered shared properties, configuration, settings history and UI/backup
exports. Absence uses 20 clicks / 5 seconds; original timer settings and saved
workspace/UI formats keep their meaning. Authored shared quests, authorship and
claims remain cloud data, outside workspace/UI exports and interface undo.
The original migration is unchanged; the second adds constraints, private
authorship and created-at metadata without changing original quest IDs or claims.
SQL installation validates exact migration history and refuses unknown/untracked
state rather than treating it as defaults. The installer is generated, not an
independent format or migration implementation.

## Quest filters

Category, Status and Search reuse the [shared domain filter base](FILTERING.md).
Speed clicking covers durations below 30 seconds; Endurance clicking covers
30 seconds and above, including the existing 30-second seed quest. Categories
are derived labels, not new saved quest kinds or benchmark/reward identities.
Filtering occurs before shared 12-card pagination, with counts and Clear filters.
Selection remains transient, resets on account change and adds no cloud requests
or database migration. Publication reveals the new quest, clearing incompatible
filters when needed. Existing paging action IDs retain their customization.
