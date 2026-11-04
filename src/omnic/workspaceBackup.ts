import {validateWorkspace,WORKSPACE_BYTES,type OmnicWorkspace} from './workspace.ts';
import {validateUILayout,type UILayout} from '../ui/layout.ts';
import {normalizeSettings,type WorkspaceSettings} from '../workspaceActions.ts';
import {parseCustomFonts,MAX_FONT_TEMPLATE_BYTES,type CustomFont} from '../fonts.ts';

export const UI_TEMPLATE_BYTES=MAX_FONT_TEMPLATE_BYTES+5_000_000;
export const WORKSPACE_BACKUP_BYTES=WORKSPACE_BYTES+UI_TEMPLATE_BYTES+1024;
export type WorkspaceUI={format:'omnium-ui-template';version:3;layout:UILayout;settings:WorkspaceSettings;fonts:CustomFont[]};
export type WorkspaceBackup={format:'omnium-workspace-backup';version:1;workspace:OmnicWorkspace;ui:WorkspaceUI};
const bytes=(value:unknown)=>new TextEncoder().encode(JSON.stringify(value)).length;
const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
export function validateWorkspaceUI(value:unknown):WorkspaceUI{
 if(!record(value)||value.format!=='omnium-ui-template'||value.version!==3||!record(value.settings))throw Error('Unsupported or invalid workspace UI template. Original data has not been replaced.');
 if(bytes(value)>UI_TEMPLATE_BYTES)throw Error('Workspace UI exceeds the template size limit.');
 return {format:'omnium-ui-template',version:3,layout:validateUILayout(value.layout),settings:normalizeSettings(value.settings),fonts:parseCustomFonts(value.fonts)};
}
export function createWorkspaceBackup(workspace:OmnicWorkspace,ui:unknown):WorkspaceBackup{
 const checked=validateWorkspace(workspace);if(bytes(checked)>WORKSPACE_BYTES)throw Error('Workspace exceeds 8 MB.');
 const result:WorkspaceBackup={format:'omnium-workspace-backup',version:1,workspace:checked,ui:validateWorkspaceUI(ui)};
 if(bytes(result)>WORKSPACE_BACKUP_BYTES)throw Error('Combined workspace backup exceeds its size limit.');return result;
}
/** Historical workspace-only exports retain the current UI. New envelopes are
 * strict: never fall through to a workspace parser and silently drop their UI. */
export function parseWorkspaceBackup(text:string):{workspace:OmnicWorkspace;ui?:WorkspaceUI}{
 if(new TextEncoder().encode(text).length>WORKSPACE_BACKUP_BYTES)throw Error('Workspace backup exceeds its size limit.');
 const value:unknown=JSON.parse(text);
 if(record(value)&&value.format==='omnium-workspace'){
  if(new TextEncoder().encode(text).length>WORKSPACE_BYTES)throw Error('Workspace exceeds 8 MB.');return {workspace:validateWorkspace(value)};
 }
 if(!record(value)||value.format!=='omnium-workspace-backup'||value.version!==1)throw Error('Unsupported workspace backup format/version. Original data has not been replaced.');
 return createWorkspaceBackup(value.workspace as OmnicWorkspace,value.ui);
}
