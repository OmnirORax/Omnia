import {spawnSync} from 'node:child_process';import {randomUUID} from 'node:crypto';
/** All SQL checks use an isolated container, never a configured hosted database. */
export async function withDisposablePostgres(label,work){
 const name=`omnia-${label.replace(/[^a-z]/g,'')}-${randomUUID()}`;let created=false;
 const docker=(args,input)=>{const r=spawnSync('docker',['--host=unix:///var/run/docker.sock',...args],{input,encoding:'utf8',env:{...process.env,DOCKER_HOST:undefined,DOCKER_CONTEXT:undefined,DOCKER_TLS:undefined,DOCKER_TLS_VERIFY:undefined,DOCKER_CERT_PATH:undefined}});if(r.status!==0)throw Error(r.stderr||'Disposable database command failed.');return r.stdout;};
 try{
  docker(['run','-d','--rm','--network','none','--name',name,'-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17-alpine']);created=true;
  let ready=false;for(let i=0;i<60;i++){try{docker(['exec',name,'pg_isready','-h','127.0.0.1','-U','postgres']);ready=true;break;}catch{await new Promise(resolve=>setTimeout(resolve,500));}}
  if(!ready)throw Error('Disposable database did not start.');
  return await work(text=>docker(['exec','-i',name,'psql','-h','127.0.0.1','-U','postgres','-v','ON_ERROR_STOP=1','-q'],text));
 }finally{if(created)docker(['rm','-f',name]);}
}
