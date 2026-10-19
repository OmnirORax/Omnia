/** UI snapshots never contain atlas knowledge. Each completed drag is one entry. */
export type History<T> = { present: T; past: T[]; future: T[]; group?: string; at?: number };
export const startHistory = <T>(present: T): History<T> => ({ present, past: [], future: [] });
export function recordHistory<T>(
  history: History<T>,
  next: T,
  group?: string,
  now = Date.now(),
): History<T> {
  if (JSON.stringify(history.present) === JSON.stringify(next)) return history;
  const coalesce = !!group && group === history.group && now - (history.at ?? 0) < 700;
  return {
    present: next,
    past: coalesce ? history.past : [...history.past, history.present].slice(-50),
    future: [],
    group,
    at: now,
  };
}
export function undoHistory<T>(history: History<T>, steps = 1): History<T> {
  if (!history.past.length) return history;
  const count = Math.min(history.past.length, Math.max(1, Math.floor(steps)));
  const restored = history.past.slice(-count);
  return {
    present: restored[0],
    past: history.past.slice(0, -count),
    future: [...restored.slice(1), history.present, ...history.future].slice(0, 50),
  };
}
export function redoHistory<T>(history: History<T>, steps = 1): History<T> {
  if (!history.future.length) return history;
  const count = Math.min(history.future.length, Math.max(1, Math.floor(steps)));
  return {
    present: history.future[count - 1],
    past: [...history.past, history.present, ...history.future.slice(0, count - 1)].slice(-50),
    future: history.future.slice(count),
  };
}
