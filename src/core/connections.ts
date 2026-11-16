import {adoptNodes} from './nodeOperations.ts';
import {bind,locate,prepareWorld,sameOrigin,type Origin,type Structure,type World} from './model.ts';
export type Edge={kind:'part';owner:Origin;index:number}|{kind:'child';owner:Origin;child:Origin}|{kind:'relationship';index:number}|{kind:'variant';owner:Origin};
export type Connection={source:Structure;target:Structure;text:string;edge:Edge};
/** Hierarchy is authored by parent, independently of a node's composition parts. */
export function* worldConnections(world:World,prepared=prepareWorld(world)):Generator<Connection>{
 const nodes=new Map(world.nodes.map(node=>[JSON.stringify(node.origin),node]));
 for(const child of world.nodes){
  const parent=child.parent&&nodes.get(JSON.stringify(child.parent));
  if(parent&&!(child.variantOf&&sameOrigin(child.variantOf,parent.origin)))yield {source:parent,target:child,text:'⋔',edge:{kind:'child',owner:parent.origin,child:child.origin}};
 }
 for(const source of world.nodes)for(const [index,binding]of source.parts.entries())for(const target of prepared.resolve(binding)){
  if(target.parent&&sameOrigin(target.parent,source.origin))continue;
  yield {source,target,text:'⋔',edge:{kind:'part',owner:source.origin,index}};
 }
 for(const target of world.nodes){const source=target.variantOf&&nodes.get(JSON.stringify(target.variantOf));if(source)yield {source,target,text:'variant',edge:{kind:'variant',owner:target.origin}};}
 for(const [index,relation]of (world.relationships??[]).entries())for(const source of prepared.resolve(relation.from))for(const target of prepared.resolve(relation.to))yield {source,target,text:relation.label,edge:{kind:'relationship',index}};
}

export function reconnectBinder(world:World,edge:Edge,target:Origin){const node=locate(world,target);if(!node)throw Error('The target no longer exists.');if(edge.kind==='relationship'){const relation=world.relationships?.[edge.index];if(!relation)throw Error('The binder no longer exists.');relation.to=bind(node,'follow',world);}else if(edge.kind==='part'){const owner=locate(world,edge.owner);if(!owner?.parts[edge.index])throw Error('The binder no longer exists.');owner.parts[edge.index]=bind(node,'follow',world);}else if(edge.kind==='child')adoptNodes(world,[edge.child],target,[0,0,0]);else{const variant=locate(world,edge.owner);if(!variant)throw Error('The binder no longer exists.');if(sameOrigin(edge.owner,target))throw Error('A variant cannot be its own template.');const previous=variant.variantOf;variant.variantOf=structuredClone(target);if(variant.parent&&previous&&sameOrigin(variant.parent,previous))variant.parent=structuredClone(target);}}
