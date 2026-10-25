import { boundedNumber, type NumericSpec } from "../properties/numericRange.ts";
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
  numberRanges?: Record<string, NumericSpec>;
  /** Compatibility policy ancestry retained when discovery regroups a target. */
  legacyAncestors?: string[];
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
/** A transaction/render owns one target snapshot; never rebuild this map per row
 * or per property channel. No global cache: callers may build a new structure. */
export function createTargetIndex(targets: Target[]) {
  const byId = new Map(targets.map(target => [target.id, target])), paths = new Map<string, string[]>();
  const path = (id: string) => {
    const cached = paths.get(id); if (cached) return cached;
    const result: string[] = [], seen = new Set<string>();
    for (let key: string | undefined = id; key && !seen.has(key); key = byId.get(key)?.parent) {
      seen.add(key); result.unshift(key);
    }
    const legacy = result.flatMap(key => byId.get(key)?.legacyAncestors ?? []);
    const combined = [...new Set([...legacy, ...result])];
    paths.set(id, combined); return combined;
  };
  return { byId, path };
}
/** Build hierarchy projections in O(targets × depth), once per structure revision. */
export function createHierarchyIndex<T extends Target>(targets: T[]) {
  const index = createTargetIndex(targets), paths = new Map<string, string[]>();
  const descendants = new Map<string, T[]>(targets.map(target => [target.id, []]));
  for (const target of targets) {
    const path = index.path(target.id); paths.set(target.id, path);
    for (const id of path) descendants.get(id)?.push(target);
  }
  return { index, paths, descendants };
}
export function ancestry(targets: Target[], id: string): string[] {
  return createTargetIndex(targets).path(id);
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
  index = createTargetIndex(targets),
): boolean {
  const path = index.path(id),
    from = origin ? path.indexOf(origin) : -1;
  // A deliberate edit at a locked row is allowed. Propagation stops at lower locks.
  const family = Object.keys(companions).find((key) => companions[key] === property) ??
    Object.entries(index.byId.get(id)?.couplings ?? {}).find(([source, channel]) => source !== channel && channel === property)?.[0];
  const originPath = origin ? index.path(origin) : [];
  const legacyLocks = path.flatMap(key => index.byId.get(key)?.legacyAncestors ?? [])
    .some(key => !originPath.includes(key) && (ruleHas(state.locks[key], property) || (!!family && ruleHas(state.locks[key], family))));
  return legacyLocks || path.some(
    (key, index) =>
      index > from &&
      (ruleHas(state.locks[key], property) || (!!family && ruleHas(state.locks[key], family))),
  );
}
export const connected = (state: Controller, targets: Target[], id: string, property: string, index = createTargetIndex(targets)) => {
  const channel = index.byId.get(id)?.couplings?.[property] ?? property;
  return !index.path(id).some(key => ruleHas(state.disconnected[key], property) || ruleHas(state.disconnected[key], channel));
};
export function included(set: AppearanceSet, targets: Target[], id: string, index = createTargetIndex(targets)): boolean {
  const path = index.path(id);
  if (set.only && !path.includes(set.only)) return false;
  let on = true;
  const relevant = set.only ? path.slice(path.indexOf(set.only) + 1) : path;
  for (const key of relevant) if (Object.hasOwn(set.selection, key)) on = set.selection[key];
  return on;
}
/** Legacy isolate-cycle compatibility. Current editors use toggleTarget. */
export function cycleTarget(state: Controller, targets: Target[], id: string): Controller {
  const index = createTargetIndex(targets);
  const active = state.sets.find(set => set.id === state.activeSet)!;
  const set = { ...active, selection: { ...active.selection } };
  const next = { ...state, sets: state.sets.map(item => item === active ? set : item) };
  if (set.only === id) {
    delete set.only;
    set.selection[id] = true;
  } else if (!included(set, targets, id, index)) set.only = id;
  else {
    set.selection[id] = false;
    // Turning a branch off excludes all descendants; existing detail remains recoverable via undo.
    for (const key of Object.keys(set.selection))
      if (key !== id && index.path(key).includes(id)) delete set.selection[key];
  }
  return next;
}
/** Binary branch selection: a parent sets the baseline, descendants may then
 * override it. Toggling a branch deliberately resets its existing exceptions. */
export function toggleTarget(state: Controller, targets: Target[], id: string): Controller {
  const index = createTargetIndex(targets);
  const active = state.sets.find(set => set.id === state.activeSet) ?? state.sets[0];
  const set = { ...active, selection: { ...active.selection } };
  const next = { ...state, sets: state.sets.map(item => item === active ? set : item) };
  if (set.only) {
    // Preserve the effective mask of older isolate-mode saves using ordinary
    // inherited on/off rules before making the first binary edit.
    const only = set.only, selection: Record<string, boolean> = {};
    for (const target of targets) if (!target.parent) selection[target.id] = false;
    selection[only] = true;
    for (const [key, value] of Object.entries(set.selection))
      if (key !== only && index.path(key).includes(only)) selection[key] = value;
    set.selection = selection;
    delete set.only;
  }
  set.selection[id] = !included(set, targets, id, index);
  for (const key of Object.keys(set.selection))
    if (key !== id && index.path(key).includes(id)) delete set.selection[key];
  return next;
}
export function toggleRule(
  state: Controller,
  field: "locks" | "disconnected",
  id: string,
  property?: string,
): Controller {
  const next = { ...state, [field]: { ...state[field] } }, old = state[field][id];
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
/** Shared applicability for setter headings and their actual editor controls. */
export function adjustmentTargets(state: Controller, targets: Target[], property: string, origin?: string, index = createTargetIndex(targets)) {
  const set = state.sets.find(item => item.id === state.activeSet) ?? state.sets[0];
  return targets.filter(target => target.properties?.includes(property) &&
    (origin ? index.path(target.id).includes(origin) : included(set, targets, target.id, index)) &&
    !blocked(state, targets, target.id, property, origin ?? set.only ?? "all", index) && connected(state, targets, target.id, property, index));
}
export function applyValue(
  state: Controller,
  targets: Target[],
  property: string,
  value: Value,
  origin?: string,
  local = false,
  options: { skipBypassed?: boolean; exact?: boolean; readInput?: (target: Target, property: string) => Value } = {},
): Controller {
  if (typeof value === "number" && !Number.isFinite(value)) return state;
  const set = state.sets.find(s => s.id === state.activeSet) ?? state.sets[0];
  let next = state;
  const writable = () => {
    if (next === state) next = { ...state };
  };
  if (!origin && set.adjustments?.[property] !== value) {
    writable();
    next.sets = state.sets.map(active => active === set
      ? { ...active, adjustments: { ...active.adjustments, [property]: value } } : active);
  }
  const index = createTargetIndex(targets);
  for (const target of targets) {
    if (!target.properties?.includes(property)) continue;
    if (property === "effect" && target.effectKinds && !target.effectKinds.includes(String(value))) continue;
    if (origin ? !index.path(target.id).includes(origin) : !included(set, targets, target.id, index)) continue;
    const root = origin ?? set.only ?? "all";
    for (const channel of new Set((options.exact ? [property] : propertyChannels(property)).map(channel => target.couplings?.[channel] ?? channel))) {
      if (!target.properties.includes(channel) || options.skipBypassed && !connected(state, targets, target.id, channel, index) || blocked(state, targets, target.id, channel, root, index)) continue;
      const spec = target.numberRanges?.[channel];
      const nextValue = typeof value === "number" && spec ? boundedNumber(spec, value, key => {
        const input = target.couplings?.[key] ?? key;
        return state.values[target.id]?.[input] ?? (target.instance ? state.values[target.instance.base]?.[input] : undefined) ?? options.readInput?.(target, input);
      }) : value;
      const refined = next.refined[target.id] ?? [], mark = !!(local && target.instance);
      if (next.values[target.id]?.[channel] === nextValue && refined.includes(channel) === mark) continue;
      writable();
      if (next.values[target.id]?.[channel] !== nextValue) {
        if (next.values === state.values) next.values = { ...state.values };
        if (next.values[target.id] === state.values[target.id]) next.values[target.id] = { ...state.values[target.id] };
        next.values[target.id][channel] = nextValue;
      }
      if (refined.includes(channel) !== mark) {
        if (next.refined === state.refined) next.refined = { ...state.refined };
        next.refined[target.id] = mark ? [...refined, channel] : refined.filter(p => p !== channel);
      }
    }
  }
  return next;
}
