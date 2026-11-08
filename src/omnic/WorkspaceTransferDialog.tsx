import {useState} from 'react';
import {FloatingWindow} from '../ui/FloatingWindow';
import {UIField} from '../ui/UIField';
import {UIAction} from '../ui/UIAction';
import type {OmnicWorkspace} from './workspace';
import {fullTransferChoice,hasTransferChoice,transferChoice,type TransferChoice,type WorkspaceTransfer} from './workspaceTransfer';

export function WorkspaceTransferDialog({workspace,source,onApply,onClose}:{workspace:OmnicWorkspace;source?:WorkspaceTransfer;onApply:(choice:TransferChoice,replace:boolean)=>Promise<void>;onClose:()=>void}){
 const available=source?transferChoice(source):fullTransferChoice(workspace);
 const [choice,setChoice]=useState<TransferChoice>(available),[replace,setReplace]=useState(!!source?.complete),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const all=available.atlasIds.every(id=>choice.atlasIds.includes(id))&&choice.atlasIds.length===available.atlasIds.length&&choice.library===available.library&&choice.layout===available.layout&&choice.settings===available.settings;
 const complete=!!source?.complete&&choice.library&&source.atlasIds.length===choice.atlasIds.length;
 const run=async()=>{setBusy(true);setError('');try{await onApply(choice,replace&&complete);onClose();}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}};
 return <FloatingWindow id="workspace-transfer" title={source?'Import workspace parts':'Export workspace parts'} width={400} height={420} onClose={()=>{if(busy)return false;onClose();}}>
  <UIField id="transfer-all" label="Entire selection" category="File"><label><input type="checkbox" disabled={busy} checked={all} onChange={e=>setChoice(e.target.checked?available:{atlasIds:[],library:false,layout:false,settings:false})}/>{source?'All parts in this file':'Entire workspace'}</label></UIField>
  {!!available.atlasIds.length&&<fieldset disabled={busy}><legend>Atlases</legend>{(source?.workspace??workspace).atlases.filter(a=>available.atlasIds.includes(a.id)).map(a=><UIField key={a.id} id={`transfer-atlas:${a.id}`} label={a.name} category="File"><label><input type="checkbox" checked={choice.atlasIds.includes(a.id)} onChange={e=>setChoice({...choice,atlasIds:e.target.checked?[...choice.atlasIds,a.id]:choice.atlasIds.filter(id=>id!==a.id)})}/>{a.name}</label></UIField>)}</fieldset>}
  {(['library','layout','settings'] as const).filter(key=>available[key]).map(key=><UIField key={key} id={`transfer-${key}`} label={{library:'Omnic definitions / library',layout:'UI layout',settings:'Settings, shortcuts & appearance'}[key]} category="File"><label><input type="checkbox" disabled={busy} checked={choice[key]} onChange={e=>setChoice({...choice,[key]:e.target.checked})}/>{{library:'Omnic definitions / library',layout:'UI layout',settings:'Settings, shortcuts & appearance'}[key]}</label></UIField>)}
  <p><small>Required definitions accompany selected atlases automatically. Unsaved drafts, private media files and device connections are excluded.</small></p>
  {source&&complete&&<UIField id="transfer-replace" label="Replace workspace" category="File"><label><input type="checkbox" disabled={busy} checked={replace} onChange={e=>setReplace(e.target.checked)}/>Replace entire workspace</label></UIField>}
  {source&&<p><small>{replace&&complete?'Replaces workspace content.':'Adds independent copies; keeps current workspace content.'} Only checked UI/settings parts are restored. A recovery copy is kept.</small></p>}
  {error&&<p role="alert">{error}</p>}
  <UIAction id="transfer-apply" label={busy?'Working…':source?'Import selected':'Export selected'} category="File" disabled={busy||!hasTransferChoice(choice)} onClick={()=>void run()}/>
 </FloatingWindow>;
}
