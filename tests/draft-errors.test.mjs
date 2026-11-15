import test from 'node:test';
import assert from 'node:assert/strict';
import {draftRequest} from '../src/cloud/request.ts';
import {DraftConflictError} from '../src/cloud/errors.ts';
test('draft requests explain conflicts, plain-text service errors, sessions and lost connections',async()=>{
 const original=globalThis.fetch;
 try{
  const cases=[
   [()=>Response.json({error:'Draft changed in another session.'},{status:409}),error=>error instanceof DraftConflictError&&/Pull.*Push/.test(error.message)],
   [()=>Response.json({error:'The shared image library is full.'},{status:400}),/image library is full/],
   [()=>new Response('resource limit',{status:546}),/resource limit.*smaller image/],
   [()=>new Response('<html>Sign in</html>',{status:403}),/Access session.*sign in/],
   [()=>new Response('busy',{status:503}),/HTTP 503.*Retry/],
   [()=>new Response('large',{status:413}),/too large/],
   [()=>new Response('rate limit',{status:429}),/Wait a moment/],
   [()=>{throw new DOMException('timeout','TimeoutError');},/timed out/],
   [()=>{throw new TypeError('Failed to fetch');},/Check your connection.*Access session/],
  ];
  for(const [fetcher,expected] of cases){globalThis.fetch=async()=>fetcher();await assert.rejects(draftRequest(),expected);}
 }finally{globalThis.fetch=original;}
});
test('image uploads send the original binary blob without JSON/base64 expansion',async()=>{
 const original=globalThis.fetch,blob=new Blob([new Uint8Array([137,80,78,71])],{type:'image/png'});let called=false;
 globalThis.fetch=async(url,init)=>{called=true;assert.match(url,/asset=/);assert.equal(init.headers['content-type'],'image/png');assert.equal(init.body,blob);return Response.json({saved:true});};
 try{await draftRequest('?asset=image&name=test.png','PUT',blob);assert.equal(called,true);}finally{globalThis.fetch=original;}
});
test('overlapping image transfers retry briefly instead of failing the draft immediately',async()=>{
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>++calls===1?Response.json({error:'Another image transfer is running.'},{status:429}):Response.json({saved:true});
 try{assert.equal((await draftRequest('?asset=image','PUT',new Blob(['bytes'],{type:'image/png'}))).status,200);assert.equal(calls,2);}finally{globalThis.fetch=original;}
});
