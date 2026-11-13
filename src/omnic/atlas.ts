import {matchesStructure,type StructuralFilter} from './libraryIndex.ts';
import {definitionRecipe} from './definition.ts';
import {addStructure,locate,prepareWorld,sameOrigin,setInvariant,type Binding,type Origin,type Structure,type World} from '../core/model.ts';
import {validateRecipe,referenceComponents,type Recipe} from './model.ts';
import {recipeDelta} from './delta.ts';
import {recipeSpecification} from './specification.ts';
import {referenceBinding,referenceKey} from './bindings.ts';
export type Catalog={tags:string[];collections:string[];preset?:boolean};
export type AtlasFilter=StructuralFilter;
export type AtlasView={name:string;filter:AtlasFilter;roots?:Binding[]};
export {definitionRecipe} from './definition.ts';
export {atlasRecipeResolver as definitionResolver} from './bindings.ts';
export function saveDefinition(world:World,origin:Origin|undefined,input:Recipe,label:string):Origin{
 const recipe=validateRecipe({...input,version:2});world.version=3;
 const existing=origin&&locate(world,origin),before=existing&&structuredClone(existing);
 const node=existing??addStructure(world,[0,0,0]);node.label=label.slice(0,160);
 const parent=node.variantOf&&locate(world,node.variantOf),base=parent&&definitionRecipe(parent,world);
 if(base){node.omnicEdits=recipeDelta(base,recipe);node.omnicRevision=(node.omnicRevision??0)+1;delete node.omnic;}
 else node.omnic={...recipe,revision:(node.omnic?.revision??0)+1};
 delete node.omnicDraft;
 node.visual={...(node.visual?.size?{size:node.visual.size}:{}),...(node.visual?.showText!==undefined?{showText:node.visual.showText}:{}),omnicEntityId:JSON.stringify(node.origin)};
 const index=prepareWorld(world),key=index.specification(node),equivalent=world.nodes.find(candidate=>candidate!==node&&candidate.invariant&&index.specification(candidate)===key);
 if(equivalent){if(before){for(const key of Object.keys(node))delete (node as unknown as Record<string,unknown>)[key];Object.assign(node,before);}else world.nodes.splice(world.nodes.indexOf(node),1);return equivalent.origin;}
 if(!node.invariant)setInvariant(world,node,true);
 return node.origin;
}

export function pinDefinition(world:World,origin:Origin,active=new Set<Structure>()):number{
 const node=locate(world,origin);if(!node)throw Error('Definition is missing.');if(active.has(node))throw Error('Circular Omnic reference.');active.add(node);
 const current=definitionRecipe(node,world);if(!current)throw Error('No Omnic definition.');const frozen=structuredClone(current),prepared=prepareWorld(world);
 for(const reference of referenceComponents(frozen))if(reference.referenceRevision===undefined){const targets=prepared.resolve(referenceBinding(reference.reference!));if(targets.length!==1)throw Error('Reference needs disambiguation.');reference.referenceRevision=pinDefinition(world,targets[0].origin,active);}
 active.delete(node);const found=node.omnicHistory?.find(recipe=>recipeSpecification(recipe)===recipeSpecification(frozen));if(found)return found.revision;
 const revision=Math.max(0,...(node.omnicHistory??[]).map(recipe=>recipe.revision))+1;
 if((node.omnicHistory?.length??0)>=128)throw Error('Pinned definition history is full.');node.omnicHistory=[...(node.omnicHistory??[]),{...frozen,revision}];world.version=3;return revision;
}
export function addReference(recipe:Recipe,node:Structure,world:World,mode:Binding['mode'],pinned=false):Recipe{
 const key=referenceKey(node,mode,world),revision=pinned?pinDefinition(world,node.origin):undefined;
 return validateRecipe({...recipe,version:2,components:[...recipe.components,{id:crypto.randomUUID(),generator:'reference',params:{},reference:key,...(revision===undefined?{}:{referenceRevision:revision})}]});
}
export function matchesAtlas(node:Structure,world:World,filter:AtlasFilter):boolean{
 return matchesStructure(world,node,filter);
}
export function visibleInAtlas(world:World):Set<string>|undefined{
 const view=world.atlases?.[world.activeAtlas??0];if(!view)return undefined;
 const prepared=prepareWorld(world),roots=view.roots?.flatMap(binding=>prepared.resolve(binding));
 return new Set(world.nodes.filter(node=>matchesAtlas(node,world,view.filter)&&(!view.roots?.length||roots?.some(root=>sameOrigin(root.origin,node.origin)))).map(node=>JSON.stringify(node.origin)));
}
