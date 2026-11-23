import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {writeFileSync} from 'node:fs';
import {guardedMigrations} from './migration-sql.mjs';
export const files=[{file:'20261104000100_click_quests.sql',table:'click_quests'},'20261104000200_quest_authoring.sql'];
export const sql=guardedMigrations(files);
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){if(process.argv[2])writeFileSync(process.argv[2],sql);else process.stdout.write(sql);}
