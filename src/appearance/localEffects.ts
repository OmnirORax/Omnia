import type { WorkspaceSettings } from "../workspaceActions";
import { resolveTargetSparkles, type SurfaceTarget } from "../graph/effects";
import { controllerTargets } from "./registry";
import { valueFor, brightHex } from "./resolve";
/** Local effect edits share the same referenced property values as the master tree. */
export function elementEffects(
  raw: WorkspaceSettings["appearance"],
  effective: WorkspaceSettings["appearance"],
  target: SurfaceTarget,
  element: HTMLElement,
) {
  const fallback = resolveTargetSparkles(effective, target),
    state = raw.controller;
  if (!state) return fallback;
  const owners: string[] = [];
  let root = element.closest<HTMLElement>("[data-ui-resident-root]");
  while (root) {
    owners.unshift(root.dataset.uiResidentRoot!);
    root = root.parentElement?.closest<HTMLElement>("[data-ui-resident-root]") ?? null;
  }
  const fn = element.closest<HTMLElement>("[data-ui-function]")?.dataset.uiFunction;
  if (fn) owners.push(`function:${fn}`);
  const targets = controllerTargets(state);
  let chosen: ReturnType<typeof controllerTargets>[number] | undefined;
  for (const owner of owners) {
    const found = targets.find(
      (t) => t.instance?.base === `vfx.${target}` && t.instance.owner === owner,
    );
    if (found) chosen = found;
  }
  if (!chosen) return fallback;
  const get = (p: string) => valueFor(raw, state, chosen!, p);
  return {
    ...fallback,
    color: brightHex(get("color") as string, get("brightness") as number),
    opacity: get("opacity") as number,
    glow: get("glow") as number,
    effect: get("effect") as typeof fallback.effect,
    motion: get("speed") as number,
    intensity: get("intensity") as number,
    density: get("density") as number,
    starSize: get("size") as number,
    boltLength: get("length") as number,
  };
}
