import {QuestSystem} from './QuestSystem';
import { memo, useEffect, useState, useSyncExternalStore } from 'react';
import { FloatingWindow } from '../ui/FloatingWindow';
import { FunctionControl } from '../ui/UIWorkspace';
import { UIField } from '../ui/UIField';
import { UISection } from '../ui/UISection';
import { useUITracked } from '../ui/context';
import { reopenContainer } from '../ui/layout';
import { useFeatureActions } from '../ui/useFeatureActions';
import { CoupledField, type PropertyBindings } from '../properties/CoupledProperties';
import { functionInputValue } from '../properties/runtimeInputs';
import { createScoreTracker, clicksPerSecond, formatTime, SCORE_LIMITS, type Result, type Split, type TimerOptions } from './model';
import { TIMER_CONSUMER, TIMER_DURATION, TIMER_MODE } from './timer.function';
import './metrics.css';

type Tracker = ReturnType<typeof createScoreTracker>;
const WINDOW_ID = 'metrics-score';

/** Always mounted command/session owner; ticking is confined to the visible
 * readout. Closing pauses a run, and reopening keeps its score and splits. */
export function ScoreTracker({ bindings }: { bindings: PropertyBindings }) {
  const [tracker] = useState(() => createScoreTracker());
  const [open, setOpen] = useState(false);
  const phase = useSyncExternalStore(tracker.subscribe, () => tracker.getSnapshot().phase);
  const lapCount = useSyncExternalStore(tracker.subscribe, () => tracker.getSnapshot().laps.length);
  const ui = useUITracked(ui => [ui.update]);
  const readOptions = (): TimerOptions => ({
    mode: functionInputValue(TIMER_CONSUMER, TIMER_MODE, () => bindings.values[TIMER_CONSUMER][TIMER_MODE]) as TimerOptions['mode'],
    durationSeconds: Number(functionInputValue(TIMER_CONSUMER, TIMER_DURATION, () => bindings.values[TIMER_CONSUMER][TIMER_DURATION])),
  });
  const reveal = () => { ui.update(layout => reopenContainer(layout, `window:${WINDOW_ID}`)); setOpen(true); };
  const commands = useFeatureActions('scoreTracker', {
    'metrics.open': { enabled: true, run: reveal },
    'metrics.start': { enabled: phase !== 'running', run: () => { tracker.start(readOptions()); reveal(); } },
    'metrics.pause': { enabled: phase === 'running', run: () => tracker.pause() },
    'metrics.finish': { enabled: phase === 'running' || phase === 'paused', run: () => tracker.finish() },
    'metrics.lap': { enabled: (phase === 'running' || phase === 'paused') && lapCount < SCORE_LIMITS.laps, run: () => tracker.lap() },
    'metrics.reset': { enabled: phase !== 'idle', run: () => tracker.reset() },
  });
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if (commands.handle(event)) { event.preventDefault(); event.stopImmediatePropagation(); } };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [commands]);
  // Deadline work is independent of redraw frequency and survives minimization.
  // Every score/action also checks expiry, so throttled callbacks cannot admit
  // a late click or save a countdown result with an overrun duration.
  useEffect(() => {
    if (phase !== 'running' || tracker.getSnapshot().options.mode !== 'countdown') return;
    const timeout = window.setTimeout(() => tracker.tick(), Math.ceil(tracker.remainingMs()) + 1);
    return () => window.clearTimeout(timeout);
  }, [tracker, phase]);
  return <><QuestSystem tracker={tracker} onPlay={reveal} bindings={bindings}/>{open ? <FloatingWindow id={WINDOW_ID} title="📊 Score tracker" width={370} height={520} openAtCursor={false}
    onClose={() => { tracker.pause(); setOpen(false); }}>
    <div className="metrics-tracker">
      <TimerSettings bindings={bindings} />
      <ScoreReadout tracker={tracker} preferences={readOptions()} />
      <div className="metrics-actions">
        {['metrics.start', 'metrics.pause', 'metrics.lap', 'metrics.finish', 'metrics.reset'].map(id => <FunctionControl key={id} id={id} />)}
      </div>
      <ClickArea tracker={tracker} running={phase === 'running'} benchmark={!!tracker.getSnapshot().options.attemptId} />
      <ScoreDetails tracker={tracker} />
    </div>
  </FloatingWindow> : null}</>;
}

const TimerSettings = memo(function TimerSettings({ bindings }: { bindings: PropertyBindings }) {
  return <div className="metrics-settings" title="Preferences apply to the next new run. Resume keeps the current mode and duration.">
    <UIField id="metrics:mode" label="Timer mode" category="♾️"><CoupledField bindings={bindings} consumer={TIMER_CONSUMER} property={TIMER_MODE} /></UIField>
    {bindings.values[TIMER_CONSUMER][TIMER_MODE] === 'countdown' &&
      <UIField id="metrics:duration" label="Countdown duration (seconds)" category="♾️"><CoupledField bindings={bindings} consumer={TIMER_CONSUMER} property={TIMER_DURATION} /></UIField>}
  </div>;
});

function ScoreReadout({ tracker, preferences }: { tracker: Tracker; preferences: TimerOptions }) {
  const state = useSyncExternalStore(tracker.subscribe, tracker.getSnapshot);
  const ui = useUITracked(ui => [ui.layout.windows[WINDOW_ID]?.collapsed, ui.layout.windows[WINDOW_ID]?.closed]);
  const collapsed = ui.layout.windows[WINDOW_ID]?.collapsed || ui.layout.windows[WINDOW_ID]?.closed;
  useEffect(() => {
    let interval: number | undefined;
    const refresh = () => {
      window.clearInterval(interval);
      if (state.phase === 'running') {
        tracker.tick();
        if (!document.hidden && !collapsed) interval = window.setInterval(() => tracker.tick(), 50);
      }
    };
    refresh(); document.addEventListener('visibilitychange', refresh);
    return () => { window.clearInterval(interval); document.removeEventListener('visibilitychange', refresh); };
  }, [tracker, state.phase, collapsed]);
  const options = state.phase === 'idle' ? preferences : state.options;
  const countdown = options.mode === 'countdown';
  const display = countdown ? Math.max(0, options.durationSeconds * 1000 - state.elapsedMs) : state.elapsedMs;
  return <div className="metrics-readout">
    <div className="metrics-status" role="status">{state.phase === 'finished' ? state.reason === 'timeout' ? 'Time’s up' : 'Finished' : state.phase === 'idle' ? 'Ready' : state.phase === 'paused' ? 'Paused' : 'Running'} · {countdown ? 'Countdown' : 'Stopwatch'}</div>
    <output className="metrics-clock" aria-label={countdown ? 'Time remaining' : 'Elapsed time'}>{formatTime(display)}</output>
    {countdown && <progress aria-label="Countdown progress" max={options.durationSeconds * 1000} value={state.elapsedMs} />}
    <dl className="metrics-stats">
      <div><dt>Clicks</dt><dd>{state.clicks}</dd></div>
      <div><dt>Clicks / sec</dt><dd>{clicksPerSecond(state.clicks, state.elapsedMs).toFixed(2)}</dd></div>
      <div><dt>Active time</dt><dd>{formatTime(state.elapsedMs)}</dd></div>
    </dl>
  </div>;
}

const ClickArea = memo(function ClickArea({ tracker, running, benchmark }: { tracker: Tracker; running: boolean; benchmark: boolean }) {
  return <button type="button" className="metrics-click-area" data-ui-id="metrics:test-area" data-ui-gesture-owner="content"
    disabled={!running} aria-label="Click test area" title="Only genuine primary clicks or keyboard activations here count while running. Controls and other app surfaces do not count."
    onKeyDown={event => { if (event.repeat) event.preventDefault(); }}
    onClick={event => { if (event.isTrusted && !event.defaultPrevented && event.button === 0 && (!benchmark || event.detail > 0)) tracker.click(); }}>
    <span aria-hidden="true">🖱️</span><span>{running ? 'Click here' : 'Start or resume to click'}</span>
  </button>;
});

function ScoreDetails({ tracker }: { tracker: Tracker }) {
  // Display ticks never rebuild result/split tables or publish UI registrations.
  const laps = useSyncExternalStore(tracker.subscribe, () => tracker.getSnapshot().laps);
  const results = useSyncExternalStore(tracker.subscribe, () => tracker.getSnapshot().results);
  return <><LapTable laps={laps} /><Results results={results} /></>;
}
const LapTable = memo(function LapTable({ laps }: { laps: readonly Split[] }) {
  return <UISection id="metrics-laps" title={`Laps (${laps.length}/${SCORE_LIMITS.laps})`} defaultExpanded={false}>
    {laps.length ? <div className="metrics-table"><table><caption className="sr-only">Lap splits</caption><thead><tr><th>Lap</th><th>Split</th><th>Clicks</th><th>CPS</th></tr></thead>
      <tbody>{[...laps].reverse().map(lap => <tr key={lap.number}><td>{lap.number}</td><td title={`Total ${formatTime(lap.elapsedMs)}`}>{formatTime(lap.splitMs)}</td><td title={`Total ${lap.clicks}`}>{lap.splitClicks}</td><td>{clicksPerSecond(lap.splitClicks, lap.splitMs).toFixed(2)}</td></tr>)}</tbody></table></div> : <small>No laps yet.</small>}
  </UISection>;
});
const Results = memo(function Results({ results }: { results: readonly Result[] }) {
  return <UISection id="metrics-results" title={`Results (${results.length}/${SCORE_LIMITS.results})`} defaultExpanded={false}>
    {results.length ? <div className="metrics-table"><table><caption className="sr-only">Recent completed runs, newest first</caption><thead><tr><th>Run</th><th>Mode</th><th>Time</th><th>Clicks</th><th>CPS</th></tr></thead>
      <tbody>{results.map(result => <tr key={result.number}><td>{result.number}</td><td title={result.reason === 'timeout' ? 'Countdown completed' : 'Finished manually'}>{result.mode === 'countdown' ? `⏳ ${result.durationSeconds}s` : '⏱️'}</td><td>{formatTime(result.elapsedMs)}</td><td>{result.clicks}</td><td>{clicksPerSecond(result.clicks, result.elapsedMs).toFixed(2)}</td></tr>)}</tbody></table></div> : <small>No completed runs.</small>}
    <small title="Reloading or closing the tab clears scores, laps and results. Timer preferences remain in UI settings.">This tab only · newest {SCORE_LIMITS.results} runs</small>
  </UISection>;
});
