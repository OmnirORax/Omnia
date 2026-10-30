/** A temporary selection consumer does not take ownership of the user's saved
 * selection. Unsupported picks remain active; acceptance/cancel restores once. */
export function selectionRequest<T>(accept:(selection:T)=>boolean,cancel:()=>void,restore:()=>void){
 let done=false;
 return {
  accept(selection:T){if(done||!accept(selection))return false;done=true;restore();return true;},
  cancel(){if(done)return;done=true;restore();cancel();},
 };
}
