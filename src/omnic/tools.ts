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
