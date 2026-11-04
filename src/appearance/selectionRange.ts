/** Source order is supplied by the owning surface, never inferred from screen distance. */
export function orderedSelectionRange<T>(items:readonly T[],anchor:string|undefined,end:string,key:(item:T)=>string):T[]{
  const last=items.findIndex(item=>key(item)===end);if(last<0)return [];
  const first=anchor===undefined?-1:items.findIndex(item=>key(item)===anchor);
  return first<0?[items[last]]:items.slice(Math.min(first,last),Math.max(first,last)+1);
}
export function selectorOpenPhase(phase:string,firstRequest=false){return firstRequest||phase==='off'?'aim':'configure';}
export function selectorEscapePhase(phase:string){return phase==='configure'?'aim':'off';}
/** An implicit pointed unit is an anchor, not a cage for a sibling range.
 * Explicit drawn working geometry remains a constraint. */
export function rangeWorkingScope<T extends {ownerFrame?:boolean;scope?:T}>(scope:T|null):T|null {
  while(scope?.ownerFrame)scope=scope.scope??null;
  return scope;
}
