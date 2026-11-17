import type {VisualAsset} from '../graph/assets.ts';
import type {Evaluation,StructuralNode} from './evaluate.ts';
import {evaluationBounds} from './svg.ts';
import {RENDER_BUDGET} from '../renderBudget.ts';
export type GlyphVectorPlan={nodes:readonly StructuralNode[];bounds:{x:number;y:number;width:number;height:number}};
const plans=new WeakMap<VisualAsset,GlyphVectorPlan>(),features=new WeakMap<VisualAsset,number>();
export function glyphFeatureSize(plan:GlyphVectorPlan){
 let width=Infinity,count=0,single:StructuralNode|undefined;
 for(const n of plan.nodes){if(n.kind==='group'||n.opacity<=0)continue;const next=n.kind==='line'||!n.fill?n.thickness:2*n.radius;if(next>0){width=Math.min(width,next);single=n;count++;}}
 // A lone mark has no inter-mark spacing to merge. A closed ring's hole,
 // or a single line's length, is its resolvable detail, not its thin stroke.
 if(count===1&&single){
  if(single.kind==='line')width=Math.max(single.thickness,Math.hypot((single.x2??single.x)-single.x,(single.y2??single.y)-single.y));
  else if(!single.fill)width=single.radius>single.thickness/2?2*single.radius-single.thickness:2*single.radius+single.thickness;
 }
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
