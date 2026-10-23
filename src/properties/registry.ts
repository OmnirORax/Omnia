import { functionInputValue } from "./runtimeInputs.ts";
/** Property definitions and couplings contain no renderer, DOM or persistence assumptions. */
export type PropertyValue = string | number | boolean;
export type PreviewActivation = { property: string; inactive: PropertyValue; active: PropertyValue };
export type Category = { id: string; label: string };
export type PropertyDefinition = {
  id: string; label: string; kind: "color" | "number" | "select" | "toggle";
  min?: number; max?: number; step?: number; initial: PropertyValue; neutral?: PropertyValue;
  options?: readonly { id: string; label: string }[];
  category?: Category; unit?: string;
  /** Another independently adjustable channel of the same property, e.g. animation color. */
  channelOf?: string;
  previewActivation?: PreviewActivation;
};
export type PropertyUse = { property: string | PropertyDefinition; initial?: PropertyValue; choices?: readonly string[] };
export type ConsumerGroup = Category & { self?: boolean };
export type ConsumerDefinition = {
  id: string; label: string; owner: string;
  locator?: string;
  /** Render-only activation while inspecting parameters; never a saved value. */
  previewActivation?: PreviewActivation;
  controls?: readonly string[];
  group: ConsumerGroup[]; properties: readonly PropertyUse[];
};
export type CoupledConsumer = Omit<ConsumerDefinition, "properties"> & {
  properties: string[]; channels: Record<string, string>; defaults: Record<string, PropertyValue>;
  choices: Record<string, readonly string[]>;
};
export function validateValue(property: PropertyDefinition, value: unknown): PropertyValue | undefined {
  if (property.kind === "toggle") return typeof value === "boolean" ? value : undefined;
  if (property.kind === "color") return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : undefined;
  if (property.kind === "number") return typeof value === "number" && Number.isFinite(value)
    ? Math.max(property.min!, Math.min(property.max!, value)) : undefined;
  return property.options?.some(option => option.id === value) ? value as string : undefined;
}
const contract = (property: PropertyDefinition) => JSON.stringify({ kind: property.kind, unit: property.unit,
  min: property.min, max: property.max, step: property.step, channelOf: property.channelOf, previewActivation: property.previewActivation,
  options: property.options?.map(option => option.id).sort() });
export function createPropertyRegistry() {
  const definitions: PropertyDefinition[] = [], consumers: CoupledConsumer[] = [], categories: Category[] = [];
  const byId = new Map<string, PropertyDefinition>();
  const category = (next: Category) => {
    if (!next.id || !next.label) throw new Error("Property categories need stable IDs and labels.");
    const existing = categories.find(item => item.id === next.id);
    if (existing && existing.label !== next.label) throw new Error(`Conflicting property category: ${next.id}`);
    if (!existing) categories.push({ ...next });
  };
  const define = (definition: PropertyDefinition): PropertyDefinition => {
    const existing = byId.get(definition.id);
    if (existing) {
      if (contract(existing) !== contract(definition)) throw new Error(`Incompatible property definition: ${definition.id}`);
      return existing;
    }
    if (!definition.id || !definition.label) throw new Error("Properties need stable IDs and labels.");
    if (definition.kind === "number" && (!Number.isFinite(definition.min) || !Number.isFinite(definition.max) ||
      definition.min! > definition.max! || !(definition.step! > 0))) throw new Error(`Invalid numeric property: ${definition.id}`);
    if (definition.channelOf && !byId.has(definition.channelOf)) throw new Error(`Unknown base property: ${definition.channelOf}`);
    if (validateValue(definition, definition.initial) !== definition.initial) throw new Error(`Invalid initial value: ${definition.id}`);
    if (definition.neutral !== undefined && validateValue(definition, definition.neutral) !== definition.neutral)
      throw new Error(`Invalid neutral value: ${definition.id}`);
    if (definition.previewActivation) {
      const activation = definition.previewActivation, prerequisite = byId.get(activation.property);
      if (!prerequisite || validateValue(prerequisite, activation.inactive) !== activation.inactive || validateValue(prerequisite, activation.active) !== activation.active)
        throw new Error(`Invalid property preview activation: ${definition.id}`);
    }
    const next = structuredClone(definition);
    next.category ??= { id: "general", label: "General" };
    category(next.category);
    definitions.push(next); byId.set(next.id, next); return next;
  };
  const couple = (definition: ConsumerDefinition): CoupledConsumer => {
    if (!definition.label || !definition.owner) throw new Error("Consumers need a label and a state owner.");
    const path = new Set([definition.id]);
    for (const group of definition.group) {
      if (!group.id || !group.label || path.has(group.id)) throw new Error(`Invalid consumer group: ${definition.id}/${group.id}`);
      path.add(group.id);
    }
    if (!definition.id || consumers.some(consumer => consumer.id === definition.id)) throw new Error(`Duplicate consumer: ${definition.id}`);
    // Stage discovery, so a failed declaration cannot partially publish a consumer/category/property.
    const staged = createPropertyRegistry(); definitions.forEach(staged.define);
    const uses = definition.properties.map(use => ({ ...use,
      definition: typeof use.property === "string" ? staged.property(use.property) : staged.define(use.property) }));
    const channels: Record<string, string> = {}, defaults: Record<string, PropertyValue> = {}, choices: Record<string, readonly string[]> = {};
    for (const use of uses) {
      const property = use.definition;
      if (!property) throw new Error(`Unknown property on ${definition.id}: ${String(use.property)}`);
      if (channels[property.id]) throw new Error(`Repeated coupling: ${definition.id}/${property.id}`);
      channels[property.id] = property.id;
      const initial = use.initial ?? property.initial;
      if (validateValue(property, initial) !== initial) throw new Error(`Invalid consumer default: ${definition.id}/${property.id}`);
      if (use.choices && (property.kind !== "select" || !use.choices.length || use.choices.some(choice => !property.options?.some(option => option.id === choice)) || !use.choices.includes(String(initial))))
        throw new Error(`Invalid consumer choices: ${definition.id}/${property.id}`);
      defaults[property.id] = initial;
      if (use.choices) choices[property.id] = [...use.choices];
    }
    if (!uses.length) throw new Error(`Consumer has no couplings: ${definition.id}`);
    for (const use of uses) {
      const property = use.definition!;
      if (property.channelOf && !channels[property.channelOf]) {
        channels[property.channelOf] = property.id;
        defaults[property.channelOf] = defaults[property.id];
      }
    }
    if (definition.previewActivation) {
      const { property, inactive, active } = definition.previewActivation;
      const channel = channels[property], spec = staged.property(channel);
      if (!spec || validateValue(spec, inactive) !== inactive || validateValue(spec, active) !== active ||
        (choices[channel] && [inactive, active].some(value => !choices[channel].includes(String(value)))))
        throw new Error(`Invalid preview activation: ${definition.id}/${property}`);
    }
    staged.definitions.forEach(define);
    const consumer = { ...definition, group: structuredClone(definition.group), properties: Object.keys(channels), channels, defaults, choices };
    consumers.push(consumer); return consumer;
  };
  return { get definitions(): readonly PropertyDefinition[] { return definitions; },
    get consumers(): readonly CoupledConsumer[] { return consumers; },
    get categories(): readonly Category[] { return categories; }, define, couple, property: (id: string) => byId.get(id),
    consumer: (id: string) => consumers.find(consumer => consumer.id === id) };
}
export type PropertyRegistry = ReturnType<typeof createPropertyRegistry>;
export type PropertyChange = { consumer: string; property: string; value: PropertyValue };
/** One setter prepares targeted writes; values remain in their existing state owners. */
export function preparePropertyChanges(registry: PropertyRegistry, property: string, raw: unknown, selected: readonly string[]): PropertyChange[] {
  const definition = registry.property(property);
  const value = definition && validateValue(definition, raw);
  if (value === undefined) throw new Error(`Invalid property value: ${property}`);
  return [...new Set(selected)].map(id => {
    const consumer = registry.consumer(id), channel = consumer?.channels[property];
    if (!consumer || !channel) throw new Error(`Consumer is not coupled: ${id}/${property}`);
    const choices = consumer.choices[channel];
    if (choices && !choices.includes(String(value))) throw new Error(`Unsupported consumer choice: ${id}/${property}/${value}`);
    return { consumer: id, property: channel, value };
  });
}

/** Renderers read declared channels through the same coupling graph as setters. */
export function resolveConsumerValues(registry: PropertyRegistry, id: string, read: (property: string) => PropertyValue) {
  const consumer = registry.consumer(id);
  if (!consumer) throw new Error(`Unregistered property consumer: ${id}`);
  return Object.fromEntries(Object.entries(consumer.channels).map(([property, channel]) => [property, read(channel)]));
}

export type StatePropertyAdapters<State> = Record<string, {
  channels: Record<string, { read: (state: State) => PropertyValue; write: (state: State, value: PropertyValue) => State }>;
}>;
/** The same binding/setter path works for any state owner, without a global value pool. */
export function bindStateProperties<State>(registry: PropertyRegistry, owner: string, state: State,
  adapters: StatePropertyAdapters<State>, update: (change: (state: State) => State) => void) {
  const values: Record<string, Record<string, PropertyValue>> = {};
  for (const consumer of registry.consumers.filter(consumer => consumer.owner === owner)) {
    values[consumer.id] = {};
    for (const channel of new Set(Object.values(consumer.channels))) {
      const adapter = adapters[consumer.id]?.channels[channel];
      if (!adapter || typeof adapter.read !== "function" || typeof adapter.write !== "function")
        throw new Error(`Missing state adapter: ${consumer.id}/${channel}`);
      Object.defineProperty(values[consumer.id], channel, { enumerable: true, get: () => functionInputValue(consumer.id, channel, () => adapter.read(state)) });
    }
  }
  return { values, commit: (changes: PropertyChange[]) => {
    const writes = changes.map(change => {
      const consumer = registry.consumer(change.consumer), property = registry.property(change.property);
      const adapter = adapters[change.consumer]?.channels[change.property];
      if (!consumer || consumer.owner !== owner || !consumer.channels[change.property] || !adapter || !property ||
        validateValue(property, change.value) !== change.value ||
        (consumer.choices[change.property] && !consumer.choices[change.property].includes(String(change.value))))
        throw new Error(`Invalid state coupling write: ${change.consumer}/${change.property}`);
      return { adapter, value: change.value };
    });
    if (writes.length) update(current => writes.reduce((next, write) => write.adapter.write(next, write.value), current));
  } };
}

/** Logical objects/devices use the same consumer/group identities as the hierarchy. */
export function resolvePropertyTarget(registry: PropertyRegistry, id: string) {
  const exact = registry.consumer(id);
  if (exact) return { id, label: exact.label, consumers: [exact.id] };
  const consumers = registry.consumers.filter(consumer => consumer.group.some(group => group.id === id));
  const labels = new Set(consumers.flatMap(consumer => consumer.group.filter(group => group.id === id).map(group => group.label)));
  if (!consumers.length || labels.size !== 1) throw new Error(`Unknown or ambiguous property target: ${id}`);
  return { id, label: [...labels][0], consumers: consumers.map(consumer => consumer.id) };
}

export type SelfInventoryNode = { id: string; label: string; consumers: string[]; children: SelfInventoryNode[] };
/** Self is metadata on the existing coupling path, not another target registry.
 * Descendants and future consumers appear automatically after coupling. */
export function selfInventory(registry: PropertyRegistry, visible: (consumer: CoupledConsumer) => boolean = () => true): SelfInventoryNode[] {
  const roots: SelfInventoryNode[] = [];
  for (const consumer of registry.consumers.filter(visible)) {
    const start = consumer.group.findIndex(group => group.self);
    if (start < 0) continue;
    let siblings = roots;
    for (const entry of [...consumer.group.slice(start), consumer]) {
      let node = siblings.find(node => node.id === entry.id);
      if (!node) { node = { id: entry.id, label: entry.label, consumers: [], children: [] }; siblings.push(node); }
      if (!node.consumers.includes(consumer.id)) node.consumers.push(consumer.id);
      siblings = node.children;
    }
  }
  return roots;
}
