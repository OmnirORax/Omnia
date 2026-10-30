import {useCallback,useRef,type RefObject} from 'react';
import {confirmValue} from './valueConfirmation';
import {useContextNavigation} from './ContextStage';
/** Pointer selection and MC Enter execute the same current candidate/owner write.
 * The consumer supplies its prepared candidate; this never derives DOF values. */
export function useValueConfirmation<T>({owner,candidate,onCommit,disabled=false}:{owner:RefObject<HTMLElement|null>;candidate:()=>T|undefined;onCommit:(value:T)=>void;disabled?:boolean}){
 const current=useRef({candidate,onCommit,disabled});current.current={candidate,onCommit,disabled};
 const confirm=useCallback((picked?:T)=>confirmValue(current.current,picked),[]);
 useContextNavigation({owner,confirm:disabled?undefined:()=>confirm()});
 return confirm;
}
