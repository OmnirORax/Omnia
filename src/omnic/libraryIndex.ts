import type {Entity} from '../graph/structural.ts';
import {evaluateRecipe} from './evaluate.ts';
import {referenceComponents,type Component,type Recipe,type RecipeResolver} from './model.ts';
import {definition,defaultParams} from './registry.ts';
import {objectResolver} from './revisions.ts';
import type {LibraryItem,StructuralFilter} from './workspace.ts';

export type StructuralFacts={count:number;motion:boolean;boundary:boolean;filled:boolean;generators:string[];operators:string[];parameters:Record<string,number[]>;dependencies:{id:string;revision?:number}[];diagnostics:string[]};
export type IndexEntry={id:string;facts?:StructuralFacts;error?:string};
/** Per-library cache: queries only read these facts. They never run evaluators,
 * render thumbnails or expand references while typing or scrolling. */
export function createLibraryIndex(){
  const cache=new Map<string,{stamp:string;entry:IndexEntry}>();
  const tokens=new WeakMap<Recipe,number>();let token=0;
  return {
    update(entity:Entity,entities:readonly Entity[],resolve:RecipeResolver=objectResolver(entities)):IndexEntry {
      const seen=new Set<string>(),stampParts:unknown[]=[];let overflow=false;
      const stamp=(id:string,revision?:number,depth=0)=>{const key=JSON.stringify([id,revision??null]);if(seen.has(key))return;if(depth>12||seen.size>=256){overflow=true;return;}seen.add(key);const r=resolve(id,revision);if(r&&!tokens.has(r))tokens.set(r,++token);stampParts.push([key,r?tokens.get(r):null]);if(r)for(const c of referenceComponents(r))stamp(c.reference!,c.referenceRevision,depth+1);};
      stamp(entity.id);if(overflow)return {id:entity.id,error:'Library indexing is limited to 256 dependencies. Open the composer to inspect this object.'};
      const signature=JSON.stringify(stampParts),prior=cache.get(entity.id);if(prior?.stamp===signature)return prior.entry;
      let entry:IndexEntry;
      try{
        if(!entity.omnic)throw Error('No structural definition.');
        const output=evaluateRecipe(entity.omnic,resolve),generators=new Set<string>(),operators=new Set<string>(),parameters:Record<string,number[]>={};
        const seenRecipes=new Set<Recipe>();
        const inspect=(recipe:Recipe,depth=0)=>{
          if(depth>12||seenRecipes.has(recipe))return;seenRecipes.add(recipe);
          const params=(kind:string,generator:boolean,values:Component['params'])=>{const spec=definition(kind,generator);if(!spec)return;const all={...defaultParams(spec),...values};for(const p of spec.parameters)if(typeof all[p.key]==='number'){const list=parameters[p.property]??=[];list.push(all[p.key] as number);}};
          const walk=(c:Component)=>{generators.add(c.generator);params(c.generator,true,c.params);c.children?.forEach(walk);if(c.reference){const r=resolve(c.reference,c.referenceRevision);if(r)inspect(r,depth+1);}};
          recipe.components.forEach(walk);for(const op of recipe.operations)if(op.enabled){operators.add(op.operator);params(op.operator,false,op.params);}
        };inspect(entity.omnic);
        entry={id:entity.id,facts:{count:output.properties.count,motion:output.motion,boundary:output.nodes.some(n=>n.kind==='ring'),filled:output.nodes.some(n=>n.kind==='dot'&&n.fill),generators:[...generators],operators:[...operators],parameters,dependencies:referenceComponents(entity.omnic).map(c=>({id:c.reference!,...(c.referenceRevision===undefined?{}:{revision:c.referenceRevision})})),diagnostics:output.diagnostics.map(d=>d.message)}};
      }catch(error){entry={id:entity.id,error:error instanceof Error?error.message:String(error)};}
      cache.set(entity.id,{stamp:signature,entry});return entry;
    },
    prune(ids:Set<string>){for(const id of cache.keys())if(!ids.has(id))cache.delete(id);},
  };
}
const searchTexts=new WeakMap<Entity,{tags:LibraryItem['tags']|undefined;text:string}>();
function searchable(entity:Entity,item:LibraryItem|undefined){let cached=searchTexts.get(entity);if(!cached||cached.tags!==item?.tags){cached={tags:item?.tags,text:[entity.label,...entity.aliases,...(item?.tags??[])].join(' ').toLocaleLowerCase()};searchTexts.set(entity,cached);}return cached.text;}
export function matchesLibrary(entity:Entity,item:LibraryItem|undefined,entry:IndexEntry|undefined,filter:StructuralFilter,collections?:Set<string>):boolean {
  const text=(filter.text??'').trim().toLocaleLowerCase();
  if(text&&!searchable(entity,item).includes(text))return false;
  if(filter.tags?.some(tag=>!item?.tags.includes(tag))||filter.collection&&!item?.collections.some(id=>collections?collections.has(id):id===filter.collection))return false;
  const needsFacts=['generator','operator','countMin','countMax','motion','boundary','filled','parameter'].some(key=>filter[key as keyof StructuralFilter]!==undefined);
  const facts=entry?.facts;if(needsFacts&&!facts)return false;if(!facts)return true;
  if(filter.generator&&!facts.generators.includes(filter.generator)||filter.operator&&!facts.operators.includes(filter.operator))return false;
  if(filter.countMin!==undefined&&facts.count<filter.countMin||filter.countMax!==undefined&&facts.count>filter.countMax)return false;
  for(const key of ['motion','boundary','filled'] as const)if(filter[key]!==undefined&&facts[key]!==filter[key])return false;
  if(filter.parameter&&!facts.parameters[filter.parameter.property]?.some(value=>value>=filter.parameter!.min&&value<=filter.parameter!.max))return false;
  return true;
}
const workspaceIndexes=new Map<string,ReturnType<typeof createLibraryIndex>>();
export function workspaceLibraryIndex(workspaceId:string){
  let index=workspaceIndexes.get(workspaceId);if(!index)index=createLibraryIndex();
  workspaceIndexes.delete(workspaceId);workspaceIndexes.set(workspaceId,index);
  if(workspaceIndexes.size>2)workspaceIndexes.delete(workspaceIndexes.keys().next().value!);return index;
}
