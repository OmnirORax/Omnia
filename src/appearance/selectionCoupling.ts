import { stableUIHash } from "../ui/identity.ts";
import { blocked, connected, propertyChannels, ruleHas, type Controller, type Instance, type Value } from "./model.ts";
import { GLYPH_PROPERTIES, scopeContains } from "./partScope.ts";
import { controllerTargets, instanceId, TARGETS, validateProperty, type RegisteredTarget } from "./registry.ts";

export type SelectedPart = Instance & { part: NonNullable<Instance["part"]> };
export const selectedPartId = (part: SelectedPart) => `${instanceId(part.base, part.owner)}:part:${stableUIHash(JSON.stringify(part.part))}`;
export function selectedPartTarget(part: SelectedPart): RegisteredTarget {
  const base = TARGETS.find(target => target.id === part.base)!;
  return { ...base, id: selectedPartId(part), parent: `${part.base}.custom`, instance: part,
    properties: part.part.text !== undefined ? base.properties?.filter(p => GLYPH_PROPERTIES.includes(p)) : base.properties };
}
export function selectedPartPolicy(state: Controller) {
  const targets = controllerTargets(state), basePolicy = new Map<string, boolean>();
  const owners = new Map<string, [string, Instance][]>();
  for (const entry of Object.entries(state.instances)) {
    const key = `${entry[1].base}\0${entry[1].owner}`;
    owners.set(key, [...(owners.get(key) ?? []), entry]);
  }
  const protectedAt = (id: string, property: string) => ruleHas(state.locks[id], property) || ruleHas(state.disconnected[id], property) ||
    GLYPH_PROPERTIES.some(family => propertyChannels(family).includes(property) &&
      (ruleHas(state.locks[id], family) || ruleHas(state.disconnected[id], family)));
  return (part: SelectedPart, property: string): boolean => {
    if (!selectedPartTarget(part).properties?.includes(property)) return false;
    const key = `${part.base}\0${property}`;
    let allowed = basePolicy.get(key);
    if (allowed === undefined) {
      allowed = !blocked(state, targets, part.base, property, "all") && connected(state, targets, part.base, property) &&
        !protectedAt(`${part.base}.custom`, property);
      basePolicy.set(key, allowed);
    }
    if (!allowed) return false;
    return ![...new Set([...(part.path ?? []), part.owner])].some(owner =>
      (owners.get(`${part.base}\0${owner}`) ?? []).some(([id, instance]) => scopeContains(instance, part) && protectedAt(id, property)));
  };
}
export const partEditable = (state: Controller, part: SelectedPart, property: string) => selectedPartPolicy(state)(part, property);
/** One transaction in the existing controller; inspection never calls this. */
export function applySelectedValue(state: Controller, parts: SelectedPart[], property: string, input: Value): Controller {
  const value = validateProperty(property, input);
  if (value === undefined) return state;
  const next = structuredClone(state);
  const editable = selectedPartPolicy(state);
  const runs = new Map<string, [string, Instance][]>();
  const hostKey = (instance: Instance) => JSON.stringify([instance.base, instance.owner, instance.part?.steps]);
  for (const entry of Object.entries(state.instances)) if (entry[1].part?.text !== undefined) {
    const key = hostKey(entry[1]); runs.set(key, [...(runs.get(key) ?? []), entry]);
  }
  let changed = false;
  for (const part of parts) {
    const target = selectedPartTarget(part), id = target.id;
    if (!editable(part, property) || (property === "effect" && target.effectKinds && !target.effectKinds.includes(String(value)))) continue;
    // Whole-text hosts supersede older exact-run paint at the same address.
    // Update eligible channels together so an old Highlight cannot mask the edit.
    const equivalentRuns = part.part.text === undefined ? runs.get(hostKey(part)) ?? [] : [];
    for (const channel of new Set(propertyChannels(property).map(channel => target.couplings?.[channel] ?? channel))) {
      if (!editable(part, channel)) continue;
      if (next.values[id]?.[channel] === value) continue;
      next.instances[id] = part;
      next.values[id] = { ...next.values[id], [channel]: value };
      next.refined[id] = [...new Set([...(next.refined[id] ?? []), channel])];
      for (const [oldId, instance] of equivalentRuns) if (state.values[oldId]?.[channel] !== undefined && editable(instance as SelectedPart, channel))
        next.values[oldId] = { ...next.values[oldId], [channel]: value };
      changed = true;
    }
  }
  return changed ? next : state;
}
export function resetSelectedParts(state: Controller, parts: SelectedPart[]): Controller {
  const next = structuredClone(state);
  const editable = selectedPartPolicy(state);
  let changed = false;
  for (const part of parts) {
    const id = selectedPartId(part);
    if (!next.instances[id]) continue;
    // Reset is explicit, but it still cannot remove protected refinements.
    if ((selectedPartTarget(part).properties ?? []).some(p => !editable(part, p))) continue;
    for (const key of ["instances", "values", "refined", "locks", "disconnected"] as const) delete next[key][id];
    changed = true;
  }
  return changed ? next : state;
}
