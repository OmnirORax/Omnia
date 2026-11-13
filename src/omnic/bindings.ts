import {definitionRecipe} from './definition.ts';
import {bind,prepareWorld,type Binding,type Structure,type World} from '../core/model.ts';
import type {Recipe,RecipeResolver} from './model.ts';
export type OmnicStructure=Structure&{omnic?:Recipe;omnicHistory?:Recipe[]};
/** The evaluator's string key encodes a real atlas binder, never another object ID. */
export const referenceKey=(node:Structure,mode:Binding['mode'],world:World)=>JSON.stringify(bind(node,mode,world));
export function referenceBinding(key:string):Binding{
 const value=JSON.parse(key),point=(p:unknown)=>Array.isArray(p)&&p.length===3&&p.every(n=>typeof n==='number'&&Number.isFinite(n));
 if(value?.mode==='follow'&&typeof value.origin?.born==='number'&&Number.isFinite(value.origin.born)&&point(value.origin.at))return value;
 if(value?.mode==='position'&&point(value.at))return value;
 if(value?.mode==='structure'&&typeof value.specification==='string'&&value.specification.length<=16000)return value;
 throw Error('Invalid Omnium reference.');
}
/** One atlas index per immutable world; ambiguous targets never pick an arbitrary owner. */
export function atlasRecipeResolver(world:World):RecipeResolver{
 const prepared=prepareWorld(world);
 return(key,revision)=>{
  let binding:Binding;try{binding=referenceBinding(key);}catch{return undefined;}
  const matches=prepared.resolve(binding);if(matches.length!==1)return undefined;
  const node=matches[0] as OmnicStructure;
  return revision===undefined?definitionRecipe(node,world):node.omnicHistory?.find(recipe=>recipe.revision===revision);
 };
}
