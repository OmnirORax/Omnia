import {useEffect,useRef,useState} from 'react';
import {backendConfiguration,cloud,type Workspace} from '../backend/client';
import {UISection} from '../ui/UISection';
import {UIField} from '../ui/UIField';
import {FunctionControl} from '../ui/UIWorkspace';
import {useFeatureActions} from '../ui/useFeatureActions';
import {saveWorkspaceSlot} from './workspaceStorage';
import {parseWorkspace,WORKSPACE_BYTES,type OmnicWorkspace} from './workspace';

type Base={localId:string;version:number};
const baseKey=(user:string,id:string)=>`omnium.workspace.cloud-base.v1:${user}:${id}`;
export function WorkspaceCloud({workspace,onChange}:{workspace:OmnicWorkspace;onChange:(next:OmnicWorkspace)=>void}){
  const config=backendConfiguration(),client=config.kind==='cloud'?config.client:null;
  const [userId,setUserId]=useState(''),[list,setList]=useState<Workspace[]>([]),[selected,setSelected]=useState('');
  const [base,setBase]=useState<Base|null>(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState('');
  const epoch=useRef(0),current=useRef({workspace,selected,userId});current.current={workspace,selected,userId};
  const attempt=useRef<{local:OmnicWorkspace;remote:string;id:string;expected:number}|null>(null);
  useEffect(()=>{
    if(!client)return;let live=true,lastUser='';
    const apply=(id:string)=>{if(!live||id===lastUser)return;lastUser=id;epoch.current++;setUserId(id);setList([]);setSelected('');setBase(null);setBusy(false);setError('');setNotice('');attempt.current=null;
      if(id)void cloud.workspaces(client).then(list=>{if(live&&lastUser===id){setList(list);setSelected(list[0]?.id??'');}}).catch(()=>{if(live)setError('Cloud workspaces could not be loaded.');});
    };
    let authEvents=0;
    const {data}=client.auth.onAuthStateChange((_event,session)=>{authEvents++;apply(session?.user.id??'');});void client.auth.getSession().then(result=>{if(!authEvents)apply(result.data.session?.user.id??'');});
    return()=>{live=false;epoch.current++;data.subscription.unsubscribe();};
  },[client]);
  useEffect(()=>{
    epoch.current++;setBusy(false);setNotice('');setError('');attempt.current=null;
    try{const saved=JSON.parse(localStorage.getItem(baseKey(userId,selected))??'null');setBase(saved&&saved.localId===workspace.id&&Number.isSafeInteger(saved.version)&&saved.version>0?saved:null);}catch{setBase(null);}
  },[selected,userId,workspace.id]);
  const run=async(kind:'save'|'load')=>{
    if(!client||!userId||!selected||busy)return;const token=epoch.current,captured=workspace,remote=selected,actor=userId;setBusy(true);setError('');setNotice('');
    const valid=()=>token===epoch.current&&current.current.selected===remote&&current.current.userId===actor;
    try{
      if(kind==='save'){
        const text=JSON.stringify(captured);if(new TextEncoder().encode(text).length>WORKSPACE_BYTES)throw Error('Workspace exceeds 8 MB. Export/reduce old revisions before saving.');
        if(attempt.current?.local!==captured||attempt.current.remote!==remote)attempt.current={local:captured,remote,id:crypto.randomUUID(),expected:base?.localId===captured.id?base.version:0};
        const request=attempt.current;
        const result=await cloud.saveWorkspace(client,{operation:'workspace.save',workspaceId:remote,requestId:request.id,expectedVersion:request.expected,snapshot:captured});
        if(!valid())return;const next={localId:captured.id,version:result.version};setBase(next);attempt.current=null;
        try{localStorage.setItem(baseKey(actor,remote),JSON.stringify(next));}catch{throw Error('Cloud save completed, but its local version token could not be saved. Load cloud before saving again.');}
        setNotice(`Cloud revision ${result.version} saved.${current.current.workspace!==captured?' Newer local edits remain unsaved to cloud.':''}`);
      }else{
        const result=await cloud.loadWorkspace(client,remote);if(!valid())return;if(!result)throw Error('This cloud workspace has no snapshot. Save local workspace to create one.');
        if(current.current.workspace!==captured)throw Error('Local work changed during download. Retry Load cloud when edits have finished.');
        const next=parseWorkspace(JSON.stringify(result.snapshot));
        // Explicit replacement retains a concrete local recovery snapshot and the
        // shared journal's undo entry. A failed backup never discards local work.
        await saveWorkspaceSlot(captured,'before-replace');
        if(!valid()||current.current.workspace!==captured)throw Error('Local work changed while preserving its backup. Retry Load cloud.');
        onChange(next);const binding={localId:next.id,version:result.version};setBase(binding);localStorage.setItem(baseKey(actor,remote),JSON.stringify(binding));
        setNotice(`Loaded cloud revision ${result.version}. Previous local workspace is recoverable with Undo and its local backup.`);
      }
    }catch(error){if(valid())setError(error instanceof Error?error.message:String(error));}
    finally{if(valid())setBusy(false);}
  };
  useFeatureActions('omnicWorkspaceCloud',{
    'omnic.workspace.saveCloud':{enabled:!!client&&!!userId&&!!selected&&!busy,run:()=>void run('save')},
    'omnic.workspace.loadCloud':{enabled:!!client&&!!userId&&!!selected&&!busy,run:()=>void run('load')},
  });
  return <UISection id="omnic-workspace-cloud" title="Cloud workspace" defaultExpanded={false}>
    {config.kind==='invalid'?<small role="alert">{config.message}</small>:!client?<small>Cloud is unconfigured. Local autosave and JSON export work independently.</small>:!userId?<small>Sign in through Workspace settings → Cloud connection.</small>:<>
      <div className="omnic-row"><UIField id="omnic:cloud-workspace" label="Cloud workspace" category="Cloud"><select aria-label="Cloud workspace for atlas library" value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Choose workspace…</option>{list.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></UIField><FunctionControl id="omnic.workspace.saveCloud"/><FunctionControl id="omnic.workspace.loadCloud"/></div>
      <small>{busy?'Working…':base?`Loaded / saved cloud revision ${base.version}`:'First save creates a snapshot; existing cloud work requires Load first.'} · Load replaces the local workspace.</small>
    </>}
    {notice&&<small role="status">{notice}</small>}{error&&<small role="alert">{error} Cloud conflicts require loading the newer snapshot or saving to another workspace.</small>}
  </UISection>;
}
