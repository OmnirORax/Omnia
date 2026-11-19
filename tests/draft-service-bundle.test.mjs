import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {buildDraftService} from '../scripts/build-draft-service.mjs';
import {emptyWorld,addStructure} from '../src/core/model.ts';
test('deployable draft service accepts current visual paint and retains validation and Access checks',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'omnia-draft-')),file=join(directory,'index.ts'),previous=globalThis.Deno;let handler;
 try{
  if(!process.env.OMNIA_DRAFT_VERIFY_BUNDLE)await buildDraftService(file);globalThis.Deno={serve:fn=>{handler=fn;},env:{get:()=>''}};
  const code=await readFile(process.env.OMNIA_DRAFT_VERIFY_BUNDLE??file,'utf8'),{validateDraftWorld}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
  const world=emptyWorld();world.appearance.text={color:'#ff000d',glow:2,glowSpread:12,glowColor:'#00ffff'};const node=addStructure(world,[0,0,0],1);node.textAppearance={glow:1.5,glowSpread:20};
  assert.equal(validateDraftWorld(structuredClone(world)).appearance.text.glow,2);
  const bad=structuredClone(world);bad.appearance.text.glow=2.1;assert.throws(()=>validateDraftWorld(bad),/Invalid visual properties/);
  assert.equal((await handler(new Request('https://example.test',{method:'PUT',body:JSON.stringify({version:1,revision:1,world})}))).status,401);
 }finally{globalThis.Deno=previous;await rm(directory,{recursive:true,force:true});}
});
