import type {OmnicSurface} from './surface.ts';
import {locate,type Structure,type World} from '../core/model.ts';
import type {VisualAsset} from '../graph/assets.ts';
import {RENDER_BUDGET} from '../renderBudget.ts';
import {definitionRecipe} from './definition.ts';
import {atlasRecipeResolver} from './bindings.ts';
import {evaluateRecipe} from './evaluate.ts';
import {renderSVG,svgDataUrl,selectionFeedback} from './svg.ts';
import {atomnicViewBounds} from './atomnicSettings.ts';
import {glyphVectorPlan,rememberVectorAsset} from './vectorPlan.ts';
/** Bounded, transient render artifacts. Definitions and references remain in the atlas. */
function buildGlyphPresentation(world:World,previewDrafts:boolean){
 const resolve=atlasRecipeResolver(world),cache=new Map<string,{asset:VisualAsset;motion:boolean;key:string;recipe:NonNullable<ReturnType<typeof definitionRecipe>>;bucket:number;selection:string}>();let serial=0;
 const recipes=new Map<string,ReturnType<typeof definitionRecipe>>();
 for(const node of world.nodes)if(node.omnic||node.variantOf||node.omnicDraft)recipes.set(JSON.stringify(node.origin),previewDrafts?(node.omnicDraft??definitionRecipe(node,world)):definitionRecipe(node,world));
 const animated=new Set<string>();
 return (node:Structure,time=0,preview?:OmnicSurface['preview'])=>{
  const owner=node.visual?.omnicEntityId??JSON.stringify(node.origin),recipe=preview?.recipe??recipes.get(owner);
  if(!recipe)return undefined;
  const selection=preview?JSON.stringify([preview.evaluation.selection,preview.hovered,preview.pivot,preview.ghost,preview.gridPitch,preview.bounds]):'',bucket=Math.floor(time*RENDER_BUDGET.omnicFps),known=cache.get(owner);
  if(known&&known.recipe===recipe&&known.selection===selection&&(!known.motion||known.bucket===bucket)){cache.delete(owner);cache.set(owner,known);return known;}
  if(!known&&cache.size>=RENDER_BUDGET.omnicSceneSources){const oldest=cache.keys().next().value!;cache.delete(oldest);animated.delete(oldest);}
  const evaluation=preview?.evaluation??evaluateRecipe(recipe,resolve,animated.size<RENDER_BUDGET.omnicSceneSources?time:0);
  if(evaluation.motion){if(evaluation.nodes.length>RENDER_BUDGET.omnicAnimatedRoles||!animated.has(owner)&&animated.size>=RENDER_BUDGET.omnicSceneSources){evaluation.motion=false;}else animated.add(owner);}
  const bounds=preview?.bounds??atomnicViewBounds(recipe.atomnic),svg=renderSVG(evaluation,{bounds,selected:preview?.evaluation.selection,hovered:preview?.hovered,pivot:preview?.pivot,ghost:preview?.ghost,gridPitch:preview?.gridPitch});
  const asset:VisualAsset={id:'omnic-render',name:locate(world,JSON.parse(owner))?.label??'Omnic',kind:'image',dataUrl:svgDataUrl(svg)};
  if(!preview?.ghost&&!preview?.pivot&&!preview?.hovered?.length&&!preview?.gridPitch)rememberVectorAsset(asset,glyphVectorPlan(selection?{...evaluation,nodes:[...evaluation.nodes,...selectionFeedback(evaluation,preview?.evaluation.selection)]}:evaluation,bounds));
  cache.delete(owner);const result={asset,motion:evaluation.motion,key:`${owner}:${++serial}`,recipe,bucket,selection};cache.set(owner,result);return result;
 };
}

const previous=new Map<boolean,{world:World;stamp:string;read:ReturnType<typeof buildGlyphPresentation>}>();
export function createGlyphPresentation(world:World,previewDrafts=false){
 const known=previous.get(previewDrafts);if(known?.world===world)return known.read;
 const stamp=JSON.stringify(world.nodes.map(node=>[node.origin,node.position,node.invariant,node.parts,node.variantOf,node.omnic,previewDrafts?node.omnicDraft:undefined,node.omnicEdits,node.omnicHistory]));
 const read=known&&stamp===known.stamp?known.read:buildGlyphPresentation(world,previewDrafts);previous.set(previewDrafts,{world,stamp,read});return read;
}
