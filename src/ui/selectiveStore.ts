/** A subscription projection of committed owner state, never a second editor. */
export const sameSlice=(a:readonly unknown[],b:readonly unknown[])=>a.length===b.length&&a.every((value,i)=>Object.is(value,b[i]));
export function createSelectiveStore<T extends object>(initial:T){
  let value=initial;const listeners=new Set<()=>void>();
  const getSnapshot=()=>value;
  const live=new Proxy({} as T,{
    get:(_target,key)=>Reflect.get(value,key),has:(_target,key)=>Reflect.has(value,key),
    ownKeys:()=>Reflect.ownKeys(value),
    getOwnPropertyDescriptor:(_target,key)=>{const descriptor=Reflect.getOwnPropertyDescriptor(value,key);return descriptor?{...descriptor,configurable:true}:undefined;},
  });
  return {getSnapshot,live,subscribe:(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};},publish(next:T){if(value===next)return;value=next;for(const notify of listeners)notify();}};
}
