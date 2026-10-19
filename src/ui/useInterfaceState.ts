import { useCallback, useRef, useState, type SetStateAction } from "react";
import { validateUILayout, type UILayout } from "./layout";
import { normalizeSettings, type WorkspaceSettings } from "../workspaceActions";
import { startHistory, recordHistory, undoHistory, redoHistory } from "./history";
type State = { layout: UILayout; settings: WorkspaceSettings };
export function useInterfaceState(initial: () => State, onError: (message: string) => void) {
  const [history, setHistory] = useState(() => startHistory(initial()));
  const ref = useRef(history);
  ref.current = history;
  const dirty = useRef(false);
  const error = useRef(onError);
  error.current = onError;
  const commit = useCallback((change: (s: State) => State, group?: string) => {
    try {
      const next = change(ref.current.present);
      const checked = {
        layout: validateUILayout(next.layout),
        settings: normalizeSettings(next.settings),
      };
      const active = document.activeElement as HTMLElement | null;
      const event = window.event;
      const typing =
        event?.type === "input" && active?.matches("input,textarea")
          ? (active.getAttribute("aria-label") ?? active.closest("label")?.textContent)
          : undefined;
      const updated = recordHistory(
        ref.current,
        checked,
        group ??
          (typing
            ? `field:${typing}`
            : event
              ? `event:${event.type}:${event.timeStamp}`
              : undefined),
      );
      if (updated !== ref.current) dirty.current = true;
      ref.current = updated;
      setHistory(updated);
    } catch (e) {
      error.current(`UI was not changed. ${e instanceof Error ? e.message : String(e)}`);
    }
  }, []);
  const update = useCallback(
    (change: (s: UILayout) => UILayout) => commit((s) => ({ ...s, layout: change(s.layout) })),
    [commit],
  );
  const setSettings = useCallback(
    (value: SetStateAction<WorkspaceSettings>) =>
      commit((s) => ({ ...s, settings: typeof value === "function" ? value(s.settings) : value })),
    [commit],
  );
  const undo = useCallback((steps = 1) => {
    const next = undoHistory(ref.current, steps);
    if (next !== ref.current) dirty.current = true;
    ref.current = next;
    setHistory(next);
  }, []);
  const redo = useCallback((steps = 1) => {
    const next = redoHistory(ref.current, steps);
    if (next !== ref.current) dirty.current = true;
    ref.current = next;
    setHistory(next);
  }, []);
  return {
    layout: history.present.layout,
    settings: history.present.settings,
    update,
    setSettings,
    commit,
    undo,
    redo,
    dirty: dirty.current,
    canUndo: !!history.past.length,
    canRedo: !!history.future.length,
  };
}
