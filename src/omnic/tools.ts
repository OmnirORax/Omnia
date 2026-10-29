import {validateRecipe,type Recipe,type Application} from './model.ts';
/** Tools are ordinary shared objects containing scope-relative operations. */
export function operationTool(operation:Application):Recipe {
  return validateRecipe({version:2,revision:0,components:[],operations:[{...operation,targets:[]}],frames:[]});
}
export function isOperationTool(recipe:Recipe):boolean {
  return recipe.components.length===0&&recipe.operations.length>0&&recipe.frames.length===0&&recipe.operations.every(op=>op.targets.length===0);
}
export function applyOperationTool(recipe:Recipe,tool:Recipe,targets:string[],newId:()=>string):Recipe {
  if(!isOperationTool(tool))throw Error('Choose an operation tool with scope-relative targets.');
  return validateRecipe({...recipe,operations:[...recipe.operations,...tool.operations.map(op=>({...op,id:newId(),params:{...op.params},targets:[...targets]}))]});
}

/** Instantiate alongside existing geometry, remapping internal identities only. */
export function insertConstruction(recipe:Recipe,source:Recipe,point:{x:number;y:number},newId:()=>string):{recipe:Recipe;ids:string[];roots:string[]}{
  const checked=validateRecipe(source),mapping=new Map<string,string>();
  const allocate=(items:Recipe['components'])=>items.forEach(item=>{mapping.set(item.id,newId());allocate(item.children??[]);});allocate(checked.components);
  const componentsOwners=[...mapping.keys()].sort((a,b)=>b.length-a.length);
  for(const item of checked.operations)mapping.set(item.id,newId());
  const ids=[...mapping.values()];
  const owners=[...mapping.keys()].sort((a,b)=>b.length-a.length);
  for(const item of checked.frames)mapping.set(item.id,newId());
  const remap=(role:string)=>{const owner=componentsOwners.find(id=>role===id||role.startsWith(`${id}:`))??owners.find(id=>role===id||role.startsWith(`${id}:`));return owner?mapping.get(owner)!+role.slice(owner.length):role;};
  const clone=(items:Recipe['components'],root=false):Recipe['components']=>items.map(item=>({...item,id:mapping.get(item.id)!,params:{...item.params,...(root?{x:Number(item.params.x??0)+point.x,y:Number(item.params.y??0)+point.y}:{})},...(item.children?{children:clone(item.children)}:{})}));
  const components=clone(checked.components,true),roots=components.map(item=>item.id);
  if(!roots.length)throw Error('This construction preset contains no geometry.');
  const operations=checked.operations.map(op=>({...op,id:mapping.get(op.id)!,params:{...op.params},targets:op.targets.length?op.targets.map(remap):roots}));
  const frames=checked.frames.map(frame=>({...frame,id:mapping.get(frame.id)!,scope:frame.scope.length?frame.scope.map(remap):roots}));
  return {recipe:validateRecipe({...recipe,version:2,components:[...recipe.components,...components],operations:[...recipe.operations,...operations],frames:[...recipe.frames,...frames]}),ids,roots};
}
