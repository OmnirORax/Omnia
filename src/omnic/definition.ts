import type {Structure,World} from '../core/model.ts';
import {applyRecipeDelta} from './delta.ts';
import type {Recipe} from './model.ts';
export function definitionRecipe(node:Structure,world:World,seen=new Set<Structure>()):Recipe|undefined{
 if(seen.has(node)||seen.size>32)throw Error('Circular Omnic inheritance.');seen.add(node);
 if(node.omnic)return node.omnic;
 const parent=node.variantOf&&world.nodes.find(candidate=>candidate.origin.born===node.variantOf!.born&&candidate.origin.at.every((n,i)=>n===node.variantOf!.at[i]));if(!parent)return undefined;
 const base=definitionRecipe(parent,world,seen);return base&&node.omnicEdits?.length?{...applyRecipeDelta(base,node.omnicEdits),revision:node.omnicRevision??base.revision}:base;
}
