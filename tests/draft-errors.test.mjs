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
