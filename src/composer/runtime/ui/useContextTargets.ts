import { useContext, useLayoutEffect, useRef, type RefObject } from 'react';
import { UIContainerContext, useUITracked } from './context';
import { contextTargets, type ContextTarget } from './contextTargets';
import { activateFrameContext } from './ActiveContext';
/** One registration per editing surface. Pointer motion never discovers targets. */
export function useContextTargets(element:RefObject<HTMLElement|null>,read:()=>readonly ContextTarget[],signature:string){
  const owner=useContext(UIContainerContext),ui=useUITracked(()=>[]),current=useRef(read);current.current=read;
  const adapter=useRef<ReturnType<typeof contextTargets.register>|null>(null);
  useLayoutEffect(()=>{
    if(!owner)return;
    adapter.current=contextTargets.register({owner,element:()=>element.current,read:()=>current.current()});
    return()=>{adapter.current?.dispose();adapter.current=null;};
  },[owner,element]);
  useLayoutEffect(()=>{adapter.current?.refresh();},[signature]);
  return ()=>{if(owner){activateFrameContext(ui,owner);adapter.current?.activate();}};
}
