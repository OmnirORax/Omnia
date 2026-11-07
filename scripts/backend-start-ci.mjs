import {spawnSync} from 'node:child_process';
import {closeSync,fchmodSync,mkdirSync,openSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as wait} from 'node:timers/promises';
import {startBackendWithRetries} from './backend-start-policy.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),directory=process.env.RUNNER_TEMP??tmpdir();
mkdirSync(directory,{recursive:true});
const result=await startBackendWithRetries({
 attempt:number=>{
  const path=join(directory,`omnia-backend-start-${number}.log`),fd=openSync(path,'w',0o600);fchmodSync(fd,0o600);
  const started=spawnSync(process.execPath,['scripts/backend.mjs','start'],{cwd:root,stdio:['ignore',fd,fd]});closeSync(fd);
  return {status:started.status,log:started.status===0?'':readFileSync(path,'utf8')};
 },wait,
 report:({next,maximum,delay})=>console.log(`Container registry throttled; retrying isolated backend startup (${next}/${maximum}) in ${delay/1000}s.`),
});
if(result.status===0)console.log('Isolated local backend started successfully.');
else{
 console.error(process.env.GITHUB_ACTIONS?`::error title=Local backend startup::${result.summary}`:result.summary);
 process.exitCode=result.status;
}
