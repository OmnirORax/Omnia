import { useId, useLayoutEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cursorPosition } from './cursorPosition';
import { activeToolCursor } from './toolCursorModel';
export type ToolCursorOptions={priority?:number;rotationTurns?:number;badge?:string;pulse?:boolean};
export type ToolCursorRequest=ToolCursorOptions & {key:string;icon:ReactNode;className?:string;width?:number;height?:number;anchor?:{x:number;y:number};parked?:{x:number;y:number}};
const owners=new Map<string,ToolCursorRequest>(),snapshots=new Map<string,HTMLElement>(),listeners=new Set<()=>void>();
let version=0;
const publish=()=>{version++;listeners.forEach(listener=>listener());};
const subscribe=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};};
/** Owners declare active state; transport, priority and clicked-icon inheritance are shared. */
export function useToolCursor(request:ToolCursorRequest|null){
  const owner=useId();
  useLayoutEffect(()=>{owners.delete(owner);if(request)owners.set(owner,request);publish();},[owner,request]);
  useLayoutEffect(()=>()=>{if(owners.delete(owner))publish();},[owner]);
}
/** Capture only the actual icon, once on activation, including custom appearance.
 * No source layout/style lookup occurs during pointer movement. */
export function rememberToolIcon(key:string,source:HTMLElement|null){
  if(!source)return;
  const nodes=[source,...source.querySelectorAll<HTMLElement>('*')];if(nodes.length>128)return;
  const clone=source.cloneNode(true) as HTMLElement,clones=[clone,...clone.querySelectorAll<HTMLElement>('*')];
  const properties=['color','background','background-clip','-webkit-background-clip','mask-image','-webkit-mask-image','mask-size','mask-repeat','font-family','font-size','font-weight','line-height','display','width','height','filter','opacity','border-radius','fill','stroke','stroke-width','transform'];
  nodes.forEach((node,index)=>{const style=getComputedStyle(node);for(const property of properties)clones[index].style.setProperty(property,style.getPropertyValue(property));});
  clone.removeAttribute('data-tool-icon');snapshots.set(key,clone);publish();
}
/** The website has one active cursor layer; pointer updates only its transform. */
export function ToolCursorLayer(){
  useSyncExternalStore(subscribe,()=>version);
  const request=activeToolCursor(owners.values());
  const root=useRef<HTMLDivElement>(null),captured=useRef<HTMLDivElement>(null),point=useRef(cursorPosition());
  const snapshot=request?snapshots.get(request.key):undefined;
  useLayoutEffect(()=>{
    if(!captured.current)return;
    captured.current.replaceChildren(...(snapshot?[snapshot.cloneNode(true)]:[]));
  },[snapshot,request?.key]);
  useLayoutEffect(()=>{
    if(!request||!root.current)return;
    const width=request.width??28,height=request.height??28,anchor=request.anchor??{x:0,y:0};
    const paint=()=>{const p=request.parked??point.current;root.current!.style.transform=`translate3d(${p.x-width*anchor.x}px,${p.y-height*anchor.y}px,0)`;};
    point.current=cursorPosition();paint();
    document.documentElement.toggleAttribute('data-tool-cursor',!request.parked);
    const move=(event:PointerEvent)=>{root.current!.style.visibility="visible";point.current={x:event.clientX,y:event.clientY};paint();};
    const hide=()=>{if(root.current&&!request.parked)root.current.style.visibility='hidden';};
    const leave=(event:PointerEvent)=>{if(!event.relatedTarget)hide();};
    if(!request.parked)window.addEventListener('pointermove',move,true);
    window.addEventListener('blur',hide);window.addEventListener('pointerout',leave,true);
    return()=>{window.removeEventListener('pointermove',move,true);window.removeEventListener('blur',hide);window.removeEventListener('pointerout',leave,true);delete document.documentElement.dataset.toolCursor;};
  },[request]);
  useLayoutEffect(()=>()=>{snapshots.clear();},[]);
  if(!request)return null;
  return createPortal(<div ref={root} className={`tool-cursor ${request.className??''}`} aria-hidden="true" data-visual-selector data-tool-cursor-owner={request.key} style={{width:request.width??28,height:request.height??28}}>
    <div className="tool-cursor-icon" style={{transform:request.rotationTurns?`rotate(${request.rotationTurns}turn)`:undefined}}>
      {snapshot?<div ref={captured} className="tool-cursor-captured"/>:request.icon}
    </div>
    {request.badge&&<i className={request.pulse?'tool-cursor-pulse':undefined}>{request.badge}</i>}
  </div>,document.body);
}
