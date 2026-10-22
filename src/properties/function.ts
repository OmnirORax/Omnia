import { PROPERTY_REGISTRY } from "./catalog.ts";
import { resolveConsumerValues, type ConsumerDefinition, type PropertyDefinition, type PropertyValue } from "./registry.ts";

type Input<State> = {
  initial?: PropertyValue; choices?: readonly string[]; definition?: PropertyDefinition;
  read?: (state: State) => PropertyValue; write?: (state: State, value: PropertyValue) => State;
};
/** A function's real inputs are the discovery source, not a second central consumer list. */
export function defineFunction<State = Record<string, PropertyValue>>(
  definition: Omit<ConsumerDefinition, "properties"> & { inputs: Record<string, Input<State>> },
) {
  const { inputs, ...identity } = definition;
  const definitions: PropertyDefinition[] = [];
  for (const [id, input] of Object.entries(inputs)) {
    if (identity.owner !== "appearance" && (!input.read || !input.write))
      throw new Error(`Function input needs its state adapter: ${identity.id}/${id}`);
    if (input.definition) {
      if (input.definition.id !== id) throw new Error(`Input identity mismatch: ${identity.id}/${id}`);
      definitions.push(input.definition);
    }
  }
  return { inputs, definitions,
    get consumer() {
      const consumer = PROPERTY_REGISTRY.consumer(identity.id);
      if (!consumer) throw new Error(`Function has not been discovered: ${identity.id}`);
      return consumer;
    },
    couple: () => PROPERTY_REGISTRY.couple({ ...identity, properties: Object.entries(inputs).map(([id, input]) =>
      ({ property: id, initial: input.initial, choices: input.choices })) }),
    readInputs: (read: (property: string) => PropertyValue) => resolveConsumerValues(PROPERTY_REGISTRY, identity.id, read),
  };
}
/** Definitions are discovered before coupling, independent of file/import order. */
export function initializeFunctions(functions: readonly { definitions: PropertyDefinition[]; couple: () => unknown }[]) {
  const pending = functions.flatMap(fn => fn.definitions);
  while (pending.length) {
    const ready = pending.findIndex(property => (!property.channelOf || PROPERTY_REGISTRY.property(property.channelOf)) && (!property.previewActivation || PROPERTY_REGISTRY.property(property.previewActivation.property)));
    if (ready < 0) throw new Error(`Unresolved property channel dependencies: ${pending.map(property => property.id).join(", ")}`);
    PROPERTY_REGISTRY.define(pending.splice(ready, 1)[0]);
  }
  functions.forEach(fn => fn.couple());
}
