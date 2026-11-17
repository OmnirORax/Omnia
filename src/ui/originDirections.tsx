import {createRoot} from 'react-dom/client';
import {useSyncExternalStore} from 'react';
import {DialSlot,dialRingSlots} from '../composer/runtime/ui/DialSlots.tsx';
import {DEFAULT_ORIGIN_DIRECTIONS,directionCount,type OriginDirections} from '../core/originDirections.ts';
import {activeWorldAxes,type AxisFrame} from '../core/axes.ts';
import './originDirections.css';
export function mountOriginDirections(host:HTMLElement,read:()=>AxisFrame,subscribe:(fn:()=>void)=>()=>void,change:(next:OriginDirections)=>void,snapshot:()=>unknown){
 const root=createRoot(host);
 function View(){useSyncExternalStore(subscribe,snapshot);const frame=read(),value=frame.directions??DEFAULT_ORIGIN_DIRECTIONS,dimensions=activeWorldAxes(frame).length,size=24,orders=value.mode==='unit'?value.rings:1,firstCount=dimensions===1?2:directionCount(value),minimum=Math.max(size,size/(2*Math.sin(Math.PI/firstCount))),extent=2*(minimum+(orders-1)*size+size/2+1),set=(next:Partial<OriginDirections>)=>change({...value,...next});
  return <div className="mathematical-dial origin-direction-dial" data-input-owner onKeyDown={event=>{if(event.key==='+'){event.preventDefault();event.stopPropagation();set({symmetry:!value.symmetry});}}}><div className="origin-direction-tools">
   <button aria-pressed={value.symmetry} onClick={()=>set({symmetry:!value.symmetry})} aria-label="Symmetry">+</button>
   {(['axis','unit'] as const).map(mode=><button key={mode} aria-pressed={value.mode===mode} onClick={()=>set({mode,disabled:[]})}>{mode==='axis'?'Axis':'Unit'}</button>)}
   {value.mode==='axis'?<><button disabled={value.halves>=6} onClick={()=>set({halves:value.halves+1,disabled:[]})}>/2</button><button disabled={!value.halves} onClick={()=>set({halves:value.halves-1,disabled:[]})}>×2</button></>:<><button disabled={value.rings>=4} onClick={()=>set({rings:value.rings+1})}>◎+</button><button disabled={value.rings<=1} onClick={()=>set({rings:value.rings-1})}>◎−</button></>}
  </div><div className="mathematical-dial-ring" style={{width:extent,height:extent}}>
   <span className="origin-direction-center"/>
   {Array.from({length:orders},(_,order)=>{const count=dimensions===1?2:directionCount(value,order+1),radius=minimum+order*size;return dialRingSlots(order,radius,count,size,extent,false,.25).map(slot=>{const key=slot.key,selected=!value.disabled.includes(key);return <DialSlot key={key} slot={slot} selected={selected} aria-label={`Ring ${order+1}, direction ${slot.index+1}`} onClick={()=>set({disabled:selected?[...value.disabled,key]:value.disabled.filter(item=>item!==key)})}/>;});})}
  </div></div>;
 }
 root.render(<View/>);return()=>root.unmount();
}
