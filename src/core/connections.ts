import {prepareWorld,sameOrigin,type Origin,type Structure,type World} from './model.ts';
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
