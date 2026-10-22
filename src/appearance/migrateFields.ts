import type { Controller, Rule } from "./model";

/** Keep saved subtype policies on their paint bindings after the shared Fields regrouping. */
export function migrateFieldBranches(state: Controller, branches: Record<string, string[]>): Controller {
  const merge = (a: Rule | undefined, b: Rule): Rule => a?.all || b.all ? { all: true } : {
    properties: [...new Set([...(a?.properties ?? []), ...(b.properties ?? [])])],
  };
  for (const [branch, parts] of Object.entries(branches)) {
    for (const field of ["locks", "disconnected"] as const) {
      const rule = state[field][branch];
      if (!rule) continue;
      for (const part of parts) state[field][part] = merge(state[field][part], rule);
      delete state[field][branch];
    }
    for (const set of state.sets) {
      if (set.selection[branch] !== undefined) {
        if (set.only !== branch)
          for (const part of parts) set.selection[part] ??= set.selection[branch];
        delete set.selection[branch];
      }
      if (set.only === branch) {
        const descendants = Object.fromEntries(Object.entries(set.selection).filter(([id]) =>
          parts.some(part => id === part || id.startsWith(part + ".") || state.instances[id]?.base === part)));
        set.selection = { all: false, ...Object.fromEntries(parts.map(part => [part, true])), ...descendants };
        delete set.only;
      }
    }
  }
  return state;
}
