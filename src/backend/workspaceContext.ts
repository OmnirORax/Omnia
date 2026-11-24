import type {SupabaseClient,Session} from '@supabase/supabase-js';
import {backendClient} from './client.ts';
import {cloud,type Workspace,type WorkspaceMember} from './cloud.ts';
/** One selected account workspace and permission owner for account, transfers and images. */
export function createWorkspaceContext(client:SupabaseClient){
 let session:Session|null=null,workspaces:Workspace[]=[],members:WorkspaceMember[]=[],id='',epoch=0,error='',disposed=false,receivedAuth=false;
 const listeners=new Set<()=>void>(),emit=()=>{for(const fn of [...listeners])fn();};
 const current=()=>{const version=epoch;return()=>!disposed&&version===epoch;};
 async function refresh(){
  const valid=current(),actor=session?.user.id;if(!actor)return;
  try{const [list,permissions]=await Promise.all([cloud.workspaces(client),client.from('workspace_members').select('*').eq('user_id',actor)]);if(!valid())return;if(permissions.error)throw Error('Workspace permissions unavailable.');const previousRole=members.find(item=>item.workspace_id===id)?.role;workspaces=list;members=permissions.data as WorkspaceMember[];if(!list.some(item=>item.id===id)){id=list[0]?.id??'';epoch++;}else if(previousRole!==members.find(item=>item.workspace_id===id)?.role)epoch++;error='';emit();}
  catch(failure){if(valid()){error=failure instanceof Error?failure.message:String(failure);emit();}}
 }
 function apply(next:Session|null){if(disposed)return;const changed=session?.user.id!==next?.user.id;session=next;if(!changed)return;epoch++;id='';workspaces=[];members=[];error='';emit();if(session)void refresh();}
 const subscription=client.auth.onAuthStateChange((_event,next)=>{receivedAuth=true;queueMicrotask(()=>apply(next));});
 const generation=epoch;
 const ready=client.auth.getSession().then(result=>{if(disposed||receivedAuth||generation!==epoch)return;if(result.error){error='Account session could not be loaded.';emit();}else apply(result.data.session);}).catch(()=>{if(!disposed&&!receivedAuth){error='Account session could not be loaded.';emit();}});
 return {client,ready,refresh,current,
  get state(){const role=members.find(item=>item.workspace_id===id)?.role;return {session,workspaces,id,role,canWrite:role==='owner'||role==='editor',error};},
  select(next:string){if(next===id)return;if(!workspaces.some(item=>item.id===next))throw Error('Workspace unavailable.');id=next;epoch++;emit();},
  async create(name:string,requestId:string){const valid=current(),actor=session?.user.id,created=await cloud.createWorkspace(client,name,requestId);if(!valid())return;await refresh();if(session?.user.id===actor&&workspaces.some(item=>item.id===created.id))this.select(created.id);},
  subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn);};},
  dispose(){disposed=true;epoch++;subscription.data.subscription.unsubscribe();listeners.clear();},
 };
}
export type WorkspaceContext=ReturnType<typeof createWorkspaceContext>;
let shared:WorkspaceContext|undefined;
export const accountWorkspaces=()=>shared??=createWorkspaceContext(backendClient());
