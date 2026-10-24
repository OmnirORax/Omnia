import type { RegisteredTarget } from "./registry.ts";

export const hierarchyTargetable = (targets: readonly RegisteredTarget[], inScope = true) =>
  inScope && targets.some(target => target.properties?.length);

/** Choosing a target is independent of the active setter's applicability.
 * Scope membership still limits edits; hovering an incompatible setter falls
 * back to existing color paint without changing the active property. */
export function hierarchyInteraction(targets: readonly RegisteredTarget[], property: string, effect: string, inScope = true) {
  const supports = (target: RegisteredTarget, id: string) => !target.aggregate && target.properties?.includes(id) &&
    (id !== "effect" || !target.effectKinds || target.effectKinds.includes(effect));
  const selected = targets.filter(target => supports(target, property));
  const feedbackProperty = selected.length ? property : "color";
  return {
    selectable: hierarchyTargetable(targets, inScope),
    feedbackProperty,
    feedbackTargets: selected.length ? selected : targets.filter(target => supports(target, "color")),
  };
}
