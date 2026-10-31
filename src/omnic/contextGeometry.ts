import { RENDER_BUDGET } from '../renderBudget.ts';
import type { Recipe, RecipeResolver } from './model.ts';
import { evaluateRecipe, type Evaluation, type StructuralNode } from './evaluate.ts';
import { componentIndex, rootTargets } from './componentTargets.ts';
import { compactButtons } from '../ui/selection.ts';
import { translateTargets, targetDegreeValue, targetParameter, writeTargetDegree } from './targetDegrees.ts';
import { legalAtoms } from './atomnic.ts';
import type { EditableDegree } from '../properties/editableDegrees.ts';
import type { ResizeRect } from '../ui/resizeGeometry.ts';
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
  if(!nodes.length)return;
  const minX=Math.min(...nodes.map(node=>Math.min(node.x-node.radius-node.thickness/2,(node.x2??node.x)-node.thickness/2))),maxX=Math.max(...nodes.map(node=>Math.max(node.x+node.radius+node.thickness/2,(node.x2??node.x)+node.thickness/2)));
  const minY=Math.min(...nodes.map(node=>Math.min(node.y-node.radius-node.thickness/2,(node.y2??node.y)-node.thickness/2))),maxY=Math.max(...nodes.map(node=>Math.max(node.y+node.radius+node.thickness/2,(node.y2??node.y)+node.thickness/2)));
  return {x:minX,y:minY,width:Math.max(.001,maxX-minX),height:Math.max(.001,maxY-minY)};
}
export function targetLevels(recipe:Recipe,ids:readonly string[]):string[][]{
  const index=componentIndex(recipe),levels:string[][]=[];let current=rootTargets(recipe,ids);
  while(current.length){levels.push(current);const parents=[...new Set(current.flatMap(id=>index.get(id)?.parent??[]))];if(!parents.length)break;current=parents;}
  const roots=recipe.components.map(c=>c.id);if(roots.length&&levels.at(-1)?.join('|')!==roots.join('|'))levels.push(roots);
  return levels;
}
/** Reuse the UI packer on authored component bounds. Bounded and click-only. */
export function compactGeometry(recipe:Recipe,evaluation:Evaluation,ids:readonly string[],area:ResizeRect):Recipe{
  const roots=rootTargets(recipe,ids),index=componentIndex(recipe);
  const targets=roots.length===1?index.get(roots[0])?.component.children?.map(c=>c.id)??roots:roots;
  if(targets.length<2)return recipe;
  if(targets.length>32)throw Error('Compact supports up to 32 geometry targets per operation.');
  const boxes=targets.flatMap(id=>{const bounds=targetBounds(evaluation,[id]);return bounds?[{id,...bounds}]:[];});
  const chosen=new Set(targets),parents=new Set(targets.map(id=>index.get(id)?.parent));
  const obstacles=[...index].filter(([id,item])=>parents.has(item.parent)&&!chosen.has(id)).flatMap(([id])=>{const bounds=targetBounds(evaluation,[id]);return bounds?[bounds]:[];});
  const packed=compactButtons(boxes,obstacles,area,1);let next=recipe;
  for(const box of boxes){const moved=packed.find(item=>item.id===box.id)!;next=translateTargets(next,new Set([box.id]),{x:moved.x-box.x,y:moved.y-box.y});}
  if(!legalAtoms(next))throw Error('Compact would leave the Realistic lattice. Use Free or adjust its placement.');
  return next;
}

/** Solve supported length fields against actual node edges with bounded samples.
 * No iterative search, pointer-time evaluation, or inferred pixel measurements. */
export function fitDegreeValue(recipe:Recipe,evaluation:Evaluation,degree:EditableDegree,ids:readonly string[],area:ResizeRect,resolve?:RecipeResolver):number{
  if(evaluation.nodes.length>RENDER_BUDGET.omnicAnimatedRoles)throw Error(`Edge fit supports up to ${RENDER_BUDGET.omnicAnimatedRoles} evaluated roles.`);
  const parameter=targetParameter(degree),value=Number(targetDegreeValue(recipe,degree));
  const delta=value<parameter.max!?Math.min(1,parameter.max!-value):-Math.min(1,value-parameter.min!);
  if(!delta)throw Error('This dimension has no writable range.');
  const baseline=evaluateRecipe(writeTargetDegree(recipe,degree,value),resolve),sample=evaluateRecipe(writeTargetDegree(recipe,degree,value+delta),resolve);
  const samples=new Map(targetNodes(sample,ids).map(node=>[node.id,node]));
  const edges=(node:StructuralNode)=>[Math.min(node.x-node.radius,node.x2??node.x)-node.thickness/2,Math.max(node.x+node.radius,node.x2??node.x)+node.thickness/2,Math.min(node.y-node.radius,node.y2??node.y)-node.thickness/2,Math.max(node.y+node.radius,node.y2??node.y)+node.thickness/2];
  const bounds=[area.x,area.x+area.width,area.y,area.y+area.height];let low=parameter.min!,high=parameter.max!;
  for(const node of targetNodes(baseline,ids)){
    const other=samples.get(node.id);if(!other)throw Error('This transform changes role identity; edit the dimension directly.');
    const before=edges(node),after=edges(other);
    for(let axis=0;axis<4;axis++){
      const sign=axis%2===0?-1:1,at=before[axis]*sign,slope=(after[axis]-before[axis])/delta*sign,limit=bounds[axis]*sign;
      if(Math.abs(slope)<1e-9){if(at>limit+1e-6)throw Error('Move the target inside its boundary before fitting.');continue;}
      const edge=value+(limit-at)/slope;if(slope>0)high=Math.min(high,edge);else low=Math.max(low,edge);
    }
  }
  if(high<low-1e-6)throw Error('No legal size fits these edges.');
  const result=Math.max(low,high),candidate=evaluateRecipe(writeTargetDegree(recipe,degree,result),resolve);
  for(const node of targetNodes(candidate,ids)){const actual=edges(node);if(actual.some((edge,axis)=>axis%2===0?edge<bounds[axis]-1e-5:edge>bounds[axis]+1e-5))throw Error('This nonlinear transform cannot fit in one step; edit the dimension directly.');}
  return result;
}
