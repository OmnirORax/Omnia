import type { PropertyValue } from "../properties/registry.ts";

/** Shared pulse adapter; values are read from the normal controller/couplings. */
export const SELECTOR_PULSE_MS = 2600;
export function selectorPulseSettings(values: Record<string, PropertyValue>) {
  const speed = Math.max(0, Math.min(1, Number(values.speed)));
  const depth = Math.max(0, Math.min(1, Number(values.intensity)));
  return { enabled: !!values.pulse && speed > 0 && depth > 0,
    duration: speed > 0 ? SELECTOR_PULSE_MS * .25 / speed : SELECTOR_PULSE_MS, depth };
}
export type SelectorPulseSettings = ReturnType<typeof selectorPulseSettings>;
