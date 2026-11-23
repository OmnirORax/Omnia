import type {QuestData} from './cloud.ts';
import type {Result} from './model.ts';
const KEY='omnium.local-quests.v1';
export type LocalQuests=QuestData&{format:'omnium-local-quests';version:1};
export function initialLocalQuests():LocalQuests{
 return {format:'omnium-local-quests',version:1,benchmarks:[5,10,30,60].map(seconds=>({id:`primary-${seconds}s-v1`,seconds})),quests:[{id:'first-20',benchmark_id:'primary-5s-v1',target:20},{id:'steady-50',benchmark_id:'primary-10s-v1',target:50},{id:'endurance-150',benchmark_id:'primary-30s-v1',target:150}],claims:[],best:{}};
}
export function validateLocalQuests(value:unknown):LocalQuests{
 if(JSON.stringify(value)?.length>1_000_000)throw Error('Local quest data exceeds its size limit.');
 const v=value as LocalQuests;
 if(!v||v.format!=='omnium-local-quests'||v.version!==1||!Array.isArray(v.quests)||v.quests.length>500||!Array.isArray(v.benchmarks)||v.benchmarks.length>504||!Array.isArray(v.claims)||!v.best||typeof v.best!=='object')throw Error('Local quest data cannot be read. The original has not been overwritten.');
 const ids=new Set<string>(),benchmarks=new Map<string,number>();
 for(const b of v.benchmarks){if(typeof b.id!=='string'||b.id.length>100||benchmarks.has(b.id)||!Number.isInteger(b.seconds)||b.seconds<1||b.seconds>3600)throw Error('Invalid local benchmark.');benchmarks.set(b.id,b.seconds);}
 for(const q of v.quests){if(typeof q.id!=='string'||q.id.length>100||ids.has(q.id)||!benchmarks.has(q.benchmark_id)||!Number.isInteger(q.target)||q.target<1||q.target>benchmarks.get(q.benchmark_id)!*100)throw Error('Invalid local quest.');ids.add(q.id);}
 if(new Set(v.claims).size!==v.claims.length||v.claims.some(id=>!ids.has(id))||Object.entries(v.best).some(([id,n])=>!benchmarks.has(id)||!Number.isInteger(n)||n<0||n>benchmarks.get(id)!*100))throw Error('Invalid local quest progress.');
 return v;
}
export function addLocalQuest(data:LocalQuests,target:number,seconds:number,id:string):LocalQuests{
 if(!Number.isInteger(seconds)||seconds<1||seconds>3600||!Number.isInteger(target)||target<1||target>seconds*100)throw Error('Choose 1–3600 seconds and a valid click target.');
 const benchmark_id=`primary-${seconds}s-v1`;
 if(data.quests.some(q=>q.benchmark_id===benchmark_id&&q.target===target))return data;
 if(data.quests.length>=500)throw Error('Local board supports up to 500 quests.');
 return validateLocalQuests({...data,benchmarks:data.benchmarks.some(b=>b.id===benchmark_id)?data.benchmarks:[...data.benchmarks,{id:benchmark_id,seconds}],quests:[...data.quests,{id,benchmark_id,target}]});
}
export function recordLocalResult(data:LocalQuests,result:Result):LocalQuests{
 const benchmark=data.benchmarks.find(b=>b.id===result.benchmarkId);
 if(!benchmark||result.actorId!=='local'||result.reason!=='timeout'||result.interrupted||result.elapsedMs!==benchmark.seconds*1000)return data;
 return validateLocalQuests({...data,best:{...data.best,[benchmark.id]:Math.max(data.best[benchmark.id]??0,result.clicks)}});
}
export function claimLocalQuest(data:LocalQuests,id:string):LocalQuests{
 const q=data.quests.find(q=>q.id===id);if(!q||(data.best[q.benchmark_id]??0)<q.target)throw Error('Complete this quest first.');
 return data.claims.includes(id)?data:{...data,claims:[...data.claims,id]};
}
/** A separate browser-local authority. Writes compare the source first so stale
 * tabs cannot overwrite newer progress; bad/newer originals are never defaulted. */
export function loadLocalQuests(){const original=localStorage.getItem(KEY);return {original,data:original===null?initialLocalQuests():validateLocalQuests(JSON.parse(original))};}
export function saveLocalQuests(data:LocalQuests,original:string|null){
 if(localStorage.getItem(KEY)!==original)throw Error('Local quests changed in another tab. Reopen or refresh before editing.');
 const text=JSON.stringify(validateLocalQuests(data));localStorage.setItem(KEY,text);return text;
}
