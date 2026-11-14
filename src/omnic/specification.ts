import {definition,defaultParams,type Value} from './registry.ts';
import {validateRecipe,type Recipe,type Component} from './model.ts';
/** Authoring brush/viewport state does not distinguish an executable definition.
 * Editing handles identify local targets; they are not the invariant's identity. */
export function recipeSpecification(input:Recipe,reference:(key:string,revision?:number)=>unknown=(key,revision)=>{let binding:unknown;try{binding=JSON.parse(key);}catch{binding=key;}return {binding,revision};}){
 const recipe=validateRecipe(input),handles=new Map<string,string>();
 const index=(components:Component[],path='c')=>components.forEach((component,i)=>{const key=`${path}${i}`;handles.set(component.id,key);index(component.children??[],`${key}.`);});index(recipe.components);
 recipe.operations.forEach((op,i)=>handles.set(op.id,`o${i}`));recipe.frames.forEach((frame,i)=>handles.set(frame.id,`f${i}`));
 const keys=[...handles.keys()].sort((a,b)=>b.length-a.length);
 const target=(value:string)=>{const owner=keys.find(key=>value===key||value.startsWith(key+':'));return owner?handles.get(owner)!+value.slice(owner.length):value;};
 const params=(id:string,values:Record<string,Value>,generator=false)=>{const spec=definition(id,generator)!,defaults=defaultParams(spec),normalize=(value:Value)=>typeof value==='string'&&/^#[a-f0-9]{6}$/i.test(value)?value.toLowerCase():value;return Object.fromEntries(Object.entries(values).filter(([key,value])=>normalize(value)!==normalize(defaults[key])).map(([key,value])=>[key,normalize(value)]));};
 const components=(values:Component[]):unknown[]=>values.map(component=>({generator:component.generator,params:params(component.generator,component.params,true),children:components(component.children??[]),...(component.reference?{reference:{mode:component.referenceRevision===undefined?'live':'pinned',structure:reference(component.reference,component.referenceRevision)}}:{})}));
 const value={components:components(recipe.components),operations:recipe.operations.map(op=>({operator:op.operator,targets:op.targets.map(target),params:params(op.operator,op.params),enabled:op.enabled})),frames:recipe.frames.map(frame=>({property:frame.property,state:frame.state,value:frame.value,scope:frame.scope.map(target)}))};
 return JSON.stringify(value,(_key,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,value[key]])):value);
}
