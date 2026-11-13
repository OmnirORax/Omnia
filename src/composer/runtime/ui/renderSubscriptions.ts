import type {UIContextValue} from './context';
import {functionIndex} from './functionIndex.ts';
import {getContainer} from './layout.ts';
/** Render dependencies only; actions read the owner's latest committed snapshot. */
export function residentRenderSlice(ui:UIContextValue,key:string):readonly unknown[]{
  const index=functionIndex(ui.functions,ui.layout),owner=index.owners.get(key);
  return [getContainer(ui.layout,key),owner,owner?getContainer(ui.layout,owner)?.layoutMode:undefined,index.permissions,ui.layout.labels?.[key],ui.layout.hideNames,ui.layout.assets,ui.shortcutBindings?.[`button:@frame:${key}`]];
}
export function nativePresentationSlice(ui:UIContextValue):readonly unknown[]{
  return [ui.layout.items,ui.layout.labels,ui.layout.assets,ui.layout.hideNames,ui.shortcutBindings,functionIndex(ui.functions,ui.layout).permissions,functionIndex(ui.functions,ui.layout).rigidity];
}
