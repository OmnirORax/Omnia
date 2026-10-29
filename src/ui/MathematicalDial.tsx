import {useId,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {radialDimensions,RADIAL_GEOMETRY} from './radialMenuModel';
import {mathematicalSlotValue,mathematicalSelectionValue,radialSlotCapacity,canAddMathematicalRing,fillMathematicalSlots,paintMathematicalSlots,type MathematicalMarks,type MathematicalStrokeSlot,type MathematicalSlotMode} from '../properties/mathematicalDial.ts';
import './mathematicalDial.css';
import {claimUIPress} from './pointerOwnership';
import {useToolCursor} from './toolCursor';
import {setToolCursorZone} from './toolCursorZone';
/** Right-click chooses a brush. Only left-click/held painting writes slot modes. */
export function MathematicalDial({value,min,max,onPreview,onCommit}:{value:number;min:number;max:number;onPreview:(value:number)=>void;onCommit:(value:number)=>void}){
 const [base,setBase]=useState<1|2>(2),[clockwise,setClockwise]=useState(true),[start]=useState(0),[orders,setOrders]=useState(1),[brush,setBrush]=useState<MathematicalSlotMode>('normal');
 const [marks,setMarks]=useState<MathematicalMarks>({selected:[],modes:{}}),[sample,setSample]=useState<MathematicalMarks|null>(null);
 const ringRef=useRef<HTMLDivElement>(null),zone=useId();
 useLayoutEffect(()=>{const node=ringRef.current;if(!node)return;setToolCursorZone(node,zone,true);return()=>setToolCursorZone(node,undefined);},[zone]);
 const cursor=useMemo(()=>({key:`math:${brush}`,zone,priority:40,icon:<span>{brush==='normal'?'●':'◎'}</span>,className:"mathematical-dial-cursor",width:12,height:12}),[brush,zone]);useToolCursor(cursor);
 const drag=useRef<{id:number;last:{x:number;y:number};slots:MathematicalStrokeSlot[];visited:readonly string[];before:MathematicalMarks;next:MathematicalMarks;brush:MathematicalSlotMode}|null>(null),suppressClick=useRef(false);
 const hover=useRef<{key:string;brush:MathematicalSlotMode;marks:MathematicalMarks}|null>(null),committed=useRef(value);
 const minimum=radialDimensions(2,6,0,base*RADIAL_GEOMETRY.minimumSize),rings=Array.from({length:orders+(orders<4?1:0)},(_,order)=>{const radius=minimum.radius+order*minimum.size;return {order,radius,count:radialSlotCapacity(radius,minimum.size)};});
 const extent=2*(rings[orders-1].radius+minimum.size/2+1),displayed=sample??marks;
 const modeAt=(state:MathematicalMarks,key:string)=>state.modes[key]??'normal',ordinal=(key:string)=>Number(key.split(':')[1])+1;
 const total=(state:MathematicalMarks,nextBase=base)=>mathematicalSelectionValue(nextBase,state.selected.map(key=>({key,ordinal:ordinal(key),mode:modeAt(state,key)})));
 const valid=(n:number)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
 const restore=()=>{if(drag.current)return;hover.current=null;setSample(null);onPreview(committed.current);};
 const preview=(key:string)=>{if(drag.current)return;if(hover.current?.key===key&&hover.current.brush===brush&&hover.current.marks===marks)return;hover.current={key,brush,marks};const candidate=paintMathematicalSlots(marks,[key],brush),n=total(candidate);if(valid(n)){setSample(candidate);onPreview(n);}else{setSample(null);onPreview(committed.current);}};
 const commit=(next:MathematicalMarks)=>{const n=total(next);if(!valid(n))return;committed.current=n;hover.current=null;setSample(null);setMarks(next);onCommit(n);};
 const cancel=()=>{drag.current=null;hover.current=null;setSample(null);onPreview(committed.current);};
 const advance=(point:{x:number;y:number})=>{const active=drag.current;if(!active)return;const visited=fillMathematicalSlots(active.visited,active.slots,active.last,point);active.last=point;if(visited===active.visited)return;const next=paintMathematicalSlots(active.before,visited,active.brush),n=total(next);if(valid(n)){active.visited=visited;active.next=next;setSample(next);onPreview(n);}};
 const changeBase=(next:1|2)=>{const g=radialDimensions(2,6,0,next*RADIAL_GEOMETRY.minimumSize);if(marks.selected.some(key=>{const [order,index]=key.split(':').map(Number);return index>=radialSlotCapacity(g.radius+order*g.size,g.size);}))return;const n=total(marks,next);if(!valid(n))return;setBase(next);setSample(null);hover.current=null;committed.current=n;onCommit(n);};
 return <div data-ui-popup-interior className="mathematical-dial" style={{width:extent}} title={`Count: ${value}`} role="group" aria-label="⠒❉" onMouseLeave={restore}
 onPointerDownCapture={event=>{if(event.button!==0||!(event.target instanceof Element)||!event.target.closest('[data-math-slot]'))return;const bounds=ringRef.current!.getBoundingClientRect(),scale=bounds.width/extent,point={x:event.clientX,y:event.clientY};
 const slots=rings.flatMap(({order,radius,count})=>Array.from({length:count},(_,i)=>{const turn=(start+(clockwise?i:-i)/count)*Math.PI*2;return {key:`${order}:${i}`,x:bounds.left+bounds.width/2+Math.sin(turn)*radius*scale,y:bounds.top+bounds.height/2-Math.cos(turn)*radius*scale,radius:minimum.size*scale/2};}));
 drag.current={id:event.pointerId,last:point,slots,visited:[],before:marks,next:marks,brush};hover.current=null;advance(point);claimUIPress(event.pointerId,event.pointerType,event.buttons);event.preventDefault();event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId);}}
 onPointerMove={event=>{if(drag.current){if(drag.current.id===event.pointerId){event.stopPropagation();advance({x:event.clientX,y:event.clientY});}return;}const slot=event.target instanceof Element?event.target.closest<HTMLElement>('[data-math-slot]'):null;if(slot)preview(slot.dataset.mathSlot!);}}
 onPointerUp={event=>{const active=drag.current;if(!active||active.id!==event.pointerId)return;event.preventDefault();event.stopPropagation();advance({x:event.clientX,y:event.clientY});const next=active.next;drag.current=null;suppressClick.current=true;commit(next);if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}}
 onPointerCancel={cancel} onLostPointerCapture={()=>{if(drag.current)cancel();}} onClickCapture={event=>{if(suppressClick.current&&event.detail>0){suppressClick.current=false;event.preventDefault();event.stopPropagation();}}}>
 <div ref={ringRef} className="mathematical-dial-ring" style={{width:extent,height:extent}} onContextMenu={event=>{event.preventDefault();event.stopPropagation();if(!drag.current)setBrush(brush==='normal'?'recursion':'normal');}}>
  <span className="mathematical-dial-base" aria-label={`Base ${base}`} style={{width:base*minimum.size,height:base*minimum.size}}>{Array.from({length:base},(_,i)=><i key={i} style={{width:minimum.size,height:minimum.size}}/>)}</span>
  <output className="mathematical-dial-value" aria-live="polite">{value}</output>
  {rings.map(({order,radius,count})=><span key={order} className="mathematical-dial-order" role="group" aria-label={`Ring ${order+1}, ${count} slots`}>
   <svg className="mathematical-dial-hover-band" width={extent} height={extent} aria-hidden="true"><circle cx={extent/2} cy={extent/2} r={radius} fill="none" stroke="transparent" strokeWidth={minimum.size}/></svg>
   {order<orders&&<><span className="mathematical-dial-start-arrow" aria-hidden="true" style={{left:`${50+Math.sin(start*Math.PI*2)*(radius+minimum.size/2)/extent*100}%`,top:`${50-Math.cos(start*Math.PI*2)*(radius+minimum.size/2)/extent*100}%`}}>{clockwise?'↻':'↺'}</span><span className="mathematical-dial-order-rim" aria-hidden="true" style={{width:2*(radius+minimum.size/2+1),height:2*(radius+minimum.size/2+1)}}/></>}
   {Array.from({length:count},(_,i)=>{const key=`${order}:${i}`,mode=modeAt(displayed,key),turn=(start+(clockwise?i:-i)/count)*Math.PI*2,candidate=paintMathematicalSlots(marks,[key],brush),n=total(candidate),contribution=mathematicalSlotValue(base,i+1,brush);return <button type="button" key={key} className="mathematical-dial-slot" data-ui-paint-owner="geometry" data-math-slot={key} data-mode={mode} data-selected={displayed.selected.includes(key)} data-preview={!!sample&&displayed.selected.includes(key)&&(!marks.selected.includes(key)||modeAt(marks,key)!==mode)} style={{width:minimum.size,height:minimum.size,left:`${50+Math.sin(turn)*radius/extent*100}%`,top:`${50-Math.cos(turn)*radius/extent*100}%`}} aria-label={`Ring ${order+1}, slot ${i+1}, brush ${brush}, contribution ${contribution}`} aria-pressed={marks.selected.includes(key)} aria-disabled={!valid(n)} title={`Slot ${i+1} · ${brush==='normal'?`${base}×${i+1}`:`${base}^${i+2}`} = ${contribution} · total ${n} · right-click changes cursor only`} onMouseEnter={()=>preview(key)} onMouseLeave={restore} onFocus={()=>preview(key)} onBlur={restore} onClick={event=>{if(event.detail===0)commit(candidate);}}><span className="mathematical-dial-mark" aria-hidden="true"/></button>;})}
  </span>)}
 </div>
 <div className="mathematical-dial-settings">
  {([1,2] as const).map(n=><button type="button" key={n} title={`Base ${n}`} aria-pressed={base===n} onClick={()=>changeBase(n)}>{n}</button>)}
  <button type="button" title="Reading direction" onClick={()=>{restore();setClockwise(!clockwise);}}>{clockwise?'↻':'↺'}</button>
  {canAddMathematicalRing(orders,marks.selected.map(key=>Number(key.split(':')[0])))&&<button type="button" title="Add outer ring" onClick={()=>{restore();setOrders(orders+1);}}>◎+</button>}
  <button type="button" title="Remove outer ring" disabled={orders===1} onClick={()=>{if(orders>1){commit({...marks,selected:marks.selected.filter(key=>Number(key.split(':')[0])<orders-1)});setOrders(orders-1);}}}>◎−</button>
 </div>
 </div>;
}
