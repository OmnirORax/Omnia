import { normalizeSettings, type WorkspaceSettings } from "../workspaceActions.ts";
import type { UILayout } from "../ui/layout.ts";
import {
  recordHistory,
  redoHistory,
  startHistory,
  undoHistory,
  type History,
} from "../ui/history.ts";

export type Appearance = WorkspaceSettings["appearance"];
export type InterfaceState = { layout: UILayout; settings: WorkspaceSettings };
export type InterfaceSession = {
  saved: History<InterfaceState>;
  draft: History<Appearance> | null;
};
export const sameAppearance = (a: Appearance, b: Appearance) =>
  JSON.stringify(a) === JSON.stringify(b);
export const startSession = (state: InterfaceState): InterfaceSession => ({
  saved: startHistory(state),
  draft: null,
});
export function currentState(session: InterfaceSession): InterfaceState {
  const saved = session.saved.present;
  return session.draft
    ? { ...saved, settings: { ...saved.settings, appearance: session.draft.present } }
    : saved;
}
/** Appearance edits are recoverable previews. Other UI settings/layout retain their normal history. */
export function editSession(
  session: InterfaceSession,
  next: InterfaceState,
  group?: string,
): InterfaceSession {
  const saved = session.saved.present;
  const appearance = next.settings.appearance;
  const draft = sameAppearance(currentState(session).settings.appearance, appearance)
    ? session.draft
    : recordHistory(session.draft ?? startHistory(saved.settings.appearance), appearance, group);
  return {
    saved: recordHistory(
      session.saved,
      { ...next, settings: { ...next.settings, appearance: saved.settings.appearance } },
      group,
    ),
    draft,
  };
}
export function applySession(
  session: InterfaceSession,
  appearance = currentState(session).settings.appearance,
): InterfaceSession {
  const saved = session.saved.present;
  return {
    saved: recordHistory(session.saved, {
      ...saved,
      settings: { ...saved.settings, appearance: normalizeSettings({ appearance }).appearance },
    }),
    draft: null,
  };
}
export function travelSession(
  session: InterfaceSession,
  direction: "undo" | "redo",
  steps = 1,
): InterfaceSession {
  const travel = direction === "undo" ? undoHistory : redoHistory;
  // Do not walk into saved settings while a pending appearance investigation is open.
  return session.draft
    ? { ...session, draft: travel(session.draft, steps) }
    : { ...session, saved: travel(session.saved, steps) };
}
