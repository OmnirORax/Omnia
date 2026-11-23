import {panel} from '../ui/panel.ts';
import {backendClient} from './client.ts';
import {cloud,type Asset,type Workspace,type WorkspaceMember} from './cloud.ts';
import {loadPrivateWorkspace,savePrivateWorkspace,downloadPrivateWorkspace} from './workspaces.ts';
import {withWorkspaceImages} from '../core/workspaceImages.ts';
import {checkedWorld,parseWorkspaceFile,TRANSFER_BYTES,type WorkspaceFile} from '../core/transfer.ts';
import {downloadScene} from '../scene/library.ts';
import type {World} from '../core/model.ts';
import type {Session} from '@supabase/supabase-js';
let active:{show:()=>void}|undefined,host:{read:()=>World;importWorkspace?:(file:WorkspaceFile)=>void|Promise<void>}|undefined;
export async function openAccountPanel(nextHost?:{read:()=>World;importWorkspace?:(file:WorkspaceFile)=>void|Promise<void>}){
 if(nextHost)host=nextHost;if(active){active.show();return;}
 const client=backendClient();let session:Session|null=null,epoch=0,closed=false,busy=false,workspaceId='',assetId='',workspaces:Workspace[]=[],members:WorkspaceMember[]=[],assets:Asset[]=[];
 let pendingCreate:{name:string;id:string}|undefined,pendingGeneration:{workspace:string;subject:string;prompt:string;id:string}|undefined;
 let stop=()=>{},renderVersion=0;
 const view=panel('Account / Cloud',()=>{closed=true;epoch++;stop();active=undefined;});active=view;
 const body=document.createElement('div'),status=document.createElement('div');status.setAttribute('role','status');view.body.append(body,status);
 function text(parent:HTMLElement,value:string){const element=document.createElement('div');element.textContent=value;parent.append(element);return element;}
 function field(parent:HTMLElement,label:string,type='text',value=''){const row=document.createElement('label'),input=document.createElement('input');row.append(document.createTextNode(label),input);input.type=type;input.value=value;parent.append(row);return input;}
 function button(parent:HTMLElement,label:string,action:(current:()=>boolean)=>void|Promise<void>){const b=document.createElement('button');b.textContent=label;b.type='button';b.disabled=busy;b.onclick=()=>void run(action);parent.append(b);return b;}
 async function run(action:(current:()=>boolean)=>void|Promise<void>){if(busy)return;const generation=epoch;busy=true;status.textContent='';try{await action(()=>generation===epoch&&!closed);}catch(error){if(generation===epoch&&!closed)status.textContent=error instanceof Error?error.message:String(error);}finally{if(generation===epoch){busy=false;for(const b of body.querySelectorAll('button'))b.disabled=b.dataset.unavailable==='true';}}}
 function download(blob:Blob,name:string){if(!closed)downloadScene(blob,name);}
 async function refresh(){
  if(!session||closed)return;const generation=epoch,actor=session.user.id,id=workspaceId;
  const [list,permissions,files]=await Promise.all([cloud.workspaces(client),client.from('workspace_members').select('*').eq('user_id',actor),id?cloud.assets(client,id):Promise.resolve([])]);
  if(closed||generation!==epoch||id!==workspaceId)return;if(permissions.error)throw Error('Workspace permissions unavailable.');
  workspaces=list;members=permissions.data as WorkspaceMember[];assets=files;
  if(!list.some(item=>item.id===workspaceId)){workspaceId=list[0]?.id??'';assetId='';if(workspaceId){await refresh();return;}}
  if(!assets.some(item=>item.id===assetId))assetId=assets[0]?.id??'';render();
 }
 function render(){
  const version=++renderVersion;body.replaceChildren();if(!session){
   const form=document.createElement('form');body.append(form);const email=field(form,'Email','email'),password=field(form,'Password','password');email.autocomplete='username';password.autocomplete='current-password';email.required=password.required=true;
   const submit=document.createElement('button');submit.type='submit';submit.textContent='Sign in';form.append(submit);
   form.onsubmit=event=>{event.preventDefault();void run(async()=>{try{const {error}=await client.auth.signInWithPassword({email:email.value.trim(),password:password.value});if(error)throw Error('Sign-in failed. Check the account and password.');}finally{password.value='';}});};return;
  }
  text(body,session.user.email??'Signed in');button(body,'Copy account ID',async()=>{await navigator.clipboard.writeText(session!.user.id);status.textContent='Account ID copied';});button(body,'Sign out',async()=>{const {error}=await client.auth.signOut({scope:'local'});if(error)throw error;});button(body,'Refresh',refresh);
  const name=field(body,'New workspace');name.maxLength=100;
  button(body,'Create workspace',async()=>{const value=name.value.trim();if(!value)throw Error('Enter a workspace name.');if(pendingCreate?.name!==value)pendingCreate={name:value,id:crypto.randomUUID()};const generation=epoch;const created=await cloud.createWorkspace(client,value,pendingCreate.id);if(closed||generation!==epoch)return;workspaceId=created.id;pendingCreate=undefined;await refresh();});
  const chooser=document.createElement('select');chooser.setAttribute('aria-label','Cloud workspace');for(const item of workspaces){const option=document.createElement('option');option.value=item.id;option.textContent=item.name;chooser.append(option);}chooser.value=workspaceId;chooser.onchange=()=>{if(busy){chooser.value=workspaceId;return;}workspaceId=chooser.value;assets=[];assetId='';void run(refresh);};body.append(chooser);
  if(!workspaceId)return;const role=members.find(item=>item.workspace_id===workspaceId)?.role,canWrite=role==='owner'||role==='editor';text(body,`Access: ${role??'unavailable'}`);
  const restricted=(button:HTMLButtonElement,allowed:boolean)=>{button.dataset.unavailable=String(!allowed);button.disabled=!allowed||busy;};
  if(role==='owner'){const member=field(body,'Member account ID'),permission=document.createElement('select');for(const value of ['viewer','editor','remove']){const option=document.createElement('option');option.value=value;option.textContent=value;permission.append(option);}body.append(permission);button(body,'Set member access',async()=>{await cloud.setMember(client,workspaceId,member.value.trim(),permission.value==='remove'?null:permission.value as 'viewer'|'editor');await refresh();});}
  const upload=field(body,'Private image','file');upload.accept='image/png,image/jpeg,image/webp';upload.disabled=!canWrite;
  restricted(button(body,'Upload image',async(current)=>{const file=upload.files?.[0];if(!file)throw Error('Choose an image.');await cloud.upload(client,workspaceId,file,crypto.randomUUID(),current);await refresh();}),canWrite);
  const fileSelect=document.createElement('select');fileSelect.setAttribute('aria-label','Private cloud file');for(const item of assets){const option=document.createElement('option');option.value=item.id;option.textContent=`${item.name} · ${item.state}`;fileSelect.append(option);}fileSelect.value=assetId;fileSelect.onchange=()=>{if(busy){fileSelect.value=assetId;return;}assetId=fileSelect.value;render();};body.append(fileSelect);
  const selected=assets.find(item=>item.id===assetId);
  restricted(button(body,'Download image',async()=>{if(!selected)return;const generation=epoch,blob=await cloud.download(client,selected);if(generation===epoch)download(blob,selected.name);}),selected?.state==='ready');
  restricted(button(body,'Finish pending upload',async()=>{if(selected){await cloud.finalize(client,selected.id);await refresh();}}),canWrite&&selected?.state==='pending'&&selected.created_by===session.user.id);
  restricted(button(body,'Delete file',async()=>{if(selected&&confirm(`Delete private file “${selected.name}”?`)){await cloud.remove(client,selected.id);await refresh();}}),canWrite&&!!selected);
  const save=async(file:WorkspaceFile,current:()=>boolean)=>{if(!current())return;const generation=epoch,id=workspaceId,expected=await loadPrivateWorkspace(client,id);if(generation!==epoch||closed)return;await savePrivateWorkspace(client,id,file,expected,crypto.randomUUID(),current);if(generation===epoch&&!closed)status.textContent='Private V2 workspace saved';};
  if(host)restricted(button(body,'Save current V2 workspace',async(current)=>{if(!host)return;await save(await withWorkspaceImages({format:'omnium-v2-workspace',version:1,world:structuredClone(checkedWorld(host.read())),scenes:[]}),current);}),canWrite);
  const backup=field(body,'V2 workspace backup','file');backup.accept='.json,application/json';backup.disabled=!canWrite;
  restricted(button(body,'Upload V2 backup',async(current)=>{const file=backup.files?.[0];if(!file)throw Error('Choose a V2 workspace backup.');if(file.size>TRANSFER_BYTES)throw Error('Workspace file exceeds its limit.');await save(parseWorkspaceFile(await file.text()),current);}),canWrite);
  if(host?.importWorkspace)button(body,'Load V2 workspace',async()=>{const generation=epoch,file=await downloadPrivateWorkspace(client,workspaceId);if(generation===epoch&&!closed)await host?.importWorkspace?.(file);});
  button(body,'Download V2 workspace',async()=>{const generation=epoch,file=await downloadPrivateWorkspace(client,workspaceId);if(generation===epoch)download(new Blob([JSON.stringify(file)],{type:'application/json'}),'omnium-v2-private-workspace.json');});
  const generation=epoch,id=workspaceId;
  void cloud.sceneCapabilities(client,id).then(capabilities=>{if(closed||generation!==epoch||workspaceId!==id||version!==renderVersion||!capabilities.enabled)return;const prior=pendingGeneration?.workspace===id?pendingGeneration:undefined;const subject=field(body,'Scene subject','text',prior?.subject??''),prompt=field(body,'Scene prompt','text',prior?.prompt??'Create a detailed landscape of {{subject}}.');button(body,'Generate private scene',async()=>{if(pendingGeneration?.workspace!==id||pendingGeneration.subject!==subject.value||pendingGeneration.prompt!==prompt.value)pendingGeneration={workspace:id,subject:subject.value,prompt:prompt.value,id:crypto.randomUUID()};const result=await cloud.generateScene(client,{operation:'scene.generate',workspaceId:id,requestId:pendingGeneration.id,prompt:prompt.value,variable:'subject',source:'label',node:{id:'account-cloud',label:subject.value,notes:''}});if(generation===epoch&&result.state==='ready')pendingGeneration=undefined;await refresh();});}).catch(error=>{if(generation===epoch&&!closed)status.textContent=String(error);});
  void cloud.sceneGenerations(client,id).then(history=>{if(closed||generation!==epoch||workspaceId!==id||version!==renderVersion)return;const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Scene generation history';details.append(summary);for(const item of history)text(details,`${item.state} · ${item.created_at}`);body.append(details);}).catch(error=>{if(generation===epoch&&!closed)status.textContent=String(error);});
 }
 function apply(next:Session|null){if(closed)return;if(session?.user.id===next?.user.id){session=next;return;}session=next;epoch++;busy=false;workspaceId='';assetId='';workspaces=[];members=[];assets=[];pendingCreate=undefined;pendingGeneration=undefined;status.textContent='';render();if(session)void refresh().catch(error=>{if(!closed)status.textContent=String(error);});}
 const generation=epoch;const subscription=client.auth.onAuthStateChange((_event,next)=>{queueMicrotask(()=>apply(next));});stop=()=>subscription.data.subscription.unsubscribe();
 render();const result=await client.auth.getSession();if(!closed&&generation===epoch){if(result.error)status.textContent='Account session could not be loaded.';else apply(result.data.session);}
}
