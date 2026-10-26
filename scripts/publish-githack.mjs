import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const cwd = fileURLToPath(new URL('../', import.meta.url));
function run(command,args,options={}) {
  const result=spawnSync(command,args,{cwd,encoding:'utf8',...options});
  if(result.status!==0) throw new Error(`${command} ${args.join(' ')} failed: ${result.stderr ?? ''}`);
  return result.stdout?.trim() ?? '';
}
// Source stays on its current branch. Only the generated app and provenance enter
// the independent artifact branch; no workspace data or environment files are copied.
run(process.execPath,['--run','build:preview'],{stdio:'inherit'});
const source=run('git',['rev-parse','HEAD']);
const remote=run('git',['remote','get-url','origin']);
const repo=remote.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/)?.[1];
if(!repo) throw new Error('GitHack publishing requires a GitHub origin.');
const branch='preview/githack', ref=`refs/heads/${branch}`;
const existing=run('git',['ls-remote','--heads','origin',ref]).split(/\s/)[0];
if(existing) run('git',['fetch','origin',ref]);
const directory=await mkdtemp(join(tmpdir(),'omnia-githack-'));
try {
  const env={...process.env,GIT_INDEX_FILE:join(directory,'index')};
  const git=(args,extra={})=>run('git',args,{env,...extra});
  git(['read-tree','--empty']);
  const html=await readFile(join(cwd,'dist-preview/index.html'));
  if(/<script\b[^>]*\bsrc=|<link\b[^>]*rel="(?:stylesheet|modulepreload)"/.test(html.toString())) throw new Error('Preview has external startup dependencies.');
  const provenance=JSON.stringify({source,sourceDirty:!!run('git',['status','--porcelain']),builtAt:new Date().toISOString()},null,2)+'\n';
  for(const [path,content] of [['index.html',html],['source.json',provenance]]) {
    const blob=git(['hash-object','-w','--stdin'],{input:content});
    git(['update-index','--add','--cacheinfo',`100644,${blob},${path}`]);
  }
  const tree=git(['write-tree']);
  const commit=git(['commit-tree',tree,...(existing?['-p',existing]:[]),'-m',`GitHack preview of ${source.slice(0,12)}`]);
  // Fast-forward only: concurrent publication fails rather than overwriting it.
  git(['push','origin',`${commit}:${ref}`]);
  console.log(`GitHack preview: https://raw.githack.com/${repo}/${commit}/index.html`);
  console.log(`Source: ${source}${provenance.includes('"sourceDirty": true')?' (working-tree changes included)':''}`);
} finally { await rm(directory,{recursive:true,force:true}); }
