import {CoupledField,type PropertyBindings} from '../properties/CoupledProperties';
import {functionInputValue} from '../properties/runtimeInputs';
import {QUEST_AUTHOR,QUEST_TARGET,QUEST_SECONDS} from './quest.function';
import {FunctionControl} from '../ui/UIWorkspace';
import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {backendConfiguration} from '../backend/client';
import {FloatingWindow} from '../ui/FloatingWindow';
import {UIAction} from '../ui/UIAction';
import {UIField} from '../ui/UIField';
import {useFeatureActions} from '../ui/useFeatureActions';
import {useUITracked} from '../ui/context';
import {reopenContainer} from '../ui/layout';
import {loadQuests,metricsRPC,type QuestData,type Standing,type Attempt,type Benchmark,type Quest} from './cloud';
import type {createScoreTracker,Result} from './model';

type Tracker=ReturnType<typeof createScoreTracker>;
export function QuestSystem({tracker,onPlay,bindings}:{tracker:Tracker;onPlay:()=>void;bindings:PropertyBindings}){
 const config=backendConfiguration(),client=config.kind==='cloud'?config.client:null;
 const [creating,setCreating]=useState(false);
 const [page,setPage]=useState(0);
 const pageSize=12;
 const revealQuest=useRef<string|null>(null);
 const creation=useRef<{id:string;target:number;seconds:number}|null>(null);
 const [panel,setPanel]=useState<'quests'|'leaderboard'|null>(null),[account,setAccount]=useState('');
 const [data,setData]=useState<QuestData|null>(null),[standings,setStandings]=useState<{top:Standing[];mine:Standing|null}|null>(null);
 const [benchmark,setBenchmark]=useState('primary-5s-v1'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[refresh,setRefresh]=useState(0);
 const epoch=useRef(0),currentAccount=useRef(''),locked=useRef(false),submitted=useRef(new Set<string>());
 const results=useSyncExternalStore(tracker.subscribe,()=>tracker.getSnapshot().results);
 const phase=useSyncExternalStore(tracker.subscribe,()=>tracker.getSnapshot().phase);
 const ui=useUITracked(ui=>[ui.update,ui.layout.windows[`infinity-${panel}`]?.collapsed,ui.layout.windows[`infinity-${panel}`]?.closed]);
 const sleeping=!!panel&&!!(ui.layout.windows[`infinity-${panel}`]?.collapsed||ui.layout.windows[`infinity-${panel}`]?.closed);
 const reveal=(next:'quests'|'leaderboard')=>{ui.update(layout=>reopenContainer(layout,`window:infinity-${next}`));setPanel(next);};
 const commands=useFeatureActions('questSystem',{'quests.open':{enabled:true,run:()=>reveal('quests')},'leaderboard.open':{enabled:true,run:()=>reveal('leaderboard')},'quests.create':{enabled:true,run:()=>{reveal('quests');setCreating(true);}},'quests.publish':{enabled:!!client&&!!account&&!busy,run:publishQuest}});
 useEffect(()=>{const key=(event:KeyboardEvent)=>{if(commands.handle(event)){event.preventDefault();event.stopImmediatePropagation();}};window.addEventListener('keydown',key,true);return()=>window.removeEventListener('keydown',key,true);},[commands]);
 useEffect(()=>{
  if(!client)return;
  let live=true;
  const apply=(id:string)=>{if(!live||id===currentAccount.current)return;epoch.current++;currentAccount.current=id;setAccount(id);setData(null);setStandings(null);setBusy(false);locked.current=false;setError('');setNotice('');setCreating(false);setPage(0);revealQuest.current=null;creation.current=null;tracker.clearOnline();};
  const before=epoch.current;
  const {data:subscription}=client.auth.onAuthStateChange((_event,session)=>apply(session?.user.id??''));
  void client.auth.getSession().then(({data})=>{if(epoch.current===before)apply(data.session?.user.id??'');});
  return()=>{live=false;epoch.current++;subscription.subscription.unsubscribe();};
 },[client,tracker]);
 useEffect(()=>{
  if(!client||!account||!panel||sleeping)return;
  let live=true;const generation=epoch.current;
  setStandings(null);
  void Promise.all([loadQuests(client),metricsRPC<{top:Standing[];mine:Standing|null}>(client,'click_standings',{p_benchmark:benchmark})]).then(([next,ranking])=>{if(live&&generation===epoch.current){setData(next);setStandings(ranking);setError('');if(revealQuest.current){const index=next.quests.findIndex(quest=>quest.id===revealQuest.current);if(index>=0)setPage(Math.floor(index/pageSize));revealQuest.current=null;}}}).catch(failure=>{if(live&&generation===epoch.current)setError(String(failure.message));});
  const interval=window.setInterval(()=>{if(!document.hidden)setRefresh(value=>value+1);},10000);
  return()=>{live=false;window.clearInterval(interval);};
 },[client,account,panel,benchmark,refresh,sleeping]);
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
  if(!creation.current||creation.current.target!==target||creation.current.seconds!==seconds)creation.current={id:crypto.randomUUID(),target,seconds};
  const request=creation.current;
  void run(async()=>{const generation=epoch.current;const quest=await metricsRPC<Quest>(client!,'create_click_quest',{p_id:request.id,p_target:target,p_seconds:seconds});if(generation===epoch.current){creation.current=null;revealQuest.current=quest.id;setBenchmark(quest.benchmark_id);setCreating(false);setNotice('Quest is on the shared board. Equal requirements share one quest and reward.');}});
 }
 function begin(b:Benchmark){void run(async()=>{
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
   <div className="metrics-actions"><UIAction id="infinity:refresh" label="Refresh" category="♾️" onClick={()=>setRefresh(value=>value+1)}/>{panel==='quests'&&<FunctionControl id="quests.create"/>}<span>⭐ {data?data.claims.length:'—'}</span></div>
   {creating&&panel==='quests'&&<div className="metrics-quest">
    <UIField id="quest:author:target" label="Click target" category="♾️"><CoupledField bindings={bindings} consumer={QUEST_AUTHOR} property={QUEST_TARGET}/></UIField>
    <UIField id="quest:author:seconds" label="Time limit (seconds)" category="♾️"><CoupledField bindings={bindings} consumer={QUEST_AUTHOR} property={QUEST_SECONDS}/></UIField>
    <small>Shared quest · ⭐ +1 per account</small>
    <div className="metrics-actions"><FunctionControl id="quests.publish"/><UIAction id="quest:author:cancel" label="Cancel" category="♾️" onClick={()=>setCreating(false)}/></div>
   </div>}
   {!client?<div><p>{config.kind==='invalid'?config.message:'Open the cloud app to sign in and share quests.'}</p><a href="https://omnium.nexus" target="_blank" rel="noopener noreferrer">Open cloud app ↗</a></div>:!account?<div><p>Sign in to create quests, earn stars and join the leaderboard.</p><FunctionControl id="settings"/></div>:<>
    <small>{standings?.mine?.player??'No ranked attempts yet'} · updates every 10 seconds</small>
    {!data&&!error&&<small role="status">Loading quests…</small>}
    {panel==='quests'?<>
     {data?.quests.slice(page*pageSize,(page+1)*pageSize).map(quest=>{const b=data.benchmarks.find(item=>item.id===quest.benchmark_id)!;const claimed=data.claims.includes(quest.id),best=data.best[b.id]??0,complete=best>=quest.target;
      return <div className="metrics-quest" key={quest.id}>
       <strong>{quest.target} clicks in {b.seconds}s</strong><small>{Math.min(best,quest.target)}/{quest.target} · ⭐ +1 · {claimed?'Claimed':complete?'Ready to hand in':'Available'}</small>
       <div className="metrics-actions"><UIAction id={`quest:${quest.id}:play`} label={`Attempt ${quest.target} in ${b.seconds}s`} category="♾️" disabled={busy||phase==='running'||phase==='paused'} onClick={()=>begin(b)}/>
       <UIAction id={`quest:${quest.id}:claim`} label={`Hand in ${quest.target} in ${b.seconds}s`} category="♾️" disabled={busy||claimed||!complete} onClick={()=>void run(async()=>{const generation=epoch.current;await metricsRPC(client!,'claim_click_quest',{p_quest:quest.id});if(generation===epoch.current)setNotice('Quest handed in: +1 star.');})}/>
       <UIAction id={`quest:${quest.id}:rank`} label={`Rankings ${b.seconds}s`} category="♾️" onClick={()=>{setBenchmark(b.id);reveal('leaderboard');}}/></div>
      </div>;
     })}
     {data&&data.quests.length>pageSize&&<div className="metrics-actions"><UIAction id="quests:previous" label="Previous quests" category="♾️" disabled={page===0} onClick={()=>setPage(value=>Math.max(0,value-1))}/><small>{page+1}/{Math.ceil(data.quests.length/pageSize)}</small><UIAction id="quests:next" label="Next quests" category="♾️" disabled={(page+1)*pageSize>=data.quests.length} onClick={()=>setPage(value=>Math.min(Math.ceil(data.quests.length/pageSize)-1,value+1))}/></div>}
    </>:<>
     <UIField id="infinity:benchmark" label="Click benchmark" category="♾️"><label>Benchmark<select value={benchmark} onChange={event=>setBenchmark(event.target.value)}>{data?.benchmarks.map(b=><option key={b.id} value={b.id}>{b.seconds}s · primary clicks</option>)}</select></label></UIField>
     <UIAction id="infinity:play" label="Start benchmark" category="♾️" disabled={busy||!data||phase==='running'||phase==='paused'} onClick={()=>{const b=data?.benchmarks.find(item=>item.id===benchmark);if(b)begin(b);}}/>
     <div className="metrics-table"><table><caption>Best score per account · this benchmark</caption><thead><tr><th>Rank</th><th>Player</th><th>Clicks</th></tr></thead><tbody>{standings?.top.map(row=><tr key={row.player}><td>{row.rank}</td><td>{row.player}{row.is_you?' (you)':''}</td><td>{row.clicks}</td></tr>)}</tbody></table></div>
     {standings&&!standings.top.length&&<small>No scores yet. Start this benchmark to set the first one.</small>}
     {standings?.mine&&<small>Your rank: {standings.mine.rank} · best: {standings.mine.clicks} clicks</small>}
    </>}
    {eligible&&<UIAction id="infinity:submit" label="Retry last score submission" category="♾️" disabled={busy} onClick={()=>void submit(result)}/>}
   </>}
   {busy&&<small role="status">Working…</small>}{notice&&<small role="status">{notice}</small>}{error&&<p role="alert">{error}</p>}
  </div>
 </FloatingWindow>:null;
}
