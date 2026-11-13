export type Value = string | number | boolean;
export type Property = { key: string; label: string; kind: 'color' | 'number' | 'text' | 'toggle' | 'select'; presentation?: 'slider'; unit?: string; min?: number; max?: number; step?: number; options?: readonly { id: string; label: string }[]; channelOf?: string };
const definitions = new Map<string, Property>();
export function property(definition: Property): Property {
  const existing = definitions.get(definition.key);
  if (existing && (existing.kind !== definition.kind || existing.unit !== definition.unit)) throw Error(`Conflicting property: ${definition.key}`);
  if (existing) return existing;
  definitions.set(definition.key, definition); return definition;
}
