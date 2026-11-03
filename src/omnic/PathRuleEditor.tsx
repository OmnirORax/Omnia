import {DofAxisWheel} from '../ui/DofAxisWheel';
import {createStateField,axisFraction} from '../properties/stateField';
import {DofRuleExpression} from '../ui/DofInformation';
import '../ui/dofStateField.css';
import {useFeatureActions} from '../ui/useFeatureActions';
import {featureActionRuntime} from '../featureActions';
import {UIAction} from '../ui/UIAction';
import {FunctionControl} from '../ui/UIWorkspace';
import {useState,useEffect,useRef} from 'react';
import {MathematicalDial} from '../ui/MathematicalDial';
import {SQUARE_PATH_RULE,swapPathInstructions,reorderPathInstruction,removePathInstruction,appendPathDirection,startPathSequence,readPathRule,type PathRule} from './pathRule';
import './pathRule.css';

/** Program authoring is rule configuration, not a reference/value selection. */
export function PathRuleEditor({value,onCommit}:{value:string;onCommit:(value:string)=>void}){
 const root=useRef<HTMLDivElement>(null);
 const rule=readPathRule(value),[selected,setSelected]=useState(0),[number,setNumber]=useState<'steps'|'m'|'p'|'r'|'f'|'b'|null>(null),[turn,setTurn]=useState(false),[replace,setReplace]=useState(false);
 const [swapFrom,setSwapFrom]=useState<number|null>(null);
 const [dragCount,setDragCount]=useState<number|undefined>();
 const [hover,setHover]=useState<number|null>(null);
 const field=createStateField({min:0,max:360,resolution:1,cyclic:{period:360,north:0},projection:'radial',thresholds:[...[0,90,180,270].map(value=>({id:`axis-${value}`,value})),...rule.s.map(([value],i)=>({id:`instruction-${i}`,value}))]},{mode:'symmetry',count:rule.f??8,step:45,reference:0});
 const directionLabel=(angle:number)=>{const f=axisFraction(field,angle);return `${f.index}/${f.total}`;};
 const active=Math.min(selected,rule.s.length-1);
 const write=(patch:Partial<PathRule>)=>{const next=JSON.stringify({...rule,...patch});if(next.length<=2048){readPathRule(next);onCommit(next);}};
 const pick=(angle:number,count=1)=>{
  if(turn){write({t:angle});setTurn(false);return;}
  if(replace){onCommit(JSON.stringify(startPathSequence(rule,angle,count)));setSelected(0);setNumber('steps');setReplace(false);return;}
  if(rule.s.length>=32)return;
  setSelected(rule.s.length);onCommit(JSON.stringify(appendPathDirection(rule,angle,count)));setNumber('steps');
 };
 const remove=(index:number)=>{if(index<0||index>=rule.s.length)return;onCommit(JSON.stringify(removePathInstruction(rule,index)));setSelected(Math.max(0,index-1));setNumber(null);setHover(null);setDragCount(undefined);setSwapFrom(null);};
 const swap=(index:number)=>{if(swapFrom===null)return;onCommit(JSON.stringify(swapPathInstructions(rule,swapFrom,index)));setSelected(index);setSwapFrom(null);setNumber(null);};
 const commands=useFeatureActions('omnicPath',{'path.removeInstruction':{enabled:active>=0,run:()=>remove(active)}});
 useEffect(()=>{const key=(event:KeyboardEvent)=>{if(commands.handle(event)){event.preventDefault();event.stopImmediatePropagation();}};window.addEventListener('keydown',key,true);return()=>window.removeEventListener('keydown',key,true);},[]);
 const nextInstruction=()=>{setNumber(null);setSelected(-1);setHover(null);setDragCount(undefined);setTurn(false);setReplace(false);setSwapFrom(null);};
 const amount=number==='steps'?(rule.s[active]?.[1]??1):number?(rule[number]??8):1;
 const button=(label:string,icon:string,pressed:boolean,run:()=>void)=><button type="button" title={label} aria-label={label} aria-pressed={pressed} onClick={run}>{icon}</button>;
 return <div ref={root} className="path-rule-editor" data-popup-drag-frame>
  <DofAxisWheel field={field} value={hover??(turn?rule.t:rule.s[active]?.[0]??0)} label={turn?'Turn':'Direction'} symbol={turn?'↻':'↑'} disabled={false} selection="accumulate" selectedValue={turn?rule.t:rule.s[active]?.[0]??NaN} axisCounts={rule.s.map(([angle,count],i)=>({angle,steps:count,order:i+1,selected:i===active,count:Math.ceil(count/(rule.b??1)),total:Math.max(rule.f??8,Math.ceil(count/(rule.b??1)))}))} onPreview={setHover} onCancel={()=>setHover(null)} countDrag={turn?undefined:{unit:rule.b??1,active:dragCount!==undefined,max:(rule.f??8)*(rule.b??1),total:rule.f??8,value:dragCount??rule.s[active]?.[1],onPreview:(angle,count)=>{setHover(angle);setDragCount(count);},onCancel:()=>setDragCount(undefined),dropTarget:point=>{const target=document.elementFromPoint(point.x,point.y)?.closest('[data-path-order]');if(!target||!root.current?.contains(target))return;return Number(target.getAttribute('data-path-order'));},onReorder:(from,to)=>{onCommit(JSON.stringify(reorderPathInstruction(rule,from-1,to-1)));setSelected(to-1);setNumber(null);setHover(null);},onEditStart:order=>{if(swapFrom!==null){swap(order-1);return false;}setSelected(order-1);setNumber(null);},onEditCommit:(order,count,angle)=>{if(rule.s[order-1]?.[1]!==count||rule.s[order-1]?.[0]!==angle)write({s:rule.s.map((s,i)=>i===order-1?[angle,count]:s)});},onCommit:pick}} onCommit={pick} onConfigure={()=>setNumber('f')}/>
  <div className="path-rule-tools"><button type="button" title="Direction fractions" aria-label="Direction fractions" onClick={()=>setNumber(number==='f'?null:'f')}><DofRuleExpression count={rule.f??8}/></button><button type="button" title="Steps per drag increment" aria-label="Steps per drag increment" onClick={()=>setNumber(number==='b'?null:'b')}>×<DofRuleExpression count={rule.b??1}/></button><button type="button" disabled={active<0} title="Instruction steps" aria-label="Instruction steps" aria-pressed={number==='steps'||dragCount!==undefined} onClick={()=>setNumber(number==='steps'?null:'steps')}>{dragCount??rule.s[active]?.[1]??1}</button></div>
  <div className="path-instructions" role="group" aria-label="Instruction order">{rule.s.map(([angle,steps],i)=><button key={i} type="button" data-path-order={i+1} aria-label={`Instruction ${i+1}: ${directionLabel(angle)}, ${steps} units`} aria-pressed={active===i} title={`Instruction ${i+1} · ${steps} steps · right-click removes`} onContextMenu={event=>{event.preventDefault();event.stopPropagation();remove(i);}} onClick={()=>{if(swapFrom!==null){swap(i);return;}setSelected(i);setNumber('steps');}}><sup>{i+1}</sup>{directionLabel(angle)}<span>×{steps}</span></button>)}</div>
  <div className="path-rule-tools">
   {button('Swap selected instruction with another','⇄',swapFrom!==null,()=>{if(active>=0){setSwapFrom(swapFrom===null?active:null);setNumber(null);}})}
   {button('Next instruction','→＋',active<0,nextInstruction)}
   {button('Start a new direction sequence','＋',replace,()=>{setReplace(!replace);setTurn(false);setNumber(null);setSwapFrom(null);})}
   {button('Remove selected instruction','⌫',false,()=>remove(active))}
   {button('Turn after each instruction',`↻${directionLabel(rule.t)}`,turn,()=>{setTurn(!turn);setReplace(false);setSwapFrom(null);})}
   {button('Loop instruction sequence','⟳',rule.l,()=>write({l:!rule.l}))}
   {button('Stop at origin after a complete sequence','⊙',rule.c,()=>write({c:!rule.c}))}
   {button(rule.a?'Drawing mode':'Fixed generation','▶',rule.a,()=>write({a:!rule.a}))}
   {button(rule.d?'Separate marks':'Connected trace',rule.d?'⠒':'━',rule.d,()=>write({d:!rule.d}))}
  </div>
  <div className="path-rule-tools">
   {button('Fixed generation maximum unit moves',`≤${rule.m}`,number==='m',()=>setNumber(number==='m'?null:'m'))}
   {button('Additive coverage per pass',`${rule.p}%`,number==='p',()=>setNumber(number==='p'?null:'p'))}
   {rule.a&&<><UIAction id="omnic:path-play" label="Play / pause drawing" symbol="⏯" category="Omnic" registerOnly onClick={()=>featureActionRuntime.invoke('omnic.play')}/><FunctionControl id="omnic:path-play" mirror symbol="⏯" tooltip="Play / pause drawing; replay after completion"/></>}
   {button('Drawing speed · unit moves per second',`${rule.r}/s`,number==='r',()=>setNumber(number==='r'?null:'r'))}
   {button('Reset square rule','↺',false,()=>{onCommit(JSON.stringify(SQUARE_PATH_RULE));setSelected(0);setNumber(null);setTurn(false);setReplace(false);setSwapFrom(null);})}
  </div>
  {number&&<MathematicalDial key={`${number}:${active}`} label={number==='b'?'Steps per drag increment':number==='steps'?'Whole-unit steps':number==='f'?'Direction fractions':number==='m'?'Maximum unit moves':number==='p'?'Coverage per pass (%)':'Unit moves per second'} value={amount} min={1} max={number==='f'?64:number==='m'?10000:number==='r'?60:number==='steps'?10000:100} integer onCommit={n=>{if(number==='steps')write({s:rule.s.map((s,i)=>i===active?[s[0],n]:s)});else write({[number]:n});}}/>}
 </div>;
}
