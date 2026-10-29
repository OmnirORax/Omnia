import type { Component, Recipe } from './model.ts';
export function componentIndex(recipe:Recipe){
  const index=new Map<string,{component:Component;parent?:string}>();
  const walk=(items:Component[],parent?:string)=>items.forEach(component=>{index.set(component.id,{component,parent});walk(component.children??[],component.id);});
  walk(recipe.components);return index;
}
/** Selected ancestors own their descendants, so a group is processed once. */
export function rootTargets(recipe:Recipe,ids:readonly string[]):string[]{
  const index=componentIndex(recipe),chosen=new Set(ids.filter(id=>index.has(id)));
  return [...chosen].filter(id=>{let parent=index.get(id)?.parent;while(parent){if(chosen.has(parent))return false;parent=index.get(parent)?.parent;}return true;});
}
/** Deletion never converts an emptied explicit operation scope into 'all'. */
export function deleteComponents(recipe:Recipe,ids:ReadonlySet<string>):Recipe{
  if(!ids.size)return recipe;
  const removed=new Set<string>();
  const collect=(item:Component)=>{removed.add(item.id);item.children?.forEach(collect);};
  const walk=(items:Component[]):Component[]=>items.flatMap(item=>{if(ids.has(item.id)){collect(item);return [];}return [{...item,...(item.children?{children:walk(item.children)}:{})}];});
  const components=walk(recipe.components);
  const owners=[...componentIndex(recipe).keys()].sort((a,b)=>b.length-a.length);
  const survives=(role:string)=>{const owner=owners.find(id=>role===id||role.startsWith(`${id}:`));return !owner||!removed.has(owner);};
  return {...recipe,components,operations:recipe.operations.flatMap(op=>{const targets=op.targets.filter(survives);return op.targets.length&&!targets.length?[]:[{...op,targets}];}),frames:recipe.frames.flatMap(frame=>{const scope=frame.scope.filter(survives);return frame.scope.length&&!scope.length?[]:[{...frame,scope}];})};
}

/** Groups inherit the actual setters of their authored members. */
export function memberTargets(recipe:Recipe,ids:readonly string[]):string[]{
  const index=componentIndex(recipe);
  const members=(id:string):string[]=>{const item=index.get(id)?.component;return item?.generator==='group'?(item.children??[]).flatMap(child=>members(child.id)):item?[id]:[];};
  return rootTargets(recipe,ids).flatMap(members);
}
