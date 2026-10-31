import {DofAxisWheel} from '../ui/DofAxisWheel';
import {createStateField} from '../properties/stateField';
import {DofRuleExpression} from '../ui/DofInformation';
import '../ui/dofStateField.css';
import {featureActionRuntime} from '../featureActions';
import {UIAction} from '../ui/UIAction';
import {FunctionControl} from '../ui/UIWorkspace';
import {useState} from 'react';
import {MathematicalDial} from '../ui/MathematicalDial';
import {SQUARE_PATH_RULE,appendPathDirection,startPathSequence,readPathRule,type PathRule} from './pathRule';
import './pathRule.css';
const directionLabel=(angle:number)=>({0:'↑',45:'↗',90:'→',135:'↘',180:'↓',225:'↙',270:'←',315:'↖'}[angle]??`${Number(angle.toFixed(2))}°`);
/** Program authoring is rule configuration, not a reference/value selection. */
export function PathRuleEditor({value,onCommit}:{value:string;onCommit:(value:string)=>void}){
 const rule=readPathRule(value),[selected,setSelected]=useState(0),[number,setNumber]=useState<'steps'|'m'|'p'|'r'|'f'|null>(null),[turn,setTurn]=useState(false),[replace,setReplace]=useState(false);
 const [hover,setHover]=useState<number|null>(null);
 const field=createStateField({min:0,max:360,resolution:1,cyclic:{period:360,north:0},projection:'radial',thresholds:[0,90,180,270].map(value=>({id:`axis-${value}`,value}))},{mode:'symmetry',count:rule.f??8,step:45,reference:0});
 const active=Math.min(selected,rule.s.length-1);
 const write=(patch:Partial<PathRule>)=>{const next=JSON.stringify({...rule,...patch});if(next.length<=512){readPathRule(next);onCommit(next);}};
 const pick=(angle:number)=>{
  if(turn){write({t:angle});setTurn(false);return;}
  if(replace){onCommit(JSON.stringify(startPathSequence(rule,angle)));setSelected(0);setNumber('steps');setReplace(false);return;}
  if(rule.s.length>=8)return;
  setSelected(rule.s.length);onCommit(JSON.stringify(appendPathDirection(rule,angle)));setNumber('steps');
 };
 const amount=number==='steps'?(rule.s[active]?.[1]??1):number?(rule[number]??8):1;
 const button=(label:string,icon:string,pressed:boolean,run:()=>void)=><button type="button" title={label} aria-label={label} aria-pressed={pressed} onClick={run}>{icon}</button>;
 return <div className="path-rule-editor" data-popup-drag-frame>
  <DofAxisWheel field={field} value={hover??(turn?rule.t:rule.s[active]?.[0]??0)} label={turn?'Turn':'Direction'} symbol={turn?'↻':'↑'} disabled={!turn&&!replace&&rule.s.length>=8} selection="accumulate" onPreview={setHover} onCancel={()=>setHover(null)} onCommit={pick} onConfigure={()=>setNumber('f')}/>
  <div className="path-rule-tools"><button type="button" title="Direction fractions" aria-label="Direction fractions" onClick={()=>setNumber(number==='f'?null:'f')}><DofRuleExpression count={rule.f??8}/></button><button type="button" disabled={!rule.s.length} title="Instruction steps" aria-label="Instruction steps" onClick={()=>setNumber(number==='steps'?null:'steps')}>{rule.s[active]?.[1]??1}</button></div>
  <div className="path-instructions" role="group" aria-label="Instruction order">{rule.s.map(([angle,steps],i)=><button key={i} type="button" aria-label={`Instruction ${i+1}: ${directionLabel(angle)}, ${steps} units`} aria-pressed={active===i} onClick={()=>{setSelected(i);setNumber('steps');}}><sup>{i+1}</sup>{directionLabel(angle)}{steps}</button>)}</div>
  <div className="path-rule-tools">
   {button('Start a new direction sequence','＋',replace,()=>{setReplace(!replace);setTurn(false);setNumber(null);})}
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
  {number&&<MathematicalDial key={`${number}:${active}`} label={number==='steps'?'Whole-unit steps':number==='f'?'Direction fractions':number==='m'?'Maximum unit moves':number==='p'?'Coverage per pass (%)':'Unit moves per second'} value={amount} min={1} max={number==='f'?64:number==='m'?10000:number==='r'?60:100} integer onCommit={n=>{if(number==='steps')write({s:rule.s.map((s,i)=>i===active?[s[0],n]:s)});else write({[number]:n});}}/>}
 </div>;
}
