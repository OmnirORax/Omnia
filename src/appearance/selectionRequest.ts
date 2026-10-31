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

/** Context consumers can borrow the normal MS entry action. The pending request
 * bypass prevents its own selector opening from launching the consumer again. */
export function selectionOpenContexts<T>(){
 const contexts=new Map<symbol,{contains:(target:T)=>boolean;open:()=>boolean}>();
 return {
  register(context:{contains:(target:T)=>boolean;open:()=>boolean}){const key=Symbol();contexts.set(key,context);return()=>{contexts.delete(key);};},
  open(target:T,requesting=false){if(requesting)return false;for(const context of [...contexts.values()].reverse())if(context.contains(target)&&context.open())return true;return false;},
 };
}

/** Cleanup may cancel only its own temporary request. A replaced editor must
 * never clear a newer editor's MS session. Owner omission is explicit user cancel. */
export function cancelOwnedSelectionRequest<T extends {owner:symbol;cancelMS?:()=>void;finish:()=>void}>(pending:{current:T|undefined},owner?:symbol):boolean{
 const request=pending.current;if(!request||owner!==undefined&&request.owner!==owner)return false;
 pending.current=undefined;request.cancelMS?.();request.finish();return true;
}

export type SelectionDecision=boolean|string;
/** A rejection reason is feedback, never a truthy acceptance. */
export function selectionDecision(result:SelectionDecision){
 return result===true?{accepted:true,message:null}:{accepted:false,message:typeof result==='string'&&result?result:'Unsupported target'};
}
