import { useId, useLayoutEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cursorSample, observeCursor } from './cursorPosition';
import { pointerToolZone, observeToolZones } from './toolCursorZone';
import { activeToolCursor, cursorApplies } from './toolCursorModel';
export type ToolCursorOptions={zone?:string;priority?:number;rotationTurns?:number;badge?:string;pulse?:boolean};
export type ToolCursorRequest=ToolCursorOptions & {key:string;icon:ReactNode;className?:string;width?:number;height?:number;anchor?:{x:number;y:number};parked?:{x:number;y:number}};
const owners=new Map<string,ToolCursorRequest>(),snapshots=new Map<string,HTMLElement>(),listeners=new Set<()=>void>();
let version=0,selected:ToolCursorRequest|null=null;
const publish=()=>{version++;listeners.forEach(listener=>listener());};
const refresh=(point=cursorSample())=>{const scope=pointerToolZone(point),next=activeToolCursor(owners.values(),request=>cursorApplies(request,scope.zone,scope.blocked));if(next!==selected){selected=next;publish();}};
const subscribe=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};};
/** Owners declare active state; transport, priority and clicked-icon inheritance are shared. */
export function useToolCursor(request:ToolCursorRequest|null){
  const owner=useId();
  useLayoutEffect(()=>{owners.delete(owner);if(request)owners.set(owner,request);refresh();},[owner,request]);
  useLayoutEffect(()=>()=>{if(owners.delete(owner))refresh();},[owner]);
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
  const request=selected;
  const root=useRef<HTMLDivElement>(null),captured=useRef<HTMLDivElement>(null),point=useRef(cursorSample());
  const snapshot=request?snapshots.get(request.key):undefined;
  useLayoutEffect(()=>{
    if(!captured.current)return;
    captured.current.replaceChildren(...(snapshot?[snapshot.cloneNode(true)]:[]));
  },[snapshot,request?.key]);
  const current=useRef(request);current.current=request;
  const paint=()=>{
    const active=current.current,node=root.current;if(!active||!node)return;
    const p=active.parked??point.current,anchor=active.anchor??{x:.5,y:.5};
    node.style.transform=`translate3d(${p.x-(active.width??28)*anchor.x}px,${p.y-(active.height??28)*anchor.y}px,0)`;
  };
  useLayoutEffect(()=>{
    const follow=(sample=cursorSample())=>{
      point.current=sample;refresh(sample);
      if(selected!==current.current){if(root.current)root.current.style.visibility='hidden';delete document.documentElement.dataset.toolCursor;return;}
      if(selected&&root.current){
        if(root.current.style.visibility!=='visible')root.current.style.visibility='visible';
        const hideNative=!selected.parked;
        if(document.documentElement.hasAttribute('data-tool-cursor')!==hideNative)document.documentElement.toggleAttribute('data-tool-cursor',hideNative);
      }
      if(!selected?.parked)paint();
    };
    const stopPointer=observeCursor(follow),stopZones=observeToolZones(follow);
    return()=>{stopPointer();stopZones();delete document.documentElement.dataset.toolCursor;};
  },[]);
  useLayoutEffect(()=>{
    if(root.current)root.current.style.visibility='visible';paint();
    document.documentElement.toggleAttribute('data-tool-cursor',!!request&&!request.parked);
    return()=>{delete document.documentElement.dataset.toolCursor;};
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
