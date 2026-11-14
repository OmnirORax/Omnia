import {flushSync} from 'react-dom';
import {createContext,useContext,useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {createValueScrub,type ValueScrub} from './valueScrub';
import {createHoverPreview} from './hoverPreview';
const Context=createContext<ReturnType<typeof createHoverPreview>|null>(null);
export const useHoverPreview=()=>useContext(Context);
export function HoverPreviewScope({children}:{children:ReactNode}){
 const [session]=useState(createHoverPreview);
 useLayoutEffect(()=>{
  let frame=0,x=0,tail=false;
  const flush=()=>{cancelAnimationFrame(frame);frame=0;session.move(x);};
  const move=(e:PointerEvent)=>{if(!session.active()||e.buttons)return;if(e.target instanceof Element&&e.target.closest('[data-hover-preview-disabled]')){session.cancel();return;}x=e.clientX;if(!frame)frame=requestAnimationFrame(flush);};
  const consume=(e:Event)=>{e.preventDefault();e.stopImmediatePropagation();};
  const down=(e:PointerEvent)=>{tail=false;if(!session.active())return;if(e.button!==0){session.cancel();return;}x=e.clientX;flush();if(session.commit()){tail=true;consume(e);}};
  const after=(e:Event)=>{if(!tail)return;consume(e);if(e.type==='click')tail=false;};
  const cancel=()=>{cancelAnimationFrame(frame);frame=0;session.cancel();};
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'&&session.active()){cancel();consume(e);}};
  window.addEventListener('pointermove',move,true);window.addEventListener('pointerdown',down,true);window.addEventListener('keydown',key,true);window.addEventListener('blur',cancel);
  for(const type of ['mousedown','pointerup','mouseup','click'])window.addEventListener(type,after,true);
  return()=>{cancel();window.removeEventListener('pointermove',move,true);window.removeEventListener('pointerdown',down,true);window.removeEventListener('keydown',key,true);window.removeEventListener('blur',cancel);for(const type of ['mousedown','pointerup','mouseup','click'])window.removeEventListener(type,after,true);};
 },[session]);
 return <Context.Provider value={session}>{children}</Context.Provider>;
}
export function HoverValue({value,min,max,step,preview,commit,children}:{value:number;min:number;max:number;step:number;preview:(n:number)=>void;commit:(n:number)=>void;children:ReactNode}){
 const session=useHoverPreview(),owner=useRef({}),latest=useRef({value,min,max,step,preview,commit});latest.current={value,min,max,step,preview,commit};
 const root=useRef<HTMLSpanElement>(null);
 useLayoutEffect(()=>{
  const element=root.current?.closest('.radial-menu-slot')??root.current;if(!element||!session)return;
  const enter=(event:Event)=>{
   const e=event as PointerEvent;if(e.pointerType!=='mouse'||e.buttons||session.owns(owner.current)||element.closest('[data-hover-preview-disabled]'))return;
   if(session.active())flushSync(()=>session.cancel());
   if(!element.isConnected)return;
   let scrub:ValueScrub,next=latest.current.value,before=next;
   const callbacks={preview:latest.current.preview,commit:latest.current.commit};
   session.enter(owner.current,{start:x=>{element.setAttribute('data-hover-preview','');const state=latest.current;before=next=state.value;scrub=createValueScrub({origin:{x,y:0},width:160,value:before,min:state.min,max:state.max,step:state.step,axis:{x:1,y:0}});},move:x=>{const n=scrub.sample({x,y:0});if(n!==undefined&&n!==next){next=n;callbacks.preview(n);}},commit:()=>{element.removeAttribute('data-hover-preview');callbacks.commit(next);},cancel:()=>{element.removeAttribute('data-hover-preview');callbacks.preview(before);}},e.clientX);
  };
  element.addEventListener('pointerenter',enter);
  return()=>{element.removeEventListener('pointerenter',enter);session.release(owner.current);};
 },[session]);
 return <span ref={root} style={{display:'contents'}}>{children}</span>;
}
