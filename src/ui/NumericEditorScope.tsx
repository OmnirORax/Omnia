import type {DofInformationState} from './DofInformation';
import {createContext,useContext,useMemo,useRef,useCallback,useState,type ReactNode} from 'react';

/** A surface can exercise a shared number editor without changing other systems.
 * Values and history remain with each existing property owner. */
const NumericEditorContext=createContext<{mathematical:boolean;activeDegree?:{ids:readonly string[];property:string};activateDegree?:(ids:readonly string[],property:string)=>void;information?:DofInformationState;registerInformation?:(info:DofInformationState,priority:number)=>()=>void;cancelPreview?:()=>void;registerOptions?:(toggle:()=>void)=>()=>void;toggleOptions?:()=>boolean;hasOptions?:()=>boolean;registerDegrees?:(show:(ids:readonly string[])=>void)=>()=>void;showDegrees?:(ids:readonly string[])=>void}>({mathematical:false});
export const useNumericEditor=()=>useContext(NumericEditorContext);
export function NumericEditorScope({children,cancelPreview}:{children:ReactNode;cancelPreview:()=>void}){
 const cancel=useRef(cancelPreview);cancel.current=cancelPreview;
 const [activeDegree,setActiveDegree]=useState<{ids:readonly string[];property:string}>();
 const activateDegree=useCallback((ids:readonly string[],property:string)=>{if(!ids.length)return;setActiveDegree(before=>before?.property===property&&before.ids.join('|')===ids.join('|')?before:{ids:[...ids],property});},[]);
 const information=useRef(new Map<symbol,{info:DofInformationState;priority:number}>());
 const options=useRef(new Map<symbol,()=>void>()),degrees=useRef<((ids:readonly string[])=>void)|null>(null),[version,refresh]=useState(0);
 const registerOptions=useCallback((toggle:()=>void)=>{const key=Symbol();options.current.set(key,toggle);refresh(n=>n+1);return()=>{options.current.delete(key);refresh(n=>n+1);};},[]);
 const registerInformation=useCallback((info:DofInformationState,priority:number)=>{const key=Symbol();information.current.set(key,{info,priority});refresh(n=>n+1);return()=>{information.current.delete(key);refresh(n=>n+1);};},[]);
 const registerDegrees=useCallback((show:(ids:readonly string[])=>void)=>{degrees.current=show;return()=>{if(degrees.current===show)degrees.current=null;};},[]);
 const value=useMemo(()=>({mathematical:true,activeDegree,activateDegree,information:[...information.current.values()].sort((a,b)=>b.priority-a.priority)[0]?.info,registerInformation,cancelPreview:()=>cancel.current(),registerOptions,registerDegrees,hasOptions:()=>options.current.size>0,toggleOptions:()=>{const handler=[...options.current.values()].at(-1);handler?.();return !!handler;},showDegrees:(ids:readonly string[])=>degrees.current?.(ids)}),[version,registerOptions,registerDegrees,registerInformation,activeDegree,activateDegree]);
 return <NumericEditorContext.Provider value={value}>{children}</NumericEditorContext.Provider>;
}


/** A state/renderer adapter lends a resolved reference and candidate to the shared
 * number editor. UI contains no object lookup or feature-specific arithmetic. */
export type SelectionReference=import('../properties/referenceUse').UsedReference&{point?:{x:number;y:number}};
export type NumericReferenceControl={vector?:boolean;allowed?:(value:number)=>boolean;targets?:readonly string[];selection?:{unavailable?:boolean;current?:SelectionReference;relation?:{sourceLabel:string;settings:import('../properties/referenceUse').ReferenceSettings;measures:readonly import('../properties/referenceUse').ReferenceMeasure[];change:(patch:Partial<import('../properties/referenceUse').ReferenceSettings>)=>void};pick:()=>Promise<SelectionReference|undefined>;clear:()=>void;cancel:()=>void}};
export const NumericOperationScope=createContext<NumericReferenceControl|undefined>(undefined);
export const useNumericOperation=()=>useContext(NumericOperationScope);
