import {initialLocalQuests,loadLocalQuests,saveLocalQuests,addLocalQuest,recordLocalResult,claimLocalQuest,type LocalQuests} from './localQuests';
import {useFilters} from '../filtering/useFilters';
import {FilterControls,FilterPagination} from '../filtering/FilterControls';
import {questCategory,questFilterContext,questFilterSchema} from './questFilters';
import {CoupledField,type PropertyBindings} from '../properties/CoupledProperties';
import {functionInputValue} from '../properties/runtimeInputs';
import {QUEST_AUTHOR,QUEST_TARGET,QUEST_SECONDS} from './quest.function';
import {FunctionControl} from '../ui/UIWorkspace';
import {useEffect,useRef,useState,useMemo,useSyncExternalStore} from 'react';
import {backendConfiguration} from '../backend/client';
import {FloatingWindow} from '../ui/FloatingWindow';
import {UIAction} from '../ui/UIAction';
import {UIField} from '../ui/UIField';
import {useFeatureActions} from '../ui/useFeatureActions';
import {useUITracked} from '../ui/context';
import {reopenContainer} from '../ui/layout';
import {loadQuests,metricsRPC,type QuestData,type Standing,type Attempt,type Benchmark} from './cloud';
import type {createScoreTracker,Result} from './model';

type Tracker=ReturnType<typeof createScoreTracker>;
export function QuestSystem({tracker,onPlay,bindings}:{tracker:Tracker;onPlay:()=>void;bindings:PropertyBindings}){
 const config=backendConfiguration(),client=config.kind==='cloud'?config.client:null;
 const [local,setLocal]=useState(()=>{try{return {...loadLocalQuests(),error:''};}catch(error){return {original:null,data:initialLocalQuests(),error:error instanceof Error?error.message:'Local storage unavailable'};}});
 const localRef=useRef(local);localRef.current=local;
 const [creating,setCreating]=useState(false);

 const revealQuest=useRef<string|null>(null);
 const [panel,setPanel]=useState<'quests'|'leaderboard'|null>(null),[account,setAccount]=useState('');
 const [data,setData]=useState<QuestData|null>(null),[standings,setStandings]=useState<{top:Standing[];mine:Standing|null}|null>(null);
 const boardData=panel==='quests'?local.data:data;
 const filterContext=useMemo(()=>questFilterContext(boardData),[boardData]);
 const questItems=useMemo(()=>boardData?.quests??[],[boardData]);
 const filters=useFilters(questItems,questFilterSchema,filterContext);
 const [benchmark,setBenchmark]=useState('primary-5s-v1'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[refresh,setRefresh]=useState(0);
 const epoch=useRef(0),currentAccount=useRef(''),locked=useRef(false),submitted=useRef(new Set<string>());
 const results=useSyncExternalStore(tracker.subscribe,()=>tracker.getSnapshot().results);
 const phase=useSyncExternalStore(tracker.subscribe,()=>tracker.getSnapshot().phase);
 const ui=useUITracked(ui=>[ui.update,ui.layout.windows[`infinity-${panel}`]?.collapsed,ui.layout.windows[`infinity-${panel}`]?.closed]);
 const sleeping=!!panel&&!!(ui.layout.windows[`infinity-${panel}`]?.collapsed||ui.layout.windows[`infinity-${panel}`]?.closed);
 const reveal=(next:'quests'|'leaderboard')=>{ui.update(layout=>reopenContainer(layout,`window:infinity-${next}`));setPanel(next);};
 const commands=useFeatureActions('questSystem',{'quests.open':{enabled:true,run:()=>reveal('quests')},'leaderboard.open':{enabled:true,run:()=>reveal('leaderboard')},'quests.create':{enabled:!local.error,run:()=>{reveal('quests');setCreating(true);}},'quests.publish':{enabled:!local.error&&!busy,run:publishQuest}});
 useEffect(()=>{const key=(event:KeyboardEvent)=>{if(commands.handle(event)){event.preventDefault();event.stopImmediatePropagation();}};window.addEventListener('keydown',key,true);return()=>window.removeEventListener('keydown',key,true);},[commands]);
 useEffect(()=>{
  if(!client)return;
  let live=true;
  const apply=(id:string)=>{if(!live||id===currentAccount.current)return;epoch.current++;currentAccount.current=id;setAccount(id);setData(null);setStandings(null);setBusy(false);locked.current=false;setError('');setNotice('');setCreating(false);filters.reset();revealQuest.current=null;tracker.clearOnline();};
  const before=epoch.current;
  const {data:subscription}=client.auth.onAuthStateChange((_event,session)=>apply(session?.user.id??''));
  void client.auth.getSession().then(({data})=>{if(epoch.current===before)apply(data.session?.user.id??'');});
  return()=>{live=false;epoch.current++;subscription.subscription.unsubscribe();};
 },[client,tracker]);
 useEffect(()=>{
  if(!client||!account||panel!=='leaderboard'||sleeping)return;
  let live=true;const generation=epoch.current;
  setStandings(null);
  void Promise.all([loadQuests(client),metricsRPC<{top:Standing[];mine:Standing|null}>(client,'click_standings',{p_benchmark:benchmark})]).then(([next,ranking])=>{if(live&&generation===epoch.current){setData(next);setStandings(ranking);setError('');}}).catch(failure=>{if(live&&generation===epoch.current)setError(String(failure.message));});
  const interval=window.setInterval(()=>{if(!document.hidden)setRefresh(value=>value+1);},10000);
  return()=>{live=false;window.clearInterval(interval);};
 },[client,account,panel,benchmark,refresh,sleeping]);
 useEffect(()=>{if(revealQuest.current&&boardData?.quests.some(quest=>quest.id===revealQuest.current)){const id=revealQuest.current;revealQuest.current=null;filters.reveal(quest=>quest.id===id);}},[boardData]);
 function updateLocal(change:(data:LocalQuests)=>LocalQuests){try{if(localRef.current.error)throw Error(localRef.current.error);const next=change(localRef.current.data);if(next===localRef.current.data)return;const original=saveLocalQuests(next,localRef.current.original);const value={data:next,original,error:''};localRef.current=value;setLocal(value);setError('');}catch(failure){setError(failure instanceof Error?failure.message:'Local save failed; previous data retained.');}}
 useEffect(()=>{const result=results[0];if(result?.actorId==='local')updateLocal(current=>recordLocalResult(current,result));},[results]);
 async function run(work:()=>Promise<void>){
  if(!client||!account||locked.current)return;
  const generation=epoch.current;locked.current=true;setBusy(true);setError('');
  try{await work();if(generation===epoch.current)setRefresh(value=>value+1);}
  catch(failure){if(generation===epoch.current)setError(failure instanceof Error?failure.message:'Cloud operation failed.');}
  finally{if(generation===epoch.current){setBusy(false);locked.current=false;}}
 }
 function publishQuest(){
  const target=Number(functionInputValue(QUEST_AUTHOR,QUEST_TARGET,()=>bindings.values[QUEST_AUTHOR][QUEST_TARGET]));
  const seconds=Number(functionInputValue(QUEST_AUTHOR,QUEST_SECONDS,()=>bindings.values[QUEST_AUTHOR][QUEST_SECONDS]));
  if(!Number.isInteger(target)||!Number.isInteger(seconds)||target<1||seconds<1||seconds>3600||target>seconds*100){setError('Choose 1–3600 seconds and at least one click, up to 100 clicks per second.');return;}
  updateLocal(current=>{const next=addLocalQuest(current,target,seconds,crypto.randomUUID());const quest=next.quests.find(q=>q.target===target&&q.benchmark_id===`primary-${seconds}s-v1`)!;revealQuest.current=quest.id;return next;});setCreating(false);

 }
 function begin(b:Benchmark){if(panel==='quests'){tracker.reset();tracker.start({mode:'countdown',durationSeconds:b.seconds,attemptId:`local:${crypto.randomUUID()}`,benchmarkId:b.id,actorId:'local'});onPlay();return;}void run(async()=>{
  const generation=epoch.current,actor=account;
  const attempt=await metricsRPC<Attempt>(client!,'begin_click_attempt',{p_benchmark:b.id,p_id:crypto.randomUUID()});
  if(generation!==epoch.current)return;
  tracker.reset();tracker.start({mode:'countdown',durationSeconds:b.seconds,attemptId:attempt.id,benchmarkId:b.id,actorId:actor});onPlay();setNotice('Benchmark started. Use primary clicks only; pausing or closing cancels ranking eligibility.');
 });}
 async function submit(result:Result){
  if(!result.attemptId||result.actorId!==account||result.interrupted||result.reason!=='timeout')return;
  await run(async()=>{const generation=epoch.current;await metricsRPC(client!,'finish_click_attempt',{p_id:result.attemptId,p_clicks:result.clicks});if(generation===epoch.current){submitted.current.add(result.attemptId!);setNotice('Score submitted. Completed quests can now be handed in.');}});
 }
 useEffect(()=>{const result=results[0];if(client&&account&&result?.attemptId&&result.actorId===account&&!result.interrupted&&result.reason==='timeout'&&!submitted.current.has(result.attemptId)){submitted.current.add(result.attemptId);void submit(result);}},[results,account]);
 const result=results[0];
 const eligible=!!result?.attemptId&&result.actorId===account&&!result.interrupted&&result.reason==='timeout';
 return panel?<FloatingWindow id={`infinity-${panel}`} title={panel==='quests'?'📜 Questboard':'🏆 Leaderboard'} width={430} height={520} openAtCursor={false} onClose={()=>setPanel(null)}>
  <div className="metrics-tracker">
   <div className="metrics-actions"><UIAction id="infinity:refresh" label="Refresh" category="♾️" onClick={()=>{if(panel==='quests'){try{setLocal({...loadLocalQuests(),error:''});setError('');}catch(failure){setError(String(failure));}}else setRefresh(value=>value+1);}}/>{panel==='quests'&&<FunctionControl id="quests.create"/>}<span>⭐ {panel==='quests'?local.data.claims.length:data?.claims.length??'—'}</span></div>
   {creating&&panel==='quests'&&<div className="metrics-quest">
    <UIField id="quest:author:target" label="Click target" category="♾️"><CoupledField bindings={bindings} consumer={QUEST_AUTHOR} property={QUEST_TARGET}/></UIField>
    <UIField id="quest:author:seconds" label="Time limit (seconds)" category="♾️"><CoupledField bindings={bindings} consumer={QUEST_AUTHOR} property={QUEST_SECONDS}/></UIField>
    <small>Local quest · ⭐ +1 once</small>
    <div className="metrics-actions"><FunctionControl id="quests.publish"/><UIAction id="quest:author:cancel" label="Cancel" category="♾️" onClick={()=>setCreating(false)}/></div>
   </div>}
   {panel==='quests'?<small>Local quests · saved in this browser</small>:!client?<div><p>Open the cloud app for online rankings.</p><a href="https://omnium.nexus" target="_blank" rel="noopener noreferrer">Open cloud app ↗</a></div>:!account?<div><p>Sign in for online rankings.</p><FunctionControl id="settings"/></div>:null}
   {(panel==='quests'||client&&account)&&<>
    {!boardData&&!error&&<small role="status">Loading quests…</small>}
    {panel==='quests'?<>
     {boardData&&<FilterControls scope="quests" category="♾️" filters={filters}/>}
     {filters.items.map(quest=>{const b=filterContext.benchmarks.get(quest.benchmark_id)!;const claimed=filterContext.claimed.has(quest.id),best=filterContext.best[b.id]??0,complete=best>=quest.target;
      return <div className="metrics-quest" key={quest.id}>
       <strong>{quest.target} clicks in {b.seconds}s</strong><small>{questCategory(b.seconds).label} · {Math.min(best,quest.target)}/{quest.target} · ⭐ +1 · {claimed?'Claimed':complete?'Ready to hand in':'Available'}</small>
       <div className="metrics-actions"><UIAction id={`quest:${quest.id}:play`} label={`Attempt ${quest.target} in ${b.seconds}s`} category="♾️" disabled={busy||phase==='running'||phase==='paused'} onClick={()=>begin(b)}/>
       <UIAction id={`quest:${quest.id}:claim`} label={`Hand in ${quest.target} in ${b.seconds}s`} category="♾️" disabled={busy||claimed||!complete} onClick={()=>updateLocal(current=>claimLocalQuest(current,quest.id))}/>
       <UIAction id={`quest:${quest.id}:rank`} label={`Rankings ${b.seconds}s`} category="♾️" onClick={()=>{setBenchmark(b.id);reveal('leaderboard');}}/></div>
      </div>;
     })}
     {boardData&&!filters.matched&&<small role="status">No quests match these filters.</small>}
     <FilterPagination scope="quests" category="♾️" filters={filters}/>

    </>:<>
     <UIField id="infinity:benchmark" label="Click benchmark" category="♾️"><label>Benchmark<select value={benchmark} onChange={event=>setBenchmark(event.target.value)}>{data?.benchmarks.map(b=><option key={b.id} value={b.id}>{b.seconds}s · primary clicks</option>)}</select></label></UIField>
     <UIAction id="infinity:play" label="Start benchmark" category="♾️" disabled={busy||!data||phase==='running'||phase==='paused'} onClick={()=>{const b=data?.benchmarks.find(item=>item.id===benchmark);if(b)begin(b);}}/>
     <div className="metrics-table"><table><caption>Best score per account · this benchmark</caption><thead><tr><th>Rank</th><th>Player</th><th>Clicks</th></tr></thead><tbody>{standings?.top.map(row=><tr key={row.player}><td>{row.rank}</td><td>{row.player}{row.is_you?' (you)':''}</td><td>{row.clicks}</td></tr>)}</tbody></table></div>
     {standings&&!standings.top.length&&<small>No scores yet. Start this benchmark to set the first one.</small>}
     {standings?.mine&&<small>Your rank: {standings.mine.rank} · best: {standings.mine.clicks} clicks</small>}
    </>}
    {eligible&&<UIAction id="infinity:submit" label="Retry last score submission" category="♾️" disabled={busy} onClick={()=>void submit(result)}/>}
   </>}
   {busy&&<small role="status">Working…</small>}{notice&&<small role="status">{notice}</small>}{(error||local.error)&&<p role="alert">{error||local.error}</p>}
  </div>
 </FloatingWindow>:null;
}
