import { normalizePartScope, type PartScope } from "./partScope.ts";
/** Stable appearance references belong to presentation settings, never graph identity. */
export type Value = string | number | boolean;
export type Values = Record<string, Value>;
/** General adjusters include their effect channel; effect-only adjusters stay independent. */
const companions: Record<string, string> = {
  color: "effectColor",
  brightness: "effectBrightness",
  opacity: "effectOpacity",
  glow: "effectGlow",
};
export const propertyChannels = (property: string) => [
  property,
  ...(companions[property] ? [companions[property]] : []),
];
export type Rule = { all?: boolean; properties?: string[] };
export type Instance = { base: string; owner: string; label: string; path?: string[]; part?: PartScope };
export type Target = {
  id: string;
  parent?: string;
  label: string;
  couplings?: Record<string, string>;
  properties?: string[];
  effectKinds?: readonly string[];
  instance?: Instance;
};
export type AppearanceSet = {
  id: string;
  name: string;
  selection: Record<string, boolean>;
  adjustments?: Values;
  only?: string;
};
export type Controller = {
  version: 1;
  values: Record<string, Values>;
  locks: Record<string, Rule>;
  disconnected: Record<string, Rule>;
  refined: Record<string, string[]>;
  instances: Record<string, Instance>;
  sets: AppearanceSet[];
  activeSet: string;
};
export const emptyController = (): Controller => ({
  version: 1,
  values: {},
  locks: {},
  disconnected: {},
  refined: {},
  instances: {},
  sets: [{ id: "default", name: "Default", selection: {} }],
  activeSet: "default",
});
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const idOK = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 600;
export function normalizeController(
  input: unknown,
  validate: (key: string, value: unknown) => Value | undefined,
): Controller {
  const result = emptyController();
  if (!object(input)) return result;
  for (const key of ["values", "locks", "disconnected", "refined", "instances"] as const) {
    if (!object(input[key])) continue;
    for (const [id, value] of Object.entries(input[key]).slice(0, 3000)) {
      if (!idOK(id)) continue;
      if (key === "values" && object(value)) {
        const values: Values = {};
        for (const [property, raw] of Object.entries(value)) {
          const checked = validate(property, raw);
          if (checked !== undefined) values[property] = checked;
        }
        result.values[id] = values;
      }
      if ((key === "locks" || key === "disconnected") && object(value))
        result[key][id] = {
          all: value.all === true,
          properties: Array.isArray(value.properties)
            ? value.properties.filter(idOK).slice(0, 100)
            : [],
        };
      if (key === "refined" && Array.isArray(value))
        result.refined[id] = value.filter(idOK).slice(0, 100);
      if (
        key === "instances" &&
        object(value) &&
        idOK(value.base) &&
        idOK(value.owner) &&
        typeof value.label === "string"
      ) {
        const part = value.part === undefined ? undefined : normalizePartScope(value.part);
        // A malformed narrow address must never become an owner-wide edit.
        if (value.part !== undefined && !part) continue;
        result.instances[id] = {
          base: value.base,
          owner: value.owner,
          label: value.label.slice(0, 240),
          path: Array.isArray(value.path) ? value.path.filter(idOK).slice(0, 50) : undefined,
          ...(part ? { part } : {}),
        };
      }
    }
  }
  if (Array.isArray(input.sets)) {
    const seen = new Set<string>();
    const sets = input.sets.slice(0, 30).flatMap((raw) => {
      if (!object(raw) || !idOK(raw.id) || seen.has(raw.id) || typeof raw.name !== "string")
        return [];
      seen.add(raw.id);
      const selection: Record<string, boolean> = {};
      if (object(raw.selection))
        for (const [id, value] of Object.entries(raw.selection).slice(0, 3000))
          if (idOK(id) && typeof value === "boolean") selection[id] = value;
      const adjustments: Values = {};
      if (object(raw.adjustments))
        for (const [key, value] of Object.entries(raw.adjustments)) {
          const checked = validate(key, value);
          if (checked !== undefined) adjustments[key] = checked;
        }
      return [
        {
          id: raw.id,
          name: raw.name.slice(0, 100),
          selection,
          adjustments,
          only: idOK(raw.only) ? raw.only : undefined,
        },
      ];
    });
    if (sets.length) result.sets = sets;
  }
  if (typeof input.activeSet === "string" && result.sets.some((set) => set.id === input.activeSet))
    result.activeSet = input.activeSet;
  return result;
}
export function ancestry(targets: Target[], id: string): string[] {
  const byId = new Map(targets.map((t) => [t.id, t])),
    path: string[] = [],
    seen = new Set<string>();
  let key: string | undefined = id;
  while (key && !seen.has(key)) {
    seen.add(key);
    path.unshift(key);
    key = byId.get(key)?.parent;
  }
  return path;
}
export const inside = (targets: Target[], child: string, parent: string) =>
  ancestry(targets, child).includes(parent);
export const ruleHas = (rule: Rule | undefined, property: string) =>
  !!(rule?.all || rule?.properties?.includes(property));
export function blocked(
  state: Controller,
  targets: Target[],
  id: string,
  property: string,
  origin?: string,
): boolean {
  const path = ancestry(targets, id),
    from = origin ? path.indexOf(origin) : -1;
  // A deliberate edit at a locked row is allowed. Propagation stops at lower locks.
  const family = Object.keys(companions).find((key) => companions[key] === property) ??
    Object.entries(targets.find(target => target.id === id)?.couplings ?? {}).find(([source, channel]) => source !== channel && channel === property)?.[0];
  return path.some(
    (key, index) =>
      index > from &&
      (ruleHas(state.locks[key], property) || (!!family && ruleHas(state.locks[key], family))),
  );
}
export const connected = (state: Controller, targets: Target[], id: string, property: string) => {
  const channel = targets.find(target => target.id === id)?.couplings?.[property] ?? property;
  return !ancestry(targets, id).some(key => ruleHas(state.disconnected[key], property) || ruleHas(state.disconnected[key], channel));
};
export function included(set: AppearanceSet, targets: Target[], id: string): boolean {
  if (set.only && !inside(targets, id, set.only)) return false;
  let on = true;
  const path = ancestry(targets, id);
  const relevant = set.only ? path.slice(path.indexOf(set.only) + 1) : path;
  for (const key of relevant) if (Object.hasOwn(set.selection, key)) on = set.selection[key];
  return on;
}
/** Legacy isolate-cycle compatibility. Current editors use toggleTarget. */
export function cycleTarget(state: Controller, targets: Target[], id: string): Controller {
  const next = structuredClone(state),
    set = next.sets.find((s) => s.id === next.activeSet)!;
  if (set.only === id) {
    delete set.only;
    set.selection[id] = true;
  } else if (!included(set, targets, id)) set.only = id;
  else {
    set.selection[id] = false;
    // Turning a branch off excludes all descendants; existing detail remains recoverable via undo.
    for (const key of Object.keys(set.selection))
      if (key !== id && inside(targets, key, id)) delete set.selection[key];
  }
  return next;
}
/** Binary branch selection: a parent sets the baseline, descendants may then
 * override it. Toggling a branch deliberately resets its existing exceptions. */
export function toggleTarget(state: Controller, targets: Target[], id: string): Controller {
  const next = structuredClone(state),
    set = next.sets.find((s) => s.id === next.activeSet) ?? next.sets[0];
  if (set.only) {
    // Preserve the effective mask of older isolate-mode saves using ordinary
    // inherited on/off rules before making the first binary edit.
    const only = set.only, selection: Record<string, boolean> = {};
    for (const target of targets) if (!target.parent) selection[target.id] = false;
    selection[only] = true;
    for (const [key, value] of Object.entries(set.selection))
      if (key !== only && inside(targets, key, only)) selection[key] = value;
    set.selection = selection;
    delete set.only;
  }
  set.selection[id] = !included(set, targets, id);
  for (const key of Object.keys(set.selection))
    if (key !== id && inside(targets, key, id)) delete set.selection[key];
  return next;
}
export function toggleRule(
  state: Controller,
  field: "locks" | "disconnected",
  id: string,
  property?: string,
): Controller {
  const next = structuredClone(state),
    old = next[field][id];
  if (!property) {
    if (old?.all) delete next[field][id];
    else next[field][id] = { all: true };
  } else {
    const properties = new Set(old?.properties ?? []);
    if (properties.has(property)) properties.delete(property);
    else properties.add(property);
    next[field][id] = { properties: [...properties] };
  }
  return next;
}
export function applyValue(
  state: Controller,
  targets: Target[],
  property: string,
  value: Value,
  origin?: string,
  local = false,
): Controller {
  const next = structuredClone(state),
    set = state.sets.find((s) => s.id === state.activeSet) ?? state.sets[0];
  if (!origin) {
    const active = next.sets.find((s) => s.id === next.activeSet) ?? next.sets[0];
    active.adjustments = { ...active.adjustments, [property]: value };
  }
  for (const target of targets) {
    if (!target.properties?.includes(property)) continue;
    if (property === "effect" && target.effectKinds && !target.effectKinds.includes(String(value)))
      continue;
    if (origin ? !inside(targets, target.id, origin) : !included(set, targets, target.id)) continue;
    // Global adjustment originates at the nearest included category; direct row edits bypass its own lock.
    const root = origin ?? set.only ?? "all";
    for (const channel of new Set(propertyChannels(property).map(channel => target.couplings?.[channel] ?? channel))) {
      if (!target.properties.includes(channel) || blocked(state, targets, target.id, channel, root))
        continue;
      next.values[target.id] = { ...next.values[target.id], [channel]: value };
      next.refined[target.id] =
        local && target.instance
          ? [...new Set([...(next.refined[target.id] ?? []), channel])]
          : (next.refined[target.id] ?? []).filter((p) => p !== channel);
    }
  }
  return next;
}
