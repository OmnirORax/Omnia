import {universalHistory} from '../core/universalHistory.ts';
import type {ActionHistory} from '../composer/runtime/ui/actionHistory.ts';
import {sameValue} from '../core/equality.ts';
import {viewHistory} from './viewHistory.ts';
/** Popup state is data; subscriptions and DOM belong only to mounted controls. */
export function createNavigationState(history:ActionHistory,activeScopes:()=>string[]=()=>[]){
 let values:Record<string,unknown>={},pruneQueued=false;
 const listeners=new Map<string,Set<()=>void>>();
 const notify=(key:string)=>{for(const listener of listeners.get(key)??[])listener();};
 history.register('ui.details',{read:()=>values,write:(next:Record<string,unknown>)=>{const before=values;values=next;for(const key of listeners.keys())if(!sameValue(before[key],next[key]))notify(key);}});
 const prune=()=>{pruneQueued=false;const keys=new Set<string>(),scopes=new Set<string>(activeScopes());
  const inspectValue=(value:unknown)=>{if(!value||typeof value!=='object')return;if('instance'in value&&typeof value.instance==='number'){scopes.add(`menu:${value.instance}`);scopes.add(`window:${value.instance}`);}for(const child of Object.values(value))if(child&&typeof child==='object')inspectValue(child);};
  type Entry=ReturnType<ActionHistory['candidates']>[number];
  const inspect=(entry:Entry)=>{if(entry.changes){for(const child of entry.changes)inspect(child);return;}if(entry.owner==='ui.details')for(const patch of entry.patches)keys.add(patch.path[0]);
   if(entry.owner==='ui.views')for(const patch of entry.patches){inspectValue(patch.before);inspectValue(patch.after);if(patch.path.at(-1)==='instance')for(const id of [patch.before,patch.after])if(typeof id==='number'){scopes.add(`menu:${id}`);scopes.add(`window:${id}`);}}
  };
  const options={...history.options,mode:'recent' as const};for(const entry of [...history.candidates('undo',options),...history.candidates('redo',options)])inspect(entry);
  const next={...values};let changed=false;for(const key of Object.keys(next)){const scope=key.split('/')[0];if(!listeners.has(key)&&!keys.has(key)&&!scopes.has(scope)){delete next[key];changed=true;}}if(changed)values=next;
 };
 const requestPrune=()=>{if(!pruneQueued){pruneQueued=true;queueMicrotask(prune);}};
 return {
  read<T>(key:string,initial:T):T{if(!Object.hasOwn(values,key))values={...values,[key]:initial};return values[key] as T;},
  set<T>(key:string,value:T,record=true){const before=values;if(sameValue(before[key],value))return;values={...values,[key]:value};if(record)history.record('ui.details',before,values,['ui'],['omnium',key.split('/')[0]]);notify(key);},
  subscribe(key:string,listener:()=>void){const set=listeners.get(key)??new Set();set.add(listener);listeners.set(key,set);requestPrune();return()=>{set.delete(listener);if(!set.size)listeners.delete(key);requestPrune();};},
 };
}
export const navigationState=createNavigationState(universalHistory,()=>[...(viewHistory.state.menu?[`menu:${viewHistory.state.menu.instance}`]:[]),...Object.values(viewHistory.state.windows).map(spec=>`window:${spec.instance}`)]);
