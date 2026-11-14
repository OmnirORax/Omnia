import {validateRecipe,type Component,type Recipe} from './model.ts';
/** Equivalent definitions may use different editor-local handles. Pair their
 * meaningful ordered structure before importing a delta against the reused base. */
export function pairedHandles(source:Recipe,target:Recipe){
 const mapping=new Map<string,string>();
 const pair=(a:Component[],b:Component[])=>{if(a.length!==b.length)throw Error('Incompatible canonical definition.');a.forEach((c,i)=>{if(c.generator!==b[i].generator)throw Error('Incompatible canonical generator.');mapping.set(c.id,b[i].id);pair(c.children??[],b[i].children??[]);});};pair(source.components,target.components);
 for(const key of ['operations','frames'] as const){if(source[key].length!==target[key].length)throw Error('Incompatible canonical program.');source[key].forEach((item,i)=>mapping.set(item.id,target[key][i].id));}return mapping;
}
export function remapRecipeHandles(input:Recipe,mapping:ReadonlyMap<string,string>){
 const keys=[...mapping.keys()].sort((a,b)=>b.length-a.length),handle=(id:string)=>mapping.get(id)??id,role=(id:string)=>{const owner=keys.find(key=>id===key||id.startsWith(key+':'));return owner?handle(owner)+id.slice(owner.length):id;};
 const components=(items:Component[]):Component[]=>items.map(component=>({...component,id:handle(component.id),...(component.children?{children:components(component.children)}:{})}));
 return validateRecipe({...input,components:components(input.components),operations:input.operations.map(op=>({...op,id:handle(op.id),targets:op.targets.map(role)})),frames:input.frames.map(frame=>({...frame,id:handle(frame.id),scope:frame.scope.map(role)}))});
}
