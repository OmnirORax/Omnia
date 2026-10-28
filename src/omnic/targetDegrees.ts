import type { Component, Recipe } from './model.ts';
import { validateRecipe } from './model.ts';
import { definition, type Parameter, type Value } from './registry.ts';
import { legalAtoms } from './atomnic.ts';
import { editableDegrees, type EditableDegree, type FreedomAdjuster } from '../properties/editableDegrees.ts';

const components=(items:readonly Component[]):Component[]=>items.flatMap(item=>[item,...components(item.children??[])]);
/** Capabilities come from the existing generator's validated parameter adapter.
 * Realistic atom radius is a substrate setting, not a selected-target freedom. */
export function targetDegrees(recipe:Recipe,ids:readonly string[],adjusters:readonly FreedomAdjuster[]=[],fixed:readonly string[]=[]):EditableDegree[] {
  const index=new Map(components(recipe.components).map(item=>[item.id,item]));
  if(!ids.length||ids.some(id=>!index.has(id)))return [];
  return editableDegrees(ids.map(id=>({id,inputs:definition(index.get(id)!.generator,true)!.parameters.filter(input=>!fixed.includes(input.property))})),adjusters);
}
export function targetDegreeValue(recipe:Recipe,degree:EditableDegree):Value {
  const target=degree.targets[0],component=components(recipe.components).find(item=>item.id===target.id)!;
  return component?.params[target.input.key]??(target.input as Parameter).initial;
}
export function writeTargetDegree(recipe:Recipe,degree:EditableDegree,value:Value):Recipe {
  if(degree.properties.length!==1)throw Error('Use the registered operation for this freedom.');
  const targets=new Map(degree.targets.map(target=>[target.id,target.input.key]));
  const current=new Set(components(recipe.components).map(item=>item.id));
  if([...targets.keys()].some(id=>!current.has(id)))throw Error('The target no longer exists. Right-click the current pattern again.');
  const walk=(items:Component[]):Component[]=>items.map(item=>({...item,
    ...(targets.has(item.id)?{params:{...item.params,[targets.get(item.id)!]:value}}:{}),
    ...(item.children?{children:walk(item.children)}:{})}));
  const next=validateRecipe({...recipe,components:walk(recipe.components)});
  if(!legalAtoms(next))throw Error('That edit is outside the Realistic touching-lattice profile.');
  return next;
}
