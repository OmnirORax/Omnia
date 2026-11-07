import {useLayoutEffect,useRef,type RefObject} from 'react';
import {selectionSurfaces,type SelectionSurface} from './selectionSurfaces';
export function useSelectionSurface(element:RefObject<HTMLElement|null>,adapter:Omit<SelectionSurface,'element'>){
  const current=useRef(adapter);current.current=adapter;
  useLayoutEffect(()=>selectionSurfaces.register({element:()=>element.current,context:()=>current.current.context?.()??'',baseline:adapter.baseline?{enabled:()=>current.current.baseline?.enabled()??false,pick:(elements,point,intent)=>current.current.baseline?.pick(elements,point,intent),cancel:()=>current.current.baseline?.cancel()}:undefined,nativePicking:adapter.nativePicking,nativeWheel:adapter.nativeWheel,onStart:()=>current.current.onStart?.(),onComplete:(ids,point)=>current.current.onComplete?.(ids,point),snapshot:()=>current.current.snapshot(),elements:adapter.elements?ids=>current.current.elements!(ids):undefined,apply:ids=>current.current.apply(ids)}),[element]);
}
