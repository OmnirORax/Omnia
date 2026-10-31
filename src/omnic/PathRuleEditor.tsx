import {featureActionRuntime} from '../featureActions';
import {UIAction} from '../ui/UIAction';
import {FunctionControl} from '../ui/UIWorkspace';
import {useState} from 'react';
import {MathematicalDial} from '../ui/MathematicalDial';
import {SQUARE_PATH_RULE,readPathRule,type PathRule} from './pathRule';
import './pathRule.css';
const directions=[{angle:0,icon:'↑'},{angle:90,icon:'→'},{angle:180,icon:'↓'},{angle:270,icon:'←'}];
/** Program authoring is rule configuration, not a reference/value selection. */
export function PathRuleEditor({value,onCommit}:{value:string;onCommit:(value:string)=>void}){
 const rule=readPathRule(value),[selected,setSelected]=useState(0),[number,setNumber]=useState<'steps'|'m'|'p'|'r'|null>(null),[turn,setTurn]=useState(false),[replace,setReplace]=useState(false);
 const active=Math.min(selected,rule.s.length-1);
 const write=(patch:Partial<PathRule>)=>{const next=JSON.stringify({...rule,...patch});if(next.length<=200){readPathRule(next);onCommit(next);}};
 const pick=(angle:number)=>{
  if(turn){write({t:angle});setTurn(false);return;}
  if(replace){write({s:[[angle,1]],t:0});setSelected(0);setReplace(false);return;}
  if(rule.s.length>=8)return;
  setSelected(rule.s.length);write({s:[...rule.s,[angle,1]]});
 };
 const amount=number==='steps'?(rule.s[active]?.[1]??1):number?rule[number]:1;
 const button=(label:string,icon:string,pressed:boolean,run:()=>void)=><button type="button" title={label} aria-label={label} aria-pressed={pressed} onClick={run}>{icon}</button>;
 return <div className="path-rule-editor" data-popup-drag-frame>
  <div className="path-direction-wheel" role="group" aria-label={turn?'Turn after each instruction':'Append directions in click order'}>
   <svg viewBox="0 0 132 132" aria-hidden="true"><circle cx="66" cy="66" r="51"/><path d="M66 15V117M15 66H117"/></svg>
   {directions.map(({angle,icon},i)=><button key={angle} type="button" className={`path-direction path-direction-${i}`} disabled={!turn&&!replace&&rule.s.length>=8} aria-label={turn?`Turn ${angle} degrees`:`Append ${icon}`} title={turn?`${angle}° after each instruction`:`${icon} · next instruction`} onClick={()=>pick(angle)}>{turn?`${angle}°`:icon}</button>)}
   <button type="button" className="path-direction-center" title="Whole-unit steps for selected instruction" aria-label="Instruction steps" disabled={!rule.s.length} onClick={()=>setNumber(number==='steps'?null:'steps')}>{(rule.s[active]?.[1]??1)}</button>
  </div>
  <div className="path-instructions" role="group" aria-label="Instruction order">{rule.s.map(([angle,steps],i)=><button key={i} type="button" aria-label={`Instruction ${i+1}: ${directions.find(d=>d.angle===angle)!.icon}, ${steps} units`} aria-pressed={active===i} onClick={()=>{setSelected(i);setNumber('steps');}}><sup>{i+1}</sup>{directions.find(d=>d.angle===angle)!.icon}{steps}</button>)}</div>
  <div className="path-rule-tools">
   {button('Start a new direction sequence','＋',replace,()=>{setReplace(!replace);setTurn(false);})}
   {button('Remove selected instruction','⌫',false,()=>{if(rule.s.length>1){write({s:rule.s.filter((_,i)=>i!==active)});setSelected(Math.max(0,active-1));}})}
   {button('Turn after each instruction',`↻${rule.t}°`,turn,()=>{setTurn(!turn);setReplace(false);})}
   {button('Loop instruction sequence','⟳',rule.l,()=>write({l:!rule.l}))}
   {button('Stop at origin after a complete sequence','⊙',rule.c,()=>write({c:!rule.c}))}
   {button(rule.a?'Drawing mode · use Composer Play to run':'Fixed generation','▶',rule.a,()=>write({a:!rule.a}))}
   {button(rule.d?'Separate marks':'Connected trace',rule.d?'⠒':'━',rule.d,()=>write({d:!rule.d}))}
  </div>
  <div className="path-rule-tools">
   {button('Fixed generation maximum unit moves',`≤${rule.m}`,number==='m',()=>setNumber(number==='m'?null:'m'))}
   {button('Additive coverage per pass',`${rule.p}%`,number==='p',()=>setNumber(number==='p'?null:'p'))}
   {rule.a&&<><UIAction id="omnic:path-play" label="Play / pause drawing" symbol="⏯" category="Omnic" registerOnly onClick={()=>featureActionRuntime.invoke('omnic.play')}/><FunctionControl id="omnic:path-play" mirror symbol="⏯" tooltip="Play / pause drawing; replay after completion"/></>}
   {button('Drawing speed · unit moves per second',`${rule.r}/s`,number==='r',()=>setNumber(number==='r'?null:'r'))}
   {button('Reset square rule','↺',false,()=>{onCommit(JSON.stringify(SQUARE_PATH_RULE));setSelected(0);setNumber(null);setTurn(false);setReplace(false);})}
  </div>
  {number&&<PathAmountDial key={`${number}:${active}`} label={number==='steps'?'Whole-unit steps':number==='m'?'Maximum unit moves':number==='p'?'Coverage per pass (%)':'Unit moves per second'} value={amount} min={1} max={number==='m'?10000:number==='r'?60:100} integer onCommit={n=>{if(number==='steps')write({s:rule.s.map((s,i)=>i===active?[s[0],n]:s)});else write({[number]:n});}}/>}
 </div>;
}

function PathAmountDial(props:Omit<Parameters<typeof MathematicalDial>[0],'onPreview'|'onCancelPreview'>){
 const [sample,setSample]=useState<number|null>(null);
 return <MathematicalDial {...props} value={sample??props.value} onPreview={setSample} onCancelPreview={()=>setSample(null)} onCommit={n=>{setSample(null);props.onCommit(n);}}/>;
}
