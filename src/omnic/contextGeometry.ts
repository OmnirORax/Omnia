import {nodeRegionBounds} from './fillRegion.ts';
import type { Recipe } from './model.ts';
import { type Evaluation, type StructuralNode } from './evaluate.ts';
import { componentIndex, rootTargets } from './componentTargets.ts';
type ResizeRect={x:number;y:number;width:number;height:number};
/** Canonical authored owner of each rendered primitive, including reused recipes. */
export function authoredNodeOwners(recipe:Recipe,evaluation:Evaluation){
 const components=componentIndex(recipe),nodes=new Map(evaluation.nodes.map(node=>[node.id,node])),owners=new Map<string,string>();
 for(const node of evaluation.nodes){
  if(node.kind==='group')continue;
  let owner:StructuralNode|undefined=node;
  while(owner&&!components.has(owner.componentId))owner=owner.parent?nodes.get(owner.parent):undefined;
  if(owner)owners.set(node.id,owner.componentId);
 }
 return owners;
}
export function targetNodes(evaluation:Evaluation,ids:readonly string[]){
  const chosen=new Set(ids),index=new Map(evaluation.nodes.map(node=>[node.id,node]));
  const inside=(node:StructuralNode)=>{let current:StructuralNode|undefined=node;while(current){if(chosen.has(current.id)||chosen.has(current.componentId))return true;current=current.parent?index.get(current.parent):undefined;}return false;};
  return evaluation.nodes.filter(node=>node.kind!=='group'&&inside(node));
}
export function targetBounds(evaluation:Evaluation,ids:readonly string[]):ResizeRect|undefined{
  return primitiveBounds(targetNodes(evaluation,ids));
}
export function primitiveBounds(nodes:readonly StructuralNode[]):ResizeRect|undefined{
  const boxes=nodes.flatMap(node=>{const box=nodeRegionBounds(node);return box?[box]:[];});if(!boxes.length)return;
  const minX=Math.min(...boxes.map(b=>b.left)),maxX=Math.max(...boxes.map(b=>b.right)),minY=Math.min(...boxes.map(b=>b.top)),maxY=Math.max(...boxes.map(b=>b.bottom));
  return {x:minX,y:minY,width:Math.max(.001,maxX-minX),height:Math.max(.001,maxY-minY)};
}
export function targetLevels(recipe:Recipe,ids:readonly string[]):string[][]{
  const index=componentIndex(recipe),levels:string[][]=[];let current=rootTargets(recipe,ids);
  while(current.length){levels.push(current);const parents=[...new Set(current.flatMap(id=>index.get(id)?.parent??[]))];if(!parents.length)break;current=parents;}
  const roots=recipe.components.map(c=>c.id);if(roots.length&&levels.at(-1)?.join('|')!==roots.join('|'))levels.push(roots);
  return levels;
}
