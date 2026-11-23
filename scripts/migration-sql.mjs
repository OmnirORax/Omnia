import {readFileSync} from 'node:fs';
export const migrationText=file=>readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8');
const literal=text=>"'"+text.replaceAll("'","''")+"'";
export function guardedMigrations(files){
 let sql=`-- Guarded migrations for the existing Omnium project. Never reset a hosted database.
begin;
select pg_advisory_xact_lock(hashtextextended('omnia-schema-deployment',0));
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations(version text primary key,statements text[],name text);
revoke all on schema supabase_migrations from public,anon,authenticated;
revoke all on table supabase_migrations.schema_migrations from public,anon,authenticated;
`;
 for(const entry of files){const {file,table}=typeof entry==='string'?{file:entry}:entry,text=migrationText(file),version=file.slice(0,14),name=file.slice(15,-4);
 sql+=`do $apply$ begin
 if exists(select from supabase_migrations.schema_migrations where version=${literal(version)}) then
  if not exists(select from supabase_migrations.schema_migrations where version=${literal(version)} and array_to_string(statements,E'\\n')=${literal(text)}) then raise exception 'Migration history differs: ${version}. Nothing changed.'; end if;
 else
  ${table?`if to_regclass(${literal('public.'+table)}) is not null then raise exception 'Untracked existing ${table}. Stop and review.';end if;`:''}
  execute ${literal(text)};
  insert into supabase_migrations.schema_migrations(version,statements,name) values(${literal(version)},array[${literal(text)}],${literal(name)});
 end if;end $apply$;
`;
 }
 return sql+"notify pgrst, 'reload schema';\ncommit;\n";
}
export async function deployMigrations({url,token,mode,files,verify,flags,fetcher=fetch}){
 if(!['plan','apply'].includes(mode))throw Error('Choose plan or apply.');if(!token)throw Error('SUPABASE_ACCESS_TOKEN secret is missing.');
 let parsed;try{parsed=new URL(url);}catch{throw Error('VITE_SUPABASE_URL is invalid.');}
 if(parsed.origin!=='https://tqjjcabekjjmmspttbli.supabase.co'||parsed.pathname!=='/'||parsed.search||parsed.hash||parsed.username||parsed.password)throw Error('Refusing deployment outside the existing Omnia project.');
 const query=async(text,read_only)=>{let response;try{response=await fetcher('https://api.supabase.com/v1/projects/tqjjcabekjjmmspttbli/database/query',{method:'POST',headers:{Authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({query:text,read_only}),signal:AbortSignal.timeout(60000)});}catch{throw Error('Supabase management connection failed.');}if(!response.ok)throw Error(`Supabase database request failed (HTTP ${response.status}).`);try{return await response.json();}catch{throw Error('Supabase returned an invalid response.');}};
 const presence=await query("select to_regclass('supabase_migrations.schema_migrations') is not null as history_exists",true);
 const history=presence[0]?.history_exists?await query('select version,statements from supabase_migrations.schema_migrations',true):[],pending=[];
 for(const entry of files){const file=typeof entry==='string'?entry:entry.file,version=file.slice(0,14),old=history.find(row=>row.version===version);if(old&&old.statements?.join('\n')!==migrationText(file))throw Error(`Migration history differs for ${version}; nothing was deployed.`);if(!old)pending.push(version);}
 if(mode==='plan')return {mode,pending};
 if(pending.length)await query(guardedMigrations(files),false);
 const check=await query(verify,true);if(flags.some(flag=>!check[0]?.[flag]))throw Error('Post-deployment verification failed.');return {mode,applied:pending,verified:true};
}
