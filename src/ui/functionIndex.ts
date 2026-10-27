import {containers,residentKey,type UILayout} from './layout.ts';
/** Render-time projection only. Mutable layout transactions keep using ownerOf. */
export function createFunctionIndex<T extends {id:string}>(functions:readonly T[],layout:UILayout){
  const byId=new Map(functions.map(fn=>[fn.id,fn])),anchors=new Map<string,T[]>(),owners=new Map<string,string>();
  for(const fn of functions){const anchor=layout.items[fn.id]?.anchorId;if(anchor){const peers=anchors.get(anchor);if(peers)peers.push(fn);else anchors.set(anchor,[fn]);}}
  for(const [owner,container] of containers(layout))for(const member of container.members??[]){const key=residentKey(member);if(!owners.has(key))owners.set(key,owner);}
  for(const [id,window] of Object.entries(layout.windows))if(window.inline&&!window.inline.detached&&window.inline.parent!=='workspace'&&!owners.has(`window:${id}`))owners.set(`window:${id}`,window.inline.parent);
  const permissions=JSON.stringify([layout.uiRigidity,layout.panels['@devMode'],[...owners],containers(layout).map(([id,c])=>[id,c.pinned,'viewport' in c?c.viewport:undefined])]);
  return {byId,anchors,owners,permissions};
}
const caches=new WeakMap<object,WeakMap<UILayout,ReturnType<typeof createFunctionIndex>>>();
export function functionIndex<T extends {id:string}>(functions:readonly T[],layout:UILayout){
  let layouts=caches.get(functions);if(!layouts){layouts=new WeakMap();caches.set(functions,layouts);}
  let index=layouts.get(layout);if(!index){index=createFunctionIndex(functions,layout);layouts.set(layout,index);}
  return index as ReturnType<typeof createFunctionIndex<T>>;
}
