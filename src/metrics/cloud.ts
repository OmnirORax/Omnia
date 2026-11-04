import type {SupabaseClient} from '@supabase/supabase-js';
export type Benchmark={id:string;seconds:number};
export type Quest={id:string;benchmark_id:string;target:number};
export type Standing={rank:number;player:string;clicks:number;finished_at:string;is_you:boolean};
export type Attempt={id:string;user_id:string;benchmark_id:string;started_at:string;finished_at:string|null;clicks:number|null};
export type QuestData={benchmarks:Benchmark[];quests:Quest[];claims:string[];best:Record<string,number>};
export async function metricsRPC<T>(client:SupabaseClient,name:string,args:Record<string,unknown>):Promise<T>{
 const {data,error}=await client.rpc(name,args);
 if(error)throw Error(error.code==='PGRST202'?'Online benchmarks need the click-quests backend migration.':error.code==='42501'?'Sign in with the account that started this attempt.':error.code==='22023'?'The attempt timing/count limit or quest requirement was not met. Start a fresh attempt.':'Cloud metrics could not complete. Refresh or retry; rewards are granted once.');
 return data as T;
}
export async function loadQuests(client:SupabaseClient):Promise<QuestData>{
 const [b,q,c]=await Promise.all([client.from('click_benchmarks').select('*').order('seconds'),client.from('click_quests').select('*').order('target'),client.from('click_claims').select('quest_id')]);
 if([b,q,c].some(r=>r.error))throw Error('Cloud quests are unavailable. Check sign-in and the click-quests migration.');
 const best:Record<string,number>={};
 await Promise.all((b.data??[]).map(async benchmark=>{const ranking=await metricsRPC<{mine:Standing|null}>(client,'click_standings',{p_benchmark:benchmark.id});best[benchmark.id]=ranking.mine?.clicks??0;}));
 return {benchmarks:b.data??[],quests:q.data??[],claims:(c.data??[]).map(row=>row.quest_id),best};
}
