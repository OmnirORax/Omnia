import {spawnSync} from 'node:child_process';
import {closeSync,mkdirSync,openSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {startupFailureSummary} from './backend-start-diagnostics.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),directory=process.env.RUNNER_TEMP??tmpdir();
mkdirSync(directory,{recursive:true});
const path=join(directory,'omnia-backend-start.log'),fd=openSync(path,'w',0o600);
const result=spawnSync(process.execPath,['scripts/backend.mjs','start'],{cwd:root,stdio:['ignore',fd,fd]});closeSync(fd);
if(result.status===0)console.log('Isolated local backend started successfully.');
else{
 const summary=startupFailureSummary(readFileSync(path,'utf8'));
 console.error(process.env.GITHUB_ACTIONS?`::error title=Local backend startup::${summary}`:summary);
 process.exitCode=result.status??1;
}
