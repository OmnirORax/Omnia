import type {FilterSchema} from '../filtering/model.ts';
import type {Benchmark,Quest,QuestData} from './cloud.ts';
export const QUEST_CATEGORIES=[{id:'speed',label:'⚡ Speed clicking'},{id:'endurance',label:'🏃 Endurance clicking'}] as const;
export const questCategory=(seconds:number)=>seconds>=30?QUEST_CATEGORIES[1]:QUEST_CATEGORIES[0];
export type QuestFilterContext={benchmarks:ReadonlyMap<string,Benchmark>;claimed:ReadonlySet<string>;best:QuestData['best']};
export function questFilterContext(data:QuestData|null):QuestFilterContext{return {benchmarks:new Map(data?.benchmarks.map(b=>[b.id,b])??[]),claimed:new Set(data?.claims??[]),best:data?.best??{}};}
export const questFilterSchema:FilterSchema<Quest,QuestFilterContext>={
 text:(quest,context)=>{const seconds=context.benchmarks.get(quest.benchmark_id)?.seconds;return `${quest.target} clicks in ${seconds??''} seconds ${seconds===undefined?'':questCategory(seconds).label}`;},
 facets:[
  {id:'category',label:'Category',options:QUEST_CATEGORIES,read:(quest,context)=>{const seconds=context.benchmarks.get(quest.benchmark_id)?.seconds;return seconds===undefined?[]:[questCategory(seconds).id];}},
  {id:'status',label:'Status',options:[{id:'available',label:'Available'},{id:'ready',label:'Ready to hand in'},{id:'claimed',label:'Claimed'}],read:(quest,context)=>[context.claimed.has(quest.id)?'claimed':(context.best[quest.benchmark_id]??0)>=quest.target?'ready':'available']},
 ],
};
