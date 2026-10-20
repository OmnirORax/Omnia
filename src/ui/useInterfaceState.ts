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
    if (next.saved !== ref.current.saved) dirty.current = true;
    ref.current = next;
    setSession(next);
  }, []);
  const commit = useCallback(
    (change: (s: InterfaceState) => InterfaceState, group?: string) => {
      try {
        const next = change(currentState(ref.current));
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
        publish(
          editSession(
            ref.current,
            checked,
            group ??
              (typing
                ? `field:${typing}`
                : event
                  ? `event:${event.type}:${event.timeStamp}`
                  : undefined),
          ),
        );
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
    (steps = 1) => publish(travelSession(ref.current, "undo", steps)),
    [publish],
  );
  const redo = useCallback(
    (steps = 1) => publish(travelSession(ref.current, "redo", steps)),
    [publish],
  );
  const applyAppearance = useCallback(
    (appearance?: Appearance) => publish(applySession(ref.current, appearance)),
    [publish],
  );
  const discardAppearance = useCallback(() => publish({ ...ref.current, draft: null }), [publish]);
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
    canUndo: !!history.past.length,
    canRedo: !!history.future.length,
  };
}
