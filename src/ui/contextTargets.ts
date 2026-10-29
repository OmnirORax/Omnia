import { createTransientStore } from './transientStore.ts';
import type { ReactNode } from 'react';
export type CommandDegree={id:string;label:string;symbol?:string;value?:string|number|boolean;run:()=>void};
export type TargetCommand={run?:()=>void;degrees?:readonly CommandDegree[];configuration?:ReactNode;available?:boolean};
export type ContextTarget={id:string;label:string;commands:Readonly<Record<string,TargetCommand>>};
type TargetSource={owner:string;element:()=>Element|null;read:()=>readonly ContextTarget[]};
/** Adapters describe supported commands; command identity, shortcuts and MC stay shared. */
export function createContextTargets(){
  const sources=new Map<symbol,TargetSource>(),changes=createTransientStore(0);
  let active:symbol|null=null,intermediate=false;
  const choice=createTransientStore<{action:string;target:string;label:string;degrees:readonly CommandDegree[]}|null>(null);
  const refresh=()=>changes.set(changes.getSnapshot()+1);
  const targets=()=>active?sources.get(active)?.read()??[]:[];
  const resolve=(id:string)=>targets().flatMap(target=>{const command=target.commands[id];return command&&command.available!==false&&(command.run||command.degrees?.length)?[{target,command}]:[];})[0];
  return {
    subscribe:changes.subscribe,getSnapshot:changes.getSnapshot,refresh,targets,resolve,
    choice,
    choose:(id:string)=>{const request=choice.getSnapshot();choice.set(null);if(!request)return false;const found=resolve(request.action);if(found?.target.id!==request.target)return false;const degree=found.command.degrees?.find(candidate=>candidate.id===id);if(!degree)return false;degree.run();return true;},
    setIntermediate:(value:boolean)=>{if(intermediate!==value){intermediate=value;refresh();}},
    owns:()=>!!active&&sources.has(active),
    isSource:(element:Element|null)=>!!active&&sources.get(active)?.element()===element,
    clear:()=>{active=null;choice.set(null);refresh();},
    active:()=>targets().length>0,
    override:(id:string)=>targets().length>0&&!(intermediate&&(id==='context.back'||id==='context.close')),
    available:(id:string)=>!!resolve(id),
    invoke:(id:string)=>{const found=resolve(id);if(!found)return false;const degrees=found.command.degrees;if(degrees&&degrees.length>1){choice.set({action:id,target:found.target.id,label:found.target.label,degrees});return true;}if(degrees?.length===1)degrees[0].run();else found.command.run?.();return true;},
    context:(owner:string|undefined,element?:Element|null,isIntermediate=false)=>{
      intermediate=isIntermediate;
      if(isIntermediate)return;
      const next=[...sources].find(([,source])=>source.owner===owner&&!!element&&source.element()?.contains(element))?.[0]??null;
      if(next!==active){active=next;choice.set(null);refresh();}
    },
    register:(source:TargetSource)=>{
      const token=Symbol(source.owner);sources.set(token,source);
      return {activate:()=>{if(active!==token){active=token;choice.set(null);refresh();}},refresh,dispose:()=>{sources.delete(token);if(active===token){active=null;choice.set(null);refresh();}}};
    },
  };
}
export const contextTargets=createContextTargets();
