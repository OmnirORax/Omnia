export type ContextNavigation={owner?:{current:HTMLElement|null};cancel?:()=>void;back?:()=>void;advance?:()=>void;confirm?:()=>void};
/** Resolve each action separately. A deeper cancel-only editor must not hide a
 * confirmation registered by its parent, or vice versa. */
export function contextNavigationAction(entries:Iterable<ContextNavigation>,action:'cancel'|'back'|'advance'|'confirm'){
 let selected:ContextNavigation|undefined;
 for(const candidate of entries){
  if(!candidate[action])continue;
  const a=selected?.owner?.current,b=candidate.owner?.current;
  if(!selected||!a||b&&a.contains(b))selected=candidate;
 }
 return selected?.[action];
}
