import {clearMathCursorReadout} from './mathCursorReadout.ts';
import {registerValueDrag,cancelValueDrag} from './valueDrag.ts';
import {createOperationNumber,type OperationNumber,type ConfirmedMathValue} from './operationNumber.ts';
import {popupControlTarget} from '../composer/runtime/ui/popupPlacement.ts';
import {confirmWindowWithin} from './windowDismissal.ts';
let closeActive:(()=>void)|undefined;
/** A value box lends one scratch parameter to shared sliding and dial configuration. */
export function bindOperationValueControl(button:HTMLInputElement,options:{label:string;min:number;max:number;integer?:boolean;step:number;read:()=>number;preview:(n?:number)=>void;commit:(n:number)=>void;feedback:(message:string)=>void;loadDial:()=>Promise<typeof import('./operationMathDial.tsx')>}){
 type Session={number:OperationNumber;sliding:boolean;panel?:HTMLElement;unmount?:()=>void;epoch:number;scrub?:ReturnType<OperationNumber['scrub']>;resume?:(accept?:boolean)=>void};
 let session:Session|undefined,disposed=false,retained:{configuration:ConfirmedMathValue;snap?:number;min:number;max:number}|undefined;
 const remember=(active:Session)=>{retained={configuration:active.number.currentConfiguration,snap:active.number.grid?.snap,min:active.number.min,max:active.number.max};};
 const closePanel=(accept=false)=>{const active=session;if(!active)return;if(accept&&active.panel)confirmWindowWithin(active.panel);active.epoch++;active.unmount?.();active.unmount=undefined;active.panel?.remove();active.panel=undefined;};
 const end=()=>{if(!session)return;cancelValueDrag(button);if(!session)return;const owner=session.number.readoutOwner;closePanel();session=undefined;clearMathCursorReadout(owner);button.value=String(options.read());options.preview();if(closeActive===end)closeActive=undefined;};
 const start=(sliding:boolean)=>{closeActive?.();const active:Session={sliding,epoch:0,number:undefined!};
  active.number=createOperationNumber({label:options.label,value:options.read(),initialConfiguration:retained?.configuration.value===options.read()?retained.configuration:{mode:'value',base:1,anchor:options.read(),count:0,value:options.read()},gridSnap:retained?.snap??(options.step===1?undefined:options.step),min:options.min,max:options.max,integer:options.integer,reject:options.feedback,apply:(n,phase)=>{
   if(disposed||session!==active)return;button.value=String(n);
   if(phase==='commit'&&!active.sliding){options.commit(n);queueMicrotask(()=>{if(session===active){remember(active);end();}});}else options.preview(n);
  }});if(retained){if(retained.min!==options.min)active.number.setLimit('min',retained.min);if(retained.max!==options.max)active.number.setLimit('max',retained.max);}session=active;closeActive=end;if(active.number.current!==options.read())active.number.preview(active.number.current,active.number.currentConfiguration);return active;
 };
 const openPanel=async(resume?:(accept?:boolean)=>void)=>{const active=session??start(false);if(active.panel)return;active.resume=resume;
  if(active.sliding)active.number.commit(active.number.current,active.number.currentConfiguration);
  // A keyboard-only opener starts directly in configuration, without saving its baseline.
  const bounds=button.getBoundingClientRect(),placement={target:popupControlTarget(button),requested:{x:bounds.left+bounds.width/2,y:bounds.top+bounds.height/2}};
  const panel=document.createElement('div');panel.className='operation-number-dial';panel.dataset.inputOwner='';Object.assign(panel.style,{position:'fixed',left:`${placement.requested.x}px`,top:`${placement.requested.y}px`,zIndex:'10000'});document.body.append(panel);active.panel=panel;const epoch=++active.epoch;panel.tabIndex=-1;panel.focus();
  const done=()=>{if(session!==active||active.epoch!==epoch)return;if(active.sliding)active.resume?.(false);else end();};
  try{const module=await options.loadDial();if(!disposed&&session===active&&active.epoch===epoch&&active.panel===panel)active.unmount=module.mountOperationMathDial(panel,active.number,done,undefined,placement);}catch(error){if(session===active&&active.epoch===epoch){options.feedback(String(error));if(active.sliding)active.resume?.(false);else end();}}
 };
 const stop=registerValueDrag(button,{read:()=>{const active=session??start(true),scrub=active.number.scrub();active.scrub=scrub;const current=scrub.toValue(scrub.value);if(current!==active.number.current&&Number.isFinite(current))active.number.preview(current,scrub.configuration(scrub.value));return {...scrub,pixelsPerStep:6,axis:{x:0,y:-1}};},
  text:{input:text=>{session?.number.type(text);button.value=text;},accept:text=>session?.number.type(text,true)??false},
  input:n=>{const active=session;if(active?.scrub)active.number.preview(active.scrub.toValue(n),active.scrub.configuration(n));},commit:()=>{const active=session;if(!active)return;remember(active);options.commit(active.number.current);end();},cancel:()=>end(),configure:{owns:target=>!!session?.panel?.contains(target),open:resume=>{void openPanel(resume);},close:accept=>closePanel(accept)},
 });
 button.onclick=()=>{if(disposed||session?.panel)return Promise.resolve();return openPanel();};
 return()=>{if(disposed)return;stop();end();disposed=true;button.onclick=null;};
}
