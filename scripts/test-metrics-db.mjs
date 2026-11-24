import {readFileSync} from 'node:fs';import {sql} from './export-metrics-migrations.mjs';import {withDisposablePostgres} from './disposable-postgres.mjs';
await withDisposablePostgres('metrics',execute=>{
 execute(readFileSync(new URL('../tests/metrics-cloud.sql',import.meta.url),'utf8').replace('-- MIGRATION',()=>sql));execute(sql);
 execute("select public.test_assert((select count(*)=2 from public.click_claims)); update supabase_migrations.schema_migrations set statements=array['unknown newer SQL'] where version='20261104000200';");
 let rejected=false;try{execute(sql);}catch{rejected=true;}if(!rejected)throw Error('Changed migration history was accepted');
 execute('select public.test_assert((select count(*)=2 from public.click_claims));');
 console.log('Metrics PostgreSQL checks passed: two-account isolation, grants, server deadlines, per-benchmark ranks, idempotent completion and one-time stars.');
});
