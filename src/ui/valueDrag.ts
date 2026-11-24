import {selectionLatch} from './selectionLatch.ts';
import {createRelativePointer} from './relativePointer.ts';
import {claimUIPress} from '../composer/runtime/ui/pointerOwnership.ts';
import {PAGE_INPUT_SUSPEND} from '../composer/runtime/ui/pageInputBoundary.ts';
import {mathematicalValueRejection} from '../properties/mathematicalDial.ts';
export type NumberDrag = {value:number;min?:number;max?:number;step?:number;pixelsPerStep?:number;axis?:{x:number;y:number};activation?:'click'|'drag'};
/** Horizontal relative movement; bounds and declared increments remain authoritative. */
export function horizontalValue(config:NumberDrag,delta:number){
  const {value,min,max,step}=config;
  if(!Number.isFinite(delta)||delta===0)return value;
  const bounded=min!==undefined&&max!==undefined&&Number.isFinite(max-min)&&max>min;
  const unit=config.pixelsPerStep&&step?step/config.pixelsPerStep:bounded?(max-min)/200:step&&step>0?step/6:Math.max(1,Math.abs(value))/100;
  let next=value+delta*unit;
  if(step&&step>0){const anchor=min??0;next=anchor+Math.round((next-anchor)/step)*step;}
  if(min!==undefined)next=Math.max(min,next);if(max!==undefined)next=Math.min(max,next);
  return Number.isFinite(next)?Number(next.toPrecision(12)):value;
}
export function valueDragDistance(config:NumberDrag,dx:number,dy:number){const axis=config.axis;if(!axis)return dx;const length=Math.hypot(axis.x,axis.y);return length>0?(dx*axis.x+(Number.isFinite(dy)?dy:0)*axis.y)/length:dx;}
type Adapter={text?:{input:(text:string)=>void;accept:(text:string)=>boolean};configure?:{open:(resume:(accept?:boolean)=>void)=>void;close:(accept:boolean)=>void;owns?:(target:HTMLElement)=>boolean};start?:()=>void;read:()=>NumberDrag|undefined;input:(value:number)=>void;commit:(value:number)=>void;cancel:(value:number)=>void};
const adapters=new WeakMap<HTMLElement,Adapter>(),activeOwners=new WeakMap<HTMLElement,()=>void>();
export const cancelValueDrag=(root:HTMLElement)=>activeOwners.get(root)?.();
export function registerValueDrag(root:HTMLElement,adapter:Adapter){
  adapters.set(root,adapter);root.dataset.valueDrag='';
  return()=>{cancelValueDrag(root);adapters.delete(root);delete root.dataset.valueDrag;};
}
function numericInput(target:EventTarget|null){
  return target instanceof HTMLInputElement&&!target.disabled&&!target.readOnly&&
    (target.type==='range'||target.type==='number'||target.inputMode==='numeric'||target.inputMode==='decimal')?target:undefined;
}
function inputAdapter(field:HTMLInputElement):Adapter{
  const number=(text:string)=>text.trim()&&Number.isFinite(Number(text))?Number(text):undefined;
  const write=(value:number)=>{
    // Bypass React's value tracker so its existing onChange receives the edit.
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(field,String(value));
    field.dispatchEvent(new Event('input',{bubbles:true}));
  };
  const read=()=>{
    const value=field.value.trim()?Number(field.value):NaN;if(!Number.isFinite(value))return;
    return {value,pixelsPerStep:Number(field.dataset?.valuePixelsPerStep)||undefined,min:number(field.min),max:number(field.max),step:field.step==='any'?undefined:number(field.step)??(field.type==='number'||field.inputMode==='numeric'?1:undefined)};
  };
  const typed=(text:string,report=false)=>{const value=text.trim()?Number(text):NaN,reason=mathematicalValueRejection(value,{min:number(field.min)??-Number.MAX_SAFE_INTEGER,max:number(field.max)??Number.MAX_SAFE_INTEGER,integer:field.step!=='any'&&(number(field.step)??1)===1});if(reason){if(report){field.setCustomValidity(reason);field.reportValidity();}return false;}field.setCustomValidity('');write(value);return true;};
  return {read,text:{input:text=>{typed(text);field.value=text;},accept:text=>typed(text,true)},input:write,commit:value=>{if(field.value!==String(value))write(value);field.dispatchEvent(new Event('change',{bubbles:true}));field.blur();},cancel:value=>{field.setCustomValidity('');write(value);field.dispatchEvent(new Event('change',{bubbles:true}));}};
}
export function installValueDrag(){
  type Drag={id:number;root:HTMLElement;adapter:Adapter;config:NumberDrag;x:number;y:number;active:boolean;configuring:boolean;text?:string;baseline:number;released:boolean;next:number};
  let drag:Drag|undefined,suppressClick=false,enterHeld=false;const suspended:Drag[]=[];
  let lastPoint={x:0,y:0};
  window.addEventListener('pointermove',event=>{if(drag&&!relative.locked)lastPoint={x:event.clientX,y:event.clientY};},true);
  const relative=createRelativePointer(()=>finish(true));
  const stop=(event:Event)=>{event.preventDefault();event.stopImmediatePropagation();};
  const finish=(cancel=false)=>{
    const current=drag;if(!current)return;
    if(!cancel&&current.text!==undefined){if(!current.adapter.text?.accept(current.text))return;current.next=Number(current.text);}
    // Detach ownership before callbacks can synchronously dispose or reopen controls.
    drag=suspended.pop();activeOwners.delete(current.root);relative.stop();
    if(current.root.hasPointerCapture(current.id))current.root.releasePointerCapture(current.id);
    if(current.active)suppressClick=!cancel||!current.released;
    try{if(current.active){if(cancel)current.adapter.cancel(current.baseline);else current.adapter.commit(current.next);}}
    finally{current.adapter.configure?.close(false);if(!drag?.active||drag.configuring)document.documentElement.classList.remove('value-dragging');}
  };
  const activate=(current:NonNullable<typeof drag>,event:MouseEvent|PointerEvent)=>{
    current.adapter.start?.();activeOwners.set(current.root,()=>{while(drag&&drag!==current&&suspended.includes(current))finish(true);if(drag===current)finish(true);});current.active=true;stop(event);claimUIPress(current.id,'pointerType' in event?event.pointerType:'mouse',event.buttons);
    selectionLatch.use();
    document.documentElement.classList.add('value-dragging');relative.start(current.root,{x:current.x,y:current.y},{requireLock:true});
  };
  window.addEventListener('pointerdown',event=>{
    if(event.button!==0||event.pointerType==='touch')return;
    const field=numericInput(event.target),root=field??(event.target instanceof Element?event.target.closest<HTMLElement>('[data-value-drag]'):null);
    const paused=drag?.configuring?drag:undefined;
    if(paused){if(!root||root===paused.root||!paused.adapter.configure?.owns?.(root))return;}else{if(drag?.active){stop(event);finish();return;}finish(true);}
    suppressClick=false;if(!root||root.closest('[data-range-control]'))return;const adapter=adapters.get(root)??(field?inputAdapter(field):undefined),config=adapter?.read();if(!adapter||!config)return;
    if(paused){suspended.push(paused);drag=undefined;}
    lastPoint={x:event.clientX,y:event.clientY};drag={id:event.pointerId,root,adapter,config,x:event.clientX,y:event.clientY,active:false,configuring:false,baseline:config.value,released:false,next:config.value};
    if(config.activation!=='drag')activate(drag,event);
  },true);
  const move=(event:MouseEvent|PointerEvent)=>{
    const current=drag;if(!current||current.configuring)return;
    if(current.active){stop(event);if(current.text!==undefined||!relative.locked)return;}
    if(!current.root.isConnected){finish(true);return;}
    if(!current.active){if(Math.abs(valueDragDistance(current.config,event.clientX-current.x,event.clientY-current.y))<4)return;activate(current,event);if(!relative.locked)return;}
    stop(event);const point=relative.sample(event);lastPoint={x:event.clientX,y:event.clientY};const next=horizontalValue(current.config,valueDragDistance(current.config,point.x-current.x,point.y-current.y));if(next!==current.next){current.next=next;current.adapter.input(next);}
  };
  relative.observeMove(move);
  window.addEventListener('pointerup',event=>{if(drag?.configuring||drag?.id!==event.pointerId||event.button!==0)return;if(!drag.active){finish();return;}stop(event);drag.released=true;suppressClick=true;if(drag.root.hasPointerCapture(drag.id))drag.root.releasePointerCapture(drag.id);},true);
  window.addEventListener('mouseup',event=>{if(drag?.active&&!drag.configuring&&event.button===0){drag.released=true;suppressClick=true;stop(event);if(drag.root.hasPointerCapture(drag.id))drag.root.releasePointerCapture(drag.id);}},true);
  window.addEventListener('mousedown',event=>{if(relative.locked&&drag?.active&&!drag.configuring&&event.button===0){stop(event);if(drag.released)finish();}},true);
  window.addEventListener('dragstart',event=>{if(drag)stop(event);},true);
  window.addEventListener('pointercancel',event=>{if(drag?.id===event.pointerId&&!drag.configuring&&!relative.active)finish(true);},true);
  window.addEventListener('lostpointercapture',event=>{if(drag?.id===event.pointerId&&!drag.active)finish(true);},true);
  const resume=(accept=true)=>{const current=drag;if(!current?.configuring)return;current.configuring=false;current.adapter.configure?.close(accept);const config=current.adapter.read();if(!config){finish(true);return;}current.config=config;current.next=config.value;current.released=true;current.x=lastPoint.x;current.y=lastPoint.y;suppressClick=false;document.documentElement.classList.add('value-dragging');relative.start(current.root,lastPoint,{requireLock:true});};
  window.addEventListener('keyup',event=>{if(event.key==='Enter'&&enterHeld){enterHeld=false;stop(event);}},true);
  window.addEventListener('keydown',event=>{
   if(event.key==='Enter'&&enterHeld){stop(event);return;}
   if(event.key==='Shift'&&!event.repeat&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&suspended.length){stop(event);selectionLatch.use();finish();resume();return;}
   const current=drag;if(!current?.active)return;
   if(event.key==='Shift'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&current.adapter.configure){stop(event);selectionLatch.use();if(event.repeat)return;if(current.text!==undefined){if(!current.adapter.text?.accept(current.text))return;current.text=undefined;}if(current.configuring){resume();}else{current.configuring=true;relative.stop();suppressClick=false;document.documentElement.classList.remove('value-dragging');current.adapter.configure.open(resume);}return;}
   if(!current.configuring&&current.adapter.text&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.isComposing){
    const key=event.key;if(/^[\d.,+-]$/.test(key)||key==='Backspace'||key==='Delete'||current.text!==undefined&&/^[eE]$/.test(key)){
     stop(event);const before=current.text??'';current.text=key==='Backspace'?before.slice(0,-1):key==='Delete'?'':before+(key===','?'.':key);current.adapter.text.input(current.text);return;
    }
    if(current.text!==undefined&&key.length===1){stop(event);return;}
   }
   if(event.key==='Enter'&&!current.configuring&&!event.ctrlKey&&!event.metaKey&&!event.altKey){stop(event);enterHeld=true;if(!event.repeat)finish();return;}
   if(event.key==='Escape'){stop(event);finish(true);}
  },true);
  window.addEventListener('click',event=>{if(suppressClick&&event.detail>0){suppressClick=false;stop(event);}},true);
  const cancelAll=()=>{enterHeld=false;while(drag)finish(true);};
  window.addEventListener('blur',cancelAll);window.addEventListener(PAGE_INPUT_SUSPEND,cancelAll);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelAll();});
}
