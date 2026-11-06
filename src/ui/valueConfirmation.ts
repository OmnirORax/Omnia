/** One confirmation operation for pointer selection and contextual Enter.
 * Undefined means no candidate; zero, false and structured values remain valid. */
export function confirmValue<T>({candidate,onCommit,disabled=false}:{candidate:()=>T|undefined;onCommit:(value:T)=>void|boolean;disabled?:boolean},picked?:T):boolean{
 const next=picked??candidate();
 if(disabled||next===undefined)return false;
 return onCommit(next)!==false;
}
