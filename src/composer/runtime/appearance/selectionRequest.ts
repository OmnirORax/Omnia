import {surfaceOwnsInput} from '../ui/inputOwnership.ts';

export type SelectionRequestSurface=()=>Element|null;
/** A borrowed content picker yields to other input owners without canceling its
 * request. Omitted scope is explicit standalone UI selection; missing scope is inactive. */
export function selectionRequestOwnsInput(surface:SelectionRequestSurface|undefined,element:unknown,path:readonly unknown[]=[]){
 if(!surface)return true;
 const root=surface();return !!root&&surfaceOwnsInput(root,element,path);
}

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

export function selectionGroupIncluded<T>(wanted:readonly T[],selected:ReadonlySet<T>){
 return wanted.length>0&&!wanted.every(key=>selected.has(key));
}

/** Clicks toggle membership; a held box adds its complete owners on release. */
export function nativeSelectionDragged(start:{x:number;y:number},end:{x:number;y:number}){
 return Math.hypot(end.x-start.x,end.y-start.y)>=4;
}
