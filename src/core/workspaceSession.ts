import {validateUILayout,type UILayout} from '../composer/runtime/ui/layout.ts';
import type {Controller} from '../composer/runtime/appearance/model.ts';
import type {ViewState} from '../ui/viewHistory.ts';
import type {ShortcutOverrides} from '../ui/shortcuts.ts';
export type WorkspaceSession={version:1;views:{state:ViewState;poses:Record<string,string>};layout:UILayout;appearance?:Controller;details:Record<string,unknown>;shortcuts:ShortcutOverrides;selection:unknown[]};
export function validateWorkspaceSession(value:WorkspaceSession){
 const record=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
 if(!record(value)||value.version!==1||!record(value.views)||!record(value.views.state)||!record(value.views.state.windows)||!record(value.views.poses)||!record(value.details)||!record(value.shortcuts)||!Array.isArray(value.selection))throw Error('Invalid workspace session.');
 const specs=[...Object.values(value.views.state.windows),...(value.views.state.menu?[value.views.state.menu]:[])];
 if(specs.length>256||specs.some(spec=>!record(spec)||typeof spec.kind!=='string'||spec.dismissOnOutside!==undefined&&typeof spec.dismissOnOutside!=='boolean'||!Number.isSafeInteger(spec.instance)||spec.instance!<1)||Object.values(value.views.poses).some(css=>typeof css!=='string'))throw Error('Invalid workspace windows.');
 validateUILayout(value.layout);
 return value;
}
