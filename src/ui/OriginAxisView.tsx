import {useMemo,useRef,useState} from 'react';
import {AxisWheelDrawing} from '../composer/runtime/ui/AxisWheelDrawing.tsx';
import {pickAxisDial} from '../properties/axisDial.ts';
import {originAxisLayout,type OriginAxisTarget} from './originAxisLayout.ts';
import {AXIS_COLORS} from '../world/axisReadout.ts';
import {originModeDemo} from './originModeDemo.ts';
import type {OriginDirections} from '../core/originDirections.ts';
export function OriginAxisView({active,directions,activate,demo=false,dismissDemo}:{active:readonly number[];directions:OriginDirections;activate:(target:OriginAxisTarget)=>void;demo?:boolean;dismissDemo?:()=>void}){
 const host=useRef<HTMLDivElement>(null),[preview,setPreview]=useState<string>();
 const signature=JSON.stringify([active,directions]),layout=useMemo(()=>originAxisLayout(active,directions),[signature]);
 const example=useMemo(()=>demo?originModeDemo(directions,active):undefined,[signature,demo]);
 const pick=(x:number,y:number)=>{const box=host.current!.getBoundingClientRect();return pickAxisDial({x:(x-box.left)/box.width*2-1,y:(y-box.top)/box.height*2-1},layout.rays,Math.max(.11,16/Math.min(box.width,box.height)));};
 const accept=(id:string)=>{if(demo)return;const target=layout.targets.get(id);if(target)activate(target);};
 const previewTarget=preview?layout.targets.get(preview):undefined,previewRay=layout.rays.find(ray=>ray.id===preview);
 const previewLabel=previewTarget?`${'axis'in previewTarget?`${['Red','Green'][previewTarget.axis]} ${previewTarget.sign===1?'positive':'negative'} side`:`Direction ${Number(previewTarget.key.split(':')[1])+1}`} ${previewRay?.selected?'on':'off'}`:'';
 return <div className="origin-direction-axes axis-wheel-surface" role="group" aria-label={`Origin axes and directions${previewLabel?`: ${previewLabel}`:''}`} ref={host} tabIndex={0} onPointerEnter={dismissDemo}
  onPointerMove={event=>{const ray=pick(event.clientX,event.clientY);setPreview(current=>current===ray?.id?current:ray?.id);}}
  onPointerLeave={()=>setPreview(undefined)}
  onPointerDown={event=>{if(event.button!==0)return;const ray=pick(event.clientX,event.clientY);if(!ray)return;event.preventDefault();event.stopPropagation();host.current?.focus({preventScroll:true});setPreview(ray.id);accept(ray.id);}}
  onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();if(preview)accept(preview);}else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();event.stopPropagation();const index=layout.rays.findIndex(ray=>ray.id===preview),delta=event.key==='ArrowLeft'||event.key==='ArrowUp'?-1:1;setPreview(layout.rays[index<0?(delta<0?layout.rays.length-1:0):(index+delta+layout.rays.length)%layout.rays.length].id);}}}>
  <AxisWheelDrawing rays={layout.rays.map(ray=>({...ray,preview:ray.id===preview}))} selectionDisplay="ticks" hub hubColor={AXIS_COLORS[2]} areas={layout.areas}>{example&&<g className="origin-mode-example" data-valid={example.valid}>{example.sites.map((point,index)=><circle key={`site:${index}`} className="origin-example-site" cx={point.x} cy={point.y} r=".012"/>)}<line className="origin-example-snap" x1={example.cursor.x} y1={example.cursor.y} x2={example.anchor.x} y2={example.anchor.y}/><circle className="origin-example-cursor" cx={example.cursor.x} cy={example.cursor.y} r=".04"/>{example.positions.map((point,index)=><circle key={index} className="origin-example-node" cx={point.x} cy={point.y} r=".033"/>)}</g>}</AxisWheelDrawing>
 </div>;
}
