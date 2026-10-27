import { useSyncExternalStore } from "react";
import type { PropertyBindings } from "./CoupledProperties";
import type { PropertyChange } from "./registry";

/** Active state owners lend their existing bindings to MC. This registry stores
 * only adapters/references; durable values stay in the owning document/draft. */
const sessions = new Map<symbol,PropertyBindings>(), listeners = new Set<() => void>();
let version = 0;
const publish = () => { version++; for(const listener of listeners) listener(); };
const subscribe = (listener:()=>void) => {listeners.add(listener);return ()=>{listeners.delete(listener);};};
const snapshot = () => version;
export function installContextBindings(binding: PropertyBindings) {
  const token = Symbol(); sessions.set(token,binding);publish();
  return {
    update(next:PropertyBindings) { if(!sessions.has(token) || sessions.get(token)===next)return;sessions.set(token,next);publish(); },
    dispose() {if(sessions.delete(token))publish();},
  };
}
export function contextPropertyBindings(base:PropertyBindings):PropertyBindings {
  const active=[...sessions.values()];
  if(!active.length)return base;
  return {values:Object.assign({},base.values,...active.map(binding=>binding.values)),limits:Object.assign({},base.limits,...active.map(binding=>binding.limits)),commit:(changes:PropertyChange[])=>{
    const writes=new Map<PropertyBindings,PropertyChange[]>();
    for(const change of changes){const binding=[...active].reverse().find(binding=>Object.hasOwn(binding.values,change.consumer)) ?? base;
      const entries=writes.get(binding) ?? [];entries.push(change);writes.set(binding,entries);}
    for(const [binding,entries]of writes)binding.commit(entries);
  }};
}

export function useContextPropertyBindings(base:PropertyBindings):PropertyBindings {
  useSyncExternalStore(subscribe,snapshot,snapshot);
  return contextPropertyBindings(base);
}
