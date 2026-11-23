import {verifyAccess} from '../cloud/access.ts';
import {privateSnapshot,UUID} from './workspaceSnapshot.ts';
type Environment={url:string;key:string;origins:readonly string[]};
export async function accountWorkspaceServer(request:Request,env:Environment,fetcher:typeof fetch=fetch){
 const origin=request.headers.get('origin')??'',headers={'access-control-allow-origin':env.origins.includes(origin)?origin:env.origins[0]??'','access-control-allow-headers':'authorization, apikey, content-type, x-client-info','access-control-allow-methods':'POST, OPTIONS','vary':'Origin','cache-control':'no-store'};
 const reply=(data:unknown,status=200)=>Response.json(data,{status,headers});
 const trusted=request.headers.get('x-omnium-origin')===origin&&await verifyAccess(request.headers.get('x-omnium-access')??'',fetcher,origin);
 if(trusted)headers['access-control-allow-origin']=origin;
 if(!env.origins.includes(origin)&&!trusted)return reply({error:'Origin is not allowed.'},403);
 if(request.method==='OPTIONS')return new Response(null,{headers});
 if(request.method!=='POST')return reply({error:'Unsupported method.'},405);
 const auth=request.headers.get('authorization')??'';if(!auth.startsWith('Bearer '))return reply({error:'Sign in first.'},401);
 try{
  const who=await fetcher(`${env.url}/auth/v1/user`,{headers:{apikey:env.key,authorization:auth},signal:AbortSignal.timeout(15000)});
  if(!who.ok)return reply({error:'Session expired or unavailable.'},who.status>=500?503:401);
  const user=await who.json() as {id?:string};if(!user.id||!UUID.test(user.id))return reply({error:'Invalid account.'},401);
  const reader=request.body?.getReader();if(!reader)return reply({error:'Missing snapshot.'},400);const chunks:Uint8Array[]=[];let size=0;
  for(;;){const next=await reader.read();if(next.done)break;size+=next.value.length;if(size>5_200_000){await reader.cancel();return reply({error:'Snapshot exceeds its size limit.'},413);}chunks.push(next.value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  const input=JSON.parse(new TextDecoder().decode(bytes));
  if(!UUID.test(input.workspaceId)||!UUID.test(input.requestId)||!Number.isSafeInteger(input.expectedVersion)||input.expectedVersion<0)return reply({error:'Invalid save request.'},400);
  const snapshot=privateSnapshot(input.snapshot),dbheaders={apikey:env.key,authorization:`Bearer ${env.key}`,'content-type':'application/json'};
  const membership=await fetcher(`${env.url}/rest/v1/workspace_members?workspace_id=eq.${input.workspaceId}&user_id=eq.${user.id}&select=role`,{headers:dbheaders,signal:AbortSignal.timeout(15000)});
  if(!membership.ok)return reply({error:'Workspace permissions unavailable.'},503);const roles=await membership.json() as {role:string}[];if(!roles.some(item=>['owner','editor'].includes(item.role)))return reply({error:'Workspace editing access is required.'},403);
  if(snapshot.images.length){const ids=[...new Set(snapshot.images.map(image=>image.assetId))];const response=await fetcher(`${env.url}/rest/v1/assets?workspace_id=eq.${input.workspaceId}&state=eq.ready&id=in.(${ids.join(',')})&select=id`,{headers:dbheaders,signal:AbortSignal.timeout(15000)});if(!response.ok)return reply({error:'Private image lookup failed.'},503);const found=await response.json() as {id:string}[];if(found.length!==ids.length)return reply({error:'A scene image is missing from this workspace.'},400);}
  const saved=await fetcher(`${env.url}/rest/v1/rpc/save_account_workspace`,{method:'POST',headers:dbheaders,body:JSON.stringify({p_workspace:input.workspaceId,p_actor:user.id,p_expected:input.expectedVersion,p_request:input.requestId,p_snapshot:snapshot}),signal:AbortSignal.timeout(30000)});
  if(!saved.ok){const error=await saved.json().catch(()=>null) as {code?:string}|null;return reply({error:error?.code==='23505'?'Workspace changed. Reload before saving.':error?.code==='42501'?'Workspace editing access is required.':'Cloud save failed.'},error?.code==='23505'?409:error?.code==='42501'?403:503);}
  return reply({data:await saved.json()});
 }catch{return reply({error:'Invalid snapshot or unavailable cloud service.'},400);}
}
