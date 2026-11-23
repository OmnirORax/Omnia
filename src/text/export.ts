import {type World,type Origin,type Structure} from '../core/model.ts';
import {address,inherited} from '../core/lattice.ts';
import {hierarchyScope} from '../core/hierarchy.ts';
import {plainNodeText} from './model.ts';
const headingName=(name:string)=>name.replace(/[\r\n\u2028\u2029]+/g,' ').trim().replace(/[\\`*_[\]<>#~&]/g,'\\$&')||'Untitled';
/** Export only selected nodes in stable parent-first order. A selected tree root
 * starts at H1; actual descendant depth is retained (Markdown supports H1–H6). */
export function selectedDocumentText(world:World,origins:readonly Origin[]){
 const selected=new Set(origins.map(address));if(!selected.size)throw Error('Select nodes to copy their documents.');
 const scope=hierarchyScope(world,[],false,true),resolved=new Map<string,Structure>(),byId=new Map(world.nodes.map(node=>[address(node.origin),node]));
 const actual=(node:Structure)=>{const id=address(node.origin);let value=resolved.get(id);if(!value){value=inherited(node,world);resolved.set(id,value);}return value;};
 const label=(id:string)=>{const node=byId.get(id);return node?actual(node).label:undefined;};
 const pending=scope.roots.map(node=>({node,depth:0,start:undefined as number|undefined})).reverse(),seen=new Set<string>(),sections:string[]=[];
 while(pending.length){const entry=pending.pop()!,{node,depth}=entry,id=address(node.origin);if(seen.has(id))throw Error('Circular node hierarchy.');seen.add(id);let start=entry.start;
  if(selected.has(id)){start??=depth;const value=actual(node),heading=`${'#'.repeat(Math.min(6,depth-start+1))} ${headingName(value.label)}`,body=value.text?plainNodeText(value.text,label):'';sections.push(body?`${heading}\n${body}`:heading);selected.delete(id);}
  const children=scope.children.get(id)??[];for(let i=children.length-1;i>=0;i--)pending.push({node:children[i],depth:depth+1,start});
 }
 if(selected.size)throw Error('Some selected nodes are unavailable or have a circular hierarchy.');
 return sections.join('\n');
}
