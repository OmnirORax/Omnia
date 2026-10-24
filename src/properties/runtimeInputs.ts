import type { PropertyChange, PropertyValue } from "./registry.ts";
let active: ReadonlyMap<string, PropertyValue> | null = null;
/** Invocation-only inputs: no preference writes, serialization or React updates. */
export function withFunctionInputs(changes: readonly PropertyChange[], run: () => void) {
  const previous = active;
  active = new Map([...(previous ?? []), ...changes.map(change => [`${change.consumer}:${change.property}`, change.value] as const)]);
  try { run(); } finally { active = previous; }
}
export function functionInputValue(consumer: string, property: string, stored: () => PropertyValue): PropertyValue {
  return active?.get(`${consumer}:${property}`) ?? stored();
}
