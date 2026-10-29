import {useId,useLayoutEffect,useEffect,useMemo,useRef,useState} from 'react';
import {radialDimensions,RADIAL_GEOMETRY} from './radialMenuModel';
import {mathematicalSlotValue,mathematicalNumberValue,mathematicalValueAllowed,mathematicalValueSession,radialSlotCapacity,canAddMathematicalRing,fillMathematicalSlots,paintMathematicalSlots,type MathematicalMarks,type MathematicalStrokeSlot,type MathematicalSlotMode} from '../properties/mathematicalDial.ts';
import './mathematicalDial.css';
import {useContextNavigation} from './ContextStage';
import {ContextualMasterController} from './ContextualMasterController';
import {useCancelValueEdit} from './ActiveContext';
import {cursorPosition} from './cursorPosition';
import {claimUIPress} from './pointerOwnership';
import {useToolCursor} from './toolCursor';
import {setToolCursorZone} from './toolCursorZone';

const emptyMarks=():MathematicalMarks=>({selected:[],modes:{}});
type Point={x:number;y:number};
type Stroke={id:number;last:Point;slots:MathematicalStrokeSlot[];visited:readonly string[];before:MathematicalMarks;next:MathematicalMarks;brush:MathematicalSlotMode};
/** Shared raw-number surface. The consumer supplies its domain and real setters.
 * Right-click chooses a brush; only left-click/held painting writes slot modes. */
export function MathematicalDial({value,min,max,integer=false,label='Value',disabled=false,onPreview,onCommit,onCancelPreview}:{
 value:number;min:number;max:number;integer?:boolean;label?:string;disabled?:boolean;
 onPreview:(value:number)=>void;onCommit:(value:number)=>void;onCancelPreview?:()=>void;
}){
 const [base,setBase]=useState<1|2>(2),[clockwise,setClockwise]=useState(true),[orders,setOrders]=useState(1);
 const [sign,setSign]=useState<1|-1>(()=>value<0?-1:1),[brush,setBrush]=useState<MathematicalSlotMode>('normal'),[painting,setPainting]=useState(false);
 const [marks,setMarks]=useState<MathematicalMarks>(emptyMarks),[sample,setSample]=useState<MathematicalMarks|null>(null);
 const [session]=useState(()=>mathematicalValueSession(value));
 const [exact,setExact]=useState<{point:Point;text:string}|null>(null),textInput=useRef<HTMLInputElement>(null),textFinished=useRef(false);
 const ringRef=useRef<HTMLDivElement>(null),zone=useId(),drag=useRef<Stroke|null>(null),suppressClick=useRef(false);
 const hover=useRef<{key:string;brush:MathematicalSlotMode;marks:MathematicalMarks}|null>(null);
 const callbacks=useRef({onPreview,onCancelPreview});callbacks.current={onPreview,onCancelPreview};
 useLayoutEffect(()=>{
  if(session.receive(value)){drag.current=null;hover.current=null;setPainting(false);setSample(null);setMarks(emptyMarks());setSign(value<0?-1:1);}
 },[value,marks,sample,session]);
 useEffect(()=>()=>{
  if(session.sampling){const previous=session.restore();if(callbacks.current.onCancelPreview)callbacks.current.onCancelPreview();else callbacks.current.onPreview(previous);}
 },[session]);
 useLayoutEffect(()=>{const node=ringRef.current;if(!node)return;setToolCursorZone(node,zone,true);return()=>setToolCursorZone(node,undefined);},[zone]);
 const cursor=useMemo(()=>({key:`math:${brush}`,zone,priority:40,icon:<span>{brush==='normal'?'●':'◎'}</span>,className:'mathematical-dial-cursor',width:12,height:12}),[brush,zone]);
 useToolCursor(disabled?null:cursor);
 const minimum=radialDimensions(2,6,0,base*RADIAL_GEOMETRY.minimumSize);
 const rings=Array.from({length:orders+(orders<4?1:0)},(_,order)=>{const radius=minimum.radius+order*minimum.size;return {order,radius,count:radialSlotCapacity(radius,minimum.size)};});
 const extent=2*(rings[orders-1].radius+minimum.size/2+1),displayed=sample??marks;
 const modeAt=(state:MathematicalMarks,key:string)=>state.modes[key]??'normal';
 const total=(state:MathematicalMarks,nextBase=base,nextSign=sign)=>mathematicalNumberValue(nextBase,state.selected.map(key=>({key,ordinal:Number(key.split(':')[1])+1,mode:modeAt(state,key)})),nextSign);
 const valid=(n:number)=>mathematicalValueAllowed(n,{min,max,integer});
 const previewValue=(n:number)=>onPreview(session.preview(n));
 const restore=()=>{
  if(drag.current)return;
  hover.current=null;setSample(null);
  if(session.sampling){const previous=session.restore();if(onCancelPreview)onCancelPreview();else onPreview(previous);}
 };
 const preview=(key:string,nextBrush=brush)=>{
  if(disabled||drag.current)return;
  if(hover.current?.key===key&&hover.current.brush===nextBrush&&hover.current.marks===marks)return;
  hover.current={key,brush:nextBrush,marks};
  const candidate=paintMathematicalSlots(marks,[key],nextBrush),n=total(candidate);
  if(valid(n)){setSample(candidate);previewValue(n);}else{setSample(null);if(session.sampling){const previous=session.restore();if(onCancelPreview)onCancelPreview();else onPreview(previous);}}
 };
 const commit=(next:MathematicalMarks,n=total(next))=>{
  if(disabled||!valid(n))return;
  hover.current=null;setSample(null);setMarks(next);onCommit(session.commit(n));
 };
 const cancel=()=>{setPainting(false);drag.current=null;restore();};
 useContextNavigation({owner:ringRef,cancel:painting?cancel:undefined});
 const cancelLatest=useRef(cancel);cancelLatest.current=cancel;
 useEffect(()=>{const stop=()=>{if(drag.current)cancelLatest.current();};window.addEventListener('blur',stop);return()=>window.removeEventListener('blur',stop);},[]);
 const advance=(point:Point)=>{
  const active=drag.current;if(!active)return;
  const visited=fillMathematicalSlots(active.visited,active.slots,active.last,point);active.last=point;
  if(visited===active.visited)return;
  const next=paintMathematicalSlots(active.before,visited,active.brush),n=total(next);
  if(valid(n)){active.visited=visited;active.next=next;setSample(next);previewValue(n);}
 };
 const changeBase=(next:1|2)=>{
  const g=radialDimensions(2,6,0,next*RADIAL_GEOMETRY.minimumSize);
  if(marks.selected.some(key=>{const [order,index]=key.split(':').map(Number);return index>=radialSlotCapacity(g.radius+order*g.size,g.size);}))return;
  if(marks.selected.length&&!valid(total(marks,next)))return;
  restore();setBase(next);if(marks.selected.length)commit(marks,total(marks,next));
 };
 const changeSign=()=>{
  const next:1|-1=sign===1?-1:1;
  const n=marks.selected.length?total(marks,base,next):-session.restore();
  if(!valid(n))return;
  restore();setSign(next);commit(marks,n===0?0:n);
 };
 const closeExact=()=>{textFinished.current=true;setExact(null);};
 const finishExact=()=>{
  if(!exact||textFinished.current)return;
  const parsed=exact.text.trim()?Number(exact.text):NaN;
  if(!valid(parsed))return;
  textFinished.current=true;setExact(null);setSign(parsed<0?-1:1);commit(emptyMarks(),parsed);
 };
 useCancelValueEdit(textInput,closeExact,!!exact);
 const openExact=()=>{restore();textFinished.current=false;setExact({point:cursorPosition(),text:String(session.restore())});};
 return <div data-ui-popup-interior className="mathematical-dial" style={{width:extent,height:extent}} title={`${label}: ${value} (${min}–${max})`} role="group" aria-label={`⠒❉ · ${label}`} aria-disabled={disabled} onMouseLeave={restore}
  onPointerDownCapture={event=>{
   suppressClick.current=false;
   if(disabled||event.button!==0||!(event.target instanceof Element)||!event.target.closest('[data-math-slot]'))return;
   const bounds=ringRef.current!.getBoundingClientRect(),scale=bounds.width/extent,point={x:event.clientX,y:event.clientY};
   const slots=rings.flatMap(({order,radius,count})=>Array.from({length:count},(_,i)=>{const turn=(clockwise?i:-i)/count*Math.PI*2;return {key:`${order}:${i}`,x:bounds.left+bounds.width/2+Math.sin(turn)*radius*scale,y:bounds.top+bounds.height/2-Math.cos(turn)*radius*scale,radius:minimum.size*scale/2};}));
   setPainting(true);drag.current={id:event.pointerId,last:point,slots,visited:[],before:marks,next:marks,brush};hover.current=null;advance(point);
   claimUIPress(event.pointerId,event.pointerType,event.buttons);event.preventDefault();event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId);
  }}
  onPointerMove={event=>{
   if(drag.current){if(drag.current.id===event.pointerId){event.stopPropagation();advance({x:event.clientX,y:event.clientY});}return;}
   const slot=event.target instanceof Element?event.target.closest<HTMLElement>('[data-math-slot]'):null;if(slot)preview(slot.dataset.mathSlot!);
  }}
  onPointerUp={event=>{
   const active=drag.current;if(!active||active.id!==event.pointerId)return;
   event.preventDefault();event.stopPropagation();advance({x:event.clientX,y:event.clientY});setPainting(false);drag.current=null;suppressClick.current=true;
   if(active.visited.length)commit(active.next);else restore();
   if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  }}
  onPointerCancel={cancel} onLostPointerCapture={()=>{if(drag.current)cancel();}}
  onClickCapture={event=>{if(suppressClick.current&&event.detail>0){suppressClick.current=false;event.preventDefault();event.stopPropagation();}}}>
  <div ref={ringRef} className="mathematical-dial-ring" style={{width:extent,height:extent}} onContextMenu={event=>{
   event.preventDefault();event.stopPropagation();if(disabled||drag.current)return;
   const next=brush==='normal'?'recursion':'normal';setBrush(next);if(hover.current)preview(hover.current.key,next);
  }}>
   <span className="mathematical-dial-base" aria-label={`Base ${base}`} style={{width:base*minimum.size,height:base*minimum.size}}>{Array.from({length:base},(_,i)=><i key={i} style={{width:minimum.size,height:minimum.size}}/>)}</span>
   {rings.map(({order,radius,count})=><span key={order} className="mathematical-dial-order" role="group" aria-label={`Ring ${order+1}, ${count} slots`}>
    <svg className="mathematical-dial-hover-band" width={extent} height={extent} aria-hidden="true"><circle cx={extent/2} cy={extent/2} r={radius} fill="none" stroke="transparent" strokeWidth={minimum.size}/></svg>
    {order<orders&&<><span className="mathematical-dial-start-arrow" aria-hidden="true" style={{left:'50%',top:`${50-(radius+minimum.size/2)/extent*100}%`}}>{clockwise?'↻':'↺'}</span><span className="mathematical-dial-order-rim" aria-hidden="true" style={{width:2*(radius+minimum.size/2+1),height:2*(radius+minimum.size/2+1)}}/></>}
    {Array.from({length:count},(_,i)=>{
     const key=`${order}:${i}`,mode=modeAt(displayed,key),turn=(clockwise?i:-i)/count*Math.PI*2;
     const candidate=paintMathematicalSlots(marks,[key],brush),n=total(candidate),contribution=sign*mathematicalSlotValue(base,i+1,brush);
     return <button type="button" key={key} disabled={disabled} className="mathematical-dial-slot" data-ui-paint-owner="geometry" data-math-slot={key} data-mode={mode} data-selected={displayed.selected.includes(key)} data-preview={!!sample&&displayed.selected.includes(key)&&(!marks.selected.includes(key)||modeAt(marks,key)!==mode)} style={{width:minimum.size,height:minimum.size,left:`${50+Math.sin(turn)*radius/extent*100}%`,top:`${50-Math.cos(turn)*radius/extent*100}%`}}
      aria-label={`Ring ${order+1}, slot ${i+1}, brush ${brush}, contribution ${contribution}`} aria-pressed={marks.selected.includes(key)} aria-disabled={!valid(n)} title={`Slot ${i+1} · ${sign<0?'−':''}${brush==='normal'?`${base}×${i+1}`:`${base}^${i+2}`} = ${contribution} · total ${n} · right-click changes cursor only`}
      onMouseEnter={()=>preview(key)} onMouseLeave={restore} onFocus={()=>preview(key)} onBlur={restore} onClick={event=>{if(event.detail===0)commit(candidate);}}><span className="mathematical-dial-mark" aria-hidden="true"/></button>;
    })}
   </span>)}
  </div>
  <div className="mathematical-dial-meta">
   <button type="button" disabled={disabled} className="mathematical-dial-readout" aria-label={`${label} value: ${value}`} title={`${label} · ${value} · click or right-click to type an exact value`} onClick={openExact} onContextMenu={event=>{event.preventDefault();event.stopPropagation();openExact();}}><output aria-live="polite">{value}</output></button>
   <div className="mathematical-dial-settings">
    {([1,2] as const).map(n=><button type="button" disabled={disabled} key={n} title={`Base ${n}`} aria-pressed={base===n} onClick={()=>changeBase(n)}>{n}</button>)}
    {min<0&&<button type="button" disabled={disabled} title="Change sign" aria-label={`${label} sign`} aria-pressed={sign<0} onClick={changeSign}>±</button>}
    <button type="button" disabled={disabled} title="Reading direction" onClick={()=>{restore();setClockwise(!clockwise);}}>{clockwise?'↻':'↺'}</button>
    {canAddMathematicalRing(orders,marks.selected.map(key=>Number(key.split(':')[0])))&&<button type="button" disabled={disabled} title="Add outer ring" onClick={()=>{restore();setOrders(orders+1);}}>◎+</button>}
    <button type="button" title="Remove outer ring" disabled={disabled||orders===1} onClick={()=>{if(orders>1){const next={...marks,selected:marks.selected.filter(key=>Number(key.split(':')[0])<orders-1)};if(!valid(total(next)))return;commit(next);setOrders(orders-1);}}}>◎−</button>
    <button type="button" title="Clear marks; keep the current property value" disabled={disabled||!marks.selected.length} onClick={()=>{restore();setMarks(emptyMarks());}}>⌫</button>
   </div>
  </div>
  {exact&&<ContextualMasterController title={`${label} value`} position={exact.point} onClose={closeExact} onConfirm={finishExact} onAdvance={finishExact}>
   <input ref={textInput} type="number" autoFocus className="mathematical-dial-exact" aria-label={`${label} exact value`} aria-invalid={exact.text.trim()===''||!valid(Number(exact.text))} value={exact.text} min={min} max={max} step={integer?1:'any'}
    onFocus={event=>event.currentTarget.select()} onChange={event=>setExact({...exact,text:event.currentTarget.value})} onBlur={finishExact}
    onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();event.stopPropagation();finishExact();}if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeExact();}}}/>
  </ContextualMasterController>}
 </div>;
}
