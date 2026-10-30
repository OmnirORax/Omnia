/** A temporary selection consumer does not take ownership of the user's saved
 * selection. Unsupported picks remain active; acceptance/cancel restores once. */
export function selectionRequest<T>(accept:(selection:T)=>boolean,cancel:()=>void,restore:()=>void){
 let done=false;
 return {
  accept(selection:T){if(done||!accept(selection))return false;done=true;restore();return true;},
  cancel(){if(done)return;done=true;restore();cancel();},
 };
}

/** Confirmation belongs to MS before underlying popups/native focused buttons.
 * Polygon completion retains its existing command and validation. */
export function selectionConfirmation(phase:string,requesting:boolean,polygon:boolean):'aim'|'accept'|undefined{
 if(polygon)return;
 if(phase==='configure')return 'aim';
 if(requesting&&(phase==='aim'||phase==='locked'))return 'accept';
}
