import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const cwd=fileURLToPath(new URL('../',import.meta.url));
test('local upload rejects production, arbitrary branches and extra deployment arguments before network access',()=>{
 for(const args of [[],['master'],['main'],['codex/system-audio-helper'],['pr-0'],['pr-61','--branch','master'],['pr-61','--check','extra']]){
  const result=spawnSync(process.execPath,['scripts/publish-cloudflare-preview.mjs',...args],{cwd,encoding:'utf8',env:{PATH:process.env.PATH}});
  assert.notEqual(result.status,0);assert.match(result.stderr,/PR preview branches only/);
 }
});
test('read-only preview check requires credentials before contacting Cloudflare',()=>{
 const result=spawnSync(process.execPath,['scripts/publish-cloudflare-preview.mjs','pr-61','--check'],{cwd,encoding:'utf8',env:{PATH:process.env.PATH}});
 assert.notEqual(result.status,0);assert.match(result.stderr,/Cloudflare account\/token missing or invalid/);
});
test('Access inventory fails closed on exposed files, API failure and unexpected production configuration',()=>{
 const directory=mkdtempSync(join(tmpdir(),'omnia-preview-test-'));
 const preload=join(directory,'network.mjs');
 writeFileSync(preload,`
globalThis.fetch=async value=>{
 const url=new URL(value), mode=process.env.OMNIA_TEST_MODE;
 if(url.hostname==='api.cloudflare.com'){
  if(mode==='api-denied')return new Response('{}',{status:403});
  const result=url.pathname.endsWith('/deployments')?[{url:'https://abcd1234.omnia-web-bae.pages.dev',aliases:['https://pr-61.omnia-web-bae.pages.dev']}]:{
   name:'omnia-web',production_branch:mode==='wrong-production'?'pr-61':'master',subdomain:'omnia-web-bae.pages.dev',domains:['omnium.nexus']};
  return Response.json({success:true,result});
 }
 if(mode==='exposed'&&url.pathname==='/source.json')return new Response('private source',{status:200});
 if(mode==='wrong-login')return new Response('',{status:302,headers:{location:'https://example.com/login'}});
 return new Response('',{status:302,headers:{location:'https://example.cloudflareaccess.com/cdn-cgi/access/login/test'}});
};
`);
 try{
  for(const mode of ['protected','exposed','api-denied','wrong-production','wrong-login']){
   const result=spawnSync(process.execPath,['--import',preload,'scripts/publish-cloudflare-preview.mjs','pr-61','--check'],{
    cwd,encoding:'utf8',env:{PATH:process.env.PATH,CLOUDFLARE_ACCOUNT_ID:'a'.repeat(32),CLOUDFLARE_API_TOKEN:'test-only',OMNIA_TEST_MODE:mode},
   });
   if(mode==='protected'){assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/Access required on 5 hosts/);}
   else assert.notEqual(result.status,0,mode);
   assert.doesNotMatch(result.stdout,/Verified private preview|Self-contained preview/);
  }
 }finally{rmSync(directory,{recursive:true,force:true});}
});
