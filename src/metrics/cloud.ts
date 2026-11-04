import type {SupabaseClient} from '@supabase/supabase-js';
export type Benchmark={id:string;seconds:number};
export type Quest={id:string;benchmark_id:string;target:number};
export type Standing={rank:number;player:string;clicks:number;finished_at:string;is_you:boolean};
export type Attempt={id:string;user_id:string;benchmark_id:string;started_at:string;finished_at:string|null;clicks:number|null};
export type QuestData={benchmarks:Benchmark[];quests:Quest[];claims:string[];best:Record<string,number>};
export async function metricsRPC<T>(client:SupabaseClient,name:string,args:Record<string,unknown>):Promise<T>{
 const {data,error}=await client.rpc(name,args);
 if(error)throw Error(error.code==='PGRST202'?'Online quest setup is incomplete. The app owner needs to finish cloud setup.':error.code==='42501'?'Sign in with the account that started this attempt.':error.code==='22023'?'The requirements or limits were not met. Quests allow 1–3600 seconds, up to 100 clicks/second and 20 created quests per account.':'Cloud metrics could not complete. Refresh or retry; rewards are granted once.');
 return data as T;
}
export async function loadQuests(client:SupabaseClient):Promise<QuestData>{
 return metricsRPC<QuestData>(client,'click_quest_board',{});
}
