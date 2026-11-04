import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
const name=`omnia-metrics-${randomUUID()}`;
function docker(args,input){const result=spawnSync('docker',['--host=unix:///var/run/docker.sock',...args],{encoding:'utf8',input,env:{...process.env,DOCKER_HOST:undefined,DOCKER_CONTEXT:undefined,DOCKER_TLS:undefined,DOCKER_TLS_VERIFY:undefined,DOCKER_CERT_PATH:undefined}});if(result.status!==0)throw Error(result.stderr||'Disposable database command failed');return result.stdout;}
try{
 docker(['run','-d','--rm','--network','none','--name',name,'-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17-alpine']);
 let ready=false;for(let i=0;i<60;i++){try{docker(['exec',name,'pg_isready','-h','127.0.0.1','-U','postgres']);ready=true;break;}catch{await new Promise(resolve=>setTimeout(resolve,500));}}
 if(!ready)throw Error('Disposable PostgreSQL did not start');
 const generated=spawnSync(process.execPath,[new URL('./export-metrics-migrations.mjs',import.meta.url).pathname],{encoding:'utf8'});
 if(generated.status!==0)throw Error('Setup SQL generation failed');
 const migration=generated.stdout;
 if(migration!==readFileSync(new URL('../docs/setup/questboard-setup.sql',import.meta.url),'utf8'))throw Error('Setup SQL is stale; regenerate it.');
 const sql=readFileSync(new URL('../tests/metrics-cloud.sql',import.meta.url),'utf8').replace('-- MIGRATION',()=>migration);
 docker(['exec','-i',name,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-q'],sql);
 docker(['exec','-i',name,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-q'],migration);
 docker(['exec','-i',name,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-q'],"select public.test_assert((select count(*)=2 from public.click_claims)); update supabase_migrations.schema_migrations set statements=array['unknown newer SQL'] where version='20261104000200';");
 let rejected=false;try{docker(['exec','-i',name,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-q'],migration);}catch{rejected=true;}
 if(!rejected)throw Error('Changed migration history was accepted');
 docker(['exec','-i',name,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-q'],"select public.test_assert((select count(*)=2 from public.click_claims));");
 console.log('Metrics PostgreSQL checks passed: two-account isolation, grants, server deadlines, per-benchmark ranks, idempotent completion and one-time stars.');
}finally{docker(['rm','-f',name]);}
