// Local direct upload. Production and GitHub settings are never mutated.
import {spawnSync} from 'node:child_process';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
const cwd=fileURLToPath(new URL('../',import.meta.url));
function run(command,args,options={}){
 const result=spawnSync(command,args,{cwd,encoding:'utf8',...options});
 if(result.status!==0)throw Error(`${command} failed; preview publication stopped.`);
 return result.stdout?.trim()??'';
}
const branch=process.argv[2];
const checkOnly=['--check','--check-upload'].includes(process.argv[3]);
const checkUpload=process.argv[3]==='--check-upload';
if(!/^pr-[1-9][0-9]*$/.test(branch??'')||process.argv.length!==(checkOnly?4:3))throw Error('Usage: node --run preview:cloudflare -- pr-61 [--check|--check-upload] (PR preview branches only).');
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
if(!/^[a-f0-9]{32}$/i.test(account??'')||!token)throw Error('Cloudflare account/token missing or invalid.');
if(!checkOnly&&run('git',['status','--porcelain','--untracked-files=normal']))throw Error('Commit source changes before uploading an attributable preview.');
const source=run('git',['rev-parse','HEAD']);
const alias=`${branch}.omnia-web-bae.pages.dev`;
async function api(path){
 const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/omnia-web${path}`,{
  headers:{Authorization:`Bearer ${token}`},redirect:'error',signal:AbortSignal.timeout(20000),
 });
 if(!response.ok)throw Error(`Cloudflare read-only inventory failed (${response.status}).`);
 const data=await response.json();if(!data.success)throw Error('Cloudflare inventory unsuccessful.');return data.result;
}
function host(value){
 const url=new URL(value.includes('://')?value:`https://${value}`);
 if(url.protocol!=='https:'||url.username||url.password||url.port||url.pathname!=='/'||url.search||url.hash)throw Error('Invalid host inventory.');
 return url.hostname;
}
async function checkAccess(postUpload=false){
 const project=await api('');
 if(project.name!=='omnia-web'||project.production_branch!=='master'||project.subdomain!=='omnia-web-bae.pages.dev'||
  project.source&&project.source.config?.deployments_enabled!==false)throw Error('Unexpected project/production/Git build configuration.');
 const hosts=new Set([alias,`access-probe-${Date.now()}.${project.subdomain}`]);
 // After upload, discover the deployment(s) for this exact source and branch.
 if (postUpload) {
  const deployments=await api('/deployments?per_page=25');
  const matches=deployments.filter(d=>d.environment==='preview' && d.deployment_trigger?.metadata?.branch===branch && d.deployment_trigger?.metadata?.commit_hash===source);
  if(!matches.length)throw Error('Uploaded preview was not found in recent deployment inventory.');
  for(const deployment of matches){
   const name=host(deployment.url);
   if(!name.endsWith(`.${project.subdomain}`))throw Error('Unexpected deployment hostname.');
   hosts.add(name);
  }
 }
 const probes=[...hosts].flatMap(host=>['/','/index.html','/source.json','/favicon.svg'].map(path=>`https://${host}${path}`));
 // Bounded concurrency; never follow authentication redirects or print their tokens.
 let completed=0;
 await Promise.all(Array.from({length:2},async()=>{
  while(probes.length){
   const url=probes.pop();
   let response;
   for(let attempt=0;attempt<3;attempt++){
    response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(20000),headers:{'Cache-Control':'no-cache'}});
    if(![429,502,503,504].includes(response.status)||attempt===2)break;
    const retryAfter=Number(response.headers.get('retry-after'));
    await response.body?.cancel();
    // Bound waits; persistent proxy/origin errors still fail closed.
    if(retryAfter>30)throw Error('Network requested a long retry delay; retry preview verification later.');
    console.log(`Transient network response (${response.status}); retrying Access probe.`);
    await delay(Math.max(2000*(attempt+1),Number.isFinite(retryAfter)?retryAfter*1000:0));
   }
   const target=new URL(response.headers.get('location')??'',url);
   await response.body?.cancel();
   if(![302,303,307,308].includes(response.status)||target.protocol!=='https:'||!target.hostname.endsWith('.cloudflareaccess.com')||!target.pathname.startsWith('/cdn-cgi/access/login'))throw Error(`Access check failed: ${url} (${response.status}); upload blocked.`);
   if(++completed%200===0)console.log(`Access verified: ${completed} paths…`);
   await delay(150);
  }
 }));
 console.log(`Access required on ${hosts.size} hosts (HTML, provenance and icon paths).`);
}
await checkAccess(checkUpload);
if(checkOnly)process.exit(0);
run(process.execPath,['scripts/cloudflare-build-config.mjs'],{stdio:'inherit'});
run(process.execPath,['--run','build:preview'],{stdio:'inherit'});
const directory=await mkdtemp(join(tmpdir(),'omnia-private-preview-'));
try{
 const html=await readFile(join(cwd,'dist-preview/index.html'));
 if(html.length>25*1024*1024||/<script\b[^>]*\bsrc=|<link\b[^>]*rel="(?:stylesheet|modulepreload)"/.test(html.toString()))throw Error('Preview must be self-contained and within the Pages file limit.');
 await writeFile(join(directory,'index.html'),html);
 await writeFile(join(directory,'favicon.svg'),await readFile(join(cwd,'public/favicon.svg')));
 await writeFile(join(directory,'source.json'),JSON.stringify({source,sourceDirty:false,branch,builtAt:new Date().toISOString()},null,2)+'\n');
 if(run('git',['status','--porcelain','--untracked-files=normal'])||run('git',['rev-parse','HEAD'])!==source)throw Error('Source changed during build; commit and retry.');
 run('npm',['exec','--yes','--package=wrangler@4.152.0','--','wrangler','pages','deploy',directory,'--project-name','omnia-web','--branch',branch,'--commit-hash',source,'--commit-dirty=false'],{
  cwd:directory,stdio:'inherit',env:{...process.env,WRANGLER_SEND_METRICS:'false',
   npm_config_cache:process.env.npm_config_cache??join(tmpdir(),'omnia-preview-npm-cache'),
   XDG_CONFIG_HOME:process.env.XDG_CONFIG_HOME??join(tmpdir(),'omnia-preview-config')},
 });
 // A postcheck failure means a deployment already exists: report and investigate,
 // never hide the failure or relax Access to make the URL work.
 await checkAccess(true);
 console.log(`Verified private preview: https://${alias}\nSource: ${source}`);
}finally{await rm(directory,{recursive:true,force:true});}
