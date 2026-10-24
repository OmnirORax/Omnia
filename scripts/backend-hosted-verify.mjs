// Explicit hosted smoke test. Temporary server-side access is protected by a
// random secret; the function, secret, users, files, and rows are cleaned up.
import { randomBytes } from 'node:crypto';
const ref = process.argv[2];
if (!/^[a-z]{20}$/.test(ref ?? '') || new URL(process.env.VITE_SUPABASE_URL ?? '').hostname !== `${ref}.supabase.co`)
  throw new Error('Supply the configured hosted project ref.');
if (!process.env.SUPABASE_ACCESS_TOKEN) throw new Error('Deployment authorization is required.');
const base = `https://api.supabase.com/v1/projects/${ref}`;
const slug = 'omnia-deployment-check';
const secretName = 'OMNIA_DEPLOY_CHECK_TOKEN';
const challenge = randomBytes(32).toString('hex');
async function api(path, method, body, multipart = false) {
  const r = await fetch(base + path, { method, headers: {
    Authorization: 'Bearer ' + process.env.SUPABASE_ACCESS_TOKEN,
    ...(multipart ? {} : { 'Content-Type': 'application/json' }),
  }, body: body === undefined ? undefined : multipart ? body : JSON.stringify(body), signal: AbortSignal.timeout(180000) });
  if (!r.ok) throw new Error(`Hosted check management operation failed: ${method} ${path}, HTTP ${r.status}`);
  const text = await r.text(); return text ? JSON.parse(text) : null;
}
const source = String.raw`
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
Deno.serve(async request => {
  const secret = Deno.env.get('OMNIA_DEPLOY_CHECK_TOKEN');
  if (!secret || request.headers.get('authorization') !== 'Bearer ' + secret || request.method !== 'POST')
    return new Response(null, {status:401});
  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_ANON_KEY')!;
  const options = {auth:{persistSession:false,autoRefreshToken:false}};
  const service = createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,options);
  const users:string[] = [], workspaces:string[] = [], objects:string[] = [], checks:string[] = [];
  let failed = '', cleanup = true;
  const ok = (r:any) => {if(r.error) throw new Error('service operation'); return r.data;};
  const pass = (name:string,value:boolean) => {if(!value) throw new Error(name);checks.push(name);};
  try {
    const actors = [];
    for(let i=0;i<2;i++) {
      const email='deployment-check-'+crypto.randomUUID()+'@omnia.invalid';
      const password=crypto.randomUUID()+'Aa1!';
      const created=ok(await service.auth.admin.createUser({email,password,email_confirm:true}));users.push(created.user.id);
      const client=createClient(url,key,options);
      const signed=ok(await client.auth.signInWithPassword({email,password}));
      actors.push({client,token:signed.session.access_token});
    }
    const [alice,bob] = actors;
    pass('temporary account sign-in',true);
    const call=async(actor:any,body:unknown,status=200)=>{
      const r=await fetch(url+'/functions/v1/backend',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+actor.token,'Content-Type':'application/json'},body:JSON.stringify(body)});
      if(r.status!==status) throw new Error('backend response HTTP '+r.status);
      return r.json();
    };
    const requestId=crypto.randomUUID();
    const workspace=(await call(alice,{operation:'workspace.create',name:'Deployment verification',requestId})).data;
    workspaces.push(workspace.id);
    pass('workspace creation and owner membership',!!workspace.id);
    const again=(await call(alice,{operation:'workspace.create',name:'Deployment verification',requestId})).data;
    pass('idempotent creation',again.id===workspace.id);
    pass('workspace isolation',ok(await bob.client.from('workspaces').select('id').eq('id',workspace.id)).length===0);
    const bytes=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII='),c=>c.charCodeAt(0));
    const asset=ok(await alice.client.rpc('reserve_asset',{p_id:crypto.randomUUID(),p_workspace_id:workspace.id,p_name:'check.png',p_media_type:'image/png',p_byte_size:bytes.length}));objects.push(asset.object_key);
    ok(await alice.client.storage.from('workspace-assets').upload(asset.object_key,new Blob([bytes],{type:'image/png'}),{contentType:'image/png'}));
    pass('private multipart upload',true);
    const finalized=(await call(alice,{operation:'asset.finalize',assetId:asset.id})).data;
    pass('server-side image finalization',finalized.state==='ready');
    const downloaded=ok(await alice.client.storage.from('workspace-assets').download(asset.object_key));
    pass('authenticated download',downloaded.size===bytes.length);
    pass('file isolation',!!(await bob.client.storage.from('workspace-assets').download(asset.object_key)).error);
    ok(await alice.client.rpc('set_workspace_member',{p_workspace_id:workspace.id,p_user_id:users[1],p_role:'viewer'}));
    ok(await bob.client.storage.from('workspace-assets').download(asset.object_key));
    await call(bob,{operation:'asset.delete',assetId:asset.id},403);
    pass('viewer can read but cannot delete',true);
    await call(alice,{operation:'asset.delete',assetId:asset.id});
    pass('object and record deletion',ok(await alice.client.from('assets').select('id').eq('id',asset.id)).length===0);
  } catch(error) {failed=error instanceof Error?error.message:'check failed';}
  finally {
    try {
      if(objects.length) ok(await service.storage.from('workspace-assets').remove(objects));
      for(const id of workspaces) {
        ok(await service.from('assets').delete().eq('workspace_id',id));
        ok(await service.from('workspace_members').delete().eq('workspace_id',id));
        ok(await service.from('workspaces').delete().eq('id',id));
      }
      for(const id of users) ok(await service.auth.admin.deleteUser(id));
    }catch{cleanup=false;}
  }
  return Response.json({checks,failed,cleanup}, {status:failed||!cleanup?500:200});
});`;
let secretCreated = false, functionCreated = false;
try {
  // Refuse to overwrite an existing verification endpoint or secret.
  if ((await api('/functions','GET')).some(item=>item.slug===slug) || (await api('/secrets','GET')).some(item=>item.name===secretName))
    throw new Error('Existing verification resources need operator review before retrying.');
  await api('/secrets','POST',[{name:secretName,value:challenge}]); secretCreated = true;
  const form = new FormData();
  form.append('metadata',JSON.stringify({entrypoint_path:'index.ts',name:slug,verify_jwt:false}));
  form.append('file',new Blob([source]),'index.ts');
  await api('/functions/deploy?slug='+slug,'POST',form,true); functionCreated = true;
  const response = await fetch(`https://${ref}.supabase.co/functions/v1/${slug}`,{
    method:'POST',headers:{Authorization:'Bearer '+challenge,apikey:process.env.VITE_SUPABASE_PUBLISHABLE_KEY},signal:AbortSignal.timeout(120000),
  });
  const result=await response.json();
  console.log(JSON.stringify({status:response.status,...result}));
  if (!response.ok || !result.cleanup) throw new Error('Hosted smoke checks or cleanup failed.');
} finally {
  // Separate cleanup attempts: a failed function removal must not retain its credential.
  try { if(functionCreated) await api('/functions/'+slug,'DELETE'); }
  finally { if(secretCreated) await api('/secrets','DELETE',[secretName]); }
  console.log('Temporary verification endpoint and secret removed.');
}
