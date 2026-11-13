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
