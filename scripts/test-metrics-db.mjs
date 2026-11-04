import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
const name=`omnia-metrics-${randomUUID()}`;
function docker(args,input){const result=spawnSync('docker',['--host=unix:///var/run/docker.sock',...args],{encoding:'utf8',input,env:{...process.env,DOCKER_HOST:undefined,DOCKER_CONTEXT:undefined,DOCKER_TLS:undefined,DOCKER_TLS_VERIFY:undefined,DOCKER_CERT_PATH:undefined}});if(result.status!==0)throw Error(result.stderr||'Disposable database command failed');return result.stdout;}
try{
 docker(['run','-d','--rm','--network','none','--name',name,'-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17-alpine']);
 let ready=false;for(let i=0;i<60;i++){try{docker(['exec',name,'pg_isready','-h','127.0.0.1','-U','postgres']);ready=true;break;}catch{await new Promise(resolve=>setTimeout(resolve,500));}}
 if(!ready)throw Error('Disposable PostgreSQL did not start');
 const migration=readFileSync(new URL('../supabase/migrations/20261104000100_click_quests.sql',import.meta.url),'utf8');
 const sql=readFileSync(new URL('../tests/metrics-cloud.sql',import.meta.url),'utf8').replace('-- MIGRATION',()=>migration);
 docker(['exec','-i',name,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-q'],sql);
 console.log('Metrics PostgreSQL checks passed: two-account isolation, grants, server deadlines, per-benchmark ranks, idempotent completion and one-time stars.');
}finally{docker(['rm','-f',name]);}
