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
export function undoHistory<T>(history: History<T>): History<T> {
  if (!history.past.length) return history;
  return {
    present: history.past.at(-1)!,
    past: history.past.slice(0, -1),
    future: [history.present, ...history.future].slice(0, 50),
  };
}
export function redoHistory<T>(history: History<T>): History<T> {
  if (!history.future.length) return history;
  return {
    present: history.future[0],
    past: [...history.past, history.present].slice(-50),
    future: history.future.slice(1),
  };
}
