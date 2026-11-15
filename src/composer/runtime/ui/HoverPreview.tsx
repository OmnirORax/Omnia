import {flushSync} from 'react-dom';
import {createContext,useContext,useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {createHoverPreview,type HoverValue} from './hoverPreview';
const Context=createContext<ReturnType<typeof createHoverPreview>|null>(null);
export const useHoverPreview=()=>useContext(Context);
export function HoverPreviewScope({children}:{children:ReactNode}){
 const [session]=useState(createHoverPreview);
 useLayoutEffect(()=>{
  let frame=0,x=0,y=0,tail=false;
  const flush=()=>{cancelAnimationFrame(frame);frame=0;session.move(x,y);};
  const move=(e:PointerEvent)=>{if(!session.active()||e.buttons)return;if(e.target instanceof Element&&e.target.closest('[data-hover-preview-disabled]')){session.cancel();return;}x=e.clientX;y=e.clientY;if(!frame)frame=requestAnimationFrame(flush);};
  const consume=(e:Event)=>{e.preventDefault();e.stopImmediatePropagation();};
  const down=(e:PointerEvent)=>{tail=false;if(!session.active())return;if(e.button!==0){session.cancel();return;}if(!session.capturesPress())return;
   // A real slider press starts its captured drag; a hover sample must not eat it.
   if(e.target instanceof Element&&e.target.closest('[data-range-control],input,select,textarea')){cancelAnimationFrame(frame);frame=0;flushSync(()=>session.cancel());return;}
   x=e.clientX;y=e.clientY;flush();if(session.commit()){tail=true;consume(e);}};
  const after=(e:Event)=>{if(!tail)return;consume(e);if(e.type==='click')tail=false;};
  const stop=session.subscribe(()=>{cancelAnimationFrame(frame);frame=0;});
  const cancel=()=>{cancelAnimationFrame(frame);frame=0;session.cancel();};
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'&&session.active()){cancel();consume(e);}};
  window.addEventListener('pointermove',move,true);window.addEventListener('pointerdown',down,true);window.addEventListener('keydown',key,true);window.addEventListener('blur',cancel);
  for(const type of ['mousedown','pointerup','mouseup','click'])window.addEventListener(type,after,true);
  return()=>{stop();cancel();window.removeEventListener('pointermove',move,true);window.removeEventListener('pointerdown',down,true);window.removeEventListener('keydown',key,true);window.removeEventListener('blur',cancel);for(const type of ['mousedown','pointerup','mouseup','click'])window.removeEventListener(type,after,true);};
 },[session]);
 return <Context.Provider value={session}>{children}</Context.Provider>;
}
export function HoverGesture({create,children}:{create:()=>HoverValue|undefined;children:ReactNode}){
 const session=useHoverPreview(),owner=useRef({}),latest=useRef(create);latest.current=create;
 const root=useRef<HTMLSpanElement>(null);
 useLayoutEffect(()=>{
  const element=root.current?.closest('.radial-menu-slot')??root.current;if(!element||!session)return;
  const enter=(event:Event)=>{
   const e=event as PointerEvent;if(e.pointerType!=='mouse'||e.buttons||session.owns(owner.current)||element.closest('[data-hover-preview-disabled]'))return;
   flushSync(()=>session.cancel());
   const currentElement=root.current?.closest('.radial-menu-slot')??root.current;if(!currentElement?.isConnected)return;
   const gesture=latest.current();if(!gesture)return;
   session.enter(owner.current,{start:(x,y)=>{currentElement.setAttribute('data-hover-preview','');gesture.start(x,y);},move:gesture.move,commit:()=>{currentElement.removeAttribute('data-hover-preview');gesture.commit();},cancel:()=>{currentElement.removeAttribute('data-hover-preview');gesture.cancel();}},e.clientX,e.clientY);
  };
  element.addEventListener('pointerenter',enter);
  return()=>{element.removeEventListener('pointerenter',enter);session.release(owner.current);};
 },[session]);
 return <span ref={root} style={{display:'contents'}}>{children}</span>;
}
