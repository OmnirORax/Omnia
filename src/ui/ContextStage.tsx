import { createContext, useContext, useLayoutEffect, useState, useCallback, useRef } from 'react';
import type {ContextNavigation} from './contextNavigation';
export type {ContextNavigation} from './contextNavigation';
import { cursorPosition } from './cursorPosition';
import { uiPointerHeld } from './pointerOwnership';
/** Shared editors announce logical stage changes, never value/hover updates. */
export const ContextStage=createContext<(()=>void)|null>(null);
export function useContextStage(identity:string){
  const open=useContext(ContextStage);
  useLayoutEffect(()=>{open?.();},[open,identity]);
}
/** Freeze the invocation point until another child/stage opens. No pointer listeners. */
export function usePopupAnchor(position:{x:number;y:number}|null,identity?:string|number){
  const key=position?`${position.x}:${position.y}`:'closed';
  const [stage,setStage]=useState<{key:string;point:{x:number;y:number}}>();
  const previous=useRef(identity);
  const nextStage=useCallback(()=>{
    if(uiPointerHeld())return;
    const point=cursorPosition();setStage(old=>old?.key===key&&old.point.x===point.x&&old.point.y===point.y?old:{key,point});
  },[key]);
  useLayoutEffect(()=>{if(!position)setStage(undefined);},[!!position]);
  useLayoutEffect(()=>{if(previous.current!==identity&&position)nextStage();previous.current=identity;},[identity,!!position,nextStage]);
  return {anchor:stage?.key===key?stage.point:position,nextStage};
}

export const ContextNavigationRegistry=createContext<((navigation:ContextNavigation)=>()=>void)|null>(null);
/** Nested editors lend navigation to the shared popup/MC instead of rendering copies. */
export function useContextNavigation(navigation:ContextNavigation){
 const register=useContext(ContextNavigationRegistry),latest=useRef(navigation);latest.current=navigation;
 useLayoutEffect(()=>register?.({owner:navigation.owner,cancel:navigation.cancel?()=>latest.current.cancel?.():undefined,back:navigation.back?()=>latest.current.back?.():undefined,advance:navigation.advance?()=>latest.current.advance?.():undefined,confirm:navigation.confirm?()=>latest.current.confirm?.():undefined}),[register,navigation.owner,!!navigation.cancel,!!navigation.back,!!navigation.advance,!!navigation.confirm]);
 return !!register;
}
