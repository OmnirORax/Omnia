import type { WorkspaceSettings } from "../workspaceActions";
import { controllerTargets, EFFECT_PROPERTIES, type RegisteredTarget } from "./registry.ts";
import { connected, createTargetIndex } from "./model.ts";
import { createValueResolver, effectsFor, effectsFromValues } from "./resolve.ts";
import { partSelector, scopeDepth } from "./partScope.ts";
import { effectVisible } from "../graph/effects.ts";

/** Build once per appearance state, never once per element or animation frame. */
export function createElementEffectsResolver(raw: WorkspaceSettings["appearance"], effective: WorkspaceSettings["appearance"], targets = raw.controller ? controllerTargets(raw.controller) : []) {
  const state = raw.controller, read = state ? createValueResolver(raw, state, targets) : undefined;
  const index = createTargetIndex(targets);
  const locals = targets.filter(target => target.instance);
  const byBase = new Map<string, RegisteredTarget[]>();
  const overrides = new Map<string, Record<string, string | number | boolean>>();
  const activeLocalBases = new Set<string>();
  const localStyles = new Map<string, ReturnType<typeof effectsFor>>();
  for (const local of locals) {
    const values: Record<string, string | number | boolean> = {};
    for (const property of EFFECT_PROPERTIES) if (state && read && local.properties?.includes(property) &&
      (state.values[local.id]?.[property] !== undefined || !connected(state, targets, local.id, property, index))) values[property] = read(local, property);
    if (!Object.keys(values).length) continue; // A paint-only customization is not an animation.
    overrides.set(local.id, values);
    const base = local.instance!.base;
    let entries = byBase.get(base);
    if (!entries) { entries = []; byBase.set(base, entries); }
    entries.push(local);
    if (read) {
      const fx = effectsFromValues(property => read(local, property)); localStyles.set(local.id, fx);
      if (effectVisible(fx)) activeLocalBases.add(base);
    }
  }
  for (const entries of byBase.values()) entries.sort((a, b) => scopeDepth(a.instance!) - scopeDepth(b.instance!));
  let cache = new WeakMap<HTMLElement, Map<string, ReturnType<typeof effectsFor>>>();
  let owners = new WeakMap<Node, Map<string, RegisteredTarget | null>>();
  const targetLocals = new Map<string, RegisteredTarget[]>();
  const forTarget = (target: RegisteredTarget) => {
    let result = targetLocals.get(target.id);
    if (!result) { result = [...(byBase.get(target.id) ?? []), ...(target.hidden && target.parent ? byBase.get(target.parent) ?? [] : [])]; targetLocals.set(target.id, result); }
    return result;
  };
  // Project registered local ownership onto each mounted host once. An inherited
  // edit may include thousands of saved/offscreen locals: never run closest()
  // for every saved owner on every visible text node.
  let hostOwners = new WeakMap<HTMLElement, Set<string>>();
  const ownerKeys = (element: HTMLElement) => {
    let keys = hostOwners.get(element);
    if (keys) return keys;
    keys = new Set(["app"]);
    for (let root: HTMLElement | null = element; root; root = root.parentElement) {
      const fn = root.getAttribute?.("data-ui-function");
      if (fn) keys.add(`function:${fn}`);
      for (const attr of ["data-ui-resident-root", "data-ui-proxy-for"]) {
        const owner = root.getAttribute?.(attr); if (owner) keys.add(owner);
      }
    }
    hostOwners.set(element, keys); return keys;
  };
  const ownerGroups = new Map<string, Map<string, RegisteredTarget[]>>();
  const localOrder = new Map<string, Map<string, number>>();
  let candidates = new WeakMap<HTMLElement, Map<string, RegisteredTarget[]>>();
  const forElement = (target: RegisteredTarget, element: HTMLElement) => {
    let cached = candidates.get(element); if (!cached) { cached = new Map(); candidates.set(element, cached); }
    const previous = cached.get(target.id); if (previous) return previous;
    let groups = ownerGroups.get(target.id), order = localOrder.get(target.id);
    if (!groups) {
      groups = new Map(); order = new Map();
      forTarget(target).forEach((local, index) => {
        const owner = local.instance!.owner;
        let group = groups!.get(owner); if (!group) { group = []; groups!.set(owner, group); }
        group.push(local); order!.set(local.id, index);
      });
      ownerGroups.set(target.id, groups); localOrder.set(target.id, order!);
    }
    const result = [...ownerKeys(element)].flatMap(key => groups!.get(key) ?? []);
    result.sort((a, b) => order!.get(a.id)! - order!.get(b.id)!);
    cached.set(target.id, result); return result;
  };
  const selectors = new Map<string, string>();
  const selectorFor = (local: RegisteredTarget) => {
    let selector = selectors.get(local.id);
    if (!selector) { selector = partSelector(local.instance!); selectors.set(local.id, selector); }
    return selector;
  };
  const ownsPart = (local: RegisteredTarget, element: HTMLElement) => !local.instance!.part || element.matches(selectorFor(local));
  const resolve = (target: RegisteredTarget, element: HTMLElement) => {
    let values = cache.get(element); if (!values) { values = new Map(); cache.set(element, values); }
    const cached = values.get(target.id); if (cached) return cached;
    const merged = { ...effective.renderDefaults?.[target.id] };
    // Exact text parts render as independent node jobs, never as host-wide effects.
    for (const local of forElement(target, element)) if (!(local.binding?.text && local.instance?.part) && ownsPart(local, element)) Object.assign(merged, overrides.get(local.id));
    const fx = Object.keys(merged).length && read
      ? effectsFromValues(property => merged[property] ?? read(target, property)) : effectsFor(effective, target.id);
    values.set(target.id, fx); return fx;
  };
  const textHostOwner = (target: RegisteredTarget, element: HTMLElement) => forElement(target, element).findLast(local =>
    local.binding?.text && local.instance?.part && local.instance.part.text === undefined && ownsPart(local, element));
  const nodeOwner = (target: RegisteredTarget, node: Node) => {
    let values = owners.get(node); if (!values) { values = new Map(); owners.set(node, values); }
    if (values.has(target.id)) return values.get(target.id);
    let result: RegisteredTarget | null = null;
    for (const local of node.parentElement ? forElement(target, node.parentElement) : []) {
      if (!local.instance?.part || !local.binding?.text) continue;
      const host = node.parentElement?.closest<HTMLElement>(selectorFor(local));
      if (!host || !ownsPart(local, host)) continue;
      if (local.instance.part.text !== undefined && [...host.childNodes].filter(child => child.nodeType === Node.TEXT_NODE && child.textContent?.trim())[local.instance.part.text] !== node) continue;
      result = local;
    }
    values.set(target.id, result); return result;
  };
  return { resolve, forTarget, activeLocalBases, nodeOwner, textHostOwner, localStyle: (local: RegisteredTarget) => localStyles.get(local.id)!,
    invalidate: () => { cache = new WeakMap(); owners = new WeakMap(); hostOwners = new WeakMap(); candidates = new WeakMap(); } };
}
/** Compatibility entry; render loops retain createElementEffectsResolver instead. */
export function elementEffects(raw: WorkspaceSettings["appearance"], effective: WorkspaceSettings["appearance"], target: RegisteredTarget, element: HTMLElement, targets = raw.controller ? controllerTargets(raw.controller) : []) {
  return createElementEffectsResolver(raw, effective, targets).resolve(target, element);
}
