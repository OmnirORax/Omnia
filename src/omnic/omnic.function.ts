import { defineFunction } from "../properties/function.ts";
import { PROPERTY_REGISTRY } from "../properties/catalog.ts";
import type { PropertyDefinition, PropertyValue } from "../properties/registry.ts";
import { GENERATORS, OPERATORS, type Parameter } from "./registry.ts";

export const OMNIC_CONSUMER = "omnic.composer";
export type OmnicParameterState = { params: Record<string, PropertyValue>; parameters: readonly Parameter[] };
/** Registry metadata is the single input declaration for evaluation and editing.
 * Aliases (e.g. size/length or x/pivotX) share a property but keep their own active
 * parameter key and narrower domain. No independent settings values are created. */
const parameters = [...GENERATORS, ...OPERATORS].flatMap(definition => definition.parameters);
const families = new Map<string, Parameter[]>();
for (const parameter of parameters) families.set(parameter.property, [...(families.get(parameter.property) ?? []), parameter]);
const labels: Record<string,string> = {
  "omnic.extent":"Geometric extent", "omnic.coordinate.x":"Procedural X", "omnic.coordinate.y":"Procedural Y", "omnic.angle":"Angle / phase",
};
export const OMNIC_PARAMETERS: readonly Parameter[] = [...families.values()].map(group => group[0]);
export function activeParameter(state: OmnicParameterState, property: string) {
  return state.parameters.find(parameter => parameter.property === property) ?? families.get(property)?.[0];
}
export function checkedParameter(parameter: Parameter, input: PropertyValue): PropertyValue {
  const spec = PROPERTY_REGISTRY.property(parameter.property);
  if (parameter.kind === "number") {
    if (typeof input !== "number" || !Number.isFinite(input)) throw Error(`Expected a finite ${parameter.label}.`);
    let value = Math.max(parameter.min ?? spec?.min ?? -Infinity, Math.min(parameter.max ?? spec?.max ?? Infinity, input));
    if (parameter.property === "omnic.count") value = Math.round(value);
    return value;
  }
  if (parameter.kind === "toggle" && typeof input !== "boolean") throw Error(`Expected boolean ${parameter.label}.`);
  if (parameter.kind === "color" && (typeof input !== "string" || !/^#[\da-f]{6}$/i.test(input))) throw Error(`Expected RGB ${parameter.label}.`);
  if (parameter.kind === "select" && !parameter.options?.some(option => option.id === input)) throw Error(`Unsupported ${parameter.label}.`);
  if (parameter.kind === "text" && (typeof input !== "string" || input.length > 200)) throw Error(`Invalid ${parameter.label}.`);
  return input;
}
const inputs = Object.fromEntries([...families].map(([property, group]) => {
  const first = group[0];
  const definition: PropertyDefinition | undefined = PROPERTY_REGISTRY.property(property) ? undefined : {
    id:property, label:labels[property] ?? first.label, kind:first.kind, initial:first.initial,
    category:{id:"omnic",label:"Omnic structure"},
    ...(first.kind === "number" ? {min:Math.min(...group.map(p=>p.min!)),max:Math.max(...group.map(p=>p.max!)),step:Math.min(...group.map(p=>p.step ?? 1))} : {}),
    ...(first.options ? {options:first.options} : {}),
    ...(first.kind === "text" ? {maxLength:200} : {}),
  };
  return [property, { ...(definition ? {definition} : {}), initial:first.initial,
    read:(state:OmnicParameterState) => { const parameter=activeParameter(state,property)!; return state.params[parameter.key] ?? parameter.initial; },
    write:(state:OmnicParameterState,value:PropertyValue) => {
      const parameter=activeParameter(state,property)!;
      // A contextual consumer exposes only its active generator/operator inputs.
      if (!state.parameters.some(p=>p.property===property)) return state;
      const next=checkedParameter(parameter,value);
      return state.params[parameter.key] === next ? state : {...state,params:{...state.params,[parameter.key]:next}};
    },
  }];
}));
export default defineFunction<OmnicParameterState>({id:OMNIC_CONSUMER,label:"Active Omnic component / operator",owner:"omnic",
  group:[{id:"omnic",label:"Omnic structure"}],inputs});
