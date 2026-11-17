import {showMathCursorReadout,clearMathCursorReadout} from '../../../ui/mathCursorReadout.ts';
import type {ConfirmedMathValue} from '../../../ui/operationNumber.ts';
import {reportSystemMessage} from '../../../ui/systemMessage.ts';
import {DialSlot,dialRingSlots} from './DialSlots.tsx';
import {useNavigationState} from '../../../ui/useNavigationState.tsx';
import {useHoverPreview} from './HoverPreview';
import {useValueDrag} from './useValueDrag.ts';
import {useValueConfirmation} from './useValueConfirmation';
import {type ReactNode,useId,useLayoutEffect,useEffect,useMemo,useRef,useState} from 'react';
import {radialDimensions,RADIAL_GEOMETRY} from './radialMenuModel';
import {mathematicalSlotScrub,mathematicalEmptyValue,mathematicalSlotValue,mathematicalNumberValue,mathematicalEditValue,mathematicalValueAllowed,mathematicalValueSession,radialSlotCapacity,mathematicalLimitsRejection,mathematicalScaleValue,mathematicalScaleMaximum,mathematicalScaleRejection,mathematicalValueRejection,mathematicalRingOrders,type MathematicalScaleMode,fillMathematicalSlots,paintMathematicalSlots,type MathematicalMarks,type MathematicalStrokeSlot,type MathematicalSlotMode} from '../properties/mathematicalDial.ts';
import './mathematicalDial.css';
import {useContextNavigation} from './ContextStage';
import {ContextualMasterController} from './ContextualMasterController';
import {useCancelValueEdit} from './ActiveContext';
import {cursorPosition} from './cursorPosition';
import {claimUIPress,ownsPointerSurface} from './pointerOwnership';
import {useToolCursor} from './toolCursor';
import {setToolCursorZone} from './toolCursorZone';
import {RadialMenu} from './RadialMenu';

const emptyMarks=():MathematicalMarks=>({selected:[],modes:{}});
type Point={x:number;y:number};
type Stroke={erase:boolean;id:number;last:Point;slots:MathematicalStrokeSlot[];visited:readonly string[];before:MathematicalMarks;next:MathematicalMarks;brush:MathematicalSlotMode;accepted?:boolean};
/** Shared raw-number surface. The consumer supplies its domain and real setters.
 * Left-click paints normal values; right-click applies recursion directly. */
export function MathematicalDial({value,min,max,integer=false,label='Value',disabled=false,configure=false,editing,rule,onPreview=()=>{},onCommit,onCancelPreview,onReject=reportSystemMessage,onConfigurationCommit,readoutOwner,keyboardInput=false,limits,modeControl,formatValue=(n:number)=>String(n)}:{
 modeControl?:ReactNode;formatValue?:(value:number)=>string;value:number;min:number;max:number;integer?:boolean;label?:string;disabled?:boolean;configure?:boolean;
 rule?:{value:string;choices:readonly {id:string;label:string;icon:string}[];onChange:(id:string)=>void};
 editing?:{kind:'value'|'increment';amount:number;minimum:number;maximum:number;onKindChange:(kind:'value'|'increment')=>void;onAmountChange:(amount:number)=>void};
 limits?:{label:string;min:number;max:number;hardMin:number;hardMax:number;integer?:boolean;change:(which:'min'|'max',value:number)=>void|boolean};readoutOwner?:string;keyboardInput?:boolean;onConfigurationCommit?:(config:ConfirmedMathValue)=>void;onReject?:(message:string)=>void;onPreview?:(value:number)=>void;onCommit:(value:number)=>void;onCancelPreview?:()=>void;
}){

 const localReadout=useId(),typedExact=useRef(false),[exactKind,setExactKind]=useState<'value'|'min'|'max'>('value');
 const [base,setBase]=useState<1|2>(2),[scaling,setScaling]=useState<MathematicalScaleMode>('value'),[scaleCount,setScaleCount]=useState(0),scaleAnchor=useRef(value),valueBase=useRef<1|2>(2);
 const readoutDrag=useValueDrag({value,min,max,step:integer?1:undefined,disabled:disabled||scaling!=='value'},n=>previewValue(n),n=>commit(emptyMarks(),n,0),()=>restore());
 const clockwise=true;
 const brush:MathematicalSlotMode='normal';
 const [sign,setSign]=useState<1|-1>(()=>editing?.kind==='increment'?1:value<0?-1:1),[painting,setPainting]=useState(false);
 const [marks,setMarks]=useState<MathematicalMarks>(emptyMarks),[sample,setSample]=useState<MathematicalMarks|null>(null);
 const [session]=useState(()=>mathematicalValueSession(value)),anchor=useRef(value);
 const [rulePopup,setRulePopup]=useNavigationState<{point:Point;stage:'modes'|'amount'}|null>(`${label}:dial-rule`,()=>configure&&editing?{point:cursorPosition(),stage:'modes'}:null);
 const [amountSample,setAmountSample]=useState<number|null>(null);
 const [exactPoint,setExactPoint]=useNavigationState<Point|null>(`${label}:dial-exact`,null),[exactText,setExactText]=useState(''),textInput=useRef<HTMLInputElement>(null),textFinished=useRef(false);
 const exact=exactPoint?{point:exactPoint,text:exactText}:null;
 const setExact=(next:{point:Point;text:string}|null)=>{setExactPoint(next?.point??null);if(next)setExactText(next.text);};

 const ruleChoices=useRef<HTMLDivElement>(null);
 const ringRef=useRef<HTMLDivElement>(null),zone=useId(),drag=useRef<Stroke|null>(null),suppressClick=useRef(false);
 const hover=useRef<{key:string;brush:MathematicalSlotMode;marks:MathematicalMarks}|null>(null);
 const callbacks=useRef({onPreview,onCancelPreview});callbacks.current={onPreview,onCancelPreview};
 const owns=(target:EventTarget|null,current:HTMLElement)=>ownsPointerSurface(current,target instanceof Element?target:null,'.mathematical-dial');
 useLayoutEffect(()=>{
  if(session.receive(value)){horizontal?.release(horizontalOwner.current);anchor.current=value;scaleAnchor.current=value;setScaleCount(0);drag.current=null;hover.current=null;setPainting(false);setSample(null);setMarks(emptyMarks());setSign(editing?.kind==='increment'?1:value<0?-1:1);}
 },[value,marks,sample,session]);
 useEffect(()=>()=>{
  if(session.sampling){const previous=session.restore();if(callbacks.current.onCancelPreview)callbacks.current.onCancelPreview();else callbacks.current.onPreview(previous);}
 },[session]);
 useLayoutEffect(()=>{const node=ringRef.current;if(!node)return;setToolCursorZone(node,zone,true);return()=>setToolCursorZone(node,undefined);},[zone]);
 const cursor=useMemo(()=>({key:`math:${brush}`,zone,priority:40,icon:<span>{brush==='normal'?'●':'◎'}</span>,className:'mathematical-dial-cursor',width:12,height:12}),[brush,zone]);
 useToolCursor(disabled?null:cursor);
 const orders=mathematicalRingOrders(marks.selected);
 const minimum=radialDimensions(2,6,0,base*RADIAL_GEOMETRY.minimumSize);
 const rings=Array.from({length:orders},(_,order)=>{const radius=minimum.radius+order*minimum.size;return {order,radius,count:radialSlotCapacity(radius,minimum.size)};});
 const extent=2*(rings[orders-1].radius+minimum.size/2+1),displayed=painting?(sample??marks):marks;
 const modeAt=(state:MathematicalMarks,key:string)=>state.modes[key]??'normal';
 const numeral=(state:MathematicalMarks,nextBase=base,nextSign=sign)=>mathematicalNumberValue(nextBase,state.selected.map(key=>({key,ordinal:Number(key.split(':')[1])+1,mode:modeAt(state,key)})),nextSign);
 const baseTotal=(state:MathematicalMarks,nextBase=base,nextSign=sign)=>{const n=mathematicalEditValue({anchor:anchor.current,index:numeral(state,nextBase,nextSign),rule:editing?.kind==='increment'?{kind:'increment',amount:editing.amount}:{kind:'value'}});return state.selected.length?n:mathematicalEmptyValue(n,{min,max,integer});};
 const scaleMaximum=scaling==='value'?undefined:mathematicalScaleMaximum(scaleAnchor.current,scaling,{min,max,integer});
 const countOf=(state:MathematicalMarks,nextBase=base)=>Math.abs(numeral(state,nextBase,1));
 const total=(state:MathematicalMarks,nextBase=base,nextSign=sign)=>scaling==='value'?baseTotal(state,nextBase,nextSign):mathematicalScaleValue(scaleAnchor.current,countOf(state,nextBase),scaling);
 const valid=(n:number)=>mathematicalValueAllowed(n,{min,max,integer});
 const reject=(n:number,count?:number)=>onReject(`${label}: ${scaling!=='value'&&count!==undefined?mathematicalScaleRejection(scaleAnchor.current,count,scaling,{min,max,integer})??'Value is unavailable.':mathematicalValueRejection(n,{min,max,integer})??'Value is unavailable.'}`);
 const accepted=(n:number,state?:MathematicalMarks)=>valid(n)&&(scaling==='value'||!state||countOf(state)<=(scaleMaximum??0));

 const previewValue=(n:number)=>{if(!session.sampling||session.expected!==n)onPreview(session.preview(n));};
 const restore=()=>{
  if(drag.current)return;
  hover.current=null;setSample(null);
  if(session.sampling){const previous=session.restore();if(onCancelPreview)onCancelPreview();else onPreview(previous);}
 };
 useLayoutEffect(()=>{
  if(!editing)return;
  restore();anchor.current=session.restore();setMarks(emptyMarks());setSign(editing.kind==='increment'?1:value<0?-1:1);
 },[editing?.kind,editing?.amount]);
 const preview=(key:string,nextBrush=brush)=>{
  if(disabled||drag.current)return;
  if(hover.current?.key===key&&hover.current.brush===nextBrush&&hover.current.marks===marks)return;
  hover.current={key,brush:nextBrush,marks};
  const candidate=paintMathematicalSlots(marks,[key],nextBrush,marks.selected.includes(key)),n=total(candidate);
  if(!candidate.selected.length&&!valid(n)){restore();setSample(candidate);}else if(accepted(n,candidate)){setSample(candidate);previewValue(n);}else{setSample(null);if(session.sampling){const previous=session.restore();if(onCancelPreview)onCancelPreview();else onPreview(previous);}}
 };
 const commit=(next:MathematicalMarks,n=total(next),count=countOf(next))=>{
  if(disabled)return;
  if(!next.selected.length&&!valid(n)){restore();anchor.current=session.restore();setMarks(next);return;}
  if(!valid(n)||scaling!=='value'&&count>(scaleMaximum??0)){reject(n,scaling==='value'?undefined:count);return;}
  hover.current=null;setSample(null);setMarks(next);if(scaling!=='value')setScaleCount(count);const configuration={mode:scaling,anchor:scaling==='value'?n:scaleAnchor.current,count:scaling==='value'?0:count,value:n};showMathCursorReadout(readoutOwner??localReadout,label,configuration);onConfigurationCommit?.(configuration);onCommit(session.commit(n));
 };
 const confirm=useValueConfirmation({owner:ringRef,candidate:()=>sample??undefined,onCommit:next=>{drag.current=null;setPainting(false);commit(next);},disabled,keyboard:!!sample});
 const cancel=()=>{setPainting(false);drag.current=null;restore();};
 const horizontal=useHoverPreview(),horizontalOwner=useRef({});
 const horizontalCallbacks=useRef({preview,commit,cancel});horizontalCallbacks.current={preview,commit,cancel};
 useLayoutEffect(()=>{
  if(!horizontal||disabled||configure||ringRef.current?.closest('[data-hover-preview-disabled]'))return;
  const choices=rings.slice(0,orders).flatMap(ring=>Array.from({length:ring.count},(_,i)=>{
   const key=`${ring.order}:${i}`,candidate=paintMathematicalSlots(marks,[key],brush,marks.selected.includes(key)),n=total(candidate);
   return {key,candidate,n};
  })).filter(choice=>accepted(choice.n,choice.candidate));
  if(!choices.length)return;
  const byKey=new Map(choices.map(choice=>[choice.key,choice]));
  const initial=choices.reduce((best,choice,i)=>Math.abs(choice.n-value)<Math.abs(choices[best].n-value)?i:best,0);
  let pick:ReturnType<typeof mathematicalSlotScrub>,current:typeof choices[number]|undefined;
  const owner=horizontalOwner.current;
  horizontal.enter(owner,{start:x=>{pick=mathematicalSlotScrub(choices.map(c=>c.key),x,initial);},move:x=>{
   const key=pick(x);if(!key||key===current?.key)return;
   current=byKey.get(key);if(current){setPainting(true);horizontalCallbacks.current.preview(current.key);}
  },commit:()=>{setPainting(false);if(current)horizontalCallbacks.current.commit(current.candidate,current.n);else horizontalCallbacks.current.commit(marks,session.expected);},cancel:()=>horizontalCallbacks.current.cancel()},cursorPosition().x);
  return()=>horizontal.release(owner);
 },[horizontal,disabled,configure,base,orders,min,max,integer,scaling,scaleMaximum,editing?.kind,editing?.amount]);

 useContextNavigation({owner:ringRef,cancel:painting?cancel:undefined});
 const cancelLatest=useRef(cancel);cancelLatest.current=cancel;
 useEffect(()=>{const stop=()=>{if(drag.current)cancelLatest.current();};window.addEventListener('blur',stop);return()=>window.removeEventListener('blur',stop);},[]);
 const advance=(point:Point)=>{
  const active=drag.current;if(!active)return;
  const visited=fillMathematicalSlots(active.visited,active.slots,active.last,point);active.last=point;
  if(visited===active.visited)return;
  const next=paintMathematicalSlots(active.before,visited,active.brush,active.erase),n=total(next);
  if(accepted(n,next)||!next.selected.length){active.visited=visited;active.next=next;active.accepted=true;if(accepted(n,next)){setSample(next);previewValue(n);}else{restore();setSample(next);}}else{active.visited=visited;reject(n,scaling==='value'?undefined:countOf(next));}
 };
 const changeBase=(next:1|2)=>{
  const g=radialDimensions(2,6,0,next*RADIAL_GEOMETRY.minimumSize);
  if(marks.selected.some(key=>{const [order,index]=key.split(':').map(Number);return index>=radialSlotCapacity(g.radius+order*g.size,g.size);})){onReject('Selected marks do not fit this base.');return;}
  if(marks.selected.length&&!accepted(total(marks,next),marks)){reject(total(marks,next),scaling==='value'?undefined:countOf(marks,next));return;}
  restore();setBase(next);if(marks.selected.length)commit(marks,total(marks,next));
 };
 const changeSign=()=>{
  const next:1|-1=sign===1?-1:1;
  if(editing?.kind==='increment'&&!marks.selected.length){restore();setSign(next);return;}
  const n=marks.selected.length?total(marks,base,next):-session.restore();
  if(!valid(n)){reject(n);return;}
  restore();setSign(next);commit(marks,n===0?0:n);
 };
 const closeExact=()=>{textFinished.current=true;setExact(null);};
 const finishExact=()=>{
  if(!exact||textFinished.current)return;
  const parsed=exact.text.trim()?Number(exact.text):NaN;
  if(exactKind!=='value'&&limits){const next={min:limits.min,max:limits.max,[exactKind]:parsed},reason=mathematicalLimitsRejection(next.min,next.max,{min:limits.hardMin,max:limits.hardMax,integer:limits.integer});if(reason){onReject(`${limits.label}: ${reason}`);return;}if(limits.change(exactKind,parsed)===false)return;textFinished.current=true;setExact(null);return;}
  const result=scaling==='value'?parsed:mathematicalScaleValue(scaleAnchor.current,parsed,scaling);
  if(!valid(result)||scaling!=='value'&&(!Number.isSafeInteger(parsed)||parsed<0||parsed>(scaleMaximum??0))){reject(result,parsed);return;}
  textFinished.current=true;setExact(null);if(scaling==='value')anchor.current=parsed;else setScaleCount(parsed);setSign(editing?.kind==='increment'?1:result<0?-1:1);commit(emptyMarks(),result,scaling==='value'?0:parsed);
 };
 useCancelValueEdit(textInput,closeExact,!!exact);
 const openExact=()=>{setExactKind('value');typedExact.current=false;restore();textFinished.current=false;setExact({point:cursorPosition(),text:String(scaling==='value'?session.restore():scaleCount)});};
 useEffect(()=>()=>{if(!readoutOwner)clearMathCursorReadout(localReadout);},[readoutOwner,localReadout]);
 useEffect(()=>{if(!keyboardInput)return;const key=(event:KeyboardEvent)=>{if(disabled||!/^\d$/.test(event.key)||event.ctrlKey||event.metaKey||event.altKey||event.target instanceof Element&&event.target.closest('input,textarea,select,[contenteditable]'))return;event.preventDefault();event.stopImmediatePropagation();restore();setExactKind('value');typedExact.current=true;textFinished.current=false;setExact({point:cursorPosition(),text:event.key});};window.addEventListener('keydown',key,true);return()=>window.removeEventListener('keydown',key,true);},[keyboardInput,disabled]);
 const changeScaling=(next:MathematicalScaleMode)=>{
  restore();horizontal?.release(horizontalOwner.current);drag.current=null;setPainting(false);setMarks(emptyMarks());setScaleCount(0);
  if(next==='value'){setBase(valueBase.current);}else{if(scaling==='value')valueBase.current=base;scaleAnchor.current=session.restore();setBase(1);setSign(1);}setScaling(next);
 };
 return <div data-ui-popup-interior className="mathematical-dial" style={{width:extent,height:extent}} title={`${label}: ${value} (${min}–${max})`} role="group" aria-label={`⠒❉ · ${label}`} aria-disabled={disabled} onMouseLeave={()=>{if(!horizontal?.owns(horizontalOwner.current))restore();}}
  onPointerDownCapture={event=>{
   if(!owns(event.target,event.currentTarget))return;
   suppressClick.current=false;
   if(disabled||event.button!==0||!(event.target instanceof Element)||!event.target.closest('[data-math-slot]'))return;
   const bounds=ringRef.current!.getBoundingClientRect(),scale=bounds.width/extent,point={x:event.clientX,y:event.clientY};
   const slots=rings.flatMap(({order,radius,count})=>dialRingSlots(order,radius,count,minimum.size,extent,clockwise).map(slot=>({key:slot.key,x:bounds.left+bounds.width/2+slot.x*scale,y:bounds.top+bounds.height/2+slot.y*scale,radius:slot.size*scale/2})));
   setPainting(true);drag.current={erase:marks.selected.includes(event.target.closest<HTMLElement>('[data-math-slot]')!.dataset.mathSlot!),id:event.pointerId,last:point,slots,visited:[],before:marks,next:marks,brush};hover.current=null;advance(point);
   claimUIPress(event.pointerId,event.pointerType,event.buttons);event.preventDefault();event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId);
  }}
  onPointerMove={event=>{
   if(!owns(event.target,event.currentTarget))return;
   if(drag.current){if(drag.current.id===event.pointerId){event.stopPropagation();advance({x:event.clientX,y:event.clientY});}return;}
   if(horizontal?.owns(horizontalOwner.current))return;
   const slot=event.target instanceof Element?event.target.closest<HTMLElement>('[data-math-slot]'):null;if(slot)preview(slot.dataset.mathSlot!);
  }}
  onPointerUp={event=>{
   const active=drag.current;if(!active||active.id!==event.pointerId)return;
   event.preventDefault();event.stopPropagation();advance({x:event.clientX,y:event.clientY});setPainting(false);drag.current=null;suppressClick.current=true;
   if(active.visited.length&&active.accepted)confirm(active.next);else restore();
   if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  }}
  onPointerCancel={cancel} onLostPointerCapture={()=>{if(drag.current)cancel();}}
  onClickCapture={event=>{if(!owns(event.target,event.currentTarget))return;if(suppressClick.current&&event.detail>0){suppressClick.current=false;event.preventDefault();event.stopPropagation();}}}>
  <div ref={ringRef} className="mathematical-dial-ring" style={{width:extent,height:extent}} onContextMenu={event=>{
   event.preventDefault();event.stopPropagation();if(disabled||drag.current)return;
   const slot=event.target instanceof Element?event.target.closest<HTMLElement>('[data-math-slot]'):null;
   if(slot&&ringRef.current?.contains(slot)){const key=slot.dataset.mathSlot!,erase=marks.selected.includes(key)&&modeAt(marks,key)==='recursion';const next=paintMathematicalSlots(marks,[key],'recursion',erase);commit(next);}
  }}>
   <button type="button" disabled={disabled} className="mathematical-dial-base" aria-label={`Base ${base}; change base`} title={`Base ${base} · click to switch base`} onClick={()=>changeBase(base===1?2:1)} style={{width:base*minimum.size,height:base*minimum.size}}>{Array.from({length:base},(_,i)=><i key={i} style={{width:minimum.size,height:minimum.size}}/>)}</button>
   {rings.map(({order,radius,count})=><span key={order} className="mathematical-dial-order" role="group" aria-label={`Ring ${order+1}, ${count} slots`}>
    <svg className="mathematical-dial-hover-band" width={extent} height={extent} aria-hidden="true"><circle cx={extent/2} cy={extent/2} r={radius} fill="none" stroke="transparent" strokeWidth={minimum.size}/></svg>
    {order<orders&&<><span className="mathematical-dial-start-arrow" aria-hidden="true" style={{left:'50%',top:`${50-(radius+minimum.size/2)/extent*100}%`}}>{clockwise?'↻':'↺'}</span><span className="mathematical-dial-order-rim" aria-hidden="true" style={{width:2*(radius+minimum.size/2+1),height:2*(radius+minimum.size/2+1)}}/></>}
    {dialRingSlots(order,radius,count,minimum.size,extent,clockwise).map(slot=>{const i=slot.index;
     const key=`${order}:${i}`,mode=modeAt(displayed,key);
     const candidate=paintMathematicalSlots(marks,[key],brush,marks.selected.includes(key)),n=total(candidate),contribution=sign*mathematicalSlotValue(base,i+1,brush);
     return <DialSlot slot={slot} selected={displayed.selected.includes(key)} key={key} disabled={disabled} data-ui-paint-owner="geometry" data-math-slot={key} data-mode={mode} data-selected={displayed.selected.includes(key)} preview={!!sample&&displayed.selected.includes(key)&&(!marks.selected.includes(key)||modeAt(marks,key)!==mode)}
      aria-label={`Ring ${order+1}, slot ${i+1}, brush ${brush}, contribution ${contribution}`} aria-pressed={marks.selected.includes(key)} aria-disabled={candidate.selected.length>0&&!accepted(n,candidate)} title={`Slot ${i+1} · ${sign<0?'−':''}${brush==='normal'?`${base}×${i+1}`:`${base}^${i+2}`} = ${contribution} · ${editing?.kind==='increment'?`${anchor.current} + (${numeral(candidate)} × ${editing.amount}) = `:''}${n} · right-click applies recursion`}
      onMouseEnter={()=>preview(key)} onMouseLeave={()=>{if(!horizontal?.owns(horizontalOwner.current))restore();}} onFocus={()=>preview(key)} onBlur={restore} onClick={event=>{if(event.detail===0)confirm(candidate);}}><span className="mathematical-dial-mark" aria-hidden="true">{mode==='recursion'&&<svg viewBox="0 0 20 20" width="100%" height="100%"><circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="1.5"/><circle cx="10" cy="10" r="4" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg>}</span></DialSlot>;
    })}
   </span>)}
  </div>
  <div className="mathematical-dial-meta">
   <div className="mathematical-dial-settings mathematical-dial-arithmetic" role="group" aria-label="Number mode">{(['value','halving','doubling'] as const).map(kind=><button key={kind} type="button" disabled={disabled||kind!=='value'&&(!Number.isFinite(session.expected)||session.expected===0)} aria-label={kind==='value'?'Set value':kind==='halving'?'Halve starting value':'Double starting value'} aria-pressed={scaling===kind} onClick={()=>changeScaling(scaling===kind&&kind!=='value'?'value':kind)}>{kind==='value'?'=':kind==='halving'?'/2':'×2'}</button>)}</div>
   {limits&&<div className="mathematical-dial-settings mathematical-dial-limits" role="group" aria-label={`${limits.label} limits`}>{(['min','max'] as const).map(kind=><button key={kind} type="button" disabled={disabled} aria-label={`Set ${limits.label} ${kind==='min'?'minimum':'maximum'}`} onClick={()=>{restore();typedExact.current=false;textFinished.current=false;setExactKind(kind);setExact({point:cursorPosition(),text:String(limits[kind])});}}>{kind==='min'?'⊢':'⊣'}{limits[kind]}</button>)}</div>}
   <div className="mathematical-dial-result">
   <button ref={readoutDrag.ref} type="button" disabled={disabled} className="mathematical-dial-readout" aria-label={`${label} value: ${value}`} title={`${label} · ${value} · click or right-click to type an exact value`} onClick={openExact} onContextMenu={event=>{event.preventDefault();event.stopPropagation();openExact();}}><output aria-live="polite">{sample?`Preview: ${formatValue(total(sample))}`:formatValue(readoutDrag.value)}</output></button>
   <output className="mathematical-dial-maximum" aria-label="Maximum value">{scaling==='value'?`max ${max}`:`${scaleAnchor.current} · max ${scaleMaximum}`}</output>
   </div>
   <div className="mathematical-dial-operation">
    {modeControl}
   {rule&&<div className="mathematical-dial-settings" role="group" aria-label="Value generation rule">{rule.choices.map(choice=><button key={choice.id} type="button" disabled={disabled} aria-label={choice.label} title={choice.label} aria-pressed={rule.value===choice.id} onClick={()=>{restore();rule.onChange(choice.id);}}>{choice.icon}</button>)}</div>}
   {editing&&<button type="button" className="mathematical-dial-rule" disabled={disabled} aria-label={`${label} editing rule`} title={editing.kind==='increment'?`Increment from ${anchor.current} by ${editing.amount} per selected step; click chooses rule, right-click sets amount`:'Absolute value; click to configure editing rule'} onClick={()=>{restore();setRulePopup({point:cursorPosition(),stage:'modes'});}} onContextMenu={event=>{event.preventDefault();event.stopPropagation();restore();setAmountSample(null);setRulePopup({point:cursorPosition(),stage:editing.kind==='increment'?'amount':'modes'});}}>Rule {editing.kind==='increment'?'+':'='}</button>}
   <div className="mathematical-dial-settings">
    {(min<0||editing?.kind==='increment')&&<button type="button" disabled={disabled} title="Change sign" aria-label={`${label} sign`} aria-pressed={sign<0} onClick={changeSign}>±</button>}
   </div>
   </div>
  </div>
  {rulePopup&&editing&&<ContextualMasterController radial title={`${label} rule`} stage={rulePopup.stage} position={rulePopup.point} onClose={()=>{if(rulePopup.stage==='amount'){setAmountSample(null);setRulePopup({...rulePopup,stage:'modes'});}else setRulePopup(null);}} onDismiss={()=>{setAmountSample(null);setRulePopup(null);}} onConfirm={()=>{
   const focused=document.activeElement;
   if(focused instanceof HTMLButtonElement&&ruleChoices.current?.contains(focused)&&!focused.disabled){focused.click();return;}
   setAmountSample(null);setRulePopup(null);
  }}>
   {rulePopup.stage==='amount'?<MathematicalDial value={amountSample??editing.amount} min={editing.minimum} max={editing.maximum} integer={integer} label="Increment" onPreview={setAmountSample} onCancelPreview={()=>setAmountSample(null)} onCommit={amount=>{setAmountSample(null);editing.onAmountChange(amount);}}/>:<div ref={ruleChoices}><RadialMenu onClose={()=>setRulePopup(null)} items={[
    {id:'value',label:'Value',symbol:'=',content:<button type="button" className="mathematical-rule-choice" title="Use selected number as the absolute property value" aria-label="Absolute value rule" aria-pressed={editing.kind==='value'} onClick={()=>{editing.onKindChange('value');setRulePopup(null);}}><span aria-hidden="true">=</span><small>Value</small></button>},
    {id:'increment',label:'Increment',symbol:'+',content:<button type="button" className="mathematical-rule-choice" title="Use selected number as steps from the current property value; right-click configures amount" aria-label="Increment rule" aria-pressed={editing.kind==='increment'} onClick={()=>{editing.onKindChange('increment');setRulePopup(null);}} onContextMenu={event=>{event.preventDefault();event.stopPropagation();editing.onKindChange('increment');setAmountSample(null);setRulePopup({point:cursorPosition(),stage:'amount'});}}><span aria-hidden="true">+</span><small>Step</small></button>},
    ...(editing.kind==='increment'?[{id:'amount',label:'Increment amount',symbol:'Δ',content:<button type="button" className="mathematical-rule-choice" title={`Increment amount: ${editing.amount}`} aria-label="Configure increment amount" onClick={()=>{setAmountSample(null);setRulePopup({point:cursorPosition(),stage:'amount'});}}><span aria-hidden="true">Δ</span><small>Amount</small></button>}]:[]),
   ]}/></div>}
  </ContextualMasterController>}
  {exact&&<ContextualMasterController title={exactKind==='value'?`${label} value`:`${limits?.label??label} ${exactKind}`} position={exact.point} onClose={closeExact} onConfirm={finishExact} onAdvance={finishExact}>
   <input ref={textInput} type="number" autoFocus className="mathematical-dial-exact" aria-label={exactKind==='value'?`${label} exact value`:`${limits?.label??label} ${exactKind}`} aria-invalid={exactKind!=='value'&&limits?!!mathematicalLimitsRejection(exactKind==='min'?Number(exact.text):limits.min,exactKind==='max'?Number(exact.text):limits.max,{min:limits.hardMin,max:limits.hardMax,integer:limits.integer})||exact.text.trim()==='':exact.text.trim()===''||(scaling==='value'?!valid(Number(exact.text)):!Number.isSafeInteger(Number(exact.text))||Number(exact.text)<0||Number(exact.text)>(scaleMaximum??0))} value={exact.text} min={exactKind==='value'?(scaling==='value'?min:0):limits?.hardMin} max={exactKind==='value'?(scaling==='value'?max:scaleMaximum):limits?.hardMax} step={exactKind==='value'?(scaling==='value'&&!integer?'any':1):limits?.integer?1:'any'}
    onFocus={event=>{if(!typedExact.current)event.currentTarget.select();}} onChange={event=>setExact({...exact,text:event.currentTarget.value})} onBlur={finishExact}
    onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();event.stopPropagation();finishExact();}if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeExact();}}}/>
  </ContextualMasterController>}
 </div>;
}
