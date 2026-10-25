import { normalizeLiveSettings } from "./normalizeLiveSettings";
import { sameValue } from "../valueEquality.ts";
import type { ActionHistory, HistoryCategory } from "./actionHistory";
import { useCallback, useRef, useState, type SetStateAction } from "react";
import { validateUILayout, type UILayout } from "./layout";
import { normalizeSettings, type WorkspaceSettings } from "../workspaceActions";
import {
  applySession,
  currentState,
  editSession,
  sameAppearance,
  startSession,
  travelSession,
  type Appearance,
  type InterfaceState,
  type InterfaceSession,
} from "../appearance/session";

export function useInterfaceState(
  initial: () => InterfaceState,
  onError: (message: string) => void,
  journal?: ActionHistory,
) {
  const [session, setSession] = useState(() => {
    const state = initial();
    return startSession({ ...state, settings: normalizeSettings(state.settings) });
  });
  const ref = useRef(session);
  const dirty = useRef(false);
  const error = useRef(onError);
  error.current = onError;
  const publish = useCallback((next: InterfaceSession) => {
    // The journal owns history in the app; retain only draft/saved lifecycle here.
    if (journal) next = { saved: { ...next.saved, past: [], future: [] }, draft: next.draft && { ...next.draft, past: [], future: [] } };
    if (next.saved !== ref.current.saved) dirty.current = true;
    ref.current = next;
    setSession(next);
  }, []);
  const snapshot = (value: InterfaceSession) => ({ ...currentState(value), savedAppearance: value.saved.present.settings.appearance });
  // Replay patches through the same state owner, without recording another action.
  journal?.register("interface", { read: () => snapshot(ref.current), write: (value) => {
    const checked = { layout: validateUILayout(value.layout), settings: normalizeSettings(value.settings) };
    const savedAppearance = normalizeSettings({ appearance: value.savedAppearance }).appearance;
    publish({ saved: { ...ref.current.saved, present: { ...checked, settings: { ...checked.settings, appearance: savedAppearance } } },
      draft: sameAppearance(checked.settings.appearance, savedAppearance) ? null : { present: checked.settings.appearance, past: [], future: [] } });
  } });
  const record = (before: InterfaceSession, after: InterfaceSession, group?: string) => {
    if (!journal) return;
    const a = snapshot(before), b = snapshot(after), categories: HistoryCategory[] = [];
    if (a.layout !== b.layout && !sameValue(a.layout, b.layout)) categories.push("ui");
    if (!sameAppearance(a.settings.appearance, b.settings.appearance) || !sameAppearance(a.savedAppearance, b.savedAppearance)) categories.push("appearance");
    if (a.settings !== b.settings && !sameValue({ ...a.settings, appearance: null }, { ...b.settings, appearance: null })) categories.push("settings");
    const contexts = new Set([...journal.contextPath, journal.activeContext]);
    for (const key of new Set([...Object.keys(a.layout.windows), ...Object.keys(b.layout.windows)]))
      if (a.layout.windows[key] !== b.layout.windows[key] && !sameValue(a.layout.windows[key], b.layout.windows[key])) contexts.add(`window:${key}`);
    journal.record("interface", a, b, categories, [...contexts], group);
  };
  const commit = useCallback(
    (change: (s: InterfaceState) => InterfaceState, group?: string) => {
      try {
        const current = currentState(ref.current);
        const next = change(current);
        if (next.layout === current.layout && next.settings === current.settings) return;
        // Normalization is an ingress boundary, not a reason to rebuild unrelated
        // appearance/layout branches on every ordinary button press.
        const checked = {
          layout: next.layout === current.layout ? current.layout : validateUILayout(next.layout),
          settings: normalizeLiveSettings(next.settings, current.settings),
        };
        if (checked.layout === current.layout && checked.settings === current.settings) return;
        const active = document.activeElement as HTMLElement | null;
        const event = window.event;
        const typing =
          event?.type === "input" && active?.matches("input,textarea")
            ? (active.getAttribute("aria-label") ?? active.closest("label")?.textContent)
            : undefined;
        const before = ref.current;
        const nextSession = editSession(
            ref.current,
            checked,
            group ??
              (typing
                ? `field:${typing}`
                : event
                  ? `event:${event.type}:${event.timeStamp}`
                  : undefined),
          );
        publish(nextSession);
        record(before, nextSession, group ?? (typing ? `field:${typing}` : event ? `event:${event.type}:${event.timeStamp}` : undefined));
      } catch (e) {
        error.current(`UI was not changed. ${e instanceof Error ? e.message : String(e)}`);
      }
    },
    [publish],
  );
  const update = useCallback(
    (change: (s: UILayout) => UILayout) => commit((s) => ({ ...s, layout: change(s.layout) })),
    [commit],
  );
  const setSettings = useCallback(
    (value: SetStateAction<WorkspaceSettings>) =>
      commit((s) => ({ ...s, settings: typeof value === "function" ? value(s.settings) : value })),
    [commit],
  );
  const undo = useCallback(
    (steps = 1) => journal ? journal.travel("undo", { ...journal.options, mode: "selective", categories: ["ui"], steps }) : publish(travelSession(ref.current, "undo", steps)),
    [publish],
  );
  const redo = useCallback(
    (steps = 1) => journal ? journal.travel("redo", { ...journal.options, mode: "selective", categories: ["ui"], steps }) : publish(travelSession(ref.current, "redo", steps)),
    [publish],
  );
  const applyAppearance = useCallback(
    (appearance?: Appearance) => { const before = ref.current, next = applySession(before, appearance); publish(next); record(before, next); },
    [publish],
  );
  const discardAppearance = useCallback(() => { const before = ref.current, next = { ...before, draft: null }; publish(next); record(before, next); }, [publish]);
  const current = currentState(session),
    history = session.draft ?? session.saved;
  return {
    layout: current.layout,
    settings: current.settings,
    savedSettings: session.saved.present.settings,
    update,
    setSettings,
    commit,
    undo,
    redo,
    applyAppearance,
    discardAppearance,
    pendingAppearance: !sameAppearance(
      current.settings.appearance,
      session.saved.present.settings.appearance,
    ),
    dirty: dirty.current,
    canUndo: journal ? !!journal.candidates("undo", { ...journal.options, mode: "selective", categories: ["ui"] }).length : !!history.past.length,
    canRedo: journal ? !!journal.candidates("redo", { ...journal.options, mode: "selective", categories: ["ui"] }).length : !!history.future.length,
  };
}
