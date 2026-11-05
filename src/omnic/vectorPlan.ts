import type {VisualAsset} from '../graph/assets.ts';
import type {Evaluation,StructuralNode} from './evaluate.ts';
import {evaluationBounds} from './svg.ts';
import {RENDER_BUDGET} from '../renderBudget.ts';
export type GlyphVectorPlan={nodes:readonly StructuralNode[];bounds:{x:number;y:number;width:number;height:number}};
const plans=new WeakMap<VisualAsset,GlyphVectorPlan>();
/** Transient render capability; never inserted into exported asset bytes. */
export function rememberVectorAsset(asset:VisualAsset,plan:GlyphVectorPlan|undefined){if(plan)plans.set(asset,plan);}
export const vectorAsset=(asset:VisualAsset)=>plans.get(asset);
export function glyphVectorPlan(evaluation:Evaluation,bounds?:GlyphVectorPlan['bounds']):GlyphVectorPlan|undefined{
 const nodes=evaluation.nodes.filter(node=>node.kind!=='group');
 if(!nodes.length||nodes.length>RENDER_BUDGET.omnicVectorPrimitives||evaluation.motion||nodes.some(node=>node.highlight||node.fillRegions?.length||node.glow||node.kind!=='line'&&node.radius<=0))return;
 return {nodes,bounds:bounds??evaluationBounds(evaluation)};
}
