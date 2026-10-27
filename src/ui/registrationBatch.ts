/** Coalesce registration metadata, not user actions or editor state commits. */
export function createRegistrationBatch<T>(publish:(values:Record<string,T>)=>void,schedule:(flush:()=>void)=>void=queueMicrotask){
  const pending=new Map<string,T>();let queued=false;
  return (id:string,value:T)=>{
    pending.set(id,value);if(queued)return;queued=true;
    schedule(()=>{queued=false;const values=Object.fromEntries(pending);pending.clear();publish(values);});
  };
}
