import { isOperationTool } from "./tools.ts";
import { RENDER_BUDGET } from "../renderBudget.ts";
import type { Document, Placement } from "../graph/structural.ts";
import type { Visual, VisualAsset } from "../graph/assets.ts";
import type { Recipe } from "./model.ts";
import { evaluateRecipe } from "./evaluate.ts";
import { renderSVG } from "./svg.ts";
import {objectResolver} from './revisions.ts';
const contexts = new WeakMap<Document,{recipes:Map<string,Recipe>;stamp:string;resolve:ReturnType<typeof objectResolver>;assets:Map<string,VisualAsset>}>();
const recipeTokens=new WeakMap<Recipe,number>();let nextRecipeToken=0;
const token=(recipe:Recipe)=>{let value=recipeTokens.get(recipe);if(value===undefined){value=++nextRecipeToken;recipeTokens.set(recipe,value);}return value;};
const pools=new WeakMap<Document["entities"],{recipes:Map<string,Recipe>;stamp:string;resolve:ReturnType<typeof objectResolver>}>();
const compiled = new WeakMap<Recipe,Map<string,string>>();
function context(doc:Document) {
  let value=contexts.get(doc);if(value)return value;
  let pool=pools.get(doc.entities);if(!pool){const recipes=new Map(doc.entities.flatMap(e=>e.omnic?[[e.id,e.omnic] as const]:[]));pool={recipes,stamp:JSON.stringify(doc.entities.filter(e=>e.omnic).map(e=>[e.id,token(e.omnic!),e.omnicHistory?.map(token)])),resolve:objectResolver(doc.entities)};pools.set(doc.entities,pool);}
  value={...pool,assets:new Map()};contexts.set(doc,value);return value;
}
/** Derived presentation envelope only; this object is never saved as a recipe/asset. */
export function structuralVisual(doc:Document,p:Pick<Placement,"entityId"|"visual">):Visual|undefined {
  if(p.visual?.assetId||p.visual?.character||!context(doc).recipes.has(p.entityId))return p.visual;
  return {...p.visual,assetId:`omnic:${p.entityId}`,showText:p.visual?.showText??isOperationTool(context(doc).recipes.get(p.entityId)!)};
}
export function omnicAsset(doc:Document,entityId:string):VisualAsset|undefined {
  const ctx=context(doc),recipe=ctx.recipes.get(entityId);if(!recipe)return;
  const existing=ctx.assets.get(entityId);if(existing)return existing;
  let cache=compiled.get(recipe);if(!cache){cache=new Map();compiled.set(recipe,cache);}
  let dataUrl=cache.get(ctx.stamp);
  if(!dataUrl){
    let svg:string;
    try { svg=renderSVG(evaluateRecipe(recipe,ctx.resolve,0)); } catch { return {...omnicBudgetAsset,id:`omnic:${entityId}`}; }
    // Renderer output uses ASCII escapes for identifiers; UTF-8 encoding stays portable.
    const bytes=new TextEncoder().encode(svg);let binary='';for(const b of bytes)binary+=String.fromCharCode(b);
    dataUrl=`data:image/svg+xml;base64,${btoa(binary)}`;
    if(cache.size>=4)cache.delete(cache.keys().next().value!);cache.set(ctx.stamp,dataUrl);
  }
  const asset:VisualAsset={id:`omnic:${entityId}`,name:"Omnic structure",kind:"image",dataUrl};
  ctx.assets.set(entityId,asset);return asset;
}
export const OMNIC_SCENE_BUDGET=RENDER_BUDGET.omnicSceneSources;
export const omnicBudgetAsset:VisualAsset={id:'omnic:budget',name:'Open Omnic composer for structure',kind:'image',dataUrl:'data:image/svg+xml;base64,'+btoa('<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" fill="#101e2d"/><text x="64" y="60" text-anchor="middle" font-size="15" fill="#60ddec">Open Omnic</text><text x="64" y="83" text-anchor="middle" font-size="11" fill="#60ddec">preview budget</text></svg>')};
