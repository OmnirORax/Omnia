import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
test('a maximum-size image decodes without a large temporary JavaScript array',()=>{
 const result=spawnSync(process.execPath,['--max-old-space-size=64','--input-type=module','-e',`
  import {decodeScene} from './src/core/transfer.ts';
  const bytes=Buffer.alloc(10*1024*1024,17);bytes.set([137,80,78,71,13,10,26,10]);
  const decoded=decodeScene({id:'image',name:'large.png',type:'image/png',data:bytes.toString('base64')});
  if(decoded.length!==bytes.length||decoded[decoded.length-1]!==17)throw Error('Image bytes changed');
 `],{cwd:new URL('..',import.meta.url),encoding:'utf8',timeout:20000});
 assert.equal(result.status,0,result.stderr);
});
