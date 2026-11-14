import {validateRecipe,type Recipe} from './model.ts';
type Step=string|{id:string};
export type RecipeEdit={op:'set'|'remove'|'insert'|'order';path:Step[];value?:unknown};
const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const identified=(values:unknown[]):boolean=>values.every(value=>record(value)&&typeof value.id==='string');
/** Stable local component handles keep deltas attached when the base gains siblings. */
export function recipeDelta(base:Recipe,next:Recipe):RecipeEdit[]{
 const edits:RecipeEdit[]=[];
 function walk(a:unknown,b:unknown,path:Step[]){
  if(JSON.stringify(a)===JSON.stringify(b))return;
  if(Array.isArray(a)&&Array.isArray(b)&&identified(a)&&identified(b)){
   const before=new Map(a.map(value=>[(value as {id:string}).id,value])),after=new Map(b.map(value=>[(value as {id:string}).id,value]));
   for(const id of before.keys())if(!after.has(id))edits.push({op:'remove',path:[...path,{id}]});
   for(const [id,value] of after)if(before.has(id))walk(before.get(id),value,[...path,{id}]);else edits.push({op:'insert',path,value});
   const original=a.filter(value=>after.has((value as {id:string}).id)).map(value=>(value as {id:string}).id),order=b.map(value=>(value as {id:string}).id);
   if(JSON.stringify(original)!==JSON.stringify(order))edits.push({op:'order',path,value:order});return;
  }
  if(record(a)&&record(b)){
   for(const key of new Set([...Object.keys(a),...Object.keys(b)])){
    if(!path.length&&key==='revision')continue;
    if(!(key in b))edits.push({op:'remove',path:[...path,key]});else if(!(key in a))edits.push({op:'set',path:[...path,key],value:b[key]});else walk(a[key],b[key],[...path,key]);
   }return;
  }
  edits.push({op:'set',path,value:b});
 }
 walk(validateRecipe(base),validateRecipe(next),[]);return structuredClone(edits);
}
export function applyRecipeDelta(base:Recipe,edits:readonly RecipeEdit[]):Recipe{
 if(!Array.isArray(edits)||edits.length>4096)throw Error('Variant delta exceeds its budget.');
 const result=structuredClone(base) as unknown as Record<string,unknown>;
 const slot=(owner:unknown,step:Step):string|number=>{
  if(typeof step==='string'){if(['__proto__','constructor','prototype'].includes(step)||!record(owner))throw Error('Invalid variant path.');return step;}
  if(!Array.isArray(owner)||!step||typeof step.id!=='string')throw Error('Invalid variant target.');
  const index=owner.findIndex(value=>record(value)&&value.id===step.id);if(index<0)throw Error('A variant target no longer resolves.');return index;
 };
 for(const edit of edits){
  if(!edit||!Array.isArray(edit.path)||edit.path.length>32||!['set','remove','insert','order'].includes(edit.op))throw Error('Invalid variant edit.');
  let owner:unknown=result;
  if(edit.op==='insert'||edit.op==='order'){
   for(const step of edit.path)owner=(owner as Record<string|number,unknown>)[slot(owner,step)];
   if(!Array.isArray(owner)||!identified(owner))throw Error('Invalid variant list.');
   if(edit.op==='insert'){if(!record(edit.value)||typeof edit.value.id!=='string'||owner.some(value=>(value as {id:string}).id===edit.value!.id))throw Error('Conflicting variant component.');owner.push(structuredClone(edit.value));}
   else{const order=edit.value;if(!Array.isArray(order)||order.some(id=>typeof id!=='string')||new Set(order).size!==order.length)throw Error('Invalid variant order.');const map=new Map(owner.map(value=>[(value as {id:string}).id,value]));if(order.some(id=>!map.has(id)))throw Error('Variant order no longer resolves.');owner.splice(0,owner.length,...order.map(id=>map.get(id)),...[...map].filter(([id])=>!order.includes(id)).map(([,value])=>value));}
  }else{
   if(!edit.path.length)throw Error('Invalid variant root.');
   for(const step of edit.path.slice(0,-1))owner=(owner as Record<string|number,unknown>)[slot(owner,step)];
   const key=slot(owner,edit.path.at(-1)!);
   if(edit.op==='remove'){if(Array.isArray(owner))owner.splice(Number(key),1);else delete(owner as Record<string|number,unknown>)[key];}
   else(owner as Record<string|number,unknown>)[key]=structuredClone(edit.value);
  }
 }
 return validateRecipe(result);
}
