import { normalizeSettings, type WorkspaceSettings } from "../workspaceActions.ts";
/** Validate new data, retaining branches already validated by this state owner.
 * Full import/startup normalization stays unchanged. Stable topology is essential:
 * a color drag must not recreate instances/locks and wake every target binding. */
export function normalizeLiveSettings(input: WorkspaceSettings, previous: WorkspaceSettings): WorkspaceSettings {
  if (input === previous) return previous;
  const next = normalizeSettings(input);
  const retain = <T extends object>(source: T, before: T, checked: T) => {
    for (const key of Object.keys(before) as (keyof T)[]) if (source[key] === before[key]) checked[key] = before[key];
    return (Object.keys(checked) as (keyof T)[]).every(key => checked[key] === before[key]) ? before : checked;
  };
  if (input.appearance !== previous.appearance) {
    const source = input.appearance.controller, before = previous.appearance.controller, checked = next.appearance.controller;
    if (source && before && checked) next.appearance.controller = retain(source, before, checked);
    next.appearance = retain(input.appearance, previous.appearance, next.appearance);
  }
  return retain(input, previous, next);
}
