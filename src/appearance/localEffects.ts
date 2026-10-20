import type { WorkspaceSettings } from "../workspaceActions";
import { controllerTargets, EFFECT_PROPERTIES, type RegisteredTarget } from "./registry";
import { connected } from "./model";
import { valueFor, effectsFor, effectsFromValues } from "./resolve";
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
  const owners: string[] = [];
  let root = element.closest<HTMLElement>("[data-ui-resident-root]");
  while (root) {
    owners.unshift(root.dataset.uiResidentRoot!);
    root = root.parentElement?.closest<HTMLElement>("[data-ui-resident-root]") ?? null;
  }
  const fn = element.closest<HTMLElement>("[data-ui-function]")?.dataset.uiFunction;
  if (fn) owners.push(`function:${fn}`);
  const values = { ...effective.renderDefaults?.[target.id] };
  for (const owner of owners) {
    const local = targets.find((t) => t.instance?.base === target.id && t.instance.owner === owner);
    if (!local) continue;
    for (const property of EFFECT_PROPERTIES)
      if (
        state.values[local.id]?.[property] !== undefined ||
        !connected(state, targets, local.id, property)
      )
        values[property] = valueFor(raw, state, local, property);
  }
  return Object.keys(values).length
    ? effectsFromValues((p) => values[p] ?? valueFor(raw, state, target, p))
    : effectsFor(effective, target.id);
}
