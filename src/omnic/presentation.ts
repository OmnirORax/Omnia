import { isOperationTool } from "./tools.ts";
import { RENDER_BUDGET } from "../renderBudget.ts";
import type { Document, Placement } from "../graph/structural.ts";
import type { Visual, VisualAsset } from "../graph/assets.ts";
import { referenceComponents, type Recipe, type RecipeResolver } from "./model.ts";
import { evaluateRecipe } from "./evaluate.ts";
import { renderSVG } from "./svg.ts";
import {objectResolver} from './revisions.ts';
const contexts = new WeakMap<Document,{recipes:Map<string,Recipe>;stamp:string;resolve:ReturnType<typeof objectResolver>;assets:Map<string,VisualAsset>}>();
const recipeTokens=new WeakMap<Recipe,number>();let nextRecipeToken=0;
const token=(recipe:Recipe)=>{let value=recipeTokens.get(recipe);if(value===undefined){value=++nextRecipeToken;recipeTokens.set(recipe,value);}return value;};
const pools=new WeakMap<Document["entities"],{recipes:Map<string,Recipe>;stamp:string;resolve:ReturnType<typeof objectResolver>}>();
const compiled = new WeakMap<Recipe,Map<string,string>>();
const liveIndexes = new WeakMap<Document['entities'], { users: Map<string, Set<string>>; affected: Map<string, Set<string>> }>();

/** Resolve live dependent identities once per immutable pool/edited identity.
 * Pinned edges stop propagation, including transitively frozen saved revisions. */
export function omnicLiveDependents(doc: Document, entityId: string): ReadonlySet<string> {
  let index = liveIndexes.get(doc.entities);
  if (!index) {
    const users = new Map<string, Set<string>>();
    for (const entity of doc.entities) if (entity.omnic) for (const reference of referenceComponents(entity.omnic)) {
      if (reference.referenceRevision !== undefined) continue;
      let entries = users.get(reference.reference!);
      if (!entries) users.set(reference.reference!, entries = new Set());
      entries.add(entity.id);
    }
    index = { users, affected: new Map() }; liveIndexes.set(doc.entities, index);
  }
  let affected = index.affected.get(entityId);
  if (!affected) {
    affected = new Set([entityId]); const pending = [entityId];
    for (let i = 0; i < pending.length; i++) for (const user of index.users.get(pending[i]) ?? [])
      if (!affected.has(user)) { affected.add(user); pending.push(user); }
    if (index.affected.size >= 8) index.affected.delete(index.affected.keys().next().value!);
    index.affected.set(entityId, affected);
  }
  return affected;
}
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
  const asset = recipeAsset(entityId, recipe, ctx.resolve, ctx.stamp);
  ctx.assets.set(entityId,asset);return asset;
}
function recipeAsset(entityId: string, recipe: Recipe, resolve: RecipeResolver, stamp: string): VisualAsset {
  let cache=compiled.get(recipe);if(!cache){cache=new Map();compiled.set(recipe,cache);}
  let dataUrl=cache.get(stamp);
  if(!dataUrl){
    let svg:string;
    try { svg=renderSVG(evaluateRecipe(recipe,resolve,0)); } catch { return {...omnicBudgetAsset,id:`omnic:${entityId}`}; }
    // Renderer output uses ASCII escapes for identifiers; UTF-8 encoding stays portable.
    const bytes=new TextEncoder().encode(svg);let binary='';for(const b of bytes)binary+=String.fromCharCode(b);
    dataUrl=`data:image/svg+xml;base64,${btoa(binary)}`;
    if(cache.size>=4)cache.delete(cache.keys().next().value!);cache.set(stamp,dataUrl);
  }
  const asset:VisualAsset={id:`omnic:${entityId}`,name:"Omnic structure",kind:"image",dataUrl};
  return asset;
}
/** A bounded renderer requests only its visible affected roots. No draft mutates
 * canonical definitions, archived pins, document revisions or saved asset bytes. */
export function omnicDraftAssets(doc: Document, editedId: string, draft: Recipe) {
  const ctx = context(doc), assets = new Map<string, VisualAsset>();
  const resolve: RecipeResolver = (id, revision) => id === editedId && revision === undefined ? draft : ctx.resolve(id, revision);
  const stamp = `${ctx.stamp}:draft:${editedId}:${token(draft)}`;
  return (entityId: string): VisualAsset | undefined => {
    const previous = assets.get(entityId); if (previous) return previous;
    const recipe = resolve(entityId); if (!recipe) return;
    const asset = recipeAsset(entityId, recipe, resolve, stamp); assets.set(entityId, asset); return asset;
  };
}
export const OMNIC_SCENE_BUDGET=RENDER_BUDGET.omnicSceneSources;
export const omnicBudgetAsset:VisualAsset={id:'omnic:budget',name:'Open Omnic composer for structure',kind:'image',dataUrl:'data:image/svg+xml;base64,'+btoa('<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" fill="#101e2d"/><text x="64" y="60" text-anchor="middle" font-size="15" fill="#60ddec">Open Omnic</text><text x="64" y="83" text-anchor="middle" font-size="11" fill="#60ddec">preview budget</text></svg>')};
