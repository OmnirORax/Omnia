import {useVisualSelection} from '../appearance/VisualSelector';
import type {ResizeRect} from '../ui/resizeGeometry';
import {measuredReferenceFor} from './referenceMeasures';
import {resolveReferenceUse,DEFAULT_REFERENCE_SETTINGS,type ReferenceSettings,type UsedReference} from '../properties/referenceUse';
import {createContext,useContext,useMemo,useRef,useState,useEffect,type ReactNode,type RefObject} from 'react';
import {LIMITS,type Recipe,type RecipeResolver} from './model';
import type {Evaluation} from './evaluate';
import type {EditableDegree} from '../properties/editableDegrees';
import {NumericOperationScope,type SelectionReference,type NumericReferenceControl} from '../ui/NumericEditorScope';
import {targetParameter,targetDegreeValue,writeTargetDegree} from './targetDegrees';
import {operationGeometry,type OperationGeometry} from './operationContext';

type Scope={snapshot:OperationGeometry|null;resolve?:RecipeResolver;references:ReadonlyMap<string,string>;configured:(degree:EditableDegree)=>boolean;settings:(degree:EditableDegree)=>ReferenceSettings;changeSettings:(degree:EditableDegree,patch:Partial<ReferenceSettings>)=>void;reference:(degree:EditableDegree,consumer?:EditableDegree)=>UsedReference|undefined;choose:(target:string,reference?:string)=>void;read:()=>Recipe;error:(error:unknown)=>void;pick:(degree:EditableDegree)=>Promise<SelectionReference|undefined>;picking:boolean;environment?:ResizeRect;cancelPick:()=>void};
const Context=createContext<Scope|null>(null);
/** Session reference choices are context, not durable property values or locks. */
export function OperationReferenceScope({recipe,evaluation,resolve,read,error,children,stateOwner,environment,surface}:{surface:RefObject<HTMLElement|null>;environment?:ResizeRect;stateOwner:string;recipe:Recipe;evaluation:Evaluation|null;resolve?:RecipeResolver;read:()=>Recipe;error:(error:unknown)=>void;children:ReactNode}){
 const selector=useVisualSelection(),selectorRef=useRef(selector);selectorRef.current=selector;
 const pending=useRef<{degree:EditableDegree;finish:(value:SelectionReference|undefined)=>void;cancelMS?:()=>void}|undefined>(undefined);
 const [picking,setPicking]=useState(false);
 const cancelPick=()=>{const request=pending.current;pending.current=undefined;request?.cancelMS?.();request?.finish(undefined);setPicking(false);};
 useEffect(()=>()=>{const request=pending.current;pending.current=undefined;request?.cancelMS?.();request?.finish(undefined);},[]);
 const [references,setReferences]=useState<ReadonlyMap<string,string>>(()=>new Map());
 const [relations,setRelations]=useState<ReadonlyMap<string,ReferenceSettings>>(()=>new Map());
 const relationKey=(degree:EditableDegree)=>JSON.stringify([[...new Set(degree.targets.map(t=>t.id))],degree.id]);
 const vectorKey=(degree:EditableDegree)=>{const vector=degree.targets[0]?.input.freedom?.vector;return vector?JSON.stringify([[...new Set(degree.targets.map(t=>t.id))],vector.id]):'';};
 const settings=(degree:EditableDegree)=>relations.get(relationKey(degree))??relations.get(vectorKey(degree))??(degree.axes?{...DEFAULT_REFERENCE_SETTINGS,use:'match' as const}:DEFAULT_REFERENCE_SETTINGS);
 const snapshot=useMemo(()=>evaluation?operationGeometry(recipe,evaluation,stateOwner):null,[recipe,evaluation,stateOwner]);
 const callbacks=useRef({read,error,snapshot});callbacks.current={read,error,snapshot};
 const value=useMemo<Scope>(()=>({snapshot,resolve,references,picking,cancelPick,environment,settings,configured:degree=>relations.has(relationKey(degree))||relations.has(vectorKey(degree)),
 changeSettings:(degree,patch)=>setRelations(before=>{const next=new Map(before);next.set(relationKey(degree),{...settings(degree),...patch});return next;}),
 reference:(degree,consumer=degree)=>{if(!snapshot)return;const source=measuredReferenceFor(snapshot,degree.axes?.[0]??degree,references.get(degree.targets[0].id),environment);return source?resolveReferenceUse(source,settings(consumer),Number(targetDegreeValue(snapshot.recipe,degree))):undefined;},
 pick:degree=>{
  cancelPick();const ms=selectorRef.current;if(!ms)return Promise.resolve(undefined);
  setPicking(true);return new Promise(finish=>{
   const request={degree,finish,cancelMS:undefined as (()=>void)|undefined};pending.current=request;
   request.cancelMS=ms.requestPick(selection=>{
    if(!surface.current?.contains(selection.element))return false;
    const element=selection.element.closest('[data-omnic-component]');
    const id=element?.getAttribute('data-omnic-component')??(selection.element.closest('[data-selection-environment]')?'@environment':undefined);if(!id)return false;
    const live=callbacks.current.snapshot;if(!live)return false;
    const source=measuredReferenceFor(live,degree.axes?.[0]??degree,id,environment);if(!source)return false;const reference=resolveReferenceUse(source,settings(degree),Number(targetDegreeValue(live.recipe,degree)))??{id:source.id,label:source.label,unit:source.unit,value:source.value,use:settings(degree).use};
    pending.current=undefined;setPicking(false);setRelations(before=>{if(before.has(relationKey(degree)))return before;const next=new Map(before);next.set(relationKey(degree),settings(degree));return next;});setReferences(before=>{const next=new Map(before);for(const t of degree.targets)next.set(t.id,id);return next;});finish(reference);return true;
   },()=>{if(pending.current===request){pending.current=undefined;setPicking(false);finish(undefined);}});
  });
 },
 read:()=>callbacks.current.read(),error:e=>callbacks.current.error(e),choose:(target,reference)=>{
  if(!snapshot?.components.has(target)&&!snapshot?.recipe.operations.some(item=>item.id===target))return;
  setReferences(before=>{const next=new Map(before);if(reference)next.set(target,reference);else next.delete(target);
   if(next.size>LIMITS.components)for(const id of next.keys()){if(!snapshot.components.has(id))next.delete(id);if(next.size<=LIMITS.components)break;}
   return next;});
 }}),[snapshot,resolve,references,picking,environment,relations]);
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
  const source=measuredReferenceFor(snapshot,degree,retained,scope.environment),current=scope.reference(degree),settings=scope.settings(degree);
  const unavailable=!current&&(!!retained||settings.use!=='bounds'||settings.measure!=='context');
  return {allowed:n=>!unavailable&&allowed(n),targets:ids,selection:{current,unavailable,relation:{sourceLabel:source?.label??retained??'Self',settings,measures:source?.measures??[],change:patch=>scope.changeSettings(degree,patch)},pick:()=>scope.pick(degree),clear:()=>scope.choose(target),cancel:scope.cancelPick}};

 },[scope,key,property]);
 return <NumericOperationScope.Provider value={reference}>{children}</NumericOperationScope.Provider>;
}
