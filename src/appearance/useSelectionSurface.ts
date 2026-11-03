import {useLayoutEffect,useRef,type RefObject} from 'react';
import {selectionSurfaces,type SelectionSurface} from './selectionSurfaces';
export function useSelectionSurface(element:RefObject<HTMLElement|null>,adapter:Omit<SelectionSurface,'element'>){
  const current=useRef(adapter);current.current=adapter;
  useLayoutEffect(()=>selectionSurfaces.register({element:()=>element.current,context:()=>current.current.context?.()??'',nativePicking:adapter.nativePicking,onStart:()=>current.current.onStart?.(),onComplete:(ids,point)=>current.current.onComplete?.(ids,point),snapshot:()=>current.current.snapshot(),elements:adapter.elements?ids=>current.current.elements!(ids):undefined,apply:ids=>current.current.apply(ids)}),[element]);
}
