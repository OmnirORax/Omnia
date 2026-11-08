import {validateWorkspace,remapImportedDocument,type OmnicWorkspace} from './workspace.ts';
import {emptyDocument,parseDocument} from '../graph/structural.ts';
import {parseWorkspaceBackup,validateWorkspaceUI,WORKSPACE_BACKUP_BYTES,type WorkspaceUI} from './workspaceBackup.ts';
import {validateUILayout,type UILayout} from '../ui/layout.ts';
import {normalizeSettings,type WorkspaceSettings} from '../workspaceActions.ts';
import {parseCustomFonts,type CustomFont} from '../fonts.ts';

export type TransferChoice={atlasIds:string[];library:boolean;layout:boolean;settings:boolean};
export type WorkspaceTransfer={format:'omnium-workspace-transfer';version:1;workspace?:OmnicWorkspace;atlasIds:string[];library:boolean;complete:boolean;layout?:UILayout;settings?:WorkspaceSettings;fonts:CustomFont[]};
export const fullTransferChoice=(workspace:OmnicWorkspace):TransferChoice=>({atlasIds:workspace.atlases.map(a=>a.id),library:true,layout:true,settings:true});
export const transferChoice=(source:WorkspaceTransfer):TransferChoice=>({atlasIds:source.atlasIds,library:source.library,layout:!!source.layout,settings:!!source.settings});
export const hasTransferChoice=(choice:TransferChoice)=>!!(choice.atlasIds.length||choice.library||choice.layout||choice.settings);

/** Conservatively retain every canonical dependency, including archived recipes,
 * glyph text, binder visuals, frame scopes and nested reference addresses. */
function contentSubset(workspace:OmnicWorkspace,atlasIds:string[],library:boolean):OmnicWorkspace{
 const atlases=workspace.atlases.filter(a=>atlasIds.includes(a.id));
 if(atlases.length!==new Set(atlasIds).size)throw Error('Selected atlas is unavailable.');
 const byId=new Map(workspace.entities.map(e=>[e.id,e])),included=new Set<string>();
 const pending:string[]=[];
 const scan=(value:unknown):void=>{
  if(typeof value==='string'){
   if(byId.has(value)&&!included.has(value)){included.add(value);pending.push(value);}
  }else if(Array.isArray(value))value.forEach(scan);
  else if(value&&typeof value==='object')Object.values(value).forEach(scan);
 };
 atlases.forEach(a=>scan(a.document));
 if(library)workspace.entities.forEach(e=>scan(e.id));
 for(let i=0;i<pending.length;i++)scan(byId.get(pending[i]));
 const fallback=emptyDocument(),{entities:_,...document}=fallback;
 return validateWorkspace({...workspace,entities:workspace.entities.filter(e=>included.has(e.id)),
  atlases:atlases.length?atlases:[{id:'transfer-empty-atlas',name:'Library content',document}],
  activeAtlasId:atlases.some(a=>a.id===workspace.activeAtlasId)?workspace.activeAtlasId:atlases[0]?.id??'transfer-empty-atlas',
  library:library?workspace.library:{items:[],collections:[],families:[]}});
}
export function createWorkspaceTransfer(workspace:OmnicWorkspace,ui:WorkspaceUI,choice:TransferChoice):WorkspaceTransfer{
 if(!hasTransferChoice(choice))throw Error('Choose at least one part.');
 const content=choice.atlasIds.length||choice.library?contentSubset(workspace,choice.atlasIds,choice.library):undefined;
 const result:WorkspaceTransfer={format:'omnium-workspace-transfer',version:1,atlasIds:[...choice.atlasIds],library:choice.library,
  complete:choice.library&&choice.atlasIds.length===workspace.atlases.length,
  ...(content?{workspace:content}:{}),...(choice.layout?{layout:ui.layout}:{}),...(choice.settings?{settings:ui.settings}:{}),fonts:choice.settings?ui.fonts:[]};
 return validateWorkspaceTransfer(result);
}
export function validateWorkspaceTransfer(input:unknown):WorkspaceTransfer{
 if(!input||typeof input!=='object')throw Error('Invalid transfer.');
 const v=input as WorkspaceTransfer;
 if(v.format!=='omnium-workspace-transfer'||v.version!==1||!Array.isArray(v.atlasIds)||v.atlasIds.some(id=>typeof id!=='string')||new Set(v.atlasIds).size!==v.atlasIds.length||typeof v.library!=='boolean'||typeof v.complete!=='boolean')throw Error('Unsupported or invalid workspace transfer.');
 if(new TextEncoder().encode(JSON.stringify(v)).length>WORKSPACE_BACKUP_BYTES)throw Error('Transfer exceeds its size limit.');
 const workspace=v.workspace===undefined?undefined:validateWorkspace(v.workspace);
 if((v.atlasIds.length||v.library)&&!workspace||workspace&&v.atlasIds.some(id=>!workspace.atlases.some(a=>a.id===id)))throw Error('Transfer is missing selected content.');
 if(v.complete&&(!v.library||!workspace||v.atlasIds.length!==workspace.atlases.length))throw Error('Invalid complete-workspace marker.');
 const fonts=parseCustomFonts(v.fonts);
 if(v.settings!==undefined&&(!v.settings||typeof v.settings!=='object'||Array.isArray(v.settings)))throw Error('Invalid settings.');
 const result:WorkspaceTransfer={format:v.format,version:1,atlasIds:v.atlasIds,library:v.library,complete:v.complete,...(workspace?{workspace}:{}),...(v.layout!==undefined?{layout:validateUILayout(v.layout)}:{}),...(v.settings!==undefined?{settings:normalizeSettings(v.settings)}:{}),fonts};
 if(!hasTransferChoice(transferChoice(result)))throw Error('Transfer contains no selectable parts.');
 return result;
}
export function parseWorkspaceTransfer(text:string):WorkspaceTransfer{
 if(new TextEncoder().encode(text).length>WORKSPACE_BACKUP_BYTES)throw Error('Transfer exceeds its size limit.');
 const value=JSON.parse(text);
 if(value?.format==='omnium-workspace-transfer')return validateWorkspaceTransfer(value);
 if(value?.format==='omnium-workspace'||value?.format==='omnium-workspace-backup'){
  const source=parseWorkspaceBackup(text);
  return validateWorkspaceTransfer({format:'omnium-workspace-transfer',version:1,workspace:source.workspace,atlasIds:source.workspace.atlases.map(a=>a.id),library:true,complete:true,layout:source.ui?.layout,settings:source.ui?.settings,fonts:source.ui?.fonts??[]});
 }
 if(value?.format==='omnium-ui-template'){
  const ui=validateWorkspaceUI(value);
  return validateWorkspaceTransfer({format:'omnium-workspace-transfer',version:1,atlasIds:[],library:false,complete:false,layout:ui.layout,settings:ui.settings,fonts:ui.fonts});
 }
 const doc=parseDocument(text),{entities,...document}=doc;
 return validateWorkspaceTransfer({format:'omnium-workspace-transfer',version:1,workspace:{format:'omnium-workspace',version:1,id:'atlas-transfer',name:'Atlas import',revision:0,entities,atlases:[{id:'imported-atlas',name:'Imported atlas',document}],activeAtlasId:'imported-atlas',library:{items:[],collections:[],families:[]}},atlasIds:['imported-atlas'],library:false,complete:false,fonts:[]});
}
/** Partial content adds independent copies, retaining cross-atlas shared identities. */
export function mergeWorkspaceTransfer(current:OmnicWorkspace,source:WorkspaceTransfer,choice:TransferChoice,newId:()=>string=()=>crypto.randomUUID()):OmnicWorkspace{
 if(!source.workspace||!choice.atlasIds.length&&!choice.library)return current;
 const content=contentSubset(source.workspace,choice.atlasIds,choice.library);
 const ids=new Map(content.entities.map(e=>[e.id,newId()])),entity=(id:string)=>ids.get(id)??id;
 const seed=remapImportedDocument({...emptyDocument(),entities:content.entities},current.entities,newId,ids);
 const atlases=content.atlases.filter(a=>choice.atlasIds.includes(a.id)).map(a=>{
  const {entities:_,...document}=remapImportedDocument({...a.document,entities:content.entities},seed.entities,newId,ids);
  return {...a,id:newId(),document};
 });
 const collections=new Map(content.library.collections.map(c=>[c.id,newId()]));
 const library=choice.library?{
  items:[...current.library.items,...content.library.items.map(item=>({...item,entityId:entity(item.entityId),derivedFrom:item.derivedFrom?entity(item.derivedFrom):undefined,collections:item.collections.map(id=>collections.get(id)!)}))],
  collections:[...current.library.collections,...content.library.collections.map(c=>({...c,id:collections.get(c.id)!,parentId:c.parentId?collections.get(c.parentId)!:null}))],
  families:[...current.library.families,...content.library.families.map(f=>({...f,id:newId(),filter:{...f.filter,...(f.filter.collection?{collection:collections.get(f.filter.collection)??f.filter.collection}:{})}}))],
 }:current.library;
 return validateWorkspace({...current,revision:current.revision+1,entities:seed.entities,atlases:[...current.atlases,...atlases],library});
}
export function prepareWorkspaceTransfer(current:OmnicWorkspace,currentUI:WorkspaceUI,source:WorkspaceTransfer,choice:TransferChoice,replace:boolean){
 const available=transferChoice(source);
 if(!hasTransferChoice(choice)||choice.atlasIds.some(id=>!available.atlasIds.includes(id))||choice.library&&!available.library||choice.layout&&!available.layout||choice.settings&&!available.settings)throw Error('Choose parts present in this file.');
 if(replace&&(!source.complete||!choice.library||choice.atlasIds.length!==source.atlasIds.length))throw Error('Only complete selected content can replace the workspace.');
 const workspace=replace?source.workspace!:mergeWorkspaceTransfer(current,source,choice);
 const ui=choice.layout||choice.settings?validateWorkspaceUI({format:'omnium-ui-template',version:3,layout:choice.layout?source.layout:currentUI.layout,settings:choice.settings?source.settings:currentUI.settings,fonts:choice.settings?source.fonts:currentUI.fonts}):undefined;
 return {workspace,ui};
}
