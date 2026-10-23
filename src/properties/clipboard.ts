import { type PropertyRegistry, type PropertyValue } from "./registry.ts";
export type PropertySnapshot = { values: Record<string, PropertyValue>; mixed: string[] };
export type PropertySource = { properties: readonly string[]; read: (property: string) => PropertyValue };
/** Copy values, never source identities, targeting masks or lock/bypass policy.
 * A mixed source has no unambiguous value to paste, so omit that property. */
export function copyPropertyValues(registry: PropertyRegistry, sources: readonly PropertySource[]): PropertySnapshot {
  const values: Record<string, PropertyValue> = {}, mixed = new Set<string>();
  for (const source of sources) for (const property of source.properties) {
    const definition = registry.property(property); if (!definition) continue;
    const value = source.read(property);
    // Sources are live registered readers. Runtime choices (e.g. imported fonts)
    // can extend static select options; validate applicability when pasting.
    if (typeof value !== typeof definition.initial || typeof value === "number" && !Number.isFinite(value)) continue;
    if (Object.hasOwn(values, property) && values[property] !== value) mixed.add(property);
    else if (!mixed.has(property)) values[property] = value;
  }
  for (const property of mixed) delete values[property];
  return { values, mixed: [...mixed] };
}
