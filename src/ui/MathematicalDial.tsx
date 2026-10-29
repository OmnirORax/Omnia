import {useRef,useState} from 'react';
import {radialDimensions,RADIAL_GEOMETRY} from './radialMenuModel';
import {mathematicalSlotValue,radialSlotCapacity,canAddMathematicalRing,fillMathematicalSlots,type MathematicalStrokeSlot,type MathematicalSlotMode} from '../properties/mathematicalDial.ts';
import './mathematicalDial.css';
import {claimUIPress} from './pointerOwnership';
/** Ring orders change geometry; arithmetic remains anchored to the chosen base. */
export function MathematicalDial({value,min,max,onPreview,onCommit}:{value:number;min:number;max:number;onPreview:(value:number)=>void;onCommit:(value:number)=>void}){
 const [base,setBase]=useState<1|2>(2),[clockwise,setClockwise]=useState(true),[start,setStart]=useState(0),[orders,setOrders]=useState(1);
 const [modes,setModes]=useState<Record<string,MathematicalSlotMode>>({}),[selected,setSelected]=useState<string[]>([]),[hovered,setHovered]=useState<string|null>(null);
 const [stroke,setStroke]=useState<readonly string[]|null>(null);
 const drag=useRef<{id:number;key:string;origin:{x:number;y:number};last:{x:number;y:number};slots:MathematicalStrokeSlot[];keys:readonly string[];moved:boolean}|null>(null),suppressClick=useRef(false);
 const committed=useRef(value),minimum=radialDimensions(2,6,0,base*RADIAL_GEOMETRY.minimumSize);
 const rings=Array.from({length:orders+(orders<4?1:0)},(_,order)=>{const radius=minimum.radius+order*minimum.size;return {order,radius,count:radialSlotCapacity(radius,minimum.size)};});
 const extent=2*(rings[orders-1].radius+minimum.size/2+1);
 const canAddRing=canAddMathematicalRing(orders,selected.map(key=>Number(key.split(':')[0])));
 const modeAt=(key:string)=>modes[key]??'normal';
 const ordinal=(key:string)=>Number(key.split(':')[1])+1;
 const result=(key:string,mode=modeAt(key))=>base===1&&mode==='recursion'?undefined:mathematicalSlotValue(base,ordinal(key),mode);
 const total=(slots:string[],changed='',mode:MathematicalSlotMode='normal',nextBase=base)=>slots.reduce((sum,key)=>{const m=key===changed?mode:modeAt(key);return sum+(nextBase===1&&m==='recursion'?NaN:mathematicalSlotValue(nextBase,ordinal(key),m));},0);
 const valid=(n:number)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
 const toggled=(key:string)=>selected.includes(key)?selected.filter(n=>n!==key):[...selected,key];
 const restore=()=>{if(drag.current)return;setHovered(null);onPreview(committed.current);};
 const preview=(key:string)=>{const n=total(toggled(key));if(valid(n)){setHovered(key);onPreview(n);}else restore();};
 const displayed=stroke??(hovered===null?selected:toggled(hovered));
 const cancelStroke=()=>{drag.current=null;setStroke(null);setHovered(null);onPreview(committed.current);};
 const changeBase=(next:1|2)=>{const g=radialDimensions(2,6,0,next*RADIAL_GEOMETRY.minimumSize);if(selected.some(key=>{const [order,index]=key.split(':').map(Number);return index>=radialSlotCapacity(g.radius+order*g.size,g.size);}))return;const n=total(selected,'','normal',next);if(!valid(n))return;setBase(next);setHovered(null);committed.current=n;onCommit(n);};
 const removeOrder=()=>{if(orders===1)return;const slots=selected.filter(key=>Number(key.split(':')[0])<orders-1),n=total(slots);if(!valid(n))return;setSelected(slots);setHovered(null);setOrders(orders-1);committed.current=n;onCommit(n);};
 return <div data-ui-popup-interior className="mathematical-dial"
 onPointerDownCapture={event=>{if(event.button!==0||!(event.target instanceof Element))return;const button=event.target.closest<HTMLElement>('[data-math-slot]');if(!button)return;
 const bounds=event.currentTarget.querySelector('.mathematical-dial-ring')!.getBoundingClientRect(),scale=bounds.width/extent,origin={x:event.clientX,y:event.clientY};
 const slots=rings.flatMap(({order,radius,count})=>Array.from({length:count},(_,i)=>{const turn=(start+(clockwise?i:-i)/count)*Math.PI*2;return {key:`${order}:${i}`,x:bounds.left+bounds.width/2+Math.sin(turn)*radius*scale,y:bounds.top+bounds.height/2-Math.cos(turn)*radius*scale,radius:minimum.size*scale/2};}));
 const keys=fillMathematicalSlots(selected,slots,origin,origin),n=total([...keys]);drag.current={id:event.pointerId,key:button.dataset.mathSlot!,origin,last:origin,slots,keys:valid(n)?keys:selected,moved:false};
 setStroke(drag.current.keys);setHovered(null);if(valid(n))onPreview(n);claimUIPress(event.pointerId,event.pointerType,event.buttons);event.preventDefault();event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId);}}
 onPointerMove={event=>{const active=drag.current;if(!active||active.id!==event.pointerId)return;event.stopPropagation();const point={x:event.clientX,y:event.clientY};if(Math.hypot(point.x-active.origin.x,point.y-active.origin.y)>=3)active.moved=true;
 const keys=fillMathematicalSlots(active.keys,active.slots,active.last,point);active.last=point;if(keys===active.keys)return;const n=total([...keys]);if(valid(n)){active.keys=keys;setStroke(keys);onPreview(n);}}}
 onPointerUp={event=>{const active=drag.current;if(!active||active.id!==event.pointerId)return;event.preventDefault();event.stopPropagation();const point={x:event.clientX,y:event.clientY};
 const moved=active.moved||Math.hypot(point.x-active.origin.x,point.y-active.origin.y)>=3,keys=moved?fillMathematicalSlots(active.keys,active.slots,active.last,point):toggled(active.key),n=total([...keys]);
 drag.current=null;setStroke(null);setHovered(null);suppressClick.current=true;if(valid(n)){committed.current=n;setSelected([...keys]);onCommit(n);}else onPreview(committed.current);if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}}
 onPointerCancel={cancelStroke} onLostPointerCapture={()=>{if(drag.current)cancelStroke();}}
 onClickCapture={event=>{if(suppressClick.current&&event.detail>0){suppressClick.current=false;event.preventDefault();event.stopPropagation();}}} style={{width:extent}} title={`Count: ${value}`} onMouseLeave={restore} role="group" aria-label="Mathematical count dial">
  <div className="mathematical-dial-ring" style={{width:extent,height:extent}}>
   <span className="mathematical-dial-base" aria-label={`Base ${base}`} style={{width:base*minimum.size,height:base*minimum.size}}>{Array.from({length:base},(_,i)=><i key={i} style={{width:minimum.size,height:minimum.size}}/>)}</span>
   <output className="mathematical-dial-value" aria-live="polite">{value}</output>
   {rings.map(({order,radius,count})=><span key={order} className="mathematical-dial-order" data-pending={order===orders} role="group" aria-label={`Ring order ${order+1}, ${count} slots`}>
    <svg className="mathematical-dial-hover-band" width={extent} height={extent} aria-hidden="true"><circle cx={extent/2} cy={extent/2} r={radius} fill="none" stroke="transparent" strokeWidth={minimum.size}/></svg>
    {order<orders&&<span className="mathematical-dial-start-arrow" title="Start and reading direction" aria-hidden="true" style={{left:`${50+Math.sin(start*Math.PI*2)*(radius+minimum.size/2)/extent*100}%`,top:`${50-Math.cos(start*Math.PI*2)*(radius+minimum.size/2)/extent*100}%`}}>{clockwise?'↻':'↺'}</span>}
    {order<orders&&<span className="mathematical-dial-order-rim" aria-hidden="true" style={{width:2*(radius+minimum.size/2+1),height:2*(radius+minimum.size/2+1)}}/>}
    {Array.from({length:count},(_,i)=>{const key=`${order}:${i}`,mode=modeAt(key),turn=(start+(clockwise?i:-i)/count)*Math.PI*2,n=result(key),next=total(toggled(key)),allowed=valid(next);return <button type="button" key={key} className="mathematical-dial-slot" data-math-slot={key} data-mode={mode} data-selected={displayed.includes(key)} data-preview={hovered===key} data-start={i===0} style={{width:minimum.size,height:minimum.size,left:`${50+Math.sin(turn)*radius/extent*100}%`,top:`${50-Math.cos(turn)*radius/extent*100}%`}} aria-label={`Ring ${order+1}, slot ${i+1}, ${mode==='normal'?'●':'◎'}, ${n??'requires base 2'}`} aria-pressed={selected.includes(key)} aria-disabled={!allowed} title={`Ring ${order+1} · slot ${i+1} · ${mode==='normal'?'●':'◎'} · ${n??'requires base 2'} · right-click changes operation`} onMouseEnter={()=>preview(key)} onMouseLeave={restore} onFocus={()=>preview(key)} onBlur={restore} onClick={()=>{if(allowed){committed.current=next;setSelected(toggled(key));setHovered(null);onCommit(next);}}} onContextMenu={event=>{event.preventDefault();event.stopPropagation();const nextMode=mode==='normal'?'recursion':'normal',slots=selected.includes(key)?selected:[...selected,key],n=total(slots,key,nextMode);if(selected.includes(key)&&!valid(n))return;setModes({...modes,[key]:nextMode});setHovered(null);if(selected.includes(key)){committed.current=n;onCommit(n);}else if(valid(n)){setHovered(key);onPreview(n);}else restore();}}><span className="mathematical-dial-mark" aria-hidden="true"/></button>;})}
   </span>)}
  </div>
  <div className="mathematical-dial-settings">
   {([1,2] as const).map(n=><button type="button" key={n} title={`Base ${n}`} aria-pressed={base===n} onClick={()=>changeBase(n)}>{n}</button>)}
   <button type="button" title={`Direction: ${clockwise?'clockwise':'counterclockwise'}`} onClick={()=>{restore();setClockwise(!clockwise);}}>{clockwise?'↻':'↺'}</button>
   <button type="button" title="Starting position · advance clockwise" onClick={()=>{restore();setStart((start+1/rings[0].count)%1);}}>⌖</button>
   {canAddRing&&<button type="button" title="Enclose the outward mark in a new ring" aria-label="Add outer ring order" onClick={()=>{restore();setOrders(orders+1);}}>◎+</button>}
   <button type="button" title="Remove outer ring order and its marks" aria-label="Remove outer ring order" disabled={orders===1} onClick={removeOrder}>◎−</button>
  </div>
 </div>;
}
