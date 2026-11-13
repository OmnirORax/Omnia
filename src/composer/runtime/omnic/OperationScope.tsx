import {authoredNodeOwners} from './contextGeometry';
import {selectedEditOwners} from './msSelection';
import {regionReference} from './regionReference';
import {cancelOwnedSelectionRequest} from '../appearance/selectionRequest';
import {useVisualSelection,type ReferenceSelection} from '../appearance/VisualSelector';
import type {ResizeRect} from '../ui/resizeGeometry';
import {degreeReferenceSource,compatibleDegreeReference,measuredReferenceFor} from './referenceMeasures';
import {resolveReferenceUse,selfReference,DEFAULT_REFERENCE_SETTINGS,type ReferenceSettings,type UsedReference} from '../properties/referenceUse';
import {createContext,useContext,useMemo,useRef,useState,useEffect,type ReactNode,type RefObject} from 'react';
import {LIMITS,type Recipe,type RecipeResolver} from './model';
import type {Evaluation} from './evaluate';
import type {EditableDegree} from '../properties/editableDegrees';
import {NumericOperationScope,type SelectionReference,type NumericReferenceControl} from '../ui/NumericEditorScope';
import {compatibleReferenceSource,targetParameter,targetDegreeValue,writeTargetDegree} from './targetDegrees';
import {operationGeometry,type OperationGeometry} from './operationContext';

export type PickedReferenceSource={id:string;label:string;point:{x:number;y:number}};
type Scope={chooseReference:(degree:EditableDegree,id:string)=>boolean;prepareReference:(degree:EditableDegree)=>void;pickAttachment:(ids:readonly string[],owner:symbol)=>Promise<PickedReferenceSource|undefined>;selectTargets:(ids:readonly string[])=>void;commit:(recipe:Recipe,preview?:boolean)=>boolean;pickRegion:(owner:symbol)=>Promise<{id:string;ids:readonly string[];point:{x:number;y:number}}|undefined>;snapshot:OperationGeometry|null;resolve?:RecipeResolver;references:ReadonlyMap<string,string>;configured:(degree:EditableDegree)=>boolean;settings:(degree:EditableDegree)=>ReferenceSettings;changeSettings:(degree:EditableDegree,patch:Partial<ReferenceSettings>)=>void;reference:(degree:EditableDegree,consumer?:EditableDegree)=>UsedReference|undefined;choose:(target:string,reference?:string)=>void;read:()=>Recipe;error:(error:unknown)=>void;pick:(degree:EditableDegree,owner?:symbol)=>Promise<SelectionReference|undefined>;pickSource:(degree:EditableDegree,owner?:symbol)=>Promise<PickedReferenceSource|undefined>;picking:boolean;environment?:ResizeRect;cancelPick:(owner?:symbol)=>void};
const Context=createContext<Scope|null>(null);
/** Session reference choices are context, not durable property values or locks. */
export function OperationReferenceScope({recipe,evaluation,resolve,read,error,commit,selectTargets,children,stateOwner,environment,surface}:{selectTargets?:(ids:readonly string[])=>void;commit?:(recipe:Recipe,preview?:boolean)=>boolean;surface:RefObject<HTMLElement|null>;environment?:ResizeRect;stateOwner:string;recipe:Recipe;evaluation:Evaluation|null;resolve?:RecipeResolver;read:()=>Recipe;error:(error:unknown)=>void;children:ReactNode}){
 const selector=useVisualSelection(),selectorRef=useRef(selector);selectorRef.current=selector;
 const pending=useRef<{owner:symbol;degree?:EditableDegree;finish:()=>void;cancelMS?:()=>void}|undefined>(undefined);
 const [picking,setPicking]=useState(false);
 const cancelPick=(owner?:symbol)=>{if(cancelOwnedSelectionRequest(pending,owner))setPicking(false);};
 useEffect(()=>()=>{cancelOwnedSelectionRequest(pending);},[]);
 const [references,setReferences]=useState<ReadonlyMap<string,string>>(()=>new Map());
 const [relations,setRelations]=useState<ReadonlyMap<string,ReferenceSettings>>(()=>new Map());
 const relationKey=(degree:EditableDegree)=>JSON.stringify([[...new Set(degree.targets.map(t=>t.id))],degree.id]);
 const vectorKey=(degree:EditableDegree)=>{const vector=degree.targets[0]?.input.freedom?.vector;return vector?JSON.stringify([[...new Set(degree.targets.map(t=>t.id))],vector.id]):'';};
 const settings=(degree:EditableDegree)=>relations.get(relationKey(degree))??relations.get(vectorKey(degree))??DEFAULT_REFERENCE_SETTINGS;
 const snapshot=useMemo(()=>evaluation?operationGeometry(recipe,evaluation,stateOwner):null,[recipe,evaluation,stateOwner]);
 const callbacks=useRef({read,error,snapshot,commit,selectTargets});callbacks.current={read,error,snapshot,commit,selectTargets};
 const pickReference=<T,>(degree:EditableDegree|undefined,resolveSource:(snapshot:OperationGeometry,id:string,point:{x:number;y:number},parts:ReferenceSelection['parts'])=>T|undefined,owner=Symbol(),mode?:'item',rejection?:string):Promise<T|undefined>=>{
  cancelPick();const ms=selectorRef.current;if(!ms)return Promise.resolve(undefined);
  setPicking(true);return new Promise(finish=>{
   const request={owner,degree,finish:()=>finish(undefined),cancelMS:undefined as (()=>void)|undefined};pending.current=request;
   request.cancelMS=ms.requestPick(selection=>{
    if(!surface.current?.contains(selection.element))return 'Pick inside Composer';
    const element=selection.element.closest('[data-omnic-component]');
    const live=callbacks.current.snapshot,role=selection.element.closest('[data-omnic-role]')?.getAttribute('data-omnic-role'),id=(role&&live?.owners.get(role))||(element?.getAttribute('data-omnic-component')??(selection.element.closest('[data-selection-environment]')?'@environment':undefined));
    if(!id||!live)return 'No target here';const source=resolveSource(live,id,selection.point,selection.parts);if(!source)return rejection??`No ${degree?.label??'region threshold'} reference`;
    pending.current=undefined;setPicking(false);if(degree){setRelations(before=>{if(before.has(relationKey(degree)))return before;const next=new Map(before);next.set(relationKey(degree),settings(degree));return next;});setReferences(before=>{const next=new Map(before);for(const t of degree.targets)next.set(t.id,id);return next;});}finish(source);return true;
   },()=>{if(pending.current===request){pending.current=undefined;setPicking(false);finish(undefined);}},{mode,surface:()=>surface.current});
  });
 };
 const chooseReference=(degree:EditableDegree,id:string)=>{
  const live=callbacks.current.snapshot;if(!live)return false;
  if(!compatibleDegreeReference(live,degree,id,environment))return false;
  setReferences(before=>{const next=new Map(before);for(const target of degree.targets)next.set(target.id,id);return next;});return true;
 };
 const value=useMemo<Scope>(()=>({chooseReference,prepareReference:degree=>{
  const live=callbacks.current.snapshot;if(!live)return;
  const retained=references.get(degree.targets[0]?.id),source=degreeReferenceSource(live,degree,retained,environment);
  if(source!==retained)setReferences(before=>{const next=new Map(before);for(const target of degree.targets){if(source)next.set(target.id,source);else next.delete(target.id);}return next;});
 },selectTargets:ids=>callbacks.current.selectTargets?.(ids),commit:(recipe,preview)=>callbacks.current.commit?.(recipe,preview)??false,snapshot,resolve,references,picking,cancelPick,environment,settings,
 pickAttachment:(ids,owner)=>pickReference(undefined,(_live,id,point)=>ids.includes(id)?{id,label:id,point}:undefined,owner,'item','Pick a contributing component'),
 pickRegion:owner=>{
  const live=callbacks.current.snapshot,parts=selectorRef.current?.parts??[];
  const retained=live?selectedEditOwners(live.evaluation.nodes,authoredNodeOwners(live.recipe,live.evaluation),new Set(parts.filter(part=>surface.current?.contains(part.element)).flatMap(part=>part.element.getAttribute('data-omnic-role')??[]))):[];
  return pickReference(undefined,(live,id,point,parts)=>{
   const owners=authoredNodeOwners(live.recipe,live.evaluation),picked=[...new Set(parts.flatMap(part=>{const role=part.element.getAttribute('data-omnic-role'),owner=role&&owners.get(role);return owner?[owner]:[];}))];
   const ids=retained.includes(id)&&retained.length>1?retained:picked.includes(id)&&picked.length>1?picked:[id];
   return regionReference(live,ids)?{id,ids,point}:undefined;
  },owner);
 },configured:degree=>relations.has(relationKey(degree))||relations.has(vectorKey(degree)),
 changeSettings:(degree,patch)=>setRelations(before=>{const next=new Map(before);next.set(relationKey(degree),{...settings(degree),...patch});return next;}),
 reference:(degree,consumer=degree)=>{if(!snapshot)return;const source=measuredReferenceFor(snapshot,degree.axes?.[0]??degree,references.get(degree.targets[0].id),environment);return source?resolveReferenceUse(source,settings(consumer),Number(targetDegreeValue(snapshot.recipe,degree))):undefined;},
 pick:(degree,owner)=>pickReference(degree,(live,id,point)=>{
  const source=measuredReferenceFor(live,degree.axes?.[0]??degree,id,environment);if(!source)return;
  const reference=resolveReferenceUse(source,settings(degree),Number(targetDegreeValue(live.recipe,degree)))??{id:source.id,label:source.label,unit:source.unit,value:source.value,use:settings(degree).use};
  return {...reference,point};
 },owner),
 pickSource:(degree,owner)=>pickReference(degree,(live,id,point)=>{
  if(!compatibleReferenceSource(live.recipe,degree,id))return;
  return {id,label:degree.targets.every(t=>t.id===id)?'Self':id.slice(0,6),point};
 },owner),
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
 const requestOwner=useRef(Symbol());
 const reference=useMemo<NumericReferenceControl|undefined>(()=>{
  const snapshot=scope?.snapshot;
  if(!scope||!snapshot||degree.properties.length!==1&&!degree.axes)return;
  const target=ids[0],retained=scope.references.get(target),parameter=targetParameter(degree);
  if(parameter.kind!=='number')return;
  const allowed=(value:number)=>{try{writeTargetDegree(snapshot.recipe,degree,value);return true;}catch{return false;}};
  if(ids.length!==1)return {allowed,targets:ids};
  const source=measuredReferenceFor(snapshot,degree.axes?.[0]??degree,retained,scope.environment),current=scope.reference(degree),settings=scope.settings(degree);
  const unavailable=!current&&(!!retained||settings.use!=='bounds'||settings.measure!=='context');
  return {vector:!!degree.axes,allowed:n=>!unavailable&&(degree.axes?true:allowed(n)),targets:ids,selection:{current,self:selfReference(retained,ids),unavailable,relation:{sourceLabel:source?.label??retained??'Self',settings,measures:source?.measures??[],change:patch=>scope.changeSettings(degree,patch)},pick:()=>scope.pick(degree,requestOwner.current),clear:()=>scope.choose(target),cancel:()=>scope.cancelPick(requestOwner.current)}};

 },[scope,key,property]);
 return <NumericOperationScope.Provider value={reference}>{children}</NumericOperationScope.Provider>;
}
