import {createContext,useContext,useMemo,useRef,type ReactNode} from 'react';

/** A surface can exercise a shared number editor without changing other systems.
 * Values and history remain with each existing property owner. */
const NumericEditorContext=createContext<{mathematical:boolean;cancelPreview?:()=>void}>({mathematical:false});
export const useNumericEditor=()=>useContext(NumericEditorContext);
export function NumericEditorScope({children,cancelPreview}:{children:ReactNode;cancelPreview:()=>void}){
 const cancel=useRef(cancelPreview);cancel.current=cancelPreview;
 const value=useMemo(()=>({mathematical:true,cancelPreview:()=>cancel.current()}),[]);
 return <NumericEditorContext.Provider value={value}>{children}</NumericEditorContext.Provider>;
}


/** A state/renderer adapter lends a resolved reference and candidate to the shared
 * number editor. UI contains no object lookup or feature-specific arithmetic. */
export type SelectionReference={id:string;label:string;value:number};
export type NumericReferenceControl={selection?:{unavailable?:boolean;current?:SelectionReference;pick:()=>Promise<SelectionReference|undefined>;clear:()=>void;cancel:()=>void}};
export const NumericOperationScope=createContext<NumericReferenceControl|undefined>(undefined);
export const useNumericOperation=()=>useContext(NumericOperationScope);

/** Content adapter lends its existing cursor zone to active DOF editors. */
export const NumericToolZone=createContext<string|undefined>(undefined);
