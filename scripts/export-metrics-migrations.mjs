import {readFileSync,writeFileSync} from 'node:fs';
const literal=text=>"'"+text.replaceAll("'","''")+"'";
const files=['20261104000100_click_quests.sql','20261104000200_quest_authoring.sql'];
const header=`-- Questboard setup for your EXISTING Supabase project. Run in SQL Editor.
-- No token or password is needed in this file. Review before running.
-- Atomic: any error rolls back this entire install, preserving existing data.
-- Re-runs skip only migrations with the exact recorded SQL; changed/untracked
-- installations fail rather than guessing or overwriting prior authored data.
begin;
select pg_advisory_xact_lock(hashtextextended('omnia-schema-deployment',0));
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations(version text primary key,statements text[],name text);
revoke all on schema supabase_migrations from public,anon,authenticated;
revoke all on table supabase_migrations.schema_migrations from public,anon,authenticated;
`;
const blocks=files.map((file,index)=>{
 const sql=readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'),version=file.slice(0,14),name=file.slice(15,-4);
 return `do $apply$
begin
 if exists(select from supabase_migrations.schema_migrations where version=${literal(version)}) then
  if not exists(select from supabase_migrations.schema_migrations where version=${literal(version)} and array_to_string(statements,E'\\n')=${literal(sql)}) then raise exception 'Migration history differs: ${version}. Stop and review; no data was changed.'; end if;
 else
  ${index===0?"if to_regclass('public.click_quests') is not null then raise exception 'Click quests exist without recorded migration history. Stop and review; no data was changed.'; end if;":''}
  execute ${literal(sql)};
  insert into supabase_migrations.schema_migrations(version,statements,name) values(${literal(version)},array[${literal(sql)}],${literal(name)});
 end if;
end $apply$;`;
});
const sql=header+blocks.join('\n')+"\nnotify pgrst, 'reload schema';\ncommit;\nselect 'Questboard migrations installed. Use the configured cloud app and sign in.' as status;\n";
if(process.argv[2]){writeFileSync(process.argv[2],sql);console.log('Questboard SQL setup file written.');}else process.stdout.write(sql);
