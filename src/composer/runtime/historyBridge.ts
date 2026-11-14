import {universalHistory} from '../../core/universalHistory.ts';
import {createTransientStore} from './ui/transientStore.ts';
import {emptyUILayout,validateUILayout,type UILayout} from './ui/layout.ts';
import type {Controller} from './appearance/model.ts';
import type {HistoryCategory} from './ui/actionHistory.ts';

export const nativeLayout=createTransientStore(emptyUILayout());
export const nativeAppearance=createTransientStore<Controller|undefined>(undefined);
const snapshot=()=>({layout:nativeLayout.getSnapshot(),controller:nativeAppearance.getSnapshot()});
type Interface=ReturnType<typeof snapshot>;
// V1 records the complete interface at its state owner, rather than inspecting
// which particular widget happened to call an update function.
universalHistory.register('interface',{read:snapshot,write:(state:Interface)=>{
 const layout=validateUILayout(state.layout);nativeLayout.set(layout);nativeAppearance.set(state.controller);
}});
function commit(change:(before:Interface)=>Interface){
 const before=snapshot(),after=change(before);if(before.layout===after.layout&&before.controller===after.controller)return;
 nativeLayout.set(after.layout);nativeAppearance.set(after.controller);
 const categories:HistoryCategory[]=[],contexts=new Set(['omnium',universalHistory.activeContext,...universalHistory.contextPath]);
 if(before.layout!==after.layout){categories.push('ui');for(const id of new Set([...Object.keys(before.layout.windows),...Object.keys(after.layout.windows)]))if(before.layout.windows[id]!==after.layout.windows[id])contexts.add(`window:${id}`);}
 if(before.controller!==after.controller)categories.push('appearance');
 const event=typeof window==='undefined'?undefined:window.event,active=typeof document==='undefined'?undefined:document.activeElement;
 const group=event?.type==='input'?`field:${active?.getAttribute('aria-label')??''}`:event?`event:${event.type}:${event.timeStamp}`:undefined;
 universalHistory.record('interface',before,after,categories,[...contexts],group);
}
export function updateNativeLayout(change:(layout:UILayout)=>UILayout){commit(before=>({...before,layout:change(before.layout)}));}
export function updateNativeAppearance(controller:Controller){commit(before=>({...before,controller}));}
