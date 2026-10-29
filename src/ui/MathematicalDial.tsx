import {useRef,useState} from 'react';
import {radialDimensions,RADIAL_GEOMETRY} from './radialMenuModel';
import './mathematicalDial.css';
type Mode=0|1|2;
const symbols=['●','◉','◎'];
/** Slots encode positions; filling one activates its value. Selected slot contributions currently add; interaction algebra remains provisional. Preview is transient. */
export function MathematicalDial({value,min,max,onPreview,onCommit}:{value:number;min:number;max:number;onPreview:(value:number)=>void;onCommit:(value:number)=>void}){
 const [base,setBase]=useState<1|2>(1),[clockwise,setClockwise]=useState(true),[start,setStart]=useState(0),[modes,setModes]=useState<Mode[]>([0,0,0,0,0,0]);
 const [selected,setSelected]=useState<number[]>([]),[hovered,setHovered]=useState<number|null>(null);
 const appliedModes=useRef<Mode[]>([0,0,0,0,0,0]);
 const committed=useRef(value),geometry=radialDimensions(2,6,0,base*RADIAL_GEOMETRY.minimumSize);
 const result=(index:number,mode=modes[index])=>mode===0?base*(index+1):base===1?undefined:mode===1?base*(index+1):base**(index+1);
 const restore=()=>{setHovered(null);onPreview(committed.current);};
 const toggled=(index:number)=>selected.includes(index)?appliedModes.current[index]!==modes[index]?selected:selected.filter(i=>i!==index):[...selected,index];
 const total=(slots:number[],changedIndex=-1,changedMode:Mode=0)=>{const values=slots.map(i=>result(i,i===changedIndex?changedMode:modes[i]));return values.some(n=>n===undefined)?undefined:values.reduce<number>((sum,n)=>sum+n!,0);};
 const validTotal=(n:number|undefined):n is number=>n!==undefined&&n>=min&&n<=max;
 const preview=(index:number)=>{const n=total(toggled(index));if(validTotal(n)){setHovered(index);onPreview(n);}else restore();};
 const resetRepresentation=()=>{restore();setSelected([]);};
 const displayed=hovered===null?selected:toggled(hovered);
 return <div data-ui-popup-interior className="mathematical-dial" style={{width:geometry.extent}} title={`Count: ${value}`} onMouseLeave={restore} role="group" aria-label="Mathematical count dial">
  <div className="mathematical-dial-ring" style={{width:geometry.extent,height:geometry.extent}}>
   <span className="mathematical-dial-base" aria-label={`Base ${base}`} style={{width:base*geometry.size,height:base*geometry.size}}>{Array.from({length:base},(_,i)=><i key={i} style={{width:geometry.size,height:geometry.size}}/>)}</span>
   <output className="mathematical-dial-value" aria-live="polite">{value}</output>
   {modes.map((mode,index)=>{const turn=(start+(clockwise?index:-index))*Math.PI/3,n=result(index),nextTotal=total(toggled(index)),valid=validTotal(nextTotal);return <button type="button" key={index} className="mathematical-dial-slot" data-mode={mode} data-selected={displayed.includes(index)} data-preview={hovered===index} data-start={index===0} style={{width:geometry.size,height:geometry.size,left:`${50+Math.sin(turn)*geometry.radius/geometry.extent*100}%`,top:`${50-Math.cos(turn)*geometry.radius/geometry.extent*100}%`}} aria-label={`Slot ${index+1}, ${symbols[mode]}, ${n??'requires base 2'}`} aria-pressed={selected.includes(index)} aria-disabled={!valid} title={`Slot ${index+1} · ${symbols[mode]} · ${n??'requires base 2'} · right-click cycles operation`} onMouseEnter={()=>preview(index)} onMouseLeave={restore} onFocus={()=>preview(index)} onBlur={restore} onClick={()=>{if(valid){committed.current=nextTotal!;appliedModes.current=[...modes];setSelected(toggled(index));setHovered(null);onCommit(nextTotal!);}}} onContextMenu={event=>{event.preventDefault();event.stopPropagation();const next=((mode+1)%3) as Mode;setModes(modes.map((m,i)=>i===index?next:m));const nextValue=total(toggled(index),index,next);if(validTotal(nextValue)){setHovered(index);onPreview(nextValue);}else restore();}}><span className="mathematical-dial-mark" aria-hidden="true"/></button>;})}
  </div>
  <div className="mathematical-dial-settings">
   {([1,2] as const).map(n=><button type="button" key={n} title={`Base ${n}`} aria-pressed={base===n} onClick={()=>{resetRepresentation();setBase(n);}}>{n}</button>)}
   <button type="button" title={`Direction: ${clockwise?'clockwise':'counterclockwise'}`} onClick={()=>{restore();setClockwise(!clockwise);}}>{clockwise?'↻':'↺'}</button>
   <button type="button" title="Starting position · advance one slot clockwise" onClick={()=>{restore();setStart((start+1)%6);}}>⌖</button>
  </div>
 </div>;
}
