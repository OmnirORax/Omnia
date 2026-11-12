import { curveEditor } from '../ui/curve.ts';
import type { Curve } from '../properties/curve.ts';
import { audioResponse, type AudioResponse, type Response } from './audioResponse.ts';
import { configureSceneAudioResponse, readSceneAudioResponse } from './audio.ts';

type Host = { read:()=>AudioResponse;commit:(target:'light'|'bounce',dimension:keyof Response,value:Curve)=>void;error:(error:unknown)=>void;subscribe:(listener:()=>void)=>()=>void };
export function responseEditor(host: Host){
  const root=document.createElement('div'),navigation=document.createElement('div');navigation.className='response-tabs';root.append(navigation);
  let target:'light'|'bounce'='light',dimension:keyof Response='loudness',draft=audioResponse(host.read()),stamp=JSON.stringify(draft);
  const reset=()=>{draft=audioResponse(host.read());stamp=JSON.stringify(draft);configureSceneAudioResponse(draft);};
  const graph=curveEditor({
    read:()=>draft[target][dimension],
    preview:value=>{draft={...draft,[target]:{...draft[target],[dimension]:value}};configureSceneAudioResponse(draft);},
    commit:value=>{host.commit(target,dimension,value);reset();},cancel:reset,error:host.error,
    labels:()=>({name:dimension==='loudness'?'Loudness':'Recurrence · 8s',left:dimension==='loudness'?'-60 dB':'0%',right:dimension==='loudness'?'0 dB':'100%',top:dimension==='recurrence'?'Multiplier · 100%':target==='light'?'Light · 200%':'Bounce · 50%',point:x=>dimension==='loudness'?`${Math.round(-60+x*60)} dB`:`${Math.round(x*100)}%`}),
    trace:()=>{const live=readSceneAudioResponse();return{input:live[dimension],histogram:dimension==='loudness'?live.counts:undefined};},
  });
  const buttons:HTMLButtonElement[]=[];
  function button(label:string,selected:()=>boolean,activate:()=>void){const b=document.createElement('button');b.textContent=label;b.onclick=()=>{graph.cancel();reset();activate();refresh();};b.dataset.kind=label;navigation.append(b);buttons.push(b);b.setAttribute('aria-pressed',String(selected()));}
  const refresh=()=>{buttons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.kind===(target==='light'?'Light':'Bounce')||b.dataset.kind===(dimension==='loudness'?'Loudness':'Recurrence'))));graph.refresh();};
  button('Light',()=>true,()=>{target='light';});button('Bounce',()=>false,()=>{target='bounce';});button('Loudness',()=>true,()=>{dimension='loudness';});button('Recurrence',()=>false,()=>{dimension='recurrence';});
  const unsubscribe=host.subscribe(()=>{if(JSON.stringify(host.read())!==stamp){graph.cancel();reset();graph.refresh();}});
  root.append(graph.root);return{root,dispose(){unsubscribe();graph.dispose();reset();}};
}
