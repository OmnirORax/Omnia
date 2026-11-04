import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
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
export function QuestSystem({tracker,onPlay}:{tracker:Tracker;onPlay:()=>void}){
 const config=backendConfiguration(),client=config.kind==='cloud'?config.client:null;
 const [panel,setPanel]=useState<'quests'|'leaderboard'|null>(null),[account,setAccount]=useState('');
 const [data,setData]=useState<QuestData|null>(null),[standings,setStandings]=useState<{top:Standing[];mine:Standing|null}|null>(null);
 const [benchmark,setBenchmark]=useState('primary-5s-v1'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[refresh,setRefresh]=useState(0);
 const epoch=useRef(0),currentAccount=useRef(''),locked=useRef(false),submitted=useRef(new Set<string>());
 const results=useSyncExternalStore(tracker.subscribe,()=>tracker.getSnapshot().results);
 const phase=useSyncExternalStore(tracker.subscribe,()=>tracker.getSnapshot().phase);
 const ui=useUITracked(ui=>[ui.update,ui.layout.windows[`infinity-${panel}`]?.collapsed,ui.layout.windows[`infinity-${panel}`]?.closed]);
 const sleeping=!!panel&&!!(ui.layout.windows[`infinity-${panel}`]?.collapsed||ui.layout.windows[`infinity-${panel}`]?.closed);
 const reveal=(next:'quests'|'leaderboard')=>{ui.update(layout=>reopenContainer(layout,`window:infinity-${next}`));setPanel(next);};
 const commands=useFeatureActions('questSystem',{'quests.open':{enabled:true,run:()=>reveal('quests')},'leaderboard.open':{enabled:true,run:()=>reveal('leaderboard')}});
 useEffect(()=>{const key=(event:KeyboardEvent)=>{if(commands.handle(event)){event.preventDefault();event.stopImmediatePropagation();}};window.addEventListener('keydown',key,true);return()=>window.removeEventListener('keydown',key,true);},[commands]);
 useEffect(()=>{
  if(!client)return;
  let live=true;
  const apply=(id:string)=>{if(!live||id===currentAccount.current)return;epoch.current++;currentAccount.current=id;setAccount(id);setData(null);setStandings(null);setBusy(false);locked.current=false;setError('');setNotice('');tracker.clearOnline();};
  const before=epoch.current;
  const {data:subscription}=client.auth.onAuthStateChange((_event,session)=>apply(session?.user.id??''));
  void client.auth.getSession().then(({data})=>{if(epoch.current===before)apply(data.session?.user.id??'');});
  return()=>{live=false;epoch.current++;subscription.subscription.unsubscribe();};
 },[client,tracker]);
 useEffect(()=>{
  if(!client||!account||!panel||sleeping)return;
  let live=true;const generation=epoch.current;
  setStandings(null);
  void Promise.all([loadQuests(client),metricsRPC<{top:Standing[];mine:Standing|null}>(client,'click_standings',{p_benchmark:benchmark})]).then(([next,ranking])=>{if(live&&generation===epoch.current){setData(next);setStandings(ranking);setError('');}}).catch(failure=>{if(live&&generation===epoch.current)setError(String(failure.message));});
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
   <div className="metrics-actions"><UIAction id="infinity:refresh" label="Refresh" category="♾️" onClick={()=>setRefresh(value=>value+1)}/><span>⭐ {data?.claims.length??0}</span></div>
   {!client?<p>Cloud connection is not configured in this build.</p>:!account?<p>Sign in through Workspace settings → Cloud connection to play online.</p>:<>
    <small>{standings?.mine?.player??'No ranked attempts yet'} · updates every 10 seconds</small>
    {panel==='quests'?<>
     {data?.quests.map(quest=>{const b=data.benchmarks.find(item=>item.id===quest.benchmark_id)!;const claimed=data.claims.includes(quest.id),best=data.best[b.id]??0,complete=best>=quest.target;
      return <div className="metrics-quest" key={quest.id}>
       <strong>{quest.target} clicks in {b.seconds}s</strong><small>{Math.min(best,quest.target)}/{quest.target} · ⭐ +1 · {claimed?'Claimed':complete?'Ready to hand in':'Available'}</small>
       <div className="metrics-actions"><UIAction id={`quest:${quest.id}:play`} label={`Attempt ${quest.target} in ${b.seconds}s`} category="♾️" disabled={busy||phase==='running'||phase==='paused'} onClick={()=>begin(b)}/>
       <UIAction id={`quest:${quest.id}:claim`} label={`Hand in ${quest.target} in ${b.seconds}s`} category="♾️" disabled={busy||claimed||!complete} onClick={()=>void run(async()=>{const generation=epoch.current;await metricsRPC(client!,'claim_click_quest',{p_quest:quest.id});if(generation===epoch.current)setNotice('Quest handed in: +1 star.');})}/>
       <UIAction id={`quest:${quest.id}:rank`} label={`Rankings ${b.seconds}s`} category="♾️" onClick={()=>{setBenchmark(b.id);reveal('leaderboard');}}/></div>
      </div>;
     })}
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
