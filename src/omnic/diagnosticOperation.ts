import type {Recipe} from './model.ts';
/** Only exact local operation identities are editable. Diagnostics inside reused
 * definitions must not accidentally address an operation in this recipe. */
export function diagnosticOperation(recipe:Recipe,id:string|undefined){
 return id===undefined?undefined:recipe.operations.find(operation=>operation.id===id);
}
export function repairDiagnosticOperation(recipe:Recipe,id:string,action:'disable'|'remove'):Recipe{
 const operation=diagnosticOperation(recipe,id);
 if(!operation||action==='disable'&&!operation.enabled)return recipe;
 return {...recipe,operations:action==='remove'?recipe.operations.filter(item=>item.id!==id):recipe.operations.map(item=>item.id===id?{...item,enabled:false}:item)};
}
