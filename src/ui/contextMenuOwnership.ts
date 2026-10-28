/** Content context menus take priority over UI-customization fallbacks. This is
 * a surface capability, not a list of feature names or a saved UI permission. */
export const CONTENT_CONTEXT_MENU = '[data-context-menu-owner],[data-context-controller]';
export function ownsContextMenu(target:unknown):boolean {
  return !!target && typeof target==='object' && 'closest' in target &&
    typeof target.closest==='function' && !!target.closest(CONTENT_CONTEXT_MENU);
}
type ContextEvent={preventDefault:()=>void;stopPropagation:()=>void;isPropagationStopped:()=>boolean};
/** defaultPrevented is deliberately not an ownership signal: the application
 * prevents the browser menu globally before local React handlers receive it. */
export function routeContextMenu<E extends ContextEvent>(event:E,local:((event:E)=>void)|undefined,fallback:(event:E)=>void,owned:boolean) {
  local?.(event);
  if(event.isPropagationStopped())return;
  if(owned){event.preventDefault();event.stopPropagation();return;}
  fallback(event);
}
