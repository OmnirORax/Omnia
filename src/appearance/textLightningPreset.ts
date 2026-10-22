import { applyValue, blocked, connected, type Controller, type Value } from "./model.ts";
import { controllerTargets, validateProperty } from "./registry.ts";

/** A recipe for existing shared inputs, not a new effect or a second settings store. */
export const TEXT_LIGHTNING_PRESET: Readonly<Record<string, Value>> = {
  effect: "electric-text",
  effectColor: "#08ff48",
  effectBrightness: 1.15,
  effectOpacity: .94,
  intensity: .85,
  density: .38,
  length: .62,
  speed: .8,
};

/** One draft transaction; keep UI text's existing typography, paint and protections. */
export function applyTextLightningPreset(state: Controller): Controller {
  const targets = controllerTargets(state);
  let next = state;
  for (const [property, value] of Object.entries(TEXT_LIGHTNING_PRESET)) {
    if (validateProperty(property, value) !== value) throw new Error(`Invalid text lightning preset input: ${property}`);
    const writable = targets.map(target => connected(state, targets, target.id, property) && !blocked(state, targets, target.id, property, "all") ? target : { ...target, properties: [] });
    next = applyValue(next, writable, property, value, "text.ui");
  }
  return next;
}
