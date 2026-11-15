import type {Evaluation} from './evaluate.ts';
import {nodeRegionBounds} from './fillRegion.ts';
import {evaluationBounds} from './svg.ts';
/** One shared conversion, rather than normalizing every glyph to the same size. */
export const GLYPH_UNITS_PER_NODE=100;
export const glyphPresentationScale=(viewport:{width:number;height:number})=>Math.max(viewport.width,viewport.height)/GLYPH_UNITS_PER_NODE;
/** Visible ink in the normalized, square SVG/vector surface. No raster reads. */
export function glyphPresentationBounds(evaluation:Evaluation,viewport=evaluationBounds(evaluation)){
 const span=Math.max(viewport.width,viewport.height),cx=viewport.x+viewport.width/2,cy=viewport.y+viewport.height/2;
 let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
 for(const node of evaluation.nodes){if(node.kind==='group'||node.opacity<=0)continue;const b=nodeRegionBounds(node);if(!b)continue;
  left=Math.min(left,b.left);right=Math.max(right,b.right);top=Math.min(top,b.top);bottom=Math.max(bottom,b.bottom);
 }
 if(!Number.isFinite(left)||!(span>0))return {x:0,y:0,width:0,height:0};
 const l=Math.max(-.5,(left-cx)/span),r=Math.min(.5,(right-cx)/span),t=Math.max(-.5,(top-cy)/span),b=Math.min(.5,(bottom-cy)/span);
 return {x:(l+r)/2,y:-(t+b)/2,width:Math.max(0,r-l),height:Math.max(0,b-t)};
}
