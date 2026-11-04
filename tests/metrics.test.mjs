import {QUEST_AUTHOR,QUEST_TARGET,QUEST_SECONDS} from '../src/metrics/quest.function.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createScoreTracker, clicksPerSecond, formatTime, SCORE_LIMITS } from '../src/metrics/model.ts';
import { createWorkspaceBackup, parseWorkspaceBackup } from '../src/omnic/workspaceBackup.ts';
import { settingsPropertyBindings } from '../src/properties/settingsAdapter.ts';
import { normalizeSettings } from '../src/workspaceActions.ts';
import { TIMER_CONSUMER, TIMER_MODE, TIMER_DURATION } from '../src/metrics/timer.function.ts';

const fixture = () => {
  let time = 100;
  const tracker = createScoreTracker(() => time);
  return { tracker, advance: ms => { time += ms; } };
};
const stopwatch = { mode: 'stopwatch', durationSeconds: 10 };
const countdown = { mode: 'countdown', durationSeconds: 5 };

test('score input is gated by lifecycle; pause excludes time and resume retains captured options', () => {
  const { tracker, advance } = fixture();
  assert.equal(tracker.click(), false);
  tracker.start(stopwatch); advance(1000); tracker.click(); tracker.pause();
  const paused = tracker.getSnapshot(); advance(9000); tracker.tick();
  assert.equal(tracker.getSnapshot(), paused); assert.equal(tracker.click(), false);
  tracker.start(countdown); advance(1000); tracker.click(); tracker.finish();
  const state = tracker.getSnapshot();
  assert.equal(state.clicks, 2); assert.equal(state.elapsedMs, 2000);
  assert.equal(state.options.mode, 'stopwatch'); assert.equal(state.results.length, 1);
  assert.equal(clicksPerSecond(state.clicks, state.elapsedMs), 1);
  assert.equal(tracker.click(), false);
});

test('countdown rejects the exact-deadline click even when no display callback has run', () => {
  const { tracker, advance } = fixture();
  tracker.start(countdown); advance(4999); assert.equal(tracker.click(), true);
  advance(1); assert.equal(tracker.click(), false);
  const state = tracker.getSnapshot();
  assert.equal(state.phase, 'finished'); assert.equal(state.elapsedMs, 5000);
  assert.equal(state.reason, 'timeout'); assert.equal(state.clicks, 1);
  tracker.tick(); tracker.finish(); tracker.pause(); tracker.lap();
  assert.equal(tracker.getSnapshot().results.length, 1);
});

test('delayed countdown callbacks clamp time and complete exactly once, including after resume', () => {
  const { tracker, advance } = fixture();
  tracker.start(countdown); advance(2000); tracker.pause();
  advance(60000); tracker.start(stopwatch);
  assert.equal(tracker.remainingMs(), 3000);
  advance(8000); tracker.tick();
  assert.equal(tracker.getSnapshot().elapsedMs, 5000);
  assert.equal(tracker.getSnapshot().results.length, 1);
  assert.equal(tracker.getSnapshot().results[0].mode, 'countdown');
});

test('laps use active-time/click deltas and completed results preserve their splits across reset', () => {
  const { tracker, advance } = fixture();
  tracker.start(stopwatch); advance(1000); tracker.click(); tracker.lap();
  advance(500); tracker.click(); tracker.click(); tracker.pause();
  advance(5000); tracker.lap(); tracker.finish();
  const result = tracker.getSnapshot().results[0];
  assert.deepEqual(result.laps.map(lap => [lap.splitMs, lap.splitClicks]), [[1000, 1], [500, 2]]);
  tracker.reset();
  assert.equal(tracker.getSnapshot().clicks, 0);
  assert.equal(tracker.getSnapshot().phase, 'idle');
  assert.equal(tracker.getSnapshot().results[0], result);
  tracker.start(countdown); tracker.reset();
  assert.equal(tracker.getSnapshot().results.length, 1, 'reset does not save an unfinished run');
});

test('result and split retention stay bounded and start does not restart a running timer', () => {
  const { tracker, advance } = fixture();
  tracker.start(stopwatch); advance(1000); tracker.start(countdown);
  for (let i = 0; i < SCORE_LIMITS.laps + 5; i++) tracker.lap();
  assert.equal(tracker.getSnapshot().laps.length, SCORE_LIMITS.laps);
  tracker.finish(); assert.equal(tracker.getSnapshot().elapsedMs, 1000);
  for (let i = 0; i < SCORE_LIMITS.results + 5; i++) { tracker.start(stopwatch); advance(100); tracker.finish(); }
  assert.equal(tracker.getSnapshot().results.length, SCORE_LIMITS.results);
  assert.ok(tracker.getSnapshot().results[0].number > tracker.getSnapshot().results.at(-1).number);
});

test('clock formatting handles hours and zero-duration rates, and invalid options leave the run intact', () => {
  assert.equal(formatTime(3_661_239), '01:01:01.23'); assert.equal(formatTime(-1), '00:00:00.00');
  assert.equal(clicksPerSecond(1, 0), 0);
  const { tracker } = fixture(), before = tracker.getSnapshot();
  for (const durationSeconds of [0, NaN, Infinity, 86401]) assert.throws(() => tracker.start({ mode: 'countdown', durationSeconds }));
  assert.equal(tracker.getSnapshot(), before);
});

test('historical backups inherit timer defaults and new preferences round-trip through the existing backup owner', () => {
  const historical = parseWorkspaceBackup(readFileSync(new URL('fixtures/workspace-backup-v1.json', import.meta.url), 'utf8'));
  let settings = historical.ui.settings;
  const originalWorkspace = JSON.stringify(historical.workspace);
  const originalBindings = structuredClone(settings.bindings);
  let bindings = settingsPropertyBindings(settings, change => { settings = change(settings); });
  assert.equal(bindings.values[TIMER_CONSUMER][TIMER_MODE], 'stopwatch');
  assert.equal(bindings.values[TIMER_CONSUMER][TIMER_DURATION], 10);
  bindings.commit([{ consumer: TIMER_CONSUMER, property: TIMER_MODE, value: 'countdown' }, { consumer: TIMER_CONSUMER, property: TIMER_DURATION, value: 30 }]);
  const exported = createWorkspaceBackup(historical.workspace, { ...historical.ui, settings });
  const restored = parseWorkspaceBackup(JSON.stringify(exported));
  bindings = settingsPropertyBindings(restored.ui.settings, () => {});
  assert.equal(bindings.values[TIMER_CONSUMER][TIMER_MODE], 'countdown');
  assert.equal(bindings.values[TIMER_CONSUMER][TIMER_DURATION], 30);
  assert.deepEqual(restored.ui.settings.bindings, originalBindings);
  assert.equal(JSON.stringify(restored.workspace), originalWorkspace);
  assert.deepEqual(normalizeSettings(restored.ui.settings).functionValues[TIMER_CONSUMER], settings.functionValues[TIMER_CONSUMER]);
});

test('online runs retain their attempt identity, reject interrupted eligibility and clear on account changes',()=>{
 const {tracker,advance}=fixture();
 tracker.start({...countdown,attemptId:'a',benchmarkId:'primary-5s-v1',actorId:'account-a'});
 tracker.click();tracker.pause();tracker.start(stopwatch);advance(5000);tracker.tick();
 assert.equal(tracker.getSnapshot().results[0].interrupted,true);
 assert.equal(tracker.getSnapshot().results[0].attemptId,'a');
 tracker.clearOnline();assert.equal(tracker.getSnapshot().results.length,0);assert.equal(tracker.getSnapshot().options.actorId,undefined);
 tracker.start(stopwatch);advance(10);tracker.finish();
 const practice=tracker.getSnapshot().results[0];
 tracker.start({...countdown,attemptId:'b',actorId:'account-b'});tracker.clearOnline();
 assert.equal(tracker.getSnapshot().phase,'idle');assert.equal(tracker.getSnapshot().results[0],practice);
});


test('old saved settings acquire author defaults and authored preferences use shared backup validation',()=>{
 const historical=parseWorkspaceBackup(readFileSync(new URL('fixtures/workspace-backup-v1.json',import.meta.url),'utf8'));
 let settings=historical.ui.settings;
 const bindings=settingsPropertyBindings(settings,change=>{settings=change(settings);});
 assert.equal(bindings.values[QUEST_AUTHOR][QUEST_TARGET],20);
 assert.equal(bindings.values[QUEST_AUTHOR][QUEST_SECONDS],5);
 bindings.commit([{consumer:QUEST_AUTHOR,property:QUEST_TARGET,value:10},{consumer:QUEST_AUTHOR,property:QUEST_SECONDS,value:7}]);
 const restored=parseWorkspaceBackup(JSON.stringify(createWorkspaceBackup(historical.workspace,{...historical.ui,settings})));
 const next=settingsPropertyBindings(restored.ui.settings,()=>{});
 assert.equal(next.values[QUEST_AUTHOR][QUEST_TARGET],10);
 assert.equal(next.values[QUEST_AUTHOR][QUEST_SECONDS],7);
 assert.deepEqual(restored.workspace,historical.workspace);
 assert.equal(restored.ui.settings.bindings['selector.open'],'');
});
