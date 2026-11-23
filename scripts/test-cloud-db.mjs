import {readFileSync} from 'node:fs';import {sql} from './deploy-cloud.mjs';import {withDisposablePostgres} from './disposable-postgres.mjs';
await withDisposablePostgres('cloud',execute=>{
 execute(readFileSync(new URL('../tests/account-cloud.sql',import.meta.url),'utf8').replace('-- MIGRATION',()=>sql));execute(sql);
 console.log('Cloud PostgreSQL checks passed: owner/viewer/unrelated accounts, stale writes, idempotent retries, protected scene images and migration reruns.');
});
