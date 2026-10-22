import type { WorkspaceSettings } from "../workspaceActions";
import { controllerTargets, EFFECT_PROPERTIES, type RegisteredTarget } from "./registry";
import { connected } from "./model";
import { createValueResolver, effectsFor, effectsFromValues } from "./resolve";
import { partSelector, scopeDepth } from "./partScope";
/** Resolve effect properties through the actual UI ownership chain. */
export function elementEffects(
  raw: WorkspaceSettings["appearance"],
  effective: WorkspaceSettings["appearance"],
  target: RegisteredTarget,
  element: HTMLElement,
  targets = controllerTargets(raw.controller!),
) {
  const state = raw.controller;
  if (!state) return effectsFor(effective, target.id);
  let resolver: ReturnType<typeof createValueResolver> | undefined;
  const read = (target: RegisteredTarget, property: string) => (resolver ??= createValueResolver(raw, state, targets))(target, property);
  const owners: string[] = [];
  let root = element.closest<HTMLElement>("[data-ui-resident-root]");
  while (root) {
    owners.unshift(root.dataset.uiResidentRoot!);
    root = root.parentElement?.closest<HTMLElement>("[data-ui-resident-root]") ?? null;
  }
  // Docked tabs are another handle for the same resident, outside its content root.
  const proxy = element.closest<HTMLElement>("[data-ui-proxy-for]")?.dataset.uiProxyFor;
  if (proxy) owners.push(proxy);
  const fn = element.closest<HTMLElement>("[data-ui-function]")?.dataset.uiFunction;
  if (fn) owners.push(`function:${fn}`);
  const values = { ...effective.renderDefaults?.[target.id] };
  for (const owner of owners) {
    const locals = targets.filter(t => t.instance?.owner === owner &&
      (t.instance.base === target.id || (target.hidden && t.instance.base === target.parent)) &&
      (!t.instance.part || element.matches(partSelector(t.instance))))
      .sort((a, b) => scopeDepth(a.instance!) - scopeDepth(b.instance!) || Number(a.instance!.base === target.parent) - Number(b.instance!.base === target.parent));
    for (const local of locals)
      for (const property of EFFECT_PROPERTIES)
        if (
          state.values[local.id]?.[property] !== undefined ||
          !connected(state, targets, local.id, property)
        )
          values[property] = read(local, property);
  }
  // Parts without a resident/function owner still use their app-relative address.
  for (const local of targets.filter(t => t.instance?.owner === "app" && t.instance.part && t.instance.base === target.id && element.matches(partSelector(t.instance))))
    for (const property of EFFECT_PROPERTIES)
      if (state.values[local.id]?.[property] !== undefined || !connected(state, targets, local.id, property))
        values[property] = read(local, property);
  return Object.keys(values).length
    ? effectsFromValues((p) => values[p] ?? read(target, p))
    : effectsFor(effective, target.id);
}
