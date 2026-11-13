import { sameValue } from "../valueEquality.ts";
import { createTargetIndex, included, type Controller } from "./model.ts";
import { controllerTargets, type RegisteredTarget } from "./registry.ts";
import { createValueResolver, type Appearance } from "./resolve.ts";

/** Restore only removed paint targets. Target masks, locks and other drafts survive. */
export function restoreTargetDraft(draft: Appearance, applied: Appearance, targets: RegisteredTarget[], ids: readonly string[], input = draft.controller!): Controller {
  const saved = applied.controller;
  if (!saved || !ids.length) return input;
  const restore = <T>(current: Record<string,T>, baseline: Record<string,T>) => {
    let result = current;
    for (const id of ids) {
      if (sameValue(current[id], baseline[id])) continue;
      if (result === current) result = {...current};
      if (baseline[id] === undefined) delete result[id]; else result[id] = baseline[id];
    }
    return result;
  };
  const values = restore(input.values, saved.values), refined = restore(input.refined, saved.refined);
  let next = values === input.values && refined === input.refined ? input : {...input,values,refined};
  const savedRead = createValueResolver(applied, saved, controllerTargets(saved));
  const read = createValueResolver(draft, next, targets), byId = new Map(targets.map(t => [t.id,t]));
  for (const id of ids) {
    const target = byId.get(id); if (!target) continue;
    for (const property of new Set(target.properties?.map(p => target.couplings?.[p] ?? p))) {
      const value = savedRead(target, property);
      if (read(target, property) === value) continue;
      if (next === input) next = {...input};
      if (next.values === input.values) next.values = {...input.values};
      next.values[id] = {...next.values[id], [property]:value};
    }
    if (next.instances[id] && !saved.instances[id] && !Object.keys(next.values[id] ?? {}).length && !next.locks[id] && !next.disconnected[id]) {
      if (next === input) next = {...input};
      if (next.instances === input.instances) next.instances = {...input.instances};
      delete next.instances[id];
    }
  }
  return next;
}
export function removedTargets(before: Controller, after: Controller, targets: RegisteredTarget[]) {
  const a = before.sets.find(s => s.id === before.activeSet) ?? before.sets[0], b = after.sets.find(s => s.id === after.activeSet) ?? after.sets[0];
  const index = createTargetIndex(targets);
  return targets.filter(t => t.properties?.length && included(a, targets, t.id, index) && !included(b, targets, t.id, index)).map(t => t.id);
}
