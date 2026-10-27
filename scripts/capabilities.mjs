import {readFile,writeFile,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {ACTIONS} from '../src/workspaceActions.ts';
import {FEATURE_GESTURES} from '../src/featureActions.ts';
const root=fileURLToPath(new URL('../',import.meta.url));
const catalog=JSON.parse(await readFile(resolve(root,'docs/capabilities/catalog.json'),'utf8'));
const entries=catalog.entries,ids=new Set(),commands=new Map(),gestures=new Map();
function demand(ok,message){if(!ok)throw Error(`Capability guide: ${message}`);}
for(const entry of entries){
  demand(!ids.has(entry.id),`duplicate ${entry.id}`);ids.add(entry.id);
  for(const key of ['id','title','where','behavior','reference','status','limits'])demand(typeof entry[key]==='string'&&entry[key].trim(),`${entry.id} needs ${key}`);
  demand(entry.steps?.length&&entry.steps.every(s=>s.do?.trim()&&s.expect?.trim()),`${entry.id} needs steps with expected outcomes`);
  demand(entry.verification?.browser&&entry.verification?.automated,`${entry.id} needs verification evidence/status`);
  for(const path of [entry.reference,...entry.sources])await access(resolve(root,path));
  for(const action of entry.actions){demand(!commands.has(action),`command ${action} documented twice`);commands.set(action,entry);}
  for(const gesture of entry.gestures??[]){demand(!gestures.has(gesture),`gesture ${gesture} documented twice`);gestures.set(gesture,entry);}
}
for(const action of ACTIONS)demand(commands.has(action.id),`add a walkthrough for new command ${action.id}`);
for(const id of commands.keys())demand(ACTIONS.some(a=>a.id===id),`retired command ${id}: update its guide and replacement note`);
for(const gesture of FEATURE_GESTURES)demand(gestures.has(gesture.id),`add a walkthrough for gesture ${gesture.id}`);
for(const entry of entries)for(const related of entry.related)demand(ids.has(related),`unknown related guide ${related}`);
const escape=value=>String(value).replaceAll('|','\\|').replaceAll('\n',' ');
const link=entry=>`[${entry.title}](#${entry.id.replaceAll('.','-')})`;
const lines=['# Omnia capabilities and how to use them','','Generated from the reviewed capability catalog and the live command/gesture registries. Edit `docs/capabilities/catalog.json`; run `node --run docs:capabilities`.','','This is the user guide and the first place workers check before proposing a duplicate feature. It describes this branch, not proof that every feature has reached production. **Browser acceptance is unrecorded unless an entry says otherwise.** Cloud rollout and provider configuration are separate from implementation.','','Find a feature by name in the index or command table. Open the relevant owner/frame first: contextual commands can be unavailable until that owner is mounted. Custom layouts can move controls; UI search and Shortcuts show registered names and your actual saved bindings. Catalog defaults below may differ from your settings.','','Use disposable work for tests; export your workspace first. Each numbered step includes its expected result. Record failures and observed results against the stable capability ID; do not mark a test passed from builds alone.','','## Feature index','','| Capability | Availability | Find it |','| --- | --- | --- |'];
for(const entry of entries)lines.push(`| ${link(entry)} | ${escape(entry.status)} | ${escape(entry.where)} |`);
for(const entry of entries){
 lines.push('',`<a id="${entry.id.replaceAll('.','-')}"></a>`,`## ${entry.title}`,'',`**ID:** \`${entry.id}\` · **Status:** ${entry.status}`,'',`**Where:** ${entry.where}`,'',entry.behavior,'','**Minimal working test**','');
 entry.steps.forEach((s,i)=>lines.push(`${i+1}. ${s.do} **Expected:** ${s.expect}`));
 lines.push('',`**Limits / unavailable behavior:** ${entry.limits}`,'',`**Verification:** browser — ${entry.verification.browser}. Automated — ${entry.verification.automated}.`,'',`**Details:** [subsystem guide](${entry.reference.replace(/^docs\//,'')}). **Implementation:** ${entry.sources.map(p=>`[${p}](../${p})`).join(', ')}.`);
 if(entry.actions.length)lines.push('',`**Command IDs:** ${entry.actions.map(id=>`\`${id}\``).join(', ')}.`);
 if(entry.related.length)lines.push('',`**Related:** ${entry.related.map(id=>link(entries.find(e=>e.id===id))).join(', ')}.`);
}
lines.push('','## Exact registered command inventory','','Labels, descriptions and defaults are read from the same catalog as the application. A blank binding means unassigned here; it does not mean unavailable. Scope-specific overrides and saved mouse bindings remain authoritative in the running UI.','','| Command / stable ID | Catalog default | Behavior | Where / walkthrough |','| --- | --- | --- | --- |');
for(const a of ACTIONS)lines.push(`| ${escape(a.label)} · \`${a.id}\` | ${escape(a.defaultKey||'Unassigned')} | ${escape(a.description??commands.get(a.id).behavior)} | ${link(commands.get(a.id))} |`);
lines.push('','## Registered native gestures','','| Gesture | Binding | Behavior | Walkthrough |','| --- | --- | --- | --- |');
for(const g of FEATURE_GESTURES)lines.push(`| ${escape(g.label)} · \`${g.id}\` | ${escape(g.binding)} | ${escape(g.description)} | ${link(gestures.get(g.id))} |`);
lines.push('','## Maintenance and known inventory boundaries','','Every registered command and native gesture is covered by a walkthrough; the normal model/build entry points check coverage and generated-file freshness. Native controls, algorithms and workflows without a command require explicit catalog entries during implementation: their meaning cannot be inferred safely from code. The initial backfill groups some older graph workflows; subsystem guides retain their finer details. This is not a claim that every historical behavior has been independently browser-tested.','','Before adding work, search this guide, the command IDs and subsystem references. Extend the existing owner when appropriate. Retire/redirect obsolete entries explicitly instead of leaving two competing instructions. Record user verification, date, source commit and reproducible failure when available.','','Future workers: read [authoring contract](capabilities/README.md) and update the catalog in the same change.');
const output=lines.join('\n')+'\n',path=resolve(root,'docs/CAPABILITIES.md');
if(process.argv.includes('--check'))demand(await readFile(path,'utf8')===output,'generated guide is stale; run node --run docs:capabilities');
else await writeFile(path,output);
console.log(`Capability guide: ${entries.length} walkthroughs, ${ACTIONS.length} commands, ${FEATURE_GESTURES.length} gestures covered.`);
