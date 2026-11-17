import type {VisualAsset} from '../graph/assets.ts';
import type {Evaluation,StructuralNode} from './evaluate.ts';
import {evaluationBounds} from './svg.ts';
import {RENDER_BUDGET} from '../renderBudget.ts';
export type GlyphVectorPlan={nodes:readonly StructuralNode[];bounds:{x:number;y:number;width:number;height:number}};
const plans=new WeakMap<VisualAsset,GlyphVectorPlan>(),features=new WeakMap<VisualAsset,number>();
export function glyphFeatureSize(plan:GlyphVectorPlan){
 let width=Infinity;
 for(const n of plan.nodes){if(n.kind==='group'||n.opacity<=0)continue;const next=n.kind==='line'||!n.fill?n.thickness:2*n.radius;if(next>0)width=Math.min(width,next);}
 return Number.isFinite(width)?width/Math.max(plan.bounds.width,plan.bounds.height):0;
}
export function rememberGlyphFeature(asset:VisualAsset,plan:GlyphVectorPlan){features.set(asset,glyphFeatureSize(plan));}
export const glyphAssetFeature=(asset:VisualAsset)=>features.get(asset);
/** Transient render capability; never inserted into exported asset bytes. */
export function rememberVectorAsset(asset:VisualAsset,plan:GlyphVectorPlan|undefined){if(plan){plans.set(asset,plan);rememberGlyphFeature(asset,plan);}}
export const vectorAsset=(asset:VisualAsset)=>plans.get(asset);
export function glyphVectorPlan(evaluation:Evaluation,bounds?:GlyphVectorPlan['bounds']):GlyphVectorPlan|undefined{
 const nodes=evaluation.nodes.filter(node=>node.kind!=='group');
 if(!nodes.length||nodes.length>RENDER_BUDGET.omnicVectorPrimitives||evaluation.motion||nodes.some(node=>node.highlight||node.clip||node.fillRegions?.length||node.glow||node.kind!=='line'&&node.radius<=0))return;
 return {nodes,bounds:bounds??evaluationBounds(evaluation)};
}
