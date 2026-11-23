import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {deployMigrations,guardedMigrations} from './migration-sql.mjs';
export const files=[{file:'20261024000100_backend_foundation.sql',table:'workspaces'},'20261024000200_asset_reservation_integrity.sql','20261024000300_scene_generation.sql',{file:'20261123000100_account_workspaces.sql',table:'omnium_account_workspaces'}];
export const sql=guardedMigrations(files);
export const deployCloud=options=>deployMigrations({...options,files,verify:"select to_regprocedure('public.save_account_workspace(uuid,uuid,bigint,uuid,jsonb)') is not null as save_ready,(select relrowsecurity from pg_class where oid='public.omnium_account_workspaces'::regclass) as rls_ready",flags:['save_ready','rls_ready']});
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{console.log(JSON.stringify(await deployCloud({url:process.env.VITE_SUPABASE_URL,token:process.env.SUPABASE_ACCESS_TOKEN,mode:process.argv[2]??'plan'})));}catch(error){console.error(error.message);process.exitCode=1;}}
