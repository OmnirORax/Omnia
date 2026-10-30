import {masterSelection,type MasterSelectionChoice} from '../ui/masterSelection';
import {useUITracked} from '../ui/context';
import {reopenContainer} from '../ui/layout';
import {definition} from './registry';
import type {ResizeRect} from '../ui/resizeGeometry';
import {fieldReferenceFor} from './referenceGeometry';
import {createContext,useContext,useMemo,useRef,useState,useEffect,type ReactNode} from 'react';
import {LIMITS,type Recipe,type RecipeResolver} from './model';
import type {Evaluation} from './evaluate';
import type {EditableDegree} from '../properties/editableDegrees';
import {NumericOperationScope,type SelectionReference,type NumericReferenceControl} from '../ui/NumericEditorScope';
import {targetParameter,writeTargetDegree} from './targetDegrees';
import {operationGeometry,type OperationGeometry} from './operationContext';

type Scope={snapshot:OperationGeometry|null;resolve?:RecipeResolver;references:ReadonlyMap<string,string>;choose:(target:string,reference?:string)=>void;read:()=>Recipe;error:(error:unknown)=>void;pick:(degree:EditableDegree)=>Promise<SelectionReference|undefined>;picking:boolean;environment?:ResizeRect;cancelPick:()=>void};
const Context=createContext<Scope|null>(null);
/** Session reference choices are context, not durable property values or locks. */
export function OperationReferenceScope({recipe,evaluation,resolve,read,error,children,stateOwner,environment}:{environment?:ResizeRect;stateOwner:string;recipe:Recipe;evaluation:Evaluation|null;resolve?:RecipeResolver;read:()=>Recipe;error:(error:unknown)=>void;children:ReactNode}){
 const ui=useUITracked(()=>[]);
 const pending=useRef<{degree:EditableDegree;finish:(value:SelectionReference|undefined)=>void;cancelSelection?:()=>void}|undefined>(undefined);
 const [picking,setPicking]=useState(false);
 const cancelPick=()=>{const request=pending.current;pending.current=undefined;request?.cancelSelection?.();request?.finish(undefined);setPicking(false);};
 useEffect(()=>()=>{const request=pending.current;pending.current=undefined;request?.cancelSelection?.();request?.finish(undefined);},[]);
 const [references,setReferences]=useState<ReadonlyMap<string,string>>(()=>new Map());
 const snapshot=useMemo(()=>evaluation?operationGeometry(recipe,evaluation,stateOwner):null,[recipe,evaluation,stateOwner]);
 const callbacks=useRef({read,error,snapshot});callbacks.current={read,error,snapshot};
 const value=useMemo<Scope>(()=>({snapshot,resolve,references,picking,cancelPick,environment,
 pick:degree=>{
  cancelPick();const current=callbacks.current.snapshot;if(!current)return Promise.resolve(undefined);
  const ids=[...new Set(degree.targets.map(t=>t.id))];if(ids.length!==1)return Promise.resolve(undefined);
  const choices:MasterSelectionChoice[]=[{id:'@self',label:'Self',symbol:'⟴'}];
  if(environment&&fieldReferenceFor(current,degree,'@environment',environment))choices.push({id:'@environment',label:'Environment',symbol:'▣'});
  for(const [id,item] of current.components){
   if(!fieldReferenceFor(current,degree,id,environment))continue;
   const spec=definition(item.component.generator,true);
   choices.push({id,label:`${spec?.label??item.component.generator} · ${id.slice(0,6)}`,symbol:spec?.symbol??'○',parent:item.parent});
  }
  setPicking(true);return new Promise(finish=>{
   const request={degree,finish,cancelSelection:undefined as (()=>void)|undefined};pending.current=request;
   request.cancelSelection=masterSelection.open({label:'⟴ Reference',choices,selected:references.get(ids[0])??'@self',choose:id=>{
    const live=callbacks.current.snapshot;if(!live||!live.components.has(ids[0]))return false;
    const reference=id==='@self'?undefined:fieldReferenceFor(live,degree,id,environment);if(id!=='@self'&&!reference)return false;
    pending.current=undefined;setPicking(false);setReferences(before=>{const next=new Map(before);if(id==='@self')next.delete(ids[0]);else next.set(ids[0],id);return next;});finish(reference);return true;
   },cancel:()=>{if(pending.current===request){pending.current=undefined;setPicking(false);finish(undefined);}}});
   ui.update(layout=>reopenContainer(layout,'window:theme'));
  });
 },
 read:()=>callbacks.current.read(),error:e=>callbacks.current.error(e),choose:(target,reference)=>{
  if(!snapshot?.components.has(target)&&!snapshot?.recipe.operations.some(item=>item.id===target))return;
  setReferences(before=>{const next=new Map(before);if(reference)next.set(target,reference);else next.delete(target);
   if(next.size>LIMITS.components)for(const id of next.keys()){if(!snapshot.components.has(id))next.delete(id);if(next.size<=LIMITS.components)break;}
   return next;});
 }}),[snapshot,resolve,references,picking,environment]);
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
  if(ids.length!==1)return {allowed,targets:ids};
  const current=fieldReferenceFor(snapshot,degree,retained,scope.environment);
  return {allowed,targets:ids,selection:{current,unavailable:!!retained&&!current,pick:()=>scope.pick(degree),clear:()=>scope.choose(target),cancel:scope.cancelPick}};

 },[scope,key,property]);
 return <NumericOperationScope.Provider value={reference}>{children}</NumericOperationScope.Provider>;
}
