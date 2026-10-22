import type { WorkspaceSettings } from "../workspaceActions";
import { controllerTargets, EFFECT_PROPERTIES, type RegisteredTarget } from "./registry.ts";
import { connected } from "./model.ts";
import { createValueResolver, effectsFor, effectsFromValues } from "./resolve.ts";
import { partSelector, scopeDepth } from "./partScope.ts";
import { effectVisible } from "../graph/effects.ts";

/** Build once per appearance state, never once per element or animation frame. */
export function createElementEffectsResolver(raw: WorkspaceSettings["appearance"], effective: WorkspaceSettings["appearance"], targets = raw.controller ? controllerTargets(raw.controller) : []) {
  const state = raw.controller, read = state ? createValueResolver(raw, state, targets) : undefined;
  const locals = targets.filter(target => target.instance);
  const byBase = new Map<string, RegisteredTarget[]>();
  const overrides = new Map<string, Record<string, string | number | boolean>>();
  const activeLocalBases = new Set<string>();
  const localStyles = new Map<string, ReturnType<typeof effectsFor>>();
  for (const local of locals) {
    const values: Record<string, string | number | boolean> = {};
    for (const property of EFFECT_PROPERTIES) if (state && read && local.properties?.includes(property) &&
      (state.values[local.id]?.[property] !== undefined || !connected(state, targets, local.id, property))) values[property] = read(local, property);
    if (!Object.keys(values).length) continue; // A paint-only customization is not an animation.
    overrides.set(local.id, values);
    const base = local.instance!.base;
    byBase.set(base, [...(byBase.get(base) ?? []), local]);
    if (read) {
      const fx = effectsFromValues(property => read(local, property)); localStyles.set(local.id, fx);
      if (effectVisible(fx)) activeLocalBases.add(base);
    }
  }
  for (const entries of byBase.values()) entries.sort((a, b) => scopeDepth(a.instance!) - scopeDepth(b.instance!));
  let cache = new WeakMap<HTMLElement, Map<string, ReturnType<typeof effectsFor>>>();
  let owners = new WeakMap<Node, Map<string, RegisteredTarget | null>>();
  const forTarget = (target: RegisteredTarget) => [...(byBase.get(target.id) ?? []), ...(target.hidden && target.parent ? byBase.get(target.parent) ?? [] : [])];
  const owns = (local: RegisteredTarget, element: HTMLElement) => {
    const instance = local.instance!, owner = instance.owner;
    const root = owner === "app" ? document.body : element.closest(owner.startsWith("function:")
      ? `[data-ui-function="${CSS.escape(owner.slice(9))}"]`
      : `:is([data-ui-resident-root="${CSS.escape(owner)}"],[data-ui-proxy-for="${CSS.escape(owner)}"])`);
    return !!root && (!instance.part || element.matches(partSelector(instance)));
  };
  const resolve = (target: RegisteredTarget, element: HTMLElement) => {
    let values = cache.get(element); if (!values) { values = new Map(); cache.set(element, values); }
    const cached = values.get(target.id); if (cached) return cached;
    const merged = { ...effective.renderDefaults?.[target.id] };
    // Exact text parts render as independent node jobs, never as host-wide effects.
    for (const local of forTarget(target)) if (!(local.binding?.text && local.instance?.part) && owns(local, element)) Object.assign(merged, overrides.get(local.id));
    const fx = Object.keys(merged).length && read
      ? effectsFromValues(property => merged[property] ?? read(target, property)) : effectsFor(effective, target.id);
    values.set(target.id, fx); return fx;
  };
  const textHostOwner = (target: RegisteredTarget, element: HTMLElement) => forTarget(target).findLast(local =>
    local.binding?.text && local.instance?.part && local.instance.part.text === undefined && owns(local, element));
  const nodeOwner = (target: RegisteredTarget, node: Node) => {
    let values = owners.get(node); if (!values) { values = new Map(); owners.set(node, values); }
    if (values.has(target.id)) return values.get(target.id);
    let result: RegisteredTarget | null = null;
    for (const local of forTarget(target)) {
      if (!local.instance?.part || !local.binding?.text) continue;
      const host = node.parentElement?.closest<HTMLElement>(partSelector(local.instance));
      if (!host || !owns(local, host)) continue;
      if (local.instance.part.text !== undefined && [...host.childNodes].filter(child => child.nodeType === Node.TEXT_NODE && child.textContent?.trim())[local.instance.part.text] !== node) continue;
      result = local;
    }
    values.set(target.id, result); return result;
  };
  return { resolve, forTarget, activeLocalBases, nodeOwner, textHostOwner, localStyle: (local: RegisteredTarget) => localStyles.get(local.id)!,
    invalidate: () => { cache = new WeakMap(); owners = new WeakMap(); } };
}
/** Compatibility entry; render loops retain createElementEffectsResolver instead. */
export function elementEffects(raw: WorkspaceSettings["appearance"], effective: WorkspaceSettings["appearance"], target: RegisteredTarget, element: HTMLElement, targets = raw.controller ? controllerTargets(raw.controller) : []) {
  return createElementEffectsResolver(raw, effective, targets).resolve(target, element);
}
