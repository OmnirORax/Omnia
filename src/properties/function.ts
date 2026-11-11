import { property, type Property, type Value } from './pool.ts';
export type FunctionInput<State> = { definition: Omit<Property, 'key'> & { id: string; initial: Value; category?: { id: string; label: string }; integer?: boolean }; read: (state: State) => Value; write: (state: State, value: Value) => State };
export function defineFunction<State>(definition: { id: string; label: string; owner: string; group: { id: string; label: string }[]; controls: string[]; inputs: Record<string, FunctionInput<State>> }) {
  for (const input of Object.values(definition.inputs)) property({ ...input.definition, key: input.definition.id });
  return definition;
}
