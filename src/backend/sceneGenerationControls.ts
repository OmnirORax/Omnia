import {workspacePicker} from './workspacePicker.ts';
import {cloud} from './cloud.ts';
import type {ScenePromptSnapshot} from '../scene/library.ts';
export type GenerationRetry={pending?:{key:string;id:string}};
/** Generation inherits the Scene prompt editor; only the remote operation differs. */
export function sceneGenerationControls(parent:HTMLElement,resolve:()=>ScenePromptSnapshot,retry:GenerationRetry,account:(()=>void)|undefined,report:(error:unknown)=>void){
 const root=document.createElement('div'),content=document.createElement('div');parent.append(root);let live=true,version=0;
 const picker=workspacePicker(root,context=>{const generation=++version;content.replaceChildren();const {id,session,canWrite}=context.state;if(!id||!session)return;const valid=context.current();
  const current=()=>live&&generation===version&&valid();
  const refresh=async()=>{const [capabilities,history]=await Promise.all([cloud.sceneCapabilities(context.client,id),cloud.sceneGenerations(context.client,id)]);if(!current())return;content.replaceChildren();
   if(capabilities.enabled){const generate=document.createElement('button');generate.textContent='Generate scene';generate.disabled=!canWrite;generate.onclick=()=>{if(!current())return;generate.disabled=true;void(async()=>{const input=resolve(),key=JSON.stringify([session.user.id,id,input.prompt,input.variable,input.source,input.node]);if(retry.pending?.key!==key)retry.pending={key,id:crypto.randomUUID()};const result=await cloud.generateScene(context.client,{operation:'scene.generate',workspaceId:id,requestId:retry.pending.id,prompt:input.prompt,variable:input.variable,source:input.source,node:input.node});if(!current())return;if(result.state==='ready')retry.pending=undefined;await refresh();})().catch(error=>{if(current())report(error);}).finally(()=>{if(current())generate.disabled=!canWrite;});};content.append(generate);}
   const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Generation history';details.append(summary);for(const item of history){const row=document.createElement('div');row.textContent=`${item.state} · ${item.created_at}`;details.append(row);}content.append(details);
  };void refresh().catch(error=>{if(current())report(error);});
 },{account,error:report});root.append(content);
 return()=>{live=false;version++;picker.dispose();};
}
