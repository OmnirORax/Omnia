import {reportSystemMessage} from './systemMessage.ts';
import {OperationChoices,OperationToggle,OperationPair} from './OperationChoices.tsx';
import {SNAP_MODE_ITEMS} from '../properties/snapMode.ts';
import {createRoot} from 'react-dom/client';
import {useReducer,useSyncExternalStore,useState} from 'react';
import {OriginAxisView} from './OriginAxisView.tsx';
import {DialSlot,dialRingSlots} from '../composer/runtime/ui/DialSlots.tsx';
import {DEFAULT_ORIGIN_DIRECTIONS,refineOriginDirections,changeOriginMode,directionCount,originDirectionAllowed,type OriginDirections} from '../core/originDirections.ts';
import {activeWorldAxes,type AxisFrame} from '../core/axes.ts';
import './originDirections.css';
export function mountOriginDirections(host:HTMLElement,read:()=>AxisFrame,subscribe:(fn:()=>void)=>()=>void,change:(next:OriginDirections)=>void,snapshot:()=>unknown,toggleAxis:(axis:number,sign?:1|-1)=>void){
 const root=createRoot(host);
 function View(){const [ignoreBounds,setIgnoreBounds]=useState(false);const [demo,setDemo]=useState<{label:string;delta:Partial<OriginDirections>}>();useSyncExternalStore(subscribe,snapshot);const [,redraw]=useReducer(n=>n+1,0),frame=read(),active=activeWorldAxes(frame),value=frame.directions??DEFAULT_ORIGIN_DIRECTIONS,dimensions=active.length,size=24,orders=value.mode==='unit'?value.rings:1,firstCount=dimensions===1?2:directionCount(value),minimum=Math.max(size,size/(2*Math.sin(Math.PI/firstCount))),extent=2*(minimum+(orders-1)*size+size/2+1),set=(next:Partial<OriginDirections>)=>{setDemo(undefined);change({...value,...next});};
  const refine=(delta:1|-1)=>{try{set(refineOriginDirections(value,delta,ignoreBounds,active));}catch(error){reportSystemMessage(error instanceof Error?error.message:String(error));}};
  const displayed=demo?{...value,...demo.delta}:value,previewArea=(inverse:string|undefined)=>setDemo(inverse?{label:inverse==='inverse'?'Inverted area':'Area',delta:{...changeOriginMode(value,'area',active),invert:inverse==='inverse'}}:undefined);
  return <div className="mathematical-dial origin-direction-dial" data-input-owner onKeyDown={event=>{if(event.key==='+'){event.preventDefault();event.stopPropagation();set({symmetry:!value.symmetry});}}}><div className="origin-direction-tools">
   <OperationToggle label="Symmetry" selected={value.symmetry} onPreview={on=>setDemo(on?{label:'Symmetry',delta:{symmetry:true}}:undefined)} onClick={()=>set({symmetry:!value.symmetry})}>↔</OperationToggle>
   <OperationChoices preview={mode=>setDemo(mode?{label:mode==='axis'?'Axis':'Unit',delta:changeOriginMode(value,mode as OriginDirections['mode'],active)}:undefined)} choices={{read:()=>value.mode,items:SNAP_MODE_ITEMS,change:mode=>set(changeOriginMode(value,mode as OriginDirections['mode'],active))}}/>
   <OperationPair label="Area" preview={previewArea} choices={{read:()=>value.mode==='area'?(value.invert?'inverse':'normal'):'',items:[{id:'normal',symbol:'◐',label:'Area'},{id:'inverse',symbol:'◑',label:'Inverted area'}],change:inverse=>set({...changeOriginMode(value,'area',active),invert:inverse==='inverse'})}}/>
   {value.mode==='area'&&<OperationPair label="Packing" preview={pattern=>setDemo(pattern?{label:pattern==='grid'?'Grid rows':'Hexagonal packing',delta:{pattern:pattern as 'grid'|'hex'}}:undefined)} choices={{read:()=>value.pattern??'grid',items:[{id:'grid',symbol:'▦',label:'Grid rows'},{id:'hex',symbol:'⬡',label:'Hexagonal packing'}],change:pattern=>set({pattern:pattern as 'grid'|'hex'})}}/>}
   {value.mode!=='unit'?<><OperationToggle label="Lock subdivision bounds" selected={!ignoreBounds} onClick={()=>{setDemo(undefined);setIgnoreBounds(on=>!on);}}><svg viewBox="0 0 20 20" aria-hidden="true"><rect x="4" y="9" width="12" height="9" rx="1.5"/><path d={ignoreBounds?'M13 9V6a4 4 0 0 0-8 0':'M6 9V6a4 4 0 0 1 8 0v3'}/></svg></OperationToggle><button disabled={value.halves>=6} onClick={()=>refine(1)}>/2</button><button disabled={!value.halves} onClick={()=>refine(-1)}>×2</button></>:<><button disabled={value.rings>=4} onClick={()=>set({rings:value.rings+1})}>◎+</button><button disabled={value.rings<=1} onClick={()=>set({rings:value.rings-1})}>◎−</button></>}
  </div><output className="origin-mode-caption">{demo?.label??(value.mode==='area'?`Area · ${value.pattern==='hex'?'Hex':'Grid'}`:value.mode==='unit'?'Unit':'Axis')}</output><OriginAxisView active={active} directions={displayed} demo={!!demo} dismissDemo={()=>setDemo(undefined)} activate={target=>{if('axis'in target){toggleAxis(target.axis,target.sign);redraw();}else set({disabled:value.disabled.includes(target.key)?value.disabled.filter(key=>key!==target.key):[...value.disabled,target.key]});}}/>{value.mode==='unit'&&<div className="mathematical-dial-ring" style={{width:extent,height:extent}}>
   <span className="origin-direction-center"/>
   {Array.from({length:orders},(_,order)=>{const count=dimensions===1?2:directionCount(value,order+1),radius=minimum+order*size;return dialRingSlots(order,radius,count,size,extent,false,.25).map(slot=>{const key=slot.key,selected=!value.disabled.includes(key),angle=slot.index/count*Math.PI*2,allowed=dimensions===1?(value.sides??[]).includes(active[0]*2+(slot.index===0?0:1)):originDirectionAllowed(value,Math.cos(angle),Math.sin(angle));return <DialSlot disabled={!allowed} key={key} slot={slot} selected={selected} aria-label={`Ring ${order+1}, direction ${slot.index+1}`} onClick={()=>set({disabled:selected?[...value.disabled,key]:value.disabled.filter(item=>item!==key)})}/>;});})}
  </div>}</div>;
 }
 root.render(<View/>);return()=>root.unmount();
}
