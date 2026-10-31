import {useCallback,useRef,useContext,type RefObject} from 'react';
import {confirmValue} from './valueConfirmation';
import {useContextNavigation,ContextValueCompletion} from './ContextStage';
/** Pointer selection and MC Enter execute the same current candidate/owner write.
 * The consumer supplies its prepared candidate; this never derives DOF values. */
export function useValueConfirmation<T>({owner,candidate,onCommit,disabled=false,keyboard=true,selection='accumulate'}:{owner:RefObject<HTMLElement|null>;candidate:()=>T|undefined;onCommit:(value:T)=>void;disabled?:boolean;keyboard?:boolean;selection?:'single'|'accumulate'}){
 const current=useRef({candidate,onCommit,disabled});current.current={candidate,onCommit,disabled};
 const complete=useContext(ContextValueCompletion),lifecycle=useRef({complete,selection});lifecycle.current={complete,selection};
 const accept=useCallback((picked?:T)=>confirmValue(current.current,picked),[]);
 const confirm=useCallback((picked?:T)=>{const {complete,selection}=lifecycle.current;return selection==='single'&&complete?complete(()=>accept(picked)):accept(picked);},[accept]);
 useContextNavigation({owner,confirm:disabled||!keyboard?undefined:()=>accept()});
 return confirm;
}
