import test from 'node:test';
import assert from 'node:assert/strict';
import {createScoreTracker,clicksPerSecond,formatTime,SCORE_LIMITS} from '../src/metrics/model.ts';
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


