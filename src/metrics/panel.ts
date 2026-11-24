import {panel} from '../ui/panel.ts';
import {infinitySystem,formatTime,clicksPerSecond} from './index.ts';
import type {QuestData,Benchmark} from './cloud.ts';
let active:{show:()=>void;select:(tab:string)=>void}|undefined;
function reuse(tab:string){if(!active)return false;active.show();active.select(tab);return true;}
export async function openInfinityPanel(initial='Score tracker',openAccount:()=>void=()=>{void import('../backend/panel.ts').then(module=>module.openAccountPanel());}){
 if(initial==='Account'){openAccount();return;}
 if(reuse(initial))return;
 const system=await infinitySystem();await system.ready;
 if(reuse(initial))return;
 let tab=initial,closed=false,generation=0,busy=false,lastResult=0,account=system.account;
 let stop=()=>{};let tick:ReturnType<typeof setInterval>|undefined;
 function clock(){clearInterval(tick);tick=undefined;if(!closed&&!document.hidden&&system.tracker.getSnapshot().phase==='running')tick=setInterval(()=>system.tracker.tick(),50);}
 const window=panel('♾️',()=>{closed=true;generation++;stop();clearInterval(tick);document.removeEventListener('visibilitychange',clock);system.tracker.pause();active=undefined;});
 const root=window.body;root.classList.add('infinity-panel');
 const tabs=document.createElement('nav'),body=document.createElement('div'),status=document.createElement('div'),readout=document.createElement('div');status.setAttribute('role','status');
 root.append(tabs,readout,body,status);
 function button(parent:HTMLElement,label:string,run:()=>void|Promise<void>){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=()=>{void action(run);};parent.append(b);return b;}
 async function action(run:()=>void|Promise<void>){if(busy)return;busy=true;status.textContent='';try{await run();}catch(error){if(!closed)status.textContent=error instanceof Error?error.message:String(error);}finally{busy=false;}}
 function field(parent:HTMLElement,label:string,type:string,value=''){const row=document.createElement('label'),input=document.createElement('input');row.append(document.createTextNode(label),input);input.type=type;input.value=value;parent.append(row);return input;}
 function text(parent:HTMLElement,value:string){const row=document.createElement('div');row.textContent=value;parent.append(row);}
 function update(){const s=system.tracker.getSnapshot();readout.textContent=`${s.phase} · ${formatTime(s.options.mode==='countdown'?Math.max(0,s.options.durationSeconds*1000-s.elapsedMs):s.elapsedMs)} · ${s.clicks} clicks · ${clicksPerSecond(s.clicks,s.elapsedMs).toFixed(2)}/s`;}
 function select(next:string){if(next==='Account'){openAccount();return;}tab=next;generation++;body.replaceChildren();for(const b of tabs.querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.textContent===tab));status.textContent='';
  if(tab==='Score tracker'){
   const preferences=system.tracker.getSnapshot().options,mode=document.createElement('select');for(const value of ['stopwatch','countdown']){const option=document.createElement('option');option.value=value;option.textContent=value;mode.append(option);}mode.value=preferences.mode;body.append(mode);
   const seconds=field(body,'Seconds','number',String(preferences.durationSeconds));seconds.min='1';seconds.max='86400';seconds.step='1';
   for(const name of ['Start','Pause','Lap','Finish','Reset'])button(body,name,()=>{const tracker=system.tracker;if(name==='Start')tracker.start({mode:mode.value as 'stopwatch'|'countdown',durationSeconds:Number(seconds.value)});else if(name==='Pause')tracker.pause();else if(name==='Lap')tracker.lap();else if(name==='Finish')tracker.finish();else tracker.reset();});
   const click=button(body,'Click here',()=>{});click.className='infinity-click';click.onkeydown=event=>{if(event.repeat)event.preventDefault();};click.onclick=event=>{const state=system.tracker.getSnapshot();if(event.isTrusted&&!event.defaultPrevented&&event.button===0&&(!state.options.attemptId||event.detail>0))system.tracker.click();};
   button(body,'Results / laps',()=>{const s=system.tracker.getSnapshot();const old=body.querySelector('[data-results]');old?.remove();const list=document.createElement('div');list.dataset.results='';for(const lap of s.laps)text(list,`Lap ${lap.number} · ${formatTime(lap.splitMs)} · ${lap.splitClicks}`);for(const result of s.results)text(list,`#${result.number} · ${formatTime(result.elapsedMs)} · ${result.clicks}`);body.append(list);});
   button(body,'Submit last online score',async()=>{const result=system.tracker.getSnapshot().results[0];if(!result)throw Error('No completed run.');await system.submit(result);status.textContent='Score submitted';});return;
  }
  const local=tab==='Questboard';
  if(!local&&!system.account){text(body,'Sign in to access online quests and leaderboard.');button(body,'Sign in',()=>select('Account'));return;}
  button(body,'Refresh',()=>{if(local)system.refreshLocal();select(tab);});
  if(local){button(body,'Online quests',()=>select('Online quests'));}
  const version=generation,actor=system.account;
  const show=(data:QuestData)=>{
   if(closed||version!==generation||actor!==system.account)return;
   text(body,`⭐ ${data.claims.length}`);
   if(tab!=='Leaderboard'){const target=field(body,'Click target','number','20'),duration=field(body,'Seconds','number','5');target.min=duration.min='1';target.step=duration.step='1';duration.max='3600';target.max='360000';
   button(body,'Create quest',async()=>{if(local)system.createLocalQuest(Number(target.value),Number(duration.value));else await system.createQuest(Number(target.value),Number(duration.value));select(tab);});}
   function play(benchmark:Benchmark){return async()=>{if(local)system.beginLocal(benchmark);else await system.beginOnline(benchmark);select('Score tracker');};}
   if(tab==='Leaderboard')for(const benchmark of data.benchmarks){button(body,`${benchmark.seconds}s · attempt`,play(benchmark));button(body,`${benchmark.seconds}s · rankings`,async()=>{const rows=await system.standings(benchmark.id);if(version!==generation||actor!==system.account)return;const table=document.createElement('div');for(const row of rows.top)text(table,`${row.rank}. ${row.player}${row.is_you?' (you)':''} · ${row.clicks}`);if(!rows.top.length)text(table,'No scores yet');if(rows.mine)text(table,`Your rank: ${rows.mine.rank} · ${rows.mine.clicks}`);body.append(table);});}
   else for(const quest of data.quests){const benchmark=data.benchmarks.find(b=>b.id===quest.benchmark_id);if(!benchmark)continue;const row=document.createElement('div');body.append(row);text(row,`${quest.target} clicks / ${benchmark.seconds}s · best ${data.best[benchmark.id]??0}`);button(row,'Attempt',play(benchmark));const claim=button(row,data.claims.includes(quest.id)?'⭐ Claimed':'Hand in',async()=>{if(local)system.claimLocalQuest(quest.id);else await system.claimQuest(quest.id);select(tab);});claim.disabled=data.claims.includes(quest.id)||(data.best[benchmark.id]??0)<quest.target;}
  };
  if(local){try{show(system.localBoard());}catch(error){status.textContent=String(error);}}
  else void system.board().then(show).catch(error=>{if(version===generation&&!closed)status.textContent=String(error);});
 }
 for(const name of ['Score tracker','Questboard','Online quests','Leaderboard','Account'])button(tabs,name,()=>select(name));
 stop=system.subscribe(()=>{if(closed)return;update();if((system.tracker.getSnapshot().phase==='running'&&!tick||system.tracker.getSnapshot().phase!=='running'&&tick))clock();if(account!==system.account){account=system.account;select(tab);}const result=system.tracker.getSnapshot().results[0];if(result&&result.number!==lastResult){lastResult=result.number;if(result.actorId===system.account&&result.attemptId&&!result.interrupted&&result.reason==='timeout')void system.submit(result).then(()=>{if(!closed)status.textContent='Score submitted';}).catch(error=>{if(!closed)status.textContent=String(error);});}});
 document.addEventListener('visibilitychange',clock);clock();
 active={show:window.show,select};update();select(initial);
}
