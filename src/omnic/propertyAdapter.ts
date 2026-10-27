import { useLayoutEffect, useRef } from "react";
import { PROPERTY_REGISTRY } from "../appearance/registry.ts";
import { bindStateProperties, type PropertyValue, type StatePropertyAdapters } from "../properties/registry.ts";
import type { PropertyBindings } from "../properties/CoupledProperties.tsx";
import { installContextBindings } from "../properties/contextBindings.ts";
import omnicFunction, { OMNIC_CONSUMER, type OmnicParameterState } from "./omnic.function.ts";
import type { Parameter } from "./registry.ts";
export const OMNIC_PROPERTY_ADAPTERS: StatePropertyAdapters<OmnicParameterState> = {
  [OMNIC_CONSUMER]:{channels:Object.fromEntries(Object.entries(omnicFunction.inputs).map(([property,input])=>[property,{read:input.read!,write:input.write!}]))},
};
export function commitOmnicParameter(params:Record<string,PropertyValue>, parameter:Parameter, value:PropertyValue) {
  const input = omnicFunction.inputs[parameter.property];
  if (!input?.write) throw Error(`Unregistered Omnic input: ${parameter.property}`);
  return input.write({params,parameters:[parameter]},value).params;
}
export function omnicPropertyBindings(params:Record<string,PropertyValue>, onChange:(params:Record<string,PropertyValue>)=>void, parameters:readonly Parameter[]):PropertyBindings {
  const state={params,parameters};
  const bound=bindStateProperties(PROPERTY_REGISTRY,"omnic",state,OMNIC_PROPERTY_ADAPTERS,change=>{
    const next=change(state);if(next.params!==params)onChange(next.params);
  });
  // Current scope capabilities, rather than every possible future operator field.
  const active = Object.fromEntries([...new Set(parameters.map(parameter=>parameter.property))].map(property=>[property, Object.getOwnPropertyDescriptor(bound.values[OMNIC_CONSUMER],property)!]));
  const values = Object.defineProperties({},active) as Record<string,PropertyValue>;
  return {values:{[OMNIC_CONSUMER]:values},
    limits:{[OMNIC_CONSUMER]:Object.fromEntries(parameters.filter(p=>p.kind==="number").map(p=>[p.property,{min:p.min!,max:p.max!}]))},commit:bound.commit};
}
/** The composer owns params. MC subscribes to lent adapters; it never causes an
 * application-wide state render or introduces a second mutable parameter pool. */
export function useOmnicParameterBindings(params:Record<string,PropertyValue>, onChange:(params:Record<string,PropertyValue>)=>void, parameters:readonly Parameter[]) {
  const change=useRef(onChange);change.current=onChange;
  const session=useRef<ReturnType<typeof installContextBindings>|null>(null);
  useLayoutEffect(()=>{
    if(!parameters.length)return;
    const binding=omnicPropertyBindings(params,next=>change.current(next),parameters);
    if(session.current)session.current.update(binding);else session.current=installContextBindings(binding);
  },[params,parameters]);
  useLayoutEffect(()=>()=>{session.current?.dispose();session.current=null;},[]);
  useLayoutEffect(()=>{if(!parameters.length){session.current?.dispose();session.current=null;}},[parameters.length]);
}
