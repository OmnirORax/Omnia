import {registerValueDrag,cancelValueDrag} from './valueDrag.ts';
import {createOperationNumber,type OperationNumber} from './operationNumber.ts';
import {popupControlTarget} from '../composer/runtime/ui/popupPlacement.ts';
import {confirmWindowWithin} from './windowDismissal.ts';
let closeActive:(()=>void)|undefined;
/** A value box lends one scratch parameter to shared sliding and dial configuration. */
export function bindOperationValueControl(button:HTMLInputElement,options:{label:string;min:number;max:number;integer?:boolean;step:number;read:()=>number;preview:(n?:number)=>void;commit:(n:number)=>void;feedback:(message:string)=>void;loadDial:()=>Promise<typeof import('./operationMathDial.tsx')>}){
 type Session={number:OperationNumber;sliding:boolean;panel?:HTMLElement;unmount?:()=>void;epoch:number;resume?:(accept?:boolean)=>void};
 let session:Session|undefined,disposed=false;
 const closePanel=(accept=false)=>{const active=session;if(!active)return;if(accept&&active.panel)confirmWindowWithin(active.panel);active.epoch++;active.unmount?.();active.unmount=undefined;active.panel?.remove();active.panel=undefined;};
 const end=()=>{if(!session)return;cancelValueDrag(button);if(!session)return;closePanel();session=undefined;button.value=String(options.read());options.preview();if(closeActive===end)closeActive=undefined;};
 const start=(sliding:boolean)=>{closeActive?.();const active:Session={sliding,epoch:0,number:undefined!};
  active.number=createOperationNumber({label:options.label,value:options.read(),min:options.min,max:options.max,integer:options.integer,reject:options.feedback,apply:(n,phase)=>{
   if(disposed||session!==active)return;button.value=String(n);
   if(phase==='commit'&&!active.sliding){options.commit(n);queueMicrotask(()=>{if(session===active)end();});}else options.preview(n);
  }});session=active;closeActive=end;return active;
 };
 const openPanel=async(resume?:(accept?:boolean)=>void)=>{const active=session??start(false);if(active.panel)return;active.resume=resume;
  if(active.sliding)active.number.commit(active.number.current,{mode:'value',anchor:active.number.current,count:0,value:active.number.current,snap:active.number.grid?.snap});
  // A keyboard-only opener starts directly in configuration, without saving its baseline.
  const bounds=button.getBoundingClientRect(),placement={target:popupControlTarget(button),requested:{x:bounds.left+bounds.width/2,y:bounds.top+bounds.height/2}};
  const panel=document.createElement('div');panel.className='operation-number-dial';panel.dataset.inputOwner='';Object.assign(panel.style,{position:'fixed',left:`${placement.requested.x}px`,top:`${placement.requested.y}px`,zIndex:'10000'});document.body.append(panel);active.panel=panel;const epoch=++active.epoch;panel.tabIndex=-1;panel.focus();
  const done=()=>{if(session!==active||active.epoch!==epoch)return;if(active.sliding)active.resume?.(false);else end();};
  try{const module=await options.loadDial();if(!disposed&&session===active&&active.epoch===epoch&&active.panel===panel)active.unmount=module.mountOperationMathDial(panel,active.number,done,undefined,placement);}catch(error){if(session===active&&active.epoch===epoch){options.feedback(String(error));if(active.sliding)active.resume?.(false);else end();}}
 };
 const stop=registerValueDrag(button,{read:()=>{const number=session?.number;return {value:number?.current??options.read(),min:number?.min??options.min,max:number?.max??options.max,step:number?.grid?.snap??options.step,pixelsPerStep:6,axis:{x:0,y:-1}};},
  start:()=>{start(true);},input:n=>session?.number.preview(n),commit:n=>{options.commit(n);end();},cancel:()=>end(),configure:{owns:target=>!!session?.panel?.contains(target),open:resume=>{void openPanel(resume);},close:accept=>closePanel(accept)},
 });
 button.onclick=()=>{if(disposed||session?.panel)return Promise.resolve();return openPanel();};
 return()=>{if(disposed)return;stop();end();disposed=true;button.onclick=null;};
}
