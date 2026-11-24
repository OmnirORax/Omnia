import {windowDrag} from '../../../ui/windowDrag.ts';
import {dialCenterScrub} from './dialCenterScrub.ts';
import {DialDrawing} from './DialDrawing.tsx';
import {dialDrawingGeometry} from './dialDrawingGeometry.ts';
import {copyDialNotation} from '../../../properties/dialNotation.ts';
import type {DialField} from '../../../ui/dialReferenceController.ts';
import {dialGridValue,type DialValueGrid} from '../../../properties/dialValueGrid.ts';
import {mathematicalDialScale} from './radialMenuState';
import {showMathCursorReadout,clearMathCursorReadout} from '../../../ui/mathCursorReadout.ts';
import type {ConfirmedMathValue} from '../../../ui/operationNumber.ts';
import {reportSystemMessage} from '../../../ui/systemMessage.ts';
import {DialSlot,dialRingSlots} from './DialSlots.tsx';
import {useNavigationState} from '../../../ui/useNavigationState.tsx';
import {useHoverPreview} from './HoverPreview';
import {useValueDrag} from './useValueDrag.ts';
import {useValueConfirmation} from './useValueConfirmation';
import {type ReactNode,useSyncExternalStore,useId,useLayoutEffect,useEffect,useMemo,useRef,useState} from 'react';
import {radialDimensions,RADIAL_GEOMETRY} from './radialMenuModel';
import {mathematicalSlotScrub,mathematicalEmptyValue,mathematicalSlotValue,mathematicalNumberValue,mathematicalEditValue,mathematicalValueAllowed,mathematicalValueSession,radialSlotCapacity,mathematicalScaleValue,mathematicalScaleAnchor,mathematicalScaleMaximum,mathematicalScaleRejection,mathematicalValueRejection,type MathematicalScaleMode,fillMathematicalSlots,paintMathematicalSlots,type MathematicalMarks,type MathematicalStrokeSlot,type MathematicalSlotMode} from '../properties/mathematicalDial.ts';
import './mathematicalDial.css';
import {useContextNavigation} from './ContextStage';
import {ContextualMasterController} from './ContextualMasterController';
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
export function MathematicalDialSurface({value,min,max,integer=false,label='Value',disabled=false,configure=false,editing,rule,onPreview=()=>{},onCommit,onCancelPreview,onReject=reportSystemMessage,onConfigurationCommit,readoutOwner,keyboardInput=false,limits,modeControl,grid,scaleStart,typedCount,onModeChange,initialConfiguration,renderValue,onReference,onSurfaceCancel}:{
 renderValue?:(kind:'value'|'min'|'max',value:number,configuration?:ConfirmedMathValue)=>ReactNode;onReference?:(kind:DialField,target:'value'|'snap',count?:number)=>void;onSurfaceCancel?:(cancel:()=>void)=>void;initialConfiguration?:ConfirmedMathValue;grid?:DialValueGrid;scaleStart?:number;typedCount?:number;onModeChange?:(mode:MathematicalScaleMode)=>void;modeControl?:ReactNode;formatValue?:(value:number)=>string;value:number;min:number;max:number;integer?:boolean;label?:string;disabled?:boolean;configure?:boolean;
 rule?:{value:string;choices:readonly {id:string;label:string;icon:string}[];onChange:(id:string)=>void};
 editing?:{kind:'value'|'increment';amount:number;minimum:number;maximum:number;onKindChange:(kind:'value'|'increment')=>void;onAmountChange:(amount:number)=>void};
 limits?:{formatValue?:(n:number)=>string;label:string;min:number;max:number;hardMin:number;hardMax:number;integer?:boolean;change:(which:'min'|'max',value:number)=>void|boolean};readoutOwner?:string;keyboardInput?:boolean;onConfigurationCommit?:(config:ConfirmedMathValue)=>void;onReject?:(message:string)=>void;onPreview?:(value:number)=>void;onCommit:(value:number)=>void;onCancelPreview?:()=>void;
}){

 const displayScale=useSyncExternalStore(mathematicalDialScale.subscribe,mathematicalDialScale.getSnapshot),scaleDrag=useValueDrag({value:displayScale,min:.1,step:.01,pixelsPerStep:2,axis:{x:1,y:1}},()=>{},mathematicalDialScale.set);
 const localReadout=useId();
 const [base,setBase]=useState<1|2>(initialConfiguration?.notation?.base??(grid?1:2)),[scaling,setScaling]=useState<MathematicalScaleMode>(initialConfiguration?.mode??'value'),scaleAnchor=useRef(initialConfiguration&&initialConfiguration.mode!=='value'?initialConfiguration.anchor:value),valueBase=useRef<1|2>(grid?1:2);

 const [brush,setBrush]=useState<MathematicalSlotMode>('normal'),[scrubCount,setScrubCount]=useState(initialConfiguration?.count??0);
 const [sign,setSign]=useState<1|-1>(()=>initialConfiguration?.notation?(initialConfiguration.notation.clockwise?1:-1):grid?(initialConfiguration?.count??0)<0?-1:1:editing?.kind==='increment'?1:value<0?-1:1),[painting,setPainting]=useState(false);
 const clockwise=sign>0;
 const [marks,setMarks]=useState<MathematicalMarks>(()=>initialConfiguration?.notation?copyDialNotation(initialConfiguration.notation).marks:emptyMarks()),[sample,setSample]=useState<MathematicalMarks|null>(null);
 const [session]=useState(()=>mathematicalValueSession(value)),anchor=useRef(value);
 const [rulePopup,setRulePopup]=useNavigationState<{point:Point;stage:'modes'|'amount'}|null>(`${label}:dial-rule`,()=>configure&&editing?{point:cursorPosition(),stage:'modes'}:null);

 const ruleChoices=useRef<HTMLDivElement>(null);
 const surfaceRef=useRef<HTMLDivElement>(null),moveRef=useRef<HTMLButtonElement>(null),centerActive=useRef(false);
 useLayoutEffect(()=>{if(surfaceRef.current&&moveRef.current)return windowDrag(surfaceRef.current,moveRef.current,undefined,{translateScale:()=>mathematicalDialScale.getSnapshot()});},[]);
 const ringRef=useRef<HTMLDivElement>(null),zone=useId(),drag=useRef<Stroke|null>(null),suppressClick=useRef(false);
 const hover=useRef<{key:string;brush:MathematicalSlotMode;marks:MathematicalMarks}|null>(null);
 const callbacks=useRef({onPreview,onCancelPreview});callbacks.current={onPreview,onCancelPreview};
 const owns=(target:EventTarget|null,current:HTMLElement)=>ownsPointerSurface(current,target instanceof Element?target:null,'.mathematical-dial');
 useLayoutEffect(()=>{
  if(session.receive(value)){horizontal?.release(horizontalOwner.current);anchor.current=value;scaleAnchor.current=value;setScrubCount(0);drag.current=null;hover.current=null;setPainting(false);setSample(null);setMarks(emptyMarks());setSign(grid||editing?.kind==='increment'?1:value<0?-1:1);}
 },[value,marks,sample,session]);

 useEffect(()=>()=>{
  if(session.sampling){const previous=session.restore();if(callbacks.current.onCancelPreview)callbacks.current.onCancelPreview();else callbacks.current.onPreview(previous);}
 },[session]);
 useLayoutEffect(()=>{const node=ringRef.current;if(!node)return;setToolCursorZone(node,zone,true);return()=>setToolCursorZone(node,undefined);},[zone]);
 const cursor=useMemo(()=>({key:`math:${brush}`,zone,priority:40,icon:<span>{brush==='normal'?'●':'◎'}</span>,className:'mathematical-dial-cursor',width:12,height:12}),[brush,zone]);
 useToolCursor(disabled?null:cursor);
 const geometry=dialDrawingGeometry(base,marks.selected),{orders,rings,extent,size}=geometry,minimum={...radialDimensions(2,6,0,base*RADIAL_GEOMETRY.minimumSize),size},displayed=painting?(sample??marks):marks;
 const modeAt=(state:MathematicalMarks,key:string)=>state.modes[key]??'normal';
 const numeral=(state:MathematicalMarks,nextBase=base,nextSign=sign)=>mathematicalNumberValue(nextBase,state.selected.map(key=>({key,ordinal:Number(key.split(':')[1])+1,mode:modeAt(state,key)})),nextSign);
 const baseTotal=(state:MathematicalMarks,nextBase=base,nextSign=sign)=>{const n=grid?dialGridValue(grid,numeral(state,nextBase,nextSign)):mathematicalEditValue({anchor:anchor.current,index:numeral(state,nextBase,nextSign),rule:editing?.kind==='increment'?{kind:'increment',amount:editing.amount}:{kind:'value'}});return state.selected.length?n:mathematicalEmptyValue(n,{min,max,integer});};
 const scaleMaximum=scaling==='value'?undefined:mathematicalScaleMaximum(scaleAnchor.current,scaling,{min,max,integer});
 const countOf=(state:MathematicalMarks,nextBase=base)=>Math.abs(numeral(state,nextBase,1));
 const total=(state:MathematicalMarks,nextBase=base,nextSign=sign)=>scaling==='value'?baseTotal(state,nextBase,nextSign):mathematicalScaleValue(scaleAnchor.current,countOf(state,nextBase),scaling);
 const valid=(n:number)=>mathematicalValueAllowed(n,{min,max,integer});
 const reject=(n:number,count?:number)=>onReject(`${label}: ${scaling!=='value'&&count!==undefined?mathematicalScaleRejection(scaleAnchor.current,count,scaling,{min,max,integer})??'Value is unavailable.':mathematicalValueRejection(n,{min,max,integer})??'Value is unavailable.'}`);
 const accepted=(n:number,state?:MathematicalMarks)=>valid(n)&&(scaling==='value'||!state||countOf(state)<=(scaleMaximum??0));

 const previewValue=(n:number)=>{if(!session.sampling||session.expected!==n)onPreview(session.preview(n));};
 const restore=()=>{
  if(drag.current||centerActive.current)return;
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
 const commit=(next:MathematicalMarks,n=total(next),count=countOf(next),direction=sign,withNotation=true)=>{
  if(disabled)return;
  if(!valid(n)||scaling!=='value'&&count>(scaleMaximum??0)){reject(n,scaling==='value'?undefined:count);return;}
  hover.current=null;setSample(null);setMarks(next);setScrubCount(count);const configuration:ConfirmedMathValue={mode:scaling,anchor:scaling==='value'?n:scaleAnchor.current,count:scaling==='value'?(grid?(next.selected.length?numeral(next,base,direction):direction*count):0):count,value:n,...(withNotation?{notation:copyDialNotation({base,clockwise:direction>0,marks:next})}:{}),...(scaling==='value'&&grid?{equilibrium:grid.equilibrium,snap:grid.snap}:{})};showMathCursorReadout(readoutOwner??localReadout,label,configuration);onConfigurationCommit?.(configuration);onCommit(session.commit(n));
 };
 useLayoutEffect(()=>{if(typedCount===undefined)return;const n=scaling==='value'?(grid?dialGridValue(grid,sign*typedCount):mathematicalEditValue({anchor:anchor.current,index:sign*typedCount,rule:editing?.kind==='increment'?{kind:'increment',amount:editing.amount}:{kind:'value'}})):mathematicalScaleValue(scaleAnchor.current,typedCount,scaling);commit(emptyMarks(),n,typedCount);},[typedCount,sign]);
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
 },[horizontal,disabled,configure,brush,base,orders,min,max,integer,scaling,scaleMaximum,editing?.kind,editing?.amount]);

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
  if((grid||editing?.kind==='increment')&&!marks.selected.length){restore();setSign(next);return;}
  const n=marks.selected.length?total(marks,base,next):-session.restore();
  if(!valid(n)){reject(n);return;}
  restore();setSign(next);commit(marks,n===0?0:n,countOf(marks),next);
 };
 useEffect(()=>()=>{if(!readoutOwner)clearMathCursorReadout(localReadout);},[readoutOwner,localReadout]);
 useEffect(()=>{if(!keyboardInput)return;const key=(event:KeyboardEvent)=>{if(disabled||!/^\d$/.test(event.key)||event.ctrlKey||event.metaKey||event.altKey||event.target instanceof Element&&event.target.closest('input,textarea,select,[contenteditable]'))return;event.preventDefault();event.stopImmediatePropagation();restore();onReference?.('value','value',Number(event.key));};window.addEventListener('keydown',key,true);return()=>window.removeEventListener('keydown',key,true);},[keyboardInput,disabled,onReference]);
 useEffect(()=>{onSurfaceCancel?.(restore);},[onSurfaceCancel]);
 const center=dialCenterScrub({value:session.committed,domain:{min,max,integer},grid,mode:scaling,anchor:scaleAnchor.current,count:marks.selected.length?countOf(marks):scrubCount,maximum:scaleMaximum});
 const centerDrag=useValueDrag({...center,axis:{x:0,y:-1},pixelsPerStep:6,disabled},n=>previewValue(center.toValue(n)),n=>{
  centerActive.current=false;const direction=scaling==='value'?(n<0?-1:1):sign;setSign(direction);commit(emptyMarks(),center.toValue(n),scaling==='value'?(grid?Math.abs(n):0):n,direction,false);
 },()=>{centerActive.current=false;restore();},()=>{horizontal?.release(horizontalOwner.current);restore();centerActive.current=true;});
 const changeScaling=(next:MathematicalScaleMode)=>{
  restore();horizontal?.release(horizontalOwner.current);drag.current=null;setPainting(false);setMarks(emptyMarks());setScrubCount(0);
  if(next==='value'){setBase(valueBase.current);}else{if(scaling==='value')valueBase.current=base;scaleAnchor.current=mathematicalScaleAnchor(next,session.restore(),scaleStart);setBase(1);setSign(1);}setScaling(next);onModeChange?.(next);
 };
 return <div ref={surfaceRef} data-live-dial data-ui-popup-interior className="mathematical-dial" style={{width:extent,height:extent,zoom:scaleDrag.value}} title={`${label}: ${value} (${min}–${max})`} role="group" aria-label={`⠒❉ · ${label}`} aria-disabled={disabled} onMouseLeave={()=>{if(!horizontal?.owns(horizontalOwner.current))restore();}}
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
   <button ref={centerDrag.ref} type="button" disabled={disabled} className="mathematical-dial-base" aria-label={`Adjust ${label}`} onContextMenu={event=>{event.preventDefault();event.stopPropagation();if(!disabled)grid?commit(emptyMarks(),grid.equilibrium,0):changeBase(base===1?2:1);}} style={{width:base*minimum.size,height:base*minimum.size}}><span aria-hidden="true"/></button>
   <DialDrawing notation={{base,clockwise,marks:displayed}} geometry={geometry}/>
   {rings.map(({order,radius,count})=><span key={order} className="mathematical-dial-order" role="group" aria-label={`Ring ${order+1}, ${count} slots`}>
    <svg className="mathematical-dial-hover-band" width={extent} height={extent} aria-hidden="true"><circle cx={extent/2} cy={extent/2} r={radius} fill="none" stroke="transparent" strokeWidth={minimum.size}/></svg>

    {dialRingSlots(order,radius,count,minimum.size,extent,clockwise).map(slot=>{const i=slot.index;
     const key=`${order}:${i}`,mode=modeAt(displayed,key);
     const candidate=paintMathematicalSlots(marks,[key],brush,marks.selected.includes(key)),n=total(candidate),contribution=sign*mathematicalSlotValue(base,i+1,brush);
     return <DialSlot slot={slot} selected={displayed.selected.includes(key)} key={key} disabled={disabled} data-ui-paint-owner="geometry" data-math-slot={key} data-mode={mode} data-selected={displayed.selected.includes(key)} preview={!!sample&&displayed.selected.includes(key)&&(!marks.selected.includes(key)||modeAt(marks,key)!==mode)}
      aria-label={`Ring ${order+1}, slot ${i+1}, brush ${brush}, contribution ${contribution}`} aria-pressed={marks.selected.includes(key)} aria-disabled={candidate.selected.length>0&&!accepted(n,candidate)} title={`Slot ${i+1} · ${sign<0?'−':''}${brush==='normal'?`${base}×${i+1}`:`${base}^${i+2}`} = ${contribution} · ${editing?.kind==='increment'?`${anchor.current} + (${numeral(candidate)} × ${editing.amount}) = `:''}${n} · right-click applies recursion`}
      onMouseEnter={()=>preview(key)} onMouseLeave={()=>{if(!horizontal?.owns(horizontalOwner.current))restore();}} onFocus={()=>preview(key)} onBlur={restore} onClick={event=>{if(event.detail===0)confirm(candidate);}}><span aria-hidden="true"/></DialSlot>;
    })}
   </span>)}
  </div>
  <div className="mathematical-dial-meta">
   <div className="mathematical-dial-settings mathematical-dial-arithmetic" role="group" aria-label="Number mode">{(['value','halving','doubling','division'] as const).map(kind=><button key={kind} type="button" disabled={disabled||kind!=='value'&&(!Number.isFinite(scaleStart??session.expected)||(scaleStart??session.expected)===0)} aria-label={kind==='value'?'Set value':kind==='halving'?'Halve starting value':kind==='division'?'Divide starting value':'Double starting value'} aria-pressed={scaling===kind} onClick={()=>changeScaling(scaling===kind&&kind!=='value'?'value':kind)}>{kind==='value'?'=':kind==='halving'?'/2':kind==='division'?'1/x':'×2'}</button>)}<button type="button" disabled={disabled} aria-label="Recursive marks" aria-pressed={brush==='recursion'} onClick={()=>{restore();setBrush(brush==='recursion'?'normal':'recursion');}}>◎</button></div>
   {limits&&renderValue&&<div className="mathematical-dial-settings mathematical-dial-limits" role="group" aria-label={`${limits.label} limits`}>{(['min','max'] as const).map(kind=><span key={kind}>{renderValue(kind,limits[kind])}</span>)}</div>}
   <div className="mathematical-dial-result">
   {renderValue?.('value',sample?total(sample):session.committed)}
   <output className="mathematical-dial-maximum" aria-label="Maximum value">{scaling==='value'?`max ${max}`:`${scaleAnchor.current} · max ${scaleMaximum}`}</output>
   </div>
   <div className="mathematical-dial-operation">
    {modeControl}
   {rule&&<div className="mathematical-dial-settings" role="group" aria-label="Value generation rule">{rule.choices.map(choice=><button key={choice.id} type="button" disabled={disabled} aria-label={choice.label} title={choice.label} aria-pressed={rule.value===choice.id} onClick={()=>{restore();rule.onChange(choice.id);}}>{choice.icon}</button>)}</div>}
   {editing&&<button type="button" className="mathematical-dial-rule" disabled={disabled} aria-label={`${label} editing rule`} title={editing.kind==='increment'?`Increment from ${anchor.current} by ${editing.amount} per selected step; click chooses rule, right-click sets amount`:'Absolute value; click to configure editing rule'} onClick={()=>{restore();setRulePopup({point:cursorPosition(),stage:'modes'});}} onContextMenu={event=>{event.preventDefault();event.stopPropagation();restore();if(editing.kind==='increment')onReference?.('amount','value');else setRulePopup({point:cursorPosition(),stage:'modes'});}}>Rule {editing.kind==='increment'?'+':'='}</button>}
   <div className="mathematical-dial-settings">
    {scaling==='value'&&(grid||min<0||editing?.kind==='increment')&&<button type="button" disabled={disabled} title="Change sign" aria-label={`${label} sign`} aria-pressed={sign<0} onClick={changeSign}>{sign>0?'↻':'↶'}</button>}
   </div>
   </div>
  </div>
  <button ref={moveRef} type="button" className="mathematical-dial-move" aria-label="Move math dial" data-ui-popup-interior>✥</button>
  <button ref={scaleDrag.ref} type="button" className="mathematical-dial-size" aria-label="Scale math dial" data-ui-popup-interior>◢</button>
  {rulePopup&&editing&&<ContextualMasterController radial title={`${label} rule`} stage={rulePopup.stage} position={rulePopup.point} onClose={()=>{if(rulePopup.stage==='amount'){setRulePopup({...rulePopup,stage:'modes'});}else setRulePopup(null);}} onDismiss={()=>{setRulePopup(null);}} onConfirm={()=>{
   const focused=document.activeElement;
   if(focused instanceof HTMLButtonElement&&ruleChoices.current?.contains(focused)&&!focused.disabled){focused.click();return;}
   setRulePopup(null);
  }}>
   {<div ref={ruleChoices}><RadialMenu onClose={()=>setRulePopup(null)} items={[
    {id:'value',label:'Value',symbol:'=',content:<button type="button" className="mathematical-rule-choice" title="Use selected number as the absolute property value" aria-label="Absolute value rule" aria-pressed={editing.kind==='value'} onClick={()=>{editing.onKindChange('value');setRulePopup(null);}}><span aria-hidden="true">=</span><small>Value</small></button>},
    {id:'increment',label:'Increment',symbol:'+',content:<button type="button" className="mathematical-rule-choice" title="Use selected number as steps from the current property value; right-click configures amount" aria-label="Increment rule" aria-pressed={editing.kind==='increment'} onClick={()=>{editing.onKindChange('increment');setRulePopup(null);}} onContextMenu={event=>{event.preventDefault();event.stopPropagation();editing.onKindChange('increment');setRulePopup(null);onReference?.('amount','value');}}><span aria-hidden="true">+</span><small>Step</small></button>},
    ...(editing.kind==='increment'?[{id:'amount',label:'Increment amount',symbol:'Δ',content:<button type="button" className="mathematical-rule-choice" title={`Increment amount: ${editing.amount}`} aria-label="Configure increment amount" onClick={()=>{setRulePopup(null);onReference?.('amount','value');}}><span aria-hidden="true">Δ</span><small>Amount</small></button>}]:[]),
   ]}/></div>}
  </ContextualMasterController>}
 </div>;
}

export type MathematicalDialProps=Parameters<typeof MathematicalDialSurface>[0];
