import { createContext, useContext, useLayoutEffect, useState, useCallback, useRef } from 'react';
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
