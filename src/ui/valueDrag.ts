import {claimUIPress} from '../composer/runtime/ui/pointerOwnership.ts';
import {PAGE_INPUT_SUSPEND} from '../composer/runtime/ui/pageInputBoundary.ts';
export type NumberDrag = {value:number;min?:number;max?:number;step?:number;pixelsPerStep?:number};
/** Horizontal relative movement; bounds and declared increments remain authoritative. */
export function horizontalValue(config:NumberDrag,delta:number){
  const {value,min,max,step}=config;
  if(!Number.isFinite(delta))return value;
  const bounded=min!==undefined&&max!==undefined&&Number.isFinite(max-min)&&max>min;
  const unit=config.pixelsPerStep&&step?step/config.pixelsPerStep:bounded?(max-min)/200:step&&step>0?step/6:Math.max(1,Math.abs(value))/100;
  let next=value+delta*unit;
  if(step&&step>0){const anchor=min??0;next=anchor+Math.round((next-anchor)/step)*step;}
  if(min!==undefined)next=Math.max(min,next);if(max!==undefined)next=Math.min(max,next);
  return Number.isFinite(next)?Number(next.toPrecision(12)):value;
}
type Adapter={read:()=>NumberDrag|undefined;input:(value:number)=>void;commit:(value:number)=>void;cancel:(value:number)=>void};
const adapters=new WeakMap<HTMLElement,Adapter>();
export function registerValueDrag(root:HTMLElement,adapter:Adapter){
  adapters.set(root,adapter);root.dataset.valueDrag='';
  return()=>{adapters.delete(root);delete root.dataset.valueDrag;};
}
function numericInput(target:EventTarget|null){
  return target instanceof HTMLInputElement&&!target.disabled&&!target.readOnly&&
    (target.type==='number'||target.inputMode==='numeric'||target.inputMode==='decimal')?target:undefined;
}
function inputAdapter(field:HTMLInputElement):Adapter{
  const write=(value:number)=>{
    // Bypass React's value tracker so its existing onChange receives the edit.
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(field,String(value));
    field.dispatchEvent(new Event('input',{bubbles:true}));
  };
  return {read:()=>{
    const value=field.value.trim()?Number(field.value):NaN;if(!Number.isFinite(value))return;
    const number=(text:string)=>text.trim()&&Number.isFinite(Number(text))?Number(text):undefined;
    return {value,pixelsPerStep:Number(field.dataset?.valuePixelsPerStep)||undefined,min:number(field.min),max:number(field.max),step:field.step==='any'?undefined:number(field.step)??(field.type==='number'||field.inputMode==='numeric'?1:undefined)};
  },input:write,commit:()=>{field.dispatchEvent(new Event('change',{bubbles:true}));field.blur();},cancel:value=>{write(value);field.dispatchEvent(new Event('change',{bubbles:true}));}};
}
export function installValueDrag(){
  let drag:{id:number;root:HTMLElement;adapter:Adapter;config:NumberDrag;x:number;active:boolean;next:number}|undefined,suppressClick=false;
  const stop=(event:Event)=>{event.preventDefault();event.stopImmediatePropagation();};
  const finish=(cancel=false)=>{
    const current=drag;drag=undefined;if(!current)return;
    document.documentElement.classList.remove('value-dragging');
    if(current.root.hasPointerCapture(current.id))current.root.releasePointerCapture(current.id);
    if(current.active){suppressClick=true;if(cancel)current.adapter.cancel(current.config.value);else current.adapter.commit(current.next);}
  };
  window.addEventListener('pointerdown',event=>{
    if(event.button!==0||event.pointerType==='touch')return;
    finish(true);suppressClick=false;
    const field=numericInput(event.target),root=field??(event.target instanceof Element?event.target.closest<HTMLElement>('[data-value-drag]'):null);
    if(!root)return;const adapter=field?inputAdapter(field):adapters.get(root),config=adapter?.read();if(!adapter||!config)return;
    drag={id:event.pointerId,root,adapter,config,x:event.clientX,active:false,next:config.value};
  },true);
  const move=(event:PointerEvent)=>{
    const current=drag;if(!current||current.id!==event.pointerId)return;
    if(!current.root.isConnected){finish(true);return;}
    if(!current.active){if(Math.abs(event.clientX-current.x)<(current.config.pixelsPerStep?1:4))return;current.active=true;claimUIPress(event.pointerId,event.pointerType,event.buttons);current.root.setPointerCapture(event.pointerId);document.documentElement.classList.add('value-dragging');}
    stop(event);const next=horizontalValue(current.config,event.clientX-current.x);
    if(next!==current.next){current.next=next;current.adapter.input(next);}
  };
  window.addEventListener('pointermove',event=>{if(drag&&!(event.buttons&1)){finish();return;}move(event);},true);
  window.addEventListener('pointerup',event=>{if(drag?.id!==event.pointerId||event.button!==0)return;const active=drag.active;if(active){move(event);stop(event);}finish();},true);
  window.addEventListener('dragstart',event=>{if(drag)stop(event);},true);
  window.addEventListener('pointercancel',event=>{if(drag?.id===event.pointerId)finish(true);},true);
  window.addEventListener('lostpointercapture',event=>{if(drag?.id===event.pointerId)finish(true);},true);
  window.addEventListener('keydown',event=>{if(event.key==='Escape'&&drag?.active){stop(event);finish(true);}},true);
  window.addEventListener('click',event=>{if(suppressClick&&event.detail>0){suppressClick=false;stop(event);}},true);
  window.addEventListener('blur',()=>finish(true));window.addEventListener(PAGE_INPUT_SUSPEND,()=>finish(true));
  document.addEventListener('visibilitychange',()=>{if(document.hidden)finish(true);});
}
