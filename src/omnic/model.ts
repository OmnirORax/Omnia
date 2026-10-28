import { checkedParams, definition, type Value } from "./registry.ts";
import { ATOMNIC_PARAMETERS } from './atomnicSettings.ts';
export type Params = Record<string,Value>;
export type Component = { id:string; generator:string; params:Params; children?:Component[]; reference?:string; referenceRevision?:number };
export type Application = { id:string; operator:string; targets:string[]; params:Params; enabled:boolean };
export type Frame = { id:string; property:string; state:"inactive"|"unspecified"|"specified"; value?:Value; scope:string[] };
export type Recipe = { version:1|2; revision:number; components:Component[]; operations:Application[]; frames:Frame[]; atomnic?:Params };
export const LIMITS = { components:128, operations:128, frames:64, depth:12, nodes:1024, work:200_000, extent:1_000_000 } as const;
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
const identifier=(v:unknown):v is string=>typeof v==="string"&&/^[a-zA-Z0-9_.:/-]{1,200}$/.test(v)&&v!=="__proto__"&&v!=="constructor"&&v!=="prototype";
const targets=(v:unknown):v is string[]=>Array.isArray(v)&&v.length<=LIMITS.nodes&&v.every(value=>typeof value==="string"&&value.length>0&&value.length<=4096);
/** Structural shape validation does not reject unresolved role addresses: generator
 * edits may remove a role and the editor must expose it for explicit repair. */
export function validateRecipe(input:unknown):Recipe {
  if(!object(input)||(input.version!==1&&input.version!==2)||!Number.isSafeInteger(input.revision)||Number(input.revision)<0||!Array.isArray(input.components)||!Array.isArray(input.operations)||input.operations.length>LIMITS.operations||!Array.isArray(input.frames)||input.frames.length>LIMITS.frames)throw Error("Invalid Omnic recipe header or budget.");
  const ids=new Set<string>();let count=0;
  const unique=(id:unknown)=>{if(!identifier(id)||ids.has(id))throw Error("Invalid or duplicate Omnic identity.");ids.add(id);return id;};
  const component=(value:unknown,depth:number):Component=>{
    if(!object(value)||depth>LIMITS.depth||++count>LIMITS.components)throw Error("Omnic component/depth budget exceeded.");
    const id=unique(value.id),spec=definition(String(value.generator),true);if(!spec)throw Error("Unknown Omnic generator.");
    const result:Component={id,generator:spec.id,params:checkedParams(value.params,spec)};
    if(value.children!==undefined){if(!Array.isArray(value.children)||spec.id!=="group")throw Error("Only groups contain authored components.");result.children=value.children.map(c=>component(c,depth+1));}
    if(spec.id==="reference"){if(typeof value.reference!=="string"||!value.reference.length||value.reference.length>200)throw Error("Missing canonical Omnic reference.");result.reference=value.reference;}
    else if(value.reference!==undefined)throw Error("Only references specify an object identity.");
    if(value.referenceRevision!==undefined){if(input.version!==2||spec.id!=="reference"||!Number.isSafeInteger(value.referenceRevision)||Number(value.referenceRevision)<0)throw Error("Pinned Omnic revisions require recipe version 2.");result.referenceRevision=Number(value.referenceRevision);}
    return result;
  };
  const components=input.components.map(c=>component(c,1));
  const operations:Application[]=input.operations.map(value=>{
    if(!object(value)||typeof value.enabled!=="boolean"||!targets(value.targets))throw Error("Invalid Omnic application.");
    const id=unique(value.id),spec=definition(String(value.operator));if(!spec)throw Error("Unknown Omnic operator.");
    return {id,operator:spec.id,params:checkedParams(value.params,spec),targets:[...value.targets],enabled:value.enabled};
  });
  const frames:Frame[]=input.frames.map(value=>{
    if(!object(value)||!identifier(value.property)||!["inactive","unspecified","specified"].includes(String(value.state))||!targets(value.scope))throw Error("Invalid Omnic frame.");
    const id=unique(value.id),state=value.state as Frame["state"];
    if(state==="specified"&&!(typeof value.value==="boolean"||typeof value.value==="string"&&value.value.length<=200||typeof value.value==="number"&&Number.isFinite(value.value)))throw Error("Specified frame requires an explicit value.");
    if(state!=="specified"&&value.value!==undefined)throw Error("Inactive/unspecified frames must not contain a specified value.");
    return {id,property:value.property,state,scope:[...value.scope],...(state==="specified"?{value:value.value as Value}:{})};
  });
  const atomnic=input.atomnic===undefined?undefined:checkedParams(input.atomnic,{id:'atomnic',label:'Atomnic',parameters:ATOMNIC_PARAMETERS});
  return {version:input.version,revision:Number(input.revision),components,operations,frames,...(atomnic?{atomnic}:{})};
}
export function recipeReferences(recipe:Recipe):string[]{const result:string[]=[];const visit=(c:Component)=>{if(c.reference)result.push(c.reference);c.children?.forEach(visit);};recipe.components.forEach(visit);return [...new Set(result)];}
/** Validate against the complete candidate atlas, including references through
 * other objects; editing a shared definition cannot introduce indirect cycles. */
export type RecipeResolver=(id:string,revision?:number)=>Recipe|undefined;
export function referenceComponents(recipe:Recipe):Component[]{const result:Component[]=[];const visit=(c:Component)=>{if(c.reference)result.push(c);c.children?.forEach(visit);};recipe.components.forEach(visit);return result;}
export function validateRecipeReferences(recipes:Map<string,Recipe>,resolve:RecipeResolver=(id,revision)=>revision===undefined?recipes.get(id):undefined,historical:Recipe[]=[]):void {
  const done=new Map<string,number>(),stack=new Set<string>();
  const visit=(id:string,depth:number,revision?:number)=>{
    const key=JSON.stringify([id,revision??null]);
    if(stack.has(key))throw Error(`Circular Omnic reference: ${id}`);
    if(depth>LIMITS.depth)throw Error("Omnic dependency depth exceeded.");
    const height=done.get(key);if(height!==undefined){if(depth+height-1>LIMITS.depth)throw Error('Omnic dependency depth exceeded.');return height;}
    const recipe=resolve(id,revision);if(!recipe)throw Error(`Missing Omnic object or revision: ${id}${revision===undefined?'':` @ ${revision}`}`);
    let longest=1;stack.add(key);for(const reference of referenceComponents(recipe))longest=Math.max(longest,1+visit(reference.reference!,depth+1,reference.referenceRevision));stack.delete(key);done.set(key,longest);return longest;
  };
  for(const id of recipes.keys())visit(id,1);
  for(const recipe of historical)for(const reference of referenceComponents(recipe))visit(reference.reference!,1,reference.referenceRevision);
}
