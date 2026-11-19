export type DialField='direct'|'value'|'min'|'max'|'amount';
export type DialSelection<T>={owner:string;source:T;field:DialField;target:'value'|'snap';initialCount?:number;generation:number};
/** One live surface. Retargeting restores its old preview before publishing the new owner. */
export function createDialReferenceController<T>(){
 const sources=new Map<string,T>(),listeners=new Set<()=>void>();let state:{host?:string;selection?:DialSelection<T>}={},generation=0,cancel:(()=>void)|undefined;
 const publish=(next:typeof state)=>{state=next;listeners.forEach(fn=>fn());};
 const restore=()=>{const previous=cancel;cancel=undefined;previous?.();};
 const select=(owner:string,field:DialField='direct',target:'value'|'snap'='value',initialCount?:number)=>{const source=sources.get(owner);if(!source)return;if(state.selection?.owner===owner&&state.selection.field===field){publish({...state,selection:{...state.selection,target,initialCount}});return;}restore();publish({host:state.host??owner,selection:{owner,source,field,target,initialCount,generation:++generation}});};
 return {subscribe:(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn);};},snapshot:()=>state,select,
  register(owner:string,source:T){sources.set(owner,source);select(owner);return()=>{sources.delete(owner);const owns=state.selection?.owner===owner;if(owns)restore();const host=state.host===owner?sources.keys().next().value:state.host;if(!sources.size){publish({});return;}if(owns){const next=host!;publish({host,selection:{owner:next,source:sources.get(next)!,field:'direct',target:'value',generation:++generation}});}else publish({...state,host});};},
  attachCancel(owner:string,field:DialField,fn:()=>void){if(state.selection?.owner!==owner||state.selection.field!==field)return()=>{};cancel=fn;return()=>{if(cancel===fn)cancel=undefined;};},
  refresh(owner:string){if(state.selection?.owner===owner)publish({...state});},
 };
}
