import {OperationChoices,OperationToggle} from './OperationChoices.tsx';
import {SNAP_MODE_ITEMS} from '../properties/snapMode.ts';
import {createRoot} from 'react-dom/client';
import {useReducer,useSyncExternalStore,useState} from 'react';
import {OriginAxisView} from './OriginAxisView.tsx';
import {DialSlot,dialRingSlots} from '../composer/runtime/ui/DialSlots.tsx';
import {DEFAULT_ORIGIN_DIRECTIONS,directionCount,originDirectionAllowed,type OriginDirections} from '../core/originDirections.ts';
import {activeWorldAxes,type AxisFrame} from '../core/axes.ts';
import './originDirections.css';
export function mountOriginDirections(host:HTMLElement,read:()=>AxisFrame,subscribe:(fn:()=>void)=>()=>void,change:(next:OriginDirections)=>void,snapshot:()=>unknown,toggleAxis:(axis:number,sign?:1|-1)=>void){
 const root=createRoot(host);
 function View(){const [demo,setDemo]=useState<{label:string;delta:Partial<OriginDirections>}>();useSyncExternalStore(subscribe,snapshot);const [,redraw]=useReducer(n=>n+1,0),frame=read(),active=activeWorldAxes(frame),value=frame.directions??DEFAULT_ORIGIN_DIRECTIONS,dimensions=active.length,size=24,orders=value.mode==='unit'?value.rings:1,firstCount=dimensions===1?2:directionCount(value),minimum=Math.max(size,size/(2*Math.sin(Math.PI/firstCount))),extent=2*(minimum+(orders-1)*size+size/2+1),set=(next:Partial<OriginDirections>)=>{setDemo(undefined);change({...value,...next});};
  const displayed=demo?{...value,...demo.delta}:value;
  return <div className="mathematical-dial origin-direction-dial" data-input-owner onKeyDown={event=>{if(event.key==='+'){event.preventDefault();event.stopPropagation();set({symmetry:!value.symmetry});}}}><div className="origin-direction-tools">
   <OperationToggle label="Symmetry" selected={value.symmetry} onPreview={on=>setDemo(on?{label:'Symmetry',delta:{symmetry:true}}:undefined)} onClick={()=>set({symmetry:!value.symmetry})}>↔</OperationToggle>
   <OperationChoices preview={mode=>setDemo(mode?{label:{axis:'Axis',unit:'Unit',area:'Area'}[mode]??mode,delta:{mode:mode as OriginDirections['mode'],disabled:[]}}:undefined)} choices={{read:()=>value.mode,items:[...SNAP_MODE_ITEMS,{id:'area',symbol:'▧',label:'Area'}],change:mode=>set({mode:mode as OriginDirections['mode'],disabled:[]})}}/>
   {value.mode==='area'?<><OperationToggle label="Invert area" selected={value.invert??false} onPreview={on=>setDemo(on?{label:'Invert area',delta:{invert:!value.invert}}:undefined)} onClick={()=>set({invert:!value.invert})}>◐</OperationToggle><OperationChoices preview={pattern=>setDemo(pattern?{label:pattern==='grid'?'Grid rows':'Hexagonal packing',delta:{pattern:pattern as 'grid'|'hex'}}:undefined)} choices={{read:()=>value.pattern??'grid',items:[{id:'grid',symbol:'▦',label:'Grid rows'},{id:'hex',symbol:'⬡',label:'Hexagonal packing'}],change:pattern=>set({pattern:pattern as 'grid'|'hex'})}}/></>:value.mode==='axis'?<><button disabled={value.halves>=6} onClick={()=>set({halves:value.halves+1,disabled:[]})}>/2</button><button disabled={!value.halves} onClick={()=>set({halves:value.halves-1,disabled:[]})}>×2</button></>:<><button disabled={value.rings>=4} onClick={()=>set({rings:value.rings+1})}>◎+</button><button disabled={value.rings<=1} onClick={()=>set({rings:value.rings-1})}>◎−</button></>}
  </div><output className="origin-mode-caption">{demo?.label??(value.mode==='area'?`Area · ${value.pattern==='hex'?'Hex':'Grid'}`:value.mode==='unit'?'Unit':'Axis')}</output><OriginAxisView active={active} directions={displayed} demo={!!demo} dismissDemo={()=>setDemo(undefined)} activate={target=>{if('axis'in target){toggleAxis(target.axis,target.sign);redraw();}else set({disabled:value.disabled.includes(target.key)?value.disabled.filter(key=>key!==target.key):[...value.disabled,target.key]});}}/>{value.mode==='unit'&&<div className="mathematical-dial-ring" style={{width:extent,height:extent}}>
   <span className="origin-direction-center"/>
   {Array.from({length:orders},(_,order)=>{const count=dimensions===1?2:directionCount(value,order+1),radius=minimum+order*size;return dialRingSlots(order,radius,count,size,extent,false,.25).map(slot=>{const key=slot.key,selected=!value.disabled.includes(key),angle=slot.index/count*Math.PI*2,allowed=dimensions===1?(value.sides??[]).includes(active[0]*2+(slot.index===0?0:1)):originDirectionAllowed(value,Math.cos(angle),Math.sin(angle));return <DialSlot disabled={!allowed} key={key} slot={slot} selected={selected} aria-label={`Ring ${order+1}, direction ${slot.index+1}`} onClick={()=>set({disabled:selected?[...value.disabled,key]:value.disabled.filter(item=>item!==key)})}/>;});})}
  </div>}</div>;
 }
 root.render(<View/>);return()=>root.unmount();
}
