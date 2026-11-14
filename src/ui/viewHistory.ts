import {universalHistory} from '../core/universalHistory.ts';
import type {ActionHistory} from '../composer/runtime/ui/actionHistory.ts';
import {sameValue} from '../core/equality.ts';
export const VIEW_CLOSE='omnium:window-close',VIEW_GEOMETRY='omnium:window-geometry',VIEW_ROUTE='omnium:window-route';
export type ViewSpec={kind:string;args?:unknown;point?:{x:number;y:number};selection?:unknown[];query?:string;instance?:number};
type State={menu:ViewSpec|null;windows:Record<string,ViewSpec>};
type Handle={root:HTMLElement;close:()=>unknown;ready?:Promise<void>};
/** Pure view descriptors; disposed views are reconstructed by registered factories. */
export function createViewHistory(history:ActionHistory,schedule:(fn:()=>void)=>void=fn=>requestAnimationFrame(fn)){
 let state:State={menu:null,windows:{}},poses:Record<string,string>={},sequence=0,depth=0,writing=false,applying=false;
 let renderMenu:(spec:ViewSpec|null)=>void=()=>{};
 const factories=new Map<string,(spec:ViewSpec)=>void>(),pending=new Map<string,ViewSpec>(),initializing=new Set<number>();
 const live=new Map<string,{spec:ViewSpec;handle:Handle;stop:()=>void}>();let queued=false;
 const record=(before:State,group?:string)=>history.record('ui.views',before,state,['ui'],['omnium'],group);
 const change=(next:State,group?:string)=>{const before=state;state=next;if(!writing)record(before,group);};
 const pose=(slot:{spec:ViewSpec;handle:Handle})=>{poses={...poses,[slot.spec.instance!]:slot.handle.root.style.cssText};};
 function closeSlot(key:string){const slot=live.get(key);if(!slot)return;pose(slot);slot.handle.close();if(slot.handle.root.isConnected)throw Error('The window is busy and could not close.');slot.stop();live.delete(key);initializing.delete(slot.spec.instance!);}
 function apply(){
  queued=false;writing=true;applying=true;
  try{
   renderMenu(state.menu);
   for(const [key,slot]of [...live])if(!sameValue(state.windows[key],slot.spec))closeSlot(key);
   for(const [key,spec]of Object.entries(state.windows))if(!live.has(key)&&!pending.has(key)){
    const factory=factories.get(spec.kind);if(factory){pending.set(key,spec);factory(spec);}
   }
  }catch(error){history.message=String(error);}finally{writing=false;applying=false;}
 }
 const requestApply=()=>{if(!queued){queued=true;queueMicrotask(apply);}};
 history.register('ui.views',{read:()=>state,write:(next:State)=>{
  const before=state;state=next;writing=true;
  try{for(const [key,slot]of [...live])if(!sameValue(state.windows[key],slot.spec))closeSlot(key);}
  catch(error){state=before;requestApply();throw error;}
  finally{writing=false;}
  for(const key of pending.keys())if(!sameValue(pending.get(key),state.windows[key]))pending.delete(key);
  requestApply();
 }});
 history.register('ui.geometry',{read:()=>poses,write:(next:Record<string,string>)=>{poses=next;for(const slot of live.values()){const css=poses[slot.spec.instance!];if(css!==undefined)slot.handle.root.style.cssText=css;}}});
 const api={
  defineWindow<Args extends unknown[]>(kind:string,create:(...args:Args)=>Handle){
   const construct=(spec:ViewSpec,restore?:ViewSpec)=>{const handle=create(...spec.args as Args);api.adopt(kind,spec,handle,restore);};
   factories.set(kind,spec=>construct(spec,spec));
   return(...args:Args)=>api.perform(()=>{closeSlot(kind);construct(api.reserve({kind,args}));});
  },
  wants(spec:ViewSpec){return Object.values(state.windows).some(wanted=>wanted.instance===spec.instance);},
  failed(spec:ViewSpec|undefined,error:unknown){if(spec)for(const [key,wanted]of pending)if(wanted.instance===spec.instance)pending.delete(key);history.message=String(error);},
  reserve(spec:ViewSpec){return {...spec,instance:++sequence};},
  get state(){return state;},get restoring(){return writing||pending.size>0||initializing.size>0;},get performing(){return depth>0;},get rendering(){return applying;},
  menuRenderer(render:(spec:ViewSpec|null)=>void){renderMenu=render;},factory(kind:string,create:(spec:ViewSpec)=>void){factories.set(kind,create);},
  perform(action:()=>void,actionId?:string){history.transaction(()=>{depth++;try{action();}finally{depth--;}},actionId);},
  menu(spec:ViewSpec){change({...state,menu:{...spec,instance:++sequence}});applying=true;try{renderMenu(state.menu);}finally{applying=false;}},
  query(value:string){if(state.menu&&state.menu.query!==value)change({...state,menu:{...state.menu,query:value}},`view-query:${state.menu.instance}`);},
  hideMenu(){if(state.menu!==null)change({...state,menu:null});renderMenu(null);},
  adopt(key:string,requested:ViewSpec,handle:Handle,restore?:ViewSpec,initial=false){
   const wanted=state.windows[key];
   if(restore&&(!wanted||wanted.instance!==restore.instance)){handle.close();return;}
   const spec=restore?wanted:{...requested,instance:requested.instance??++sequence};pending.delete(key);
   live.get(key)?.stop();handle.root.dataset.historyWindow=key;
   if(restore){handle.root.dataset.historyPlacement='restore';const css=poses[spec.instance!];if(css!==undefined)handle.root.style.cssText=css;}
   const closed=()=>{const slot=live.get(key);if(slot?.handle!==handle)return;pose(slot);if(writing)return;slot.stop();live.delete(key);initializing.delete(spec.instance!);const windows={...state.windows};delete windows[key];change({...state,windows});};
   const moved=()=>{const before=poses;pose({spec,handle});history.record('ui.geometry',before,poses,['ui'],['omnium',key]);};
   const routed=(event:Event)=>{const slot=live.get(key);if(!slot||writing)return;slot.spec={...slot.spec,args:(event as CustomEvent).detail};change({...state,windows:{...state.windows,[key]:slot.spec}});};
   handle.root.addEventListener(VIEW_CLOSE,closed);handle.root.addEventListener(VIEW_GEOMETRY,moved);handle.root.addEventListener(VIEW_ROUTE,routed);
   live.set(key,{spec,handle,stop:()=>{handle.root.removeEventListener(VIEW_CLOSE,closed);handle.root.removeEventListener(VIEW_GEOMETRY,moved);handle.root.removeEventListener(VIEW_ROUTE,routed);}});
   initializing.add(spec.instance!);
   if(!restore){const next={menu:initial?state.menu:null,windows:{...state.windows,[key]:spec}};if(initial)state=next;else change(next);if(!initial)renderMenu(null);}
   const placed=()=>schedule(()=>{initializing.delete(spec.instance!);if(live.get(key)?.handle!==handle)return;if(poses[spec.instance!]===undefined)pose({spec,handle});else if(restore)handle.root.style.cssText=poses[spec.instance!];
    const active=new Set([...live.values()].map(slot=>String(slot.spec.instance)));const keys=Object.keys(poses).filter(id=>!active.has(id));if(keys.length>256){const next={...poses};for(const id of keys.slice(0,keys.length-256))delete next[id];poses=next;}
   });
   if(handle.ready)void handle.ready.then(placed);else placed();
  },
 };return api;
}
export const viewHistory=createViewHistory(universalHistory);
