import {useCallback,useRef,useState} from 'react';
import {nextWindowLayer,raiseWindowLayer} from './layers';
/** Current transient stacking position; repeated activation does not rerender. */
export function useWindowLayer(){
  const [layer,setLayer]=useState(nextWindowLayer),current=useRef(layer);
  const raise=useCallback(()=>{
    const next=raiseWindowLayer(current.current);
    if(next===current.current)return;
    current.current=next;setLayer(next);
  },[]);
  return [layer,raise] as const;
}
