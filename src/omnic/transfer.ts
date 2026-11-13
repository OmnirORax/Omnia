import type {Binding,Structure} from '../core/model.ts';
import {referenceBinding} from './bindings.ts';
import {referenceComponents,type Recipe} from './model.ts';
/** Only declared reference slots are rebound; user strings and parameters are untouched. */
export function definitionBindings(node:Structure):Binding[]{
 const bindings:Binding[]=[];
 const visit=(recipe:Recipe)=>{for(const ref of referenceComponents(recipe))bindings.push(referenceBinding(ref.reference!));};
 if(node.omnic)visit(node.omnic);if(node.omnicDraft)visit(node.omnicDraft);for(const recipe of node.omnicHistory??[])visit(recipe);
 for(const edit of node.omnicEdits??[])walkEdit(edit.value,value=>{bindings.push(referenceBinding(value));return value;},edit.path.at(-1)==='reference');
 return bindings;
}
function walkEdit(value:unknown,rebind:(key:string)=>string,direct=false):unknown{
 if(direct&&typeof value==='string')return rebind(value);
 if(Array.isArray(value))return value.map(item=>walkEdit(item,rebind));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,key==='reference'&&(value as {generator?:string}).generator==='reference'&&typeof item==='string'?rebind(item):walkEdit(item,rebind)]));
 return value;
}
export function rebindDefinitions(node:Structure,binding:(value:Binding)=>Binding,pin?:(value:Binding,revision:number)=>number,materialized?:Recipe){
 const rebind=(key:string)=>JSON.stringify(binding(referenceBinding(key)));
 const visit=(recipe:Recipe)=>{for(const ref of referenceComponents(recipe)){if(pin&&ref.referenceRevision!==undefined)ref.referenceRevision=pin(referenceBinding(ref.reference!),ref.referenceRevision);ref.reference=rebind(ref.reference!);}};
 if(node.omnic)visit(node.omnic);if(node.omnicDraft)visit(node.omnicDraft);for(const recipe of node.omnicHistory??[])visit(recipe);
 for(const edit of node.omnicEdits??[])if(edit.value!==undefined){
  if(pin&&edit.path.at(-1)==='referenceRevision'&&typeof edit.value==='number'){
   const step=edit.path.find(step=>typeof step==='object'),ref=step&&materialized&&referenceComponents(materialized).find(ref=>ref.id===step.id);if(ref)edit.value=pin(referenceBinding(ref.reference!),edit.value);
  }
  const embedded=(value:unknown):unknown=>{if(Array.isArray(value))return value.map(embedded);if(value&&typeof value==='object'){const object=value as {generator?:string;reference?:string;referenceRevision?:number};if(pin&&object.generator==='reference'&&object.reference&&object.referenceRevision!==undefined)object.referenceRevision=pin(referenceBinding(object.reference),object.referenceRevision);for(const [key,item]of Object.entries(value))if(item&&typeof item==='object')Object.assign(value,{[key]:embedded(item)});}return value;};
  edit.value=walkEdit(embedded(edit.value),rebind,edit.path.at(-1)==='reference');
 }
}
