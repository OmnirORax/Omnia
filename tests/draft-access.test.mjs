import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyAccess} from '../src/cloud/access.ts';
import {onRequest} from '../functions/api/draft.ts';
const encode=bytes=>Buffer.from(bytes).toString('base64url');
const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk={...await crypto.subtle.exportKey('jwk',pair.publicKey),kid:'draft-test'};
async function token(changes={}){
 const now=Date.now()/1000,head=encode(JSON.stringify({alg:'RS256',kid:jwk.kid})),body=encode(JSON.stringify({iss:'https://omnia-web-bae-pages.cloudflareaccess.com',aud:['5d6b072d04e3ec562ee66a50e39458b4cb20a48a33aace8351ef16eb796b10b3'],exp:now+300,nbf:now-1,...changes}));
 return `${head}.${body}.${encode(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(`${head}.${body}`)))}`;
}
test('shared draft requires a signed, unexpired assertion from the existing Access app',async()=>{
 const fetcher=async url=>{assert.equal(url,'https://omnia-web-bae-pages.cloudflareaccess.com/cdn-cgi/access/certs');return Response.json({keys:[jwk]});};
 const signed=await token();assert.equal(await verifyAccess(signed,fetcher),true);
 for(const changes of [{iss:'https://attacker.example'},{aud:['other-app']},{exp:0},{nbf:Date.now()/1000+600}])assert.equal(await verifyAccess(await token(changes),fetcher),false);
 const parts=signed.split('.');parts[2]=encode(new Uint8Array(256));assert.equal(await verifyAccess(parts.join('.'),fetcher),false);
 assert.equal(await verifyAccess('not-a-token',fetcher),false);
});
test('the website proxy rejects missing identity, cross-site writes and unsupported methods',async()=>{
 assert.equal((await onRequest({request:new Request('https://omnium.nexus/api/draft')})).status,401);
 assert.equal((await onRequest({request:new Request('https://omnium.nexus/api/draft',{method:'PUT',headers:{'cf-access-jwt-assertion':'ignored',origin:'https://attacker.example'},body:'{}'})})).status,403);
 assert.equal((await onRequest({request:new Request('https://omnium.nexus/api/draft',{method:'DELETE',headers:{'cf-access-jwt-assertion':'ignored'}})})).status,405);
});
test('the storage endpoint validates snapshots and handles revision conflicts without public database access',async()=>{
 const {draftServer}=await import('../src/cloud/server.ts'),{emptyWorld}=await import('../src/core/model.ts');
 const original=globalThis.fetch,world=emptyWorld();let conflict=false,calls=0;
 globalThis.fetch=async(url,init)=>{
  if(String(url).includes('/certs'))return Response.json({keys:[jwk]});
  assert.equal(init.headers.apikey,'server-only');calls++;
  if(String(url).includes('rpc/omnium_save_draft')){const body=JSON.parse(init.body);assert.equal(body.expected,1);assert.deepEqual(body.snapshot,world);return Response.json(conflict?null:2);}
  if(String(url).includes('omnium_site_draft?'))return Response.json([{world,revision:1}]);
  return Response.json([]);
 };
 try{
  const identity=await token(),env={url:'https://storage.example',key:'server-only'},headers={'x-omnium-access':identity,'content-type':'application/json'};
  let response=await draftServer(new Request('https://api.example/',{headers}),env);assert.equal(response.status,200);assert.deepEqual((await response.json()).world,world);
  const put=()=>new Request('https://api.example/',{method:'PUT',headers,body:JSON.stringify({version:1,revision:1,world})});
  response=await draftServer(put(),env);assert.deepEqual(await response.json(),{revision:2});conflict=true;assert.equal((await draftServer(put(),env)).status,409);
  const before=calls;response=await draftServer(new Request('https://api.example/',{method:'PUT',headers,body:JSON.stringify({version:2,revision:1,world})}),env);assert.equal(response.status,400);assert.equal(calls,before);
  assert.equal((await draftServer(new Request('https://api.example/'),env)).status,401);assert.equal(calls,before);
 }finally{globalThis.fetch=original;}
});
test('Pages Access cookies reach the verifier when the assertion header is absent',async()=>{
 const old=globalThis.fetch;let forwarded;
 globalThis.fetch=async(_url,init)=>{forwarded=init.headers['x-omnium-access'];return Response.json({ok:true});};
 try{const response=await onRequest({request:new Request('https://omnium.nexus/api/draft',{headers:{cookie:'other=value; CF_Authorization=signed-session; next=ignored'}})});assert.equal(response.status,200);assert.equal(forwarded,'signed-session');}
 finally{globalThis.fetch=old;}
});
test('preview Access audiences are discovered from that protected host, not assumed to equal production',async()=>{
 const origin='https://pr-72.omnia-web-bae.pages.dev',previewAudience='1'.repeat(64);
 const fetcher=async url=>{if(url===origin+'/')return new Response(null,{status:302,headers:{location:`https://omnia-web-bae-pages.cloudflareaccess.com/cdn-cgi/access/login/preview?kid=${previewAudience}`}});return Response.json({keys:[jwk]});};
 assert.equal(await verifyAccess(await token({aud:[previewAudience]}),fetcher,origin),true);
 assert.equal(await verifyAccess(await token(),fetcher,origin),false);
 assert.equal(await verifyAccess(await token({aud:[previewAudience]}),fetcher,'https://attacker.example'),false);
});
test('known storage failures reach the website without exposing database internals',async()=>{
 const {draftServer}=await import('../src/cloud/server.ts');
 const original=globalThis.fetch,identity=await token();
 try{
  for(const [message,expected] of [['Draft image library is full',/Pending.*100 MiB/],['Draft images exceed workspace limit',/workspace uses more than 100 images/],['Draft image missing',/image.*missing/],['Invalid draft',/format or size/],['secret database relation and credentials',/HTTP 500/]]){
   globalThis.fetch=async url=>String(url).includes('/certs')?Response.json({keys:[jwk]}):Response.json({message},{status:500});
   const response=await draftServer(new Request('https://api.example/',{headers:{'x-omnium-access':identity}}),{url:'https://storage.example',key:'server-only'});
   const result=await response.json();assert.match(result.error,expected);assert.doesNotMatch(result.error,/credentials|relation/);
  }
 }finally{globalThis.fetch=original;}
});
test('the website proxy explains upstream connection failures',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>{throw new TypeError('private upstream details');};
 try{const response=await onRequest({request:new Request('https://omnium.nexus/api/draft',{headers:{'cf-access-jwt-assertion':'signed-session'}})});assert.equal(response.status,502);assert.match((await response.json()).error,/Could not reach/);}
 finally{globalThis.fetch=original;}
});
test('binary and legacy image uploads validate identity and do not overlap in one worker',async()=>{
 const {draftServer}=await import('../src/cloud/server.ts'),{encodeBytes}=await import('../src/core/transfer.ts');
 const original=globalThis.fetch,identity=await token(),env={url:'https://storage.example',key:'server-only'};
 const bytes=new Uint8Array([137,80,78,71,13,10,26,10,1,2,3,4]);
 const id='sha256:'+Buffer.from(await crypto.subtle.digest('SHA-256',bytes)).toString('hex');
 const request=(data=bytes,type='image/png',asset=id)=>new Request(`https://api.example/?asset=${encodeURIComponent(asset)}&name=image.png`,{method:'PUT',headers:{'x-omnium-access':identity,'content-type':type},body:data});
 let calls=0,wait,started;const pending=new Promise(resolve=>{wait=resolve;}),entered=new Promise(resolve=>{started=resolve;});
 globalThis.fetch=async(url,init)=>{
  if(String(url).includes('/certs'))return Response.json({keys:[jwk]});
  const value=JSON.parse(init.body);assert.equal(value.asset_data,encodeBytes(bytes));assert.equal(value.asset_size,bytes.length);assert.equal(value.asset_name,'image.png');calls++;started();await pending;return new Response(null,{status:204});
 };
 try{
  const first=draftServer(request(),env);await entered;
  assert.equal((await draftServer(request(),env)).status,429);wait();assert.equal((await first).status,200);
  assert.equal((await draftServer(request(JSON.stringify({id,name:'image.png',type:'image/png',data:encodeBytes(bytes)}),'application/json'),env)).status,200);
  assert.equal(calls,2);
  assert.equal((await draftServer(request(bytes,'image/png','sha256:'+'0'.repeat(64)),env)).status,400);
  assert.equal((await draftServer(request(new Uint8Array(12)),env)).status,400);
  assert.equal(calls,2);
  // A rejected request must release the worker's transfer slot.
  assert.equal((await draftServer(request(),env)).status,200);
 }finally{wait();globalThis.fetch=original;}
});
test('the website proxy preserves binary image bodies and content types',async()=>{
 const original=globalThis.fetch,bytes=new Uint8Array([1,2,3]);
 globalThis.fetch=async(_url,init)=>{assert.equal(init.headers['content-type'],'image/png');assert.deepEqual(new Uint8Array(await new Response(init.body).arrayBuffer()),bytes);return Response.json({saved:true});};
 try{assert.equal((await onRequest({request:new Request('https://omnium.nexus/api/draft?asset=image',{method:'PUT',headers:{'cf-access-jwt-assertion':'signed-session',origin:'https://omnium.nexus','content-type':'image/png'},body:bytes})})).status,200);}finally{globalThis.fetch=original;}
});
