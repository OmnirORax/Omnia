import {createContext,useContext,useMemo,useRef,useState,useEffect,type ReactNode} from 'react';
import {LIMITS,type Recipe,type RecipeResolver} from './model';
import type {Evaluation} from './evaluate';
import type {EditableDegree} from '../properties/editableDegrees';
import {NumericOperationScope,type SelectionReference,type NumericReferenceControl} from '../ui/NumericEditorScope';
import {targetParameter,writeTargetDegree} from './targetDegrees';
import {selectionReference} from './selectionReference';
import {operationGeometry,type OperationGeometry} from './operationContext';

type Scope={snapshot:OperationGeometry|null;resolve?:RecipeResolver;references:ReadonlyMap<string,string>;choose:(target:string,reference?:string)=>void;read:()=>Recipe;error:(error:unknown)=>void;pick:(degree:EditableDegree)=>Promise<SelectionReference|undefined>;accept:(id:string)=>boolean;picking:boolean;cancelPick:()=>void};
const Context=createContext<Scope|null>(null);
/** Session reference choices are context, not durable property values or locks. */
export function OperationReferenceScope({recipe,evaluation,resolve,read,error,children,stateOwner}:{stateOwner:string;recipe:Recipe;evaluation:Evaluation|null;resolve?:RecipeResolver;read:()=>Recipe;error:(error:unknown)=>void;children:ReactNode}){
 const pending=useRef<{degree:EditableDegree;finish:(value:SelectionReference|undefined)=>void}|undefined>(undefined);
 const [picking,setPicking]=useState(false);
 const cancelPick=()=>{pending.current?.finish(undefined);pending.current=undefined;setPicking(false);};
 useEffect(()=>()=>{pending.current?.finish(undefined);},[]);
 const [references,setReferences]=useState<ReadonlyMap<string,string>>(()=>new Map());
 const snapshot=useMemo(()=>evaluation?operationGeometry(recipe,evaluation,stateOwner):null,[recipe,evaluation,stateOwner]);
 const callbacks=useRef({read,error});callbacks.current={read,error};
 const value=useMemo<Scope>(()=>({snapshot,resolve,references,picking,cancelPick,
 pick:degree=>{pending.current?.finish(undefined);setPicking(true);return new Promise(finish=>{pending.current={degree,finish};});},
 accept:id=>{
  const request=pending.current;if(!request)return false;
  const reference=selectionReference(callbacks.current.read(),request.degree,id);if(!reference)return false;
  request.finish(reference);pending.current=undefined;setPicking(false);
  for(const t of request.degree.targets)setReferences(before=>new Map(before).set(t.id,id));
  return true;
 },read:()=>callbacks.current.read(),error:e=>callbacks.current.error(e),choose:(target,reference)=>{
  if(!snapshot?.components.has(target)&&!snapshot?.recipe.operations.some(item=>item.id===target))return;
  setReferences(before=>{const next=new Map(before);if(reference)next.set(target,reference);else next.delete(target);
   if(next.size>LIMITS.components)for(const id of next.keys()){if(!snapshot.components.has(id))next.delete(id);if(next.size<=LIMITS.components)break;}
   return next;});
 }}),[snapshot,resolve,references,picking]);
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useOperationReferencePicker=()=>useContext(Context);
/** Preset and selected-target DOFs share one adapter into the global operation
 * contract. Reference measurement snapshots never follow hover samples. */
export function OperationDegreeScope({degree,children}:{degree:EditableDegree;children:ReactNode}){
 const scope=useContext(Context),ids=[...new Set(degree.targets.map(t=>t.id))],property=degree.properties[0],key=ids.join('|');
 const reference=useMemo<NumericReferenceControl|undefined>(()=>{
  const snapshot=scope?.snapshot;
  if(!scope||!snapshot||degree.properties.length!==1)return;
  const target=ids[0],retained=scope.references.get(target),parameter=targetParameter(degree);
  if(parameter.kind!=='number')return;
  const allowed=(value:number)=>{try{writeTargetDegree(snapshot.recipe,degree,value);return true;}catch{return false;}};
  if(ids.length!==1)return {allowed};
  const current=retained?selectionReference(snapshot.recipe,degree,retained):undefined;
  return {allowed,selection:{current,unavailable:!!retained&&!current,pick:()=>scope.pick(degree),clear:()=>scope.choose(target),cancel:scope.cancelPick}};

 },[scope,key,property]);
 return <NumericOperationScope.Provider value={reference}>{children}</NumericOperationScope.Provider>;
}
