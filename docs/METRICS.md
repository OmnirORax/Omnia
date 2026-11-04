# Metrics

Open **UI library → 📊 Metrics → 📊 Score tracker**, or search Score tracker.
Metrics is a single category; there are no Tracking or Performance subcategories.
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
