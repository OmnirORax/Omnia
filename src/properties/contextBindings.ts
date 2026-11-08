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
  const owners=new Set<PropertyBindings>();
  const dispatch=(changes:PropertyChange[],temporary:boolean)=>{
    const writes=new Map<PropertyBindings,PropertyChange[]>();
    for(const change of changes){const binding=[...active].reverse().find(binding=>Object.hasOwn(binding.values,change.consumer)) ?? base;
      const entries=writes.get(binding) ?? [];entries.push(change);writes.set(binding,entries);}
    if(temporary){for(const owner of owners)if(!writes.has(owner))owner.preview?.(null);owners.clear();}
    for(const [binding,entries]of writes){if(temporary){owners.add(binding);binding.preview?.(entries);}else binding.commit(entries);}
  };
  return {values:Object.assign({},base.values,...active.map(binding=>binding.values)),limits:Object.assign({},base.limits,...active.map(binding=>binding.limits)),commit:(changes:PropertyChange[])=>dispatch(changes,false),preview:changes=>{
    if(changes===null){for(const owner of owners)owner.preview?.(null);owners.clear();}else dispatch(changes,true);
  }};
}

export function useContextPropertyBindings(base:PropertyBindings):PropertyBindings {
  useSyncExternalStore(subscribe,snapshot,snapshot);
  return contextPropertyBindings(base);
}
