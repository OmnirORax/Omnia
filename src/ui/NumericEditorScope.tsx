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
