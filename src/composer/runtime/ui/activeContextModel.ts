import type { TransientStore } from "./transientStore.ts";
export type ActiveContextEntry = { kind: "frame"; key: string; element?: HTMLElement } |
  { kind: "field" | "layer"; element: HTMLElement };
export type ActiveContextStack = readonly ActiveContextEntry[];
export type ActiveContextStore = TransientStore<ActiveContextStack>;
export type ContextLayer = { ancestors?:readonly HTMLElement[];parent?: string; close: () => void; dismiss?: () => void; dismissOutside?:boolean; cancel?:()=>void;advance?:()=>void; confirm?:()=>void };
export const UI_CANCEL_EDIT = "omnium:cancel-value-edit";
/** One level only, even when the same physical key repeats. */
export const parentContext = (stack: ActiveContextStack): ActiveContextStack => stack.slice(0, -1);
export const activeFrame = (stack: ActiveContextStack) => [...stack].reverse().find((entry): entry is Extract<ActiveContextEntry, { kind: "frame" }> => entry.kind === "frame");

/** A popup may also have a resident ID for search/ownership. Its registered
 * dismissal layer takes precedence over that presentation identity. */
export function contextStackFromScopes(scopes: readonly { element: HTMLElement; frame?: string; layer?: ContextLayer }[], framesFor: (key: string) => ActiveContextEntry[], field?: HTMLElement | null): ActiveContextStack {
  let stack: ActiveContextEntry[] = [];
  for (const scope of scopes) {
    if (scope.layer) {
      if (!stack.length && scope.layer.parent) stack = framesFor(scope.layer.parent);
      stack.push({ kind: "layer", element: scope.element });
    } else if (scope.frame && !stack.some(entry => entry.kind === "frame" && entry.key === scope.frame)) {
      stack.push(...framesFor(scope.frame).filter(entry => entry.kind !== "frame" || !stack.some(old => old.kind === "frame" && old.key === entry.key)));
    }
  }
  if (field && stack.length) stack.push({ kind: "field", element: field });
  return stack;
}

/** Empty-space dismissal closes every opted-in dial, deepest first. */
export function dismissContextDials(layers:Iterable<ContextLayer>):boolean {
  const open=[...layers].filter(layer=>layer.dismiss);
  for(const layer of open.reverse())layer.dismiss!();
  return open.length>0;
}

/** Shared navigation resolves the nearest layer that actually supports the action. */
export function contextLayerAction(stack:ActiveContextStack,layers:ReadonlyMap<HTMLElement,ContextLayer>,action:'advance'|'confirm'|'cancel'):(()=>void)|undefined{
 for(const entry of [...stack].reverse())if(entry.kind==='layer'){
  const layer=layers.get(entry.element),handler=action==='confirm'?layer?.confirm??layer?.advance:layer?.[action];
  if(handler)return handler;
 }
}

/** Explicit outside-zone dismissal protects registered child popup interiors too. */
export function dismissOutsideContext(layers:ReadonlyMap<HTMLElement,ContextLayer>,target:Node){
 if([...layers.keys()].some(node=>node.contains(target)))return false;
 const selected=[...layers.values()].filter(layer=>layer.dismissOutside&&layer.dismiss);
 for(const layer of selected.reverse())layer.dismiss!();
 return selected.length>0;
}

/** Popup dismissal is a fallback after an active input owner and registered popup
 * interiors. Applies to every present/future popup, without widget hit exceptions. */
export function dismissContextPointer(layers:ReadonlyMap<HTMLElement,ContextLayer>,target:Node,inputOwned:boolean,preserveContent:boolean):boolean{
 if(inputOwned||[...layers.keys()].some(node=>node.contains(target)))return false;
 if(dismissOutsideContext(layers,target))return true;
 return preserveContent?false:dismissContextDials(layers.values());
}

/** A logical popup parent may mount/register after its portalled child. Keep the
 * hierarchy ordered even though their DOM roots are siblings. */
export function insertContextLayer(stack:ActiveContextStack,node:HTMLElement,layers:ReadonlyMap<HTMLElement,ContextLayer>):ActiveContextStack{
 const next=stack.filter(entry=>entry.kind!=='layer'||entry.element!==node);
 const index=next.findIndex(entry=>entry.kind==='layer'&&layers.get(entry.element)?.ancestors?.includes(node));
 return [...next.slice(0,index<0?next.length:index),{kind:'layer',element:node},...next.slice(index<0?next.length:index)];
}

/** Entering an open popup selects its declared logical scope without requiring
 * a prior click or DOM focus. Portal siblings still retain parent-first order. */
export function contextLayerScope(prefix:ActiveContextStack,node:HTMLElement,layers:ReadonlyMap<HTMLElement,ContextLayer>):ActiveContextStack{
 const layer=layers.get(node);if(!layer)return prefix;
 const parents=[...(layer.ancestors??[])].reverse().filter(parent=>layers.has(parent));
 return [...prefix,...[...new Set([...parents,node])].map(element=>({kind:'layer' as const,element}))];
}
