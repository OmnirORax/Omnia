import { dockKeys, insertDockKey } from './dockTree.ts';
import { canDock, containers, getContainer, pruneEmptyDockGroups, readResident, releaseResident, residentContextScope, residentKey, residentPinned, updateContainer, validateUILayout, type UILayout, type WindowState } from './layout.ts';

function originalIndex(current:readonly string[],reference:readonly string[],key:string):number {
 const rank=reference.indexOf(key);
 if(rank<0)return current.length;
 const previous=reference.slice(0,rank).reverse().find(key=>current.includes(key));
 const following=reference.slice(rank+1).find(key=>current.includes(key));
 return previous?current.indexOf(previous)+1:following?current.indexOf(following):current.length;
}

type Homes = { original: UILayout; windows: ReadonlyMap<string, WindowState>; functions: readonly {id:string;homePath?:string[];scope?:string}[] };
/** Original means the shipped layout or the resident's declared native home,
 * never the most recent saved placement or an undo snapshot. */
function homeFor(layout:UILayout,key:string,homes:Homes) {
 const member=readResident(key), original=homes.original;
 const state=member.kind==='window'?original.windows[member.id]??homes.windows.get(member.id):getContainer(original,key);
 const fn=member.kind==='function'?homes.functions.find(fn=>fn.id===member.id):undefined;
 if(member.kind==='function'?!fn:!state)return null;
 if(member.kind==='function'&&layout.customControls?.[member.id]&&!original.customControls?.[member.id])return null;
 const owner=containers(original).find(([,container])=>container.members?.some(member=>residentKey(member)===key))?.[0];
 const inline=state&&'inline' in state?state.inline:undefined;
 const nativeOwner=!owner?(!inline?.detached?inline?.parent:undefined)??fn?.homePath?.at(-1)??fn?.scope:undefined;
 const target=owner??(nativeOwner&&nativeOwner!=='workspace'?nativeOwner:undefined);
 const destination=target?(getContainer(layout,target)??getContainer(original,target)):undefined;
 if(target&&(!destination||!getContainer(layout,target)&&!target.startsWith('window:')))return null;
 const parent=destination&&'inline' in destination?destination.inline?.parent:undefined;
 if(target&&!getContainer(layout,target)&&parent&&parent!=='workspace'&&!getContainer(layout,parent))return null;
 if(residentPinned(layout,key)||target&&residentPinned(layout,target))return null;
 if(target){
  const projected=getContainer(layout,target)?layout:{...layout,windows:{...layout.windows,[target.slice(7)]:destination as WindowState}};
  if(!canDock(projected,key,target))return null;
 }else if(residentContextScope(layout,key))return null;
 return {member,state,owner,inline,target,destination};
}
export function canResetResidentHome(layout:UILayout,key:string,homes:Homes):boolean {
 return !!homeFor(layout,key,homes);
}
/** Restore one resident only; unrelated siblings and authored contents survive.
 * Call through the existing UI transaction for persistence and optional undo. */
export function resetResidentHome(layout:UILayout,key:string,homes:Homes):UILayout {
 const home=homeFor(layout,key,homes);if(!home)return layout;
 const {member,state,owner,inline,target,destination}=home;
 let next=releaseResident(layout,key);
 if(target&&!getContainer(next,target)){
  if(!target.startsWith('window:'))return layout;
  next={...next,windows:{...next.windows,[target.slice(7)]:{...destination as WindowState,members:[],dockLayout:undefined}}};
 }
 if(owner){
  const reference=getContainer(homes.original,owner)?.members??[];
  const originalMember=reference.find(m=>residentKey(m)===key)??member;
  const siblings=[...(getContainer(next,owner)?.members??[])];
  const at=originalIndex(siblings.map(residentKey),reference.map(residentKey),key);
  siblings.splice(at,0,structuredClone(originalMember));
  const dockLayout=getContainer(next,owner)?.dockLayout;
  next=updateContainer(next,owner,{members:siblings,...(dockLayout?{dockLayout:insertDockKey(dockLayout,dockKeys(dockLayout)[0],key,'tab')}: {})});
 }
 if(member.kind==='function'){
  const initial=homes.original.items[member.id];
  next={...next,items:{...next.items,[member.id]:{
   ...next.items[member.id],x:initial?.x??0,y:initial?.y??0,
   home:owner?false:initial?.home??true,anchorId:initial?.anchorId,
   frameId:initial?.frameId,cell:initial?.cell,size:initial?.size,
  }}};
  // Old native order lists must not keep projecting the moved item elsewhere.
  if(next.nativeOrders)next={...next,nativeOrders:Object.fromEntries(Object.entries(next.nativeOrders).map(([anchor,ids])=>[anchor,ids.filter(id=>id!==member.id)]))};
  if(initial?.anchorId){
   const anchor=initial.anchorId,order=[...(next.nativeOrders?.[anchor]??[])];
   order.splice(originalIndex(order,homes.original.nativeOrders?.[anchor]??[],member.id),0,member.id);
   next={...next,nativeOrders:{...next.nativeOrders,[anchor]:order}};
  }
 }else if(state){
  const current=getContainer(next,key);
  next=updateContainer(next,key,{
   x:state.x,y:state.y,width:state.width,height:state.height,viewport:undefined,
   dockEdge:'dockEdge' in state?state.dockEdge:undefined,
   ...(inline?{inline:{...(current&&'inline' in current?current.inline:undefined),...inline,detached:inline.detached??false}}:{}),
  });
 }
 // Pruning empty auto dock shells never removes user-created frames.
 return validateUILayout(pruneEmptyDockGroups(next));
}
