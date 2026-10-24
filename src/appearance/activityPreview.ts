import { connected, createTargetIndex } from "./model.ts";
import { controllerTargets, PROPERTY_REGISTRY, type RegisteredTarget } from "./registry.ts";
import { createValueResolver, type Appearance } from "./resolve.ts";

export type ActivityPreview = { property: string; targets: RegisteredTarget[] };
/** A renderer-only projection. Never pass this controller to an editor or commit path. */
export function activityPreview(base: Appearance, requests: readonly ActivityPreview[]): Appearance {
  if (!base.controller || !requests.length) return base;
  const state = base.controller, targets = controllerTargets(state);
  const known = new Set(targets.map(target => target.id));
  for (const request of requests) for (const target of request.targets) if (!known.has(target.id)) {
    targets.push({ ...target, parent: target.instance?.base ?? target.parent }); known.add(target.id);
  }
  const read = createValueResolver(base, state, targets), index = createTargetIndex(targets);
  let controller: typeof state | undefined;
  for (const request of requests) for (const target of request.targets) {
    const consumer = PROPERTY_REGISTRY.consumer(target.instance?.base ?? target.id);
    const channel = target.couplings?.[request.property] ?? request.property;
    const activation = consumer?.previewActivation ?? PROPERTY_REGISTRY.property(channel)?.previewActivation;
    // The switch's own Off choice and bypass are authoritative, even during editing.
    if (!activation || request.property === activation.property || !target.properties?.includes(activation.property) || !target.properties?.includes(request.property) ||
      !connected(state, targets, target.id, request.property, index) || !connected(state, targets, target.id, activation.property, index) ||
      read(target, activation.property) !== activation.inactive) continue;
    const activationChannel = target.couplings?.[activation.property] ?? activation.property;
    const choices = consumer?.choices[activationChannel] ?? (activation.property === "effect" ? target.effectKinds : undefined);
    const active = choices && !choices.includes(String(activation.active)) ? choices.find(value => value !== activation.inactive) : activation.active;
    if (active === undefined) continue;
    controller ??= { ...state, instances: { ...state.instances }, values: { ...state.values } };
    if (target.instance) controller.instances[target.id] = target.instance;
    controller.values[target.id] = { ...controller.values[target.id], [activationChannel]: active };
  }
  return controller ? { ...base, controller } : base;
}
