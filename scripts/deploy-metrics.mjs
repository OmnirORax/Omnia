import {readFileSync} from 'node:fs';
import {sql as setupSQL} from './export-metrics-migrations.mjs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const versions=['20261104000100_click_quests.sql','20261104000200_quest_authoring.sql'];
export async function deployMetrics({url,token,mode,fetcher=fetch}){
 if(!['plan','apply'].includes(mode))throw Error('Choose plan or apply.');
 if(!token)throw Error('SUPABASE_ACCESS_TOKEN secret is missing.');
 let parsed;try{parsed=new URL(url);}catch{throw Error('VITE_SUPABASE_URL is missing or invalid.');}
 if(parsed.origin!=='https://tqjjcabekjjmmspttbli.supabase.co'||parsed.pathname!=='/'||parsed.search||parsed.hash||parsed.username||parsed.password)throw Error('Refusing deployment outside the existing Omnia project.');
 const endpoint='https://api.supabase.com/v1/projects/tqjjcabekjjmmspttbli/database/query';
 const query=async(sql,readOnly)=>{
  let response;try{response=await fetcher(endpoint,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query:sql,read_only:readOnly}),signal:AbortSignal.timeout(60000)});}catch{throw Error('Supabase management connection failed.');}
  if(!response.ok)throw Error(`Supabase database request failed (HTTP ${response.status}). Check token scope, expiry and project availability.`);
  try{return await response.json();}catch{throw Error('Supabase returned an invalid response.');}
 };
 const presence=await query("select to_regclass('supabase_migrations.schema_migrations') is not null as history_exists",true);
 const history=presence[0]?.history_exists?await query('select version,statements from supabase_migrations.schema_migrations',true):[];
 const pending=[];
 for(const file of versions){const version=file.slice(0,14),sql=readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'),old=history.find(row=>row.version===version);if(old&&old.statements?.join('\n')!==sql)throw Error(`Migration history differs for ${version}; nothing was deployed.`);if(!old)pending.push(version);}
 if(mode==='plan')return {mode,pending};
 const sql=setupSQL;
 await query(sql,false);
 // Read-only verification checks deployed behavior exists and original reward
 // uniqueness remains enforced. No accounts, claims or test data are created.
 const check=await query("select to_regprocedure('public.create_click_quest(uuid,integer,integer)') is not null as authoring_ready,to_regprocedure('public.click_quest_board()') is not null as board_ready,exists(select from pg_constraint where conrelid='public.click_claims'::regclass and contype='p') as claims_protected",true);
 if(!check[0]?.authoring_ready||!check[0]?.board_ready||!check[0]?.claims_protected)throw Error('Post-deployment verification failed; inspect migration state before retrying.');
 return {mode,applied:pending,verified:true};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{console.log(JSON.stringify(await deployMetrics({url:process.env.VITE_SUPABASE_URL,token:process.env.SUPABASE_ACCESS_TOKEN,mode:process.argv[2]??'plan'})));}
 catch(error){console.error(error.message);process.exitCode=1;}
}
