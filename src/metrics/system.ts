import type {SupabaseClient} from '@supabase/supabase-js';
import {createScoreTracker,type Result} from './model.ts';
import {loadLocalQuests,saveLocalQuests,addLocalQuest,recordLocalResult,claimLocalQuest,type LocalQuests} from './localQuests.ts';
import {loadQuests,metricsRPC,type Attempt,type Benchmark,type Standing} from './cloud.ts';
/** A UI-independent owner for the V1 scoring, local rewards and account-scoped RPCs. */
export function createInfinitySystem(client:SupabaseClient,now:()=>number=()=>performance.now()){
 const tracker=createScoreTracker(now),listeners=new Set<()=>void>();
 let actor='',epoch=0,disposed=false,deadline:ReturnType<typeof setTimeout>|undefined;
 let local:ReturnType<typeof loadLocalQuests>|undefined,localError='';
 let beginning=false;
 let submitted=new Set<string>(),submitting=new Map<string,Promise<void>>(),lastResult=0;
 const publish=()=>{for(const listener of listeners)listener();};
 const identity=(next:string)=>{if(disposed||actor===next)return;actor=next;epoch++;submitted=new Set();submitting=new Map();tracker.clearOnline();publish();};
 const sessionEpoch=epoch;
 const auth=client.auth.onAuthStateChange((_event,session)=>identity(session?.user.id??''));
 const ready=client.auth.getSession().then(({data,error})=>{if(error)throw error;if(epoch===sessionEpoch)identity(data.session?.user.id??'');});
 // Surface initialization failure through ready; attaching a handler avoids an
 // unhandled rejection when a consumer subscribes before awaiting initialization.
 void ready.catch(()=>{});
 function readLocal(){if(!local)local=loadLocalQuests();return local;}
 function updateLocal(change:(value:LocalQuests)=>LocalQuests){
  const current=readLocal(),next=change(current.data);if(next===current.data)return;
  local={data:next,original:saveLocalQuests(next,current.original)};localError='';publish();
 }
 async function online<T>(work:()=>Promise<T>):Promise<T>{
  const initialActor=actor,initialEpoch=epoch;await ready;
  if(initialActor&&initialEpoch!==epoch)throw Error('Account changed during the request.');
  if(disposed||!actor)throw Error('Sign in first.');const generation=epoch;
  const result=await work();if(disposed||generation!==epoch)throw Error('Account changed during the request.');return result;
 }
 function submit(result:Result):Promise<void>{
  if(!result.attemptId||result.actorId!==actor||result.interrupted||result.reason!=='timeout')return Promise.reject(Error('This result is not eligible for online submission.'));
  if(submitted.has(result.attemptId))return Promise.resolve();
  const pending=submitting.get(result.attemptId);if(pending)return pending;
  const id=result.attemptId,generation=epoch;
  const job=online(()=>metricsRPC(client,'finish_click_attempt',{p_id:id,p_clicks:result.clicks})).then(()=>{if(generation===epoch)submitted.add(id);}).finally(()=>{if(generation===epoch)submitting.delete(id);});
  submitting.set(id,job);return job;
 }
 const stop=tracker.subscribe(()=>{
  clearTimeout(deadline);deadline=undefined;
  const state=tracker.getSnapshot();
  if(state.phase==='running'&&state.options.mode==='countdown')deadline=setTimeout(()=>tracker.tick(),Math.ceil(tracker.remainingMs())+1);
  const result=state.results[0];
  if(result&&result.number!==lastResult){lastResult=result.number;
   if(result.actorId==='local'){try{updateLocal(data=>recordLocalResult(data,result));}catch(error){localError=error instanceof Error?error.message:String(error);}}
  }
  publish();
 });
 return {
  tracker,ready,
  get disposed(){return disposed;},
  get account(){return actor;},get localError(){return localError;},
  subscribe(listener:()=>void){listeners.add(listener);return ()=>{listeners.delete(listener);};},
  localBoard:()=>readLocal().data,
  refreshLocal(){local=loadLocalQuests();localError='';publish();},
  createLocalQuest(target:number,seconds:number){updateLocal(data=>addLocalQuest(data,target,seconds,crypto.randomUUID()));},
  claimLocalQuest(id:string){updateLocal(data=>claimLocalQuest(data,id));},
  beginLocal(benchmark:Benchmark){const known=readLocal().data.benchmarks.find(b=>b.id===benchmark.id);if(!known)throw Error('Unknown local benchmark.');tracker.reset();tracker.start({mode:'countdown',durationSeconds:known.seconds,attemptId:`local:${crypto.randomUUID()}`,benchmarkId:known.id,actorId:'local'});},
  board:()=>online(()=>loadQuests(client)),
  standings:(benchmark:string)=>online(()=>metricsRPC<{top:Standing[];mine:Standing|null}>(client,'click_standings',{p_benchmark:benchmark})),
  createQuest:(target:number,seconds:number)=>online(()=>metricsRPC(client,'create_click_quest',{p_id:crypto.randomUUID(),p_target:target,p_seconds:seconds})),
  claimQuest:(id:string)=>online(()=>metricsRPC<number>(client,'claim_click_quest',{p_quest:id})),
  async beginOnline(benchmark:Benchmark){
   if(beginning||tracker.getSnapshot().phase==='running'||tracker.getSnapshot().phase==='paused')throw Error('Finish or reset the current run first.');
   beginning=true;try{
   await ready;const generation=epoch;
   const board=await online(()=>loadQuests(client));const canonical=board.benchmarks.find(b=>b.id===benchmark.id);if(!canonical)throw Error('Unknown online benchmark.');
   if(generation!==epoch)throw Error('Account changed during the request.');
   const attempt=await online(()=>metricsRPC<Attempt>(client,'begin_click_attempt',{p_benchmark:canonical.id,p_id:crypto.randomUUID()}));
   // Capture the authenticated actor from the server, never from a form value.
   if(generation!==epoch||attempt.user_id!==actor)throw Error('Attempt account mismatch.');
   tracker.reset();tracker.start({mode:'countdown',durationSeconds:canonical.seconds,attemptId:attempt.id,benchmarkId:attempt.benchmark_id,actorId:actor});
   }finally{beginning=false;}
  },
  submit,
  async signIn(email:string,password:string){const {error}=await client.auth.signInWithPassword({email,password});if(error)throw error;},
  async signOut(){const {error}=await client.auth.signOut();if(error)throw error;identity('');},
  dispose(){disposed=true;epoch++;clearTimeout(deadline);stop();auth.data.subscription.unsubscribe();tracker.pause();listeners.clear();},
 };
}
