import {useRef,useState} from 'react';
import './mathematicalDial.css';
type Mode=0|1|2;
const symbols=['●','◉','◎'];
/** Reusable value picker: only previews/commits values through the caller's owner. */
export function MathematicalDial({value,min,max,onPreview,onCommit}:{value:number;min:number;max:number;onPreview:(value:number)=>void;onCommit:(value:number)=>void}){
 const [base,setBase]=useState<1|2>(1),[clockwise,setClockwise]=useState(true),[start,setStart]=useState(0),[modes,setModes]=useState<Mode[]>([0,0,0,0,0,0]);
 const committed=useRef(value);
 const result=(index:number,mode=modes[index])=>mode===0?base*(index+1):base===1?undefined:mode===1?(index+1)**2:2**(index+1);
 const restore=()=>onPreview(committed.current);
 return <div className="mathematical-dial" onMouseLeave={restore} role="group" aria-label="Mathematical count dial">
  <div className="mathematical-dial-settings">
   {([1,2] as const).map(n=><button type="button" key={n} title={`Base ${n}`} aria-pressed={base===n} onClick={()=>{restore();setBase(n);}}>{n}</button>)}
   <button type="button" title={`Direction: ${clockwise?'clockwise':'counterclockwise'}`} onClick={()=>{restore();setClockwise(!clockwise);}}>{clockwise?'↻':'↺'}</button>
   <button type="button" title="Starting position · advance one slot clockwise" onClick={()=>{restore();setStart((start+1)%6);}}>⌖</button>
  </div>
  <div className="mathematical-dial-ring">
   <output className="mathematical-dial-value" aria-live="polite">{value}</output>
   {modes.map((mode,index)=>{const turn=(start+(clockwise?index:-index))*Math.PI/3,n=result(index),valid=n!==undefined&&n>=min&&n<=max;return <button type="button" key={index} className="mathematical-dial-slot" style={{left:`${50+Math.sin(turn)*37}%`,top:`${50-Math.cos(turn)*37}%`}} aria-label={`Slot ${index+1}, ${symbols[mode]}, ${n??'requires base 2'}`} aria-disabled={!valid} title={`Slot ${index+1} · ${symbols[mode]} · ${n??'requires base 2'} · right-click cycles operation`} onMouseEnter={()=>{if(valid)onPreview(n!);else restore();}} onMouseLeave={restore} onFocus={()=>{if(valid)onPreview(n!);}} onBlur={restore} onClick={()=>{if(valid){committed.current=n!;onCommit(n!);}}} onContextMenu={event=>{event.preventDefault();event.stopPropagation();const next=((mode+1)%3) as Mode;setModes(modes.map((m,i)=>i===index?next:m));const nextValue=result(index,next);if(nextValue!==undefined&&nextValue>=min&&nextValue<=max)onPreview(nextValue);else restore();}}>{symbols[mode]}<small>{index+1}</small></button>;})}
  </div>
 </div>;
}
