import {universalHistory} from '../../core/universalHistory.ts';
import {createTransientStore} from './ui/transientStore.ts';
import {emptyUILayout,type UILayout} from './ui/layout.ts';
import type {Controller} from './appearance/model.ts';

export const nativeLayout=createTransientStore(emptyUILayout());
export const nativeAppearance=createTransientStore<Controller|undefined>(undefined);
universalHistory.register('native.ui',{read:nativeLayout.getSnapshot,write:nativeLayout.set});
universalHistory.register('native.appearance',{read:nativeAppearance.getSnapshot,write:nativeAppearance.set});
export function updateNativeLayout(change:(layout:UILayout)=>UILayout){
 const before=nativeLayout.getSnapshot(),after=change(before);
 nativeLayout.set(after);
 // Opening a new window seeds its geometry; only edits of existing windows
 // belong to the user's UI history.
 if(Object.keys(before.windows).some(id=>before.windows[id]!==after.windows[id]))universalHistory.record('native.ui',before,after,['ui'],['omnium','window:omnic-composer'],'native.ui');
}
export function updateNativeAppearance(after:Controller){
 const before=nativeAppearance.getSnapshot();nativeAppearance.set(after);
 universalHistory.record('native.appearance',before,after,['appearance'],['omnium','window:omnic-composer'],'native.appearance');
}
