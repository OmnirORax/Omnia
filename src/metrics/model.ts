export type TimerOptions = { mode: 'stopwatch' | 'countdown'; durationSeconds: number };
export type Split = { number: number; elapsedMs: number; splitMs: number; clicks: number; splitClicks: number };
export type Result = TimerOptions & { number: number; elapsedMs: number; clicks: number; laps: readonly Split[]; reason: 'finished' | 'timeout' };
export type ScoreState = {
  phase: 'idle' | 'running' | 'paused' | 'finished';
  options: TimerOptions; elapsedMs: number; clicks: number; laps: readonly Split[];
  results: readonly Result[]; reason?: Result['reason'];
};
export const SCORE_LIMITS = { laps: 100, results: 20 } as const;
export const clicksPerSecond = (clicks: number, elapsedMs: number) => elapsedMs > 0 ? clicks * 1000 / elapsedMs : 0;
export function formatTime(ms: number): string {
  const centiseconds = Math.floor(Math.max(0, ms) / 10);
  return `${String(Math.floor(centiseconds / 360000)).padStart(2, '0')}:${String(Math.floor(centiseconds / 6000) % 60).padStart(2, '0')}:${String(Math.floor(centiseconds / 100) % 60).padStart(2, '0')}.${String(centiseconds % 100).padStart(2, '0')}`;
}
/** One session owner. Clock samples determine elapsed time; display ticks never
 * advance the clock. No document listeners, persistent writes or click log. */
export function createScoreTracker(now: () => number = () => performance.now()) {
  let state: ScoreState = { phase: 'idle', options: { mode: 'stopwatch', durationSeconds: 10 }, elapsedMs: 0, clicks: 0, laps: [], results: [] };
  let accumulated = 0, startedAt = 0, sequence = 0;
  const listeners = new Set<() => void>();
  const publish = (next: ScoreState) => { state = next; for (const listener of listeners) listener(); };
  const elapsed = () => accumulated + (state.phase === 'running' ? Math.max(0, now() - startedAt) : 0);
  const complete = (elapsedMs: number, reason: Result['reason']) => {
    const result: Result = { ...state.options, number: ++sequence, elapsedMs, clicks: state.clicks, laps: state.laps, reason };
    accumulated = elapsedMs;
    publish({ ...state, phase: 'finished', elapsedMs, reason, results: [result, ...state.results].slice(0, SCORE_LIMITS.results) });
  };
  const sample = () => {
    const value = elapsed();
    if (state.phase === 'running' && state.options.mode === 'countdown' && value >= state.options.durationSeconds * 1000) {
      complete(state.options.durationSeconds * 1000, 'timeout');
      return null;
    }
    return value;
  };
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    remainingMs: () => Math.max(0, state.options.durationSeconds * 1000 - elapsed()),
    tick() {
      if (state.phase !== 'running') return;
      const value = sample();
      if (value !== null && value !== state.elapsedMs) publish({ ...state, elapsedMs: value });
    },
    start(options: TimerOptions) {
      if (state.phase === 'running') return;
      if (state.phase !== 'paused') {
        if (!['stopwatch', 'countdown'].includes(options.mode) || !Number.isFinite(options.durationSeconds) || options.durationSeconds < 1 || options.durationSeconds > 86400) throw Error('Choose a timer duration between 1 second and 24 hours.');
        accumulated = 0;
        state = { ...state, phase: 'idle', options: { ...options }, elapsedMs: 0, clicks: 0, laps: [], reason: undefined };
      }
      startedAt = now();
      publish({ ...state, phase: 'running' });
    },
    pause() {
      if (state.phase !== 'running') return;
      const value = sample(); if (value === null) return;
      accumulated = value; publish({ ...state, phase: 'paused', elapsedMs: value });
    },
    finish() {
      if (state.phase !== 'running' && state.phase !== 'paused') return;
      const value = sample(); if (value !== null) complete(value, 'finished');
    },
    reset() {
      accumulated = 0;
      publish({ ...state, phase: 'idle', elapsedMs: 0, clicks: 0, laps: [], reason: undefined });
    },
    click() {
      if (state.phase !== 'running') return false;
      const value = sample(); if (value === null) return false;
      publish({ ...state, elapsedMs: value, clicks: state.clicks + 1 }); return true;
    },
    lap() {
      if (state.phase !== 'running' && state.phase !== 'paused') return;
      const value = sample(); if (value === null || state.laps.length >= SCORE_LIMITS.laps) return;
      const previous = state.laps.at(-1);
      const lap = { number: state.laps.length + 1, elapsedMs: value, splitMs: value - (previous?.elapsedMs ?? 0), clicks: state.clicks, splitClicks: state.clicks - (previous?.clicks ?? 0) };
      publish({ ...state, elapsedMs: value, laps: [...state.laps, lap] });
    },
  };
}
