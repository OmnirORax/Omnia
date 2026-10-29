import type { Component, Recipe } from './model.ts';
import { validateRecipe } from './model.ts';
import { applicableParameters, definition, type Parameter, type Value } from './registry.ts';
import { legalAtoms } from './atomnic.ts';
import { editableDegrees, type EditableDegree, type FreedomAdjuster } from '../properties/editableDegrees.ts';

const components=(items:readonly Component[]):Component[]=>items.flatMap(item=>[item,...components(item.children??[])]);
/** Capabilities come from the existing generator's validated parameter adapter.
 * Realistic atom radius is a substrate setting, not a selected-target freedom. */
export function targetDegrees(recipe:Recipe,ids:readonly string[],adjusters:readonly FreedomAdjuster[]=[],fixed:readonly string[]=[],coverage:'common'|'available'='common'):EditableDegree[] {
  const index=new Map([...components(recipe.components),...recipe.operations].map(item=>[item.id,item]));
  if(!ids.length||ids.some(id=>!index.has(id)))return [];
  return editableDegrees(ids.map(id=>{const item=index.get(id)!;const spec='generator' in item?definition(item.generator,true)!:definition(item.operator)!;return {id,inputs:applicableParameters(spec,item.params).filter(input=>!fixed.includes(input.property))};}),adjusters,coverage);
}
export function targetDegreeValue(recipe:Recipe,degree:EditableDegree):Value {
  const target=degree.targets[0],component=[...components(recipe.components),...recipe.operations].find(item=>item.id===target.id)!;
  return component?.params[target.input.key]??(target.input as Parameter).initial;
}
export function writeTargetDegree(recipe:Recipe,degree:EditableDegree,value:Value):Recipe {
  if(degree.properties.length!==1)throw Error('Use the registered operation for this freedom.');
  const targets=new Map(degree.targets.map(target=>[target.id,target.input.key]));
  const current=new Set([...components(recipe.components),...recipe.operations].map(item=>item.id));
  if([...targets.keys()].some(id=>!current.has(id)))throw Error('The target no longer exists. Right-click the current pattern again.');
  const walk=(items:Component[]):Component[]=>items.map(item=>({...item,
    ...(targets.has(item.id)?{params:{...item.params,[targets.get(item.id)!]:value}}:{}),
    ...(item.children?{children:walk(item.children)}:{})}));
  const next=validateRecipe({...recipe,components:walk(recipe.components),operations:recipe.operations.map(item=>targets.has(item.id)?{...item,params:{...item.params,[targets.get(item.id)!]:value}}:item)});
  if(!legalAtoms(next))throw Error('That edit is outside the Realistic touching-lattice profile.');
  return next;
}

/** Translate authored targets once each; selected ancestors own their children. */
export function translateTargets(recipe:Recipe,ids:ReadonlySet<string>,delta:{x:number;y:number}):Recipe {
  const index=new Map(components(recipe.components).map(item=>[item.id,item]));
  if(!ids.size||[...ids].some(id=>!index.has(id)))throw Error('The movement target no longer exists.');
  const walk=(items:Component[]):Component[]=>items.map(item=>{
    if(ids.has(item.id)){
      const parameters=definition(item.generator,true)!.parameters;
      const x=parameters.find(p=>p.property==='omnic.coordinate.x'),y=parameters.find(p=>p.property==='omnic.coordinate.y');
      if(!x||!y)throw Error('This target has no position adapter.');
      return {...item,params:{...item.params,[x.key]:Number(item.params[x.key]??x.initial)+delta.x,[y.key]:Number(item.params[y.key]??y.initial)+delta.y}};
    }
    return item.children?{...item,children:walk(item.children)}:item;
  });
  const next=validateRecipe({...recipe,components:walk(recipe.components)});
  if(!legalAtoms(next))throw Error('That movement is outside the Realistic touching-lattice profile.');
  return next;
}
