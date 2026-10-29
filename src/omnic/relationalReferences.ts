import type {Recipe,Component} from './model.ts';
import {definition,applicableParameters} from './registry.ts';
/** Reference context carries identity, never an equation or a geometry lock. */
export type RelationalReference={kind:'self'|'parent'|'object'|'frame';object?:string;feature?:'center'|'dimensions'|'boundary'|'axis-x'|'axis-y'};
export type ReferenceContext={reference?:RelationalReference;degrees?:Record<string,RelationalReference|null>};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export function validateReferenceContext(value:unknown):ReferenceContext{
 if(!object(value))throw Error('Invalid reference context.');
 const read=(v:unknown):RelationalReference=>{
  if(!object(v)||!['self','parent','object','frame'].includes(String(v.kind)))throw Error('Invalid relational reference.');
  if(v.kind==='object'&&(typeof v.object!=='string'||!v.object.length||v.object.length>200))throw Error('Missing reference identity.');
  if(v.kind!=='object'&&v.object!==undefined)throw Error('Unexpected reference identity.');
  if(v.feature!==undefined&&!['center','dimensions','boundary','axis-x','axis-y'].includes(String(v.feature)))throw Error('Invalid reference feature.');
  return {kind:v.kind as RelationalReference['kind'],...(v.kind==='object'?{object:v.object as string}:{}),...(v.feature?{feature:v.feature as RelationalReference['feature']}:{})};
 };
 if(value.degrees!==undefined&&(!object(value.degrees)||Object.keys(value.degrees).length>128))throw Error('Invalid DOF references.');
 const degrees:Record<string,RelationalReference|null>={};
 for(const [key,v] of Object.entries(value.degrees??{})){if(!/^[a-zA-Z0-9_.-]{1,200}$/.test(key)||['__proto__','constructor','prototype'].includes(key))throw Error('Invalid DOF identity.');degrees[key]=v===null?null:read(v);}
 return {...(value.reference!==undefined?{reference:read(value.reference)}:{}),...(value.degrees!==undefined?{degrees}:{})};
}
export function referenceIndex(recipe:Recipe){
 const result=new Map<string,{component:Component;parent?:string}>();
 const walk=(items:Component[],parent?:string)=>items.forEach(component=>{result.set(component.id,{component,parent});walk(component.children??[],component.id);});walk(recipe.components);return result;
}
export function resolvedReference(recipe:Recipe,target:string,property?:string,index=referenceIndex(recipe)){
 const owner=index.get(target);
 if(!owner)return {status:'missing-target' as const};
 const context=owner.component.relations,override=property?context?.degrees?.[property]:undefined;
 const reference=override===undefined?context?.reference:override;
 if(reference===null)return {status:'ignored' as const};
 if(!reference)return {status:'independent' as const};
 const id=reference.kind==='self'?target:reference.kind==='parent'?owner.parent:reference.kind==='object'?reference.object:undefined;
 if(reference.kind!=='frame'&&(!id||!index.has(id)))return {status:'unresolved' as const,reference};
 return {status:'active' as const,reference,id,component:id?index.get(id)?.component:undefined};
}
export function setReferenceContext(recipe:Recipe,targets:readonly string[],reference:RelationalReference|null|undefined,property?:string):Recipe{
 const index=referenceIndex(recipe);
 for(const id of targets){const item=index.get(id)?.component;if(!item)throw Error('Reference target no longer exists.');if(property&&!applicableParameters(definition(item.generator,true)!,item.params).some(p=>p.property===property))throw Error('Reference DOF is not available.');}
 const checked=reference?validateReferenceContext({reference}).reference:reference;
 if(checked?.kind==='object'&&!index.has(checked.object!))throw Error('Reference object no longer exists.');
 const selected=new Set(targets);
 const walk=(items:Component[]):Component[]=>items.map(item=>{
  let relations=item.relations;
  if(selected.has(item.id)){
   relations={...relations};
   if(property){const degrees={...relations.degrees};if(checked===undefined)delete degrees[property];else degrees[property]=checked;relations.degrees=degrees;}
   else if(checked)relations.reference=checked;else delete relations.reference;
  }
  return {...item,...(relations?{relations}:{}),...(item.children?{children:walk(item.children)}:{})};
 });
 return {...recipe,components:walk(recipe.components)};
}
export function remapReferenceContext(context:ReferenceContext|undefined,mapping:ReadonlyMap<string,string>):ReferenceContext|undefined{
 if(!context)return;
 const remap=(r:RelationalReference|null)=>r?.kind==='object'?{...r,object:mapping.get(r.object!)??r.object}:r;
 return {...(context.reference?{reference:remap(context.reference)!}:{}),...(context.degrees?{degrees:Object.fromEntries(Object.entries(context.degrees).map(([k,r])=>[k,remap(r)]))}:{})};
}
