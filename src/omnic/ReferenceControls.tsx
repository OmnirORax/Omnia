import {createContext,useContext,useMemo,type ReactNode} from 'react';
import type {Recipe} from './model';
import type {EditableDegree} from '../properties/editableDegrees';
import {referenceIndex,resolvedReference,setReferenceContext,type RelationalReference} from './relationalReferences';
const Context=createContext<{recipe:Recipe;index:ReturnType<typeof referenceIndex>;commit:(next:Recipe)=>unknown}|null>(null);
export function ReferenceScope({recipe,commit,children}:{recipe:Recipe;commit:(next:Recipe)=>unknown;children:ReactNode}){const index=useMemo(()=>referenceIndex(recipe),[recipe.components]);return <Context.Provider value={{recipe,index,commit}}>{children}</Context.Provider>;}
/** One contextual projection for every registered component DOF. */
export function ReferenceControls({degree}:{degree:EditableDegree}){
 const owner=useContext(Context);if(!owner)return null;
 const {recipe,commit,index}=owner,ids=[...new Set(degree.targets.map(t=>t.id))];
 if(!ids.length||ids.some(id=>!index.has(id))||degree.properties.length!==1)return null;
 const property=degree.properties[0],contexts=ids.map(id=>index.get(id)!.component.relations);
 const shared=(values:unknown[])=>values.every(v=>JSON.stringify(v)===JSON.stringify(values[0]))?values[0]: 'mixed';
 const defaults=shared(contexts.map(c=>c?.reference)),overrides=shared(contexts.map(c=>c?.degrees?.[property]));
 const encode=(v:unknown,fallback:string)=>v==='mixed'?'mixed':v===null?'ignore':v===undefined?fallback:(v as RelationalReference).kind==='object'?`object:${(v as RelationalReference).object}`:(v as RelationalReference).kind;
 const choices=[['self','Self'],['parent','Parent'],['frame','Composition frame'],...[...index.values()].map(({component})=>[`object:${component.id}`,`${component.generator} · ${component.id.slice(0,6)}`])];
 const change=(key:string,perDegree:boolean)=>{
  const reference=key==='inherit'||key==='none'?undefined:key==='ignore'?null:key.startsWith('object:')?{kind:'object' as const,object:key.slice(7)}:{kind:key as RelationalReference['kind']};
  commit(setReferenceContext(recipe,ids,reference,perDegree?property:undefined));
 };
 const results=ids.map(id=>resolvedReference(recipe,id,property,index));
 const active=results[0].reference;
 const select=(perDegree:boolean)=><select aria-label={perDegree?'DOF reference':'Object reference context'} value={encode(perDegree?overrides:defaults,perDegree?'inherit':'none')} onChange={event=>change(event.target.value,perDegree)}>
  <option value={perDegree?'inherit':'none'}>{perDegree?'Use object reference':'Independent'}</option>
  {perDegree&&<option value="ignore">Ignore reference</option>}
  <option value="mixed" disabled>Mixed</option>
  {choices.map(([id,label])=><option key={id} value={id}>{label}</option>)}
 </select>;
 return <details className="omnic-reference-context" data-ui-popup-interior><summary title="Shared reference context and DOF override">⨮ Reference</summary>
  <label title="Reference context shared by this object's DOFs; choosing it preserves geometry">Reference {select(false)}</label>
  <label title="This DOF can inherit, ignore or override the object's reference">{degree.label} {select(true)}</label>
  {active&&results.every(r=>JSON.stringify(r.reference)===JSON.stringify(active))&&<select aria-label="Reference feature" value={active.feature??''} onChange={event=>{
   const {feature:_,...rest}=active;
   commit(setReferenceContext(recipe,ids,{...rest,...(event.target.value?{feature:event.target.value as RelationalReference['feature']}:{})},overrides===undefined?undefined:property));
  }}><option value="">Whole reference</option>{['center','dimensions','boundary','axis-x','axis-y'].map(feature=><option key={feature} value={feature}>{feature}</option>)}</select>}
  <small role="status" title="Reference context only; geometric snapping and equations are later stages">{results.some(r=>r.status==='unresolved')?'Reference unavailable':results.every(r=>r.status===results[0].status)?results[0].status:'Mixed references'}</small>
 </details>;
}
