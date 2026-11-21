import {useMemo,useRef,useState} from 'react';
import {AxisWheelDrawing} from '../composer/runtime/ui/AxisWheelDrawing.tsx';
import {pickAxisDial} from '../properties/axisDial.ts';
import {originAxisLayout,type OriginAxisTarget} from './originAxisLayout.ts';
import {AXIS_COLORS} from '../world/axisReadout.ts';
import type {OriginDirections} from '../core/originDirections.ts';
export function OriginAxisView({active,directions,activate}:{active:readonly number[];directions:OriginDirections;activate:(target:OriginAxisTarget)=>void}){
 const host=useRef<HTMLDivElement>(null),[preview,setPreview]=useState<string>();
 const signature=JSON.stringify([active,directions]),layout=useMemo(()=>originAxisLayout(active,directions),[signature]);
 const pick=(x:number,y:number)=>{const box=host.current!.getBoundingClientRect();return pickAxisDial({x:(x-box.left)/box.width*2-1,y:(y-box.top)/box.height*2-1},layout.rays,Math.max(.11,16/Math.min(box.width,box.height)));};
 const accept=(id:string)=>{const target=layout.targets.get(id);if(target)activate(target);};
 const previewTarget=preview?layout.targets.get(preview):undefined,previewRay=layout.rays.find(ray=>ray.id===preview);
 const previewLabel=previewTarget?`${'axis'in previewTarget?`${['Red','Green'][previewTarget.axis]} ${previewTarget.sign===1?'positive':'negative'} side`:`Direction ${Number(previewTarget.key.split(':')[1])+1}`} ${previewRay?.selected?'on':'off'}`:'';
 return <div className="origin-direction-axes axis-wheel-surface" role="group" aria-label={`Origin axes and directions${previewLabel?`: ${previewLabel}`:''}`} ref={host} tabIndex={0}
  onPointerMove={event=>{const ray=pick(event.clientX,event.clientY);setPreview(current=>current===ray?.id?current:ray?.id);}}
  onPointerLeave={()=>setPreview(undefined)}
  onPointerDown={event=>{if(event.button!==0)return;const ray=pick(event.clientX,event.clientY);if(!ray)return;event.preventDefault();event.stopPropagation();host.current?.focus({preventScroll:true});setPreview(ray.id);accept(ray.id);}}
  onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();if(preview)accept(preview);}else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();event.stopPropagation();const index=layout.rays.findIndex(ray=>ray.id===preview),delta=event.key==='ArrowLeft'||event.key==='ArrowUp'?-1:1;setPreview(layout.rays[index<0?(delta<0?layout.rays.length-1:0):(index+delta+layout.rays.length)%layout.rays.length].id);}}}>
  <AxisWheelDrawing rays={layout.rays.map(ray=>({...ray,preview:ray.id===preview}))} selectionDisplay="ticks" hub hubColor={AXIS_COLORS[2]} areas={layout.areas}/>
 </div>;
}
