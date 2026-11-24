import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {deployMigrations} from './migration-sql.mjs';
import {files} from './export-metrics-migrations.mjs';
export const deployMetrics=options=>deployMigrations({...options,files,verify:"select to_regprocedure('public.create_click_quest(uuid,integer,integer)') is not null as authoring_ready,to_regprocedure('public.click_quest_board()') is not null as board_ready,exists(select from pg_constraint where conrelid='public.click_claims'::regclass and contype='p') as claims_protected",flags:['authoring_ready','board_ready','claims_protected']});
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{console.log(JSON.stringify(await deployMetrics({url:process.env.VITE_SUPABASE_URL,token:process.env.SUPABASE_ACCESS_TOKEN,mode:process.argv[2]??'plan'})));}catch(error){console.error(error.message);process.exitCode=1;}}
