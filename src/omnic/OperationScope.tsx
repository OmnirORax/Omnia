import {createContext,useContext,useMemo,useRef,useState,type ReactNode} from 'react';
import {LIMITS,type Recipe,type RecipeResolver} from './model';
import type {Evaluation} from './evaluate';
import type {EditableDegree} from '../properties/editableDegrees';
import {NumericOperationScope,type NumericReferenceControl} from '../ui/NumericEditorScope';
import {targetParameter} from './targetDegrees';
import {operationGeometry,referenceForOperation,matchForOperation,resolveMatch,type OperationGeometry} from './operationContext';

type Scope={snapshot:OperationGeometry|null;resolve?:RecipeResolver;references:ReadonlyMap<string,string>;choose:(target:string,reference?:string)=>void;read:()=>Recipe;error:(error:unknown)=>void};
const Context=createContext<Scope|null>(null);
/** Session reference choices are context, not durable property values or locks. */
export function OperationReferenceScope({recipe,evaluation,resolve,read,error,children,stateOwner}:{stateOwner:string;recipe:Recipe;evaluation:Evaluation|null;resolve?:RecipeResolver;read:()=>Recipe;error:(error:unknown)=>void;children:ReactNode}){
 const [references,setReferences]=useState<ReadonlyMap<string,string>>(()=>new Map());
 const snapshot=useMemo(()=>evaluation?operationGeometry(recipe,evaluation,stateOwner):null,[recipe,evaluation,stateOwner]);
 const callbacks=useRef({read,error});callbacks.current={read,error};
 const value=useMemo<Scope>(()=>({snapshot,resolve,references,read:()=>callbacks.current.read(),error:e=>callbacks.current.error(e),choose:(target,reference)=>{
  if(!snapshot?.components.has(target))return;
  setReferences(before=>{const next=new Map(before);if(reference)next.set(target,reference);else next.delete(target);
   if(next.size>LIMITS.components)for(const id of next.keys()){if(!snapshot.components.has(id))next.delete(id);if(next.size<=LIMITS.components)break;}
   return next;});
 }}),[snapshot,resolve,references]);
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
/** Preset and selected-target DOFs share one adapter into the global operation
 * contract. Reference measurement snapshots never follow hover samples. */
export function OperationDegreeScope({degree,children}:{degree:EditableDegree;children:ReactNode}){
 const scope=useContext(Context),ids=[...new Set(degree.targets.map(t=>t.id))],property=degree.properties[0],key=ids.join('|');
 const reference=useMemo<NumericReferenceControl|undefined>(()=>{
  const snapshot=scope?.snapshot;
  if(!scope||!snapshot||ids.length!==1||degree.properties.length!==1||!snapshot.components.has(ids[0]))return;
  const target=ids[0],retained=scope.references.get(target),parameter=targetParameter(degree);
  const id=parameter.measurement?referenceForOperation(snapshot,target,parameter.measurement,retained):retained;
  if(!id)return;
  const ref=snapshot.components.get(id)?.component;
  const active=retained!==undefined;
  const candidate=active?matchForOperation(snapshot,ids,property,id,scope.resolve):undefined;
  const measurement=parameter.measurement?snapshot.views.get(id)?.measurements.get(parameter.measurement):undefined;
  const name=ref?`${ref.generator} · ${id.slice(0,6)}`:'Unavailable reference';
  return {active,description:`${name}${measurement?` · ${measurement.quantity}: ${measurement.value}`:''} · ${active?'click to clear context; Match uses this reference, Value/Step keep their current basis':'click to use as reference; geometry stays unchanged'}${active&&!candidate?' · no valid Match candidate for this DOF':''}`,
   toggle:()=>scope.choose(target,active?undefined:id),
   ...(candidate?{match:{value:candidate.value,description:`Match ${candidate.context.measurement.quantity} to ${candidate.context.reference.id} (${candidate.context.reference.value}); derived ${property} = ${candidate.value}. One-time result.`,resolve:()=>{
    try{return resolveMatch(scope.read(),candidate,scope.resolve,snapshot.stateOwner).value;}catch(error){scope.error(error);return;}
   }}}:{})};
 },[scope,key,property]);
 return <NumericOperationScope.Provider value={reference}>{children}</NumericOperationScope.Provider>;
}
