import {DofAxisWheel} from '../ui/DofAxisWheel';
import {createStateField} from '../properties/stateField';
import {DofRuleExpression} from '../ui/DofInformation';
import '../ui/dofStateField.css';
import {useFeatureActions} from '../ui/useFeatureActions';
import {featureActionRuntime} from '../featureActions';
import {UIAction} from '../ui/UIAction';
import {FunctionControl} from '../ui/UIWorkspace';
import {useState,useEffect} from 'react';
import {MathematicalDial} from '../ui/MathematicalDial';
import {SQUARE_PATH_RULE,removePathInstruction,appendPathDirection,startPathSequence,readPathRule,type PathRule} from './pathRule';
import './pathRule.css';
const directionLabel=(angle:number)=>({0:'↑',45:'↗',90:'→',135:'↘',180:'↓',225:'↙',270:'←',315:'↖'}[angle]??`${Number(angle.toFixed(2))}°`);
/** Program authoring is rule configuration, not a reference/value selection. */
export function PathRuleEditor({value,onCommit}:{value:string;onCommit:(value:string)=>void}){
 const rule=readPathRule(value),[selected,setSelected]=useState(0),[number,setNumber]=useState<'steps'|'m'|'p'|'r'|'f'|'b'|null>(null),[turn,setTurn]=useState(false),[replace,setReplace]=useState(false);
 const [dragCount,setDragCount]=useState<number|undefined>();
 const [hover,setHover]=useState<number|null>(null);
 const field=createStateField({min:0,max:360,resolution:1,cyclic:{period:360,north:0},projection:'radial',thresholds:[...[0,90,180,270].map(value=>({id:`axis-${value}`,value})),...rule.s.map(([value],i)=>({id:`instruction-${i}`,value}))]},{mode:'symmetry',count:rule.f??8,step:45,reference:0});
 const active=Math.min(selected,rule.s.length-1);
 const write=(patch:Partial<PathRule>)=>{const next=JSON.stringify({...rule,...patch});if(next.length<=2048){readPathRule(next);onCommit(next);}};
 const pick=(angle:number,count=1)=>{
  if(turn){write({t:angle});setTurn(false);return;}
  if(replace){onCommit(JSON.stringify(startPathSequence(rule,angle,count)));setSelected(0);setNumber('steps');setReplace(false);return;}
  if(rule.s.length>=32)return;
  setSelected(rule.s.length);onCommit(JSON.stringify(appendPathDirection(rule,angle,count)));setNumber('steps');
 };
 const remove=(index:number)=>{if(index<0||index>=rule.s.length)return;onCommit(JSON.stringify(removePathInstruction(rule,index)));setSelected(Math.max(0,index-1));setNumber(null);setHover(null);setDragCount(undefined);};
 const commands=useFeatureActions('omnicPath',{'path.removeInstruction':{enabled:active>=0,run:()=>remove(active)}});
 useEffect(()=>{const key=(event:KeyboardEvent)=>{if(commands.handle(event)){event.preventDefault();event.stopImmediatePropagation();}};window.addEventListener('keydown',key,true);return()=>window.removeEventListener('keydown',key,true);},[]);
 const nextInstruction=()=>{setNumber(null);setSelected(-1);setHover(null);setDragCount(undefined);setTurn(false);setReplace(false);};
 const amount=number==='steps'?(rule.s[active]?.[1]??1):number?(rule[number]??8):1;
 const button=(label:string,icon:string,pressed:boolean,run:()=>void)=><button type="button" title={label} aria-label={label} aria-pressed={pressed} onClick={run}>{icon}</button>;
 return <div className="path-rule-editor" data-popup-drag-frame>
  <DofAxisWheel field={field} value={hover??(turn?rule.t:rule.s[active]?.[0]??0)} label={turn?'Turn':'Direction'} symbol={turn?'↻':'↑'} disabled={!turn&&!replace&&rule.s.length>=32} selection="accumulate" selectedValue={turn?rule.t:rule.s[active]?.[0]??NaN} axisCounts={rule.s.map(([angle,count])=>({angle,count:Math.ceil(count/(rule.b??1)),total:Math.max(rule.f??8,Math.ceil(count/(rule.b??1)))}))} onPreview={setHover} onCancel={()=>setHover(null)} countDrag={turn?undefined:{unit:rule.b??1,active:dragCount!==undefined,max:(rule.f??8)*(rule.b??1),total:rule.f??8,value:dragCount??rule.s[active]?.[1],onPreview:(angle,count)=>{setHover(angle);setDragCount(count);},onCancel:()=>setDragCount(undefined),onCommit:pick}} onCommit={pick} onConfigure={()=>setNumber('f')}/>
  <div className="path-rule-tools"><button type="button" title="Direction fractions" aria-label="Direction fractions" onClick={()=>setNumber(number==='f'?null:'f')}><DofRuleExpression count={rule.f??8}/></button><button type="button" title="Steps per drag increment" aria-label="Steps per drag increment" onClick={()=>setNumber(number==='b'?null:'b')}>×<DofRuleExpression count={rule.b??1}/></button><button type="button" disabled={active<0} title="Instruction steps" aria-label="Instruction steps" aria-pressed={number==='steps'||dragCount!==undefined} onClick={()=>setNumber(number==='steps'?null:'steps')}>{dragCount??rule.s[active]?.[1]??1}</button></div>
  <div className="path-instructions" role="group" aria-label="Instruction order">{rule.s.map(([angle,steps],i)=><button key={i} type="button" aria-label={`Instruction ${i+1}: ${directionLabel(angle)}, ${steps} units`} aria-pressed={active===i} title={`Instruction ${i+1} · ${steps} steps · right-click removes`} onContextMenu={event=>{event.preventDefault();event.stopPropagation();remove(i);}} onClick={()=>{setSelected(i);setNumber('steps');}}><sup>{i+1}</sup>{directionLabel(angle)}{steps}</button>)}</div>
  <div className="path-rule-tools">
   {button('Next instruction','→＋',active<0,nextInstruction)}
   {button('Start a new direction sequence','＋',replace,()=>{setReplace(!replace);setTurn(false);setNumber(null);})}
   {button('Remove selected instruction','⌫',false,()=>remove(active))}
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
  {number&&<MathematicalDial key={`${number}:${active}`} label={number==='b'?'Steps per drag increment':number==='steps'?'Whole-unit steps':number==='f'?'Direction fractions':number==='m'?'Maximum unit moves':number==='p'?'Coverage per pass (%)':'Unit moves per second'} value={amount} min={1} max={number==='f'?64:number==='m'?10000:number==='r'?60:number==='steps'?10000:100} integer onCommit={n=>{if(number==='steps')write({s:rule.s.map((s,i)=>i===active?[s[0],n]:s)});else write({[number]:n});}}/>}
 </div>;
}
