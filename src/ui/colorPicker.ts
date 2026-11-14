import {registerTopLayerPriority,TOP_LAYER_PRIORITY} from '../composer/runtime/ui/topLayerOrder.ts';
import {UI_CANCEL_EDIT} from '../composer/runtime/ui/activeContextModel.ts';
import {claimUIPress} from '../composer/runtime/ui/pointerOwnership.ts';
import {createValueScrub,type ValueScrub} from '../composer/runtime/ui/valueScrub.ts';
import {registerWindow} from './windowDismissal.ts';
import {channelColor,colorChannels,createColorSession} from './colorSession.ts';
let active:{field:HTMLInputElement;root:HTMLElement;finish:(accept:boolean)=>void}|undefined,installed=false;
/** One picker for React and ordinary forms. No per-field listeners or roots. */
export function openColorPicker(field:HTMLInputElement){
 if(field.disabled||!field.isConnected)return;
 if(active?.field===field)return;
 active?.finish(true);
 if(active)return;
 const root=document.createElement('section');root.className='color-picker';root.dataset.inputOwner='';root.dataset.hoverPreviewDisabled='';root.dataset.uiGestureOwner='content';root.dataset.contextController='';root.setAttribute('role','dialog');root.setAttribute('aria-label',field.getAttribute('aria-label')??'Color');
 const emit=(value:string,type:string)=>{field.value=value;field.dispatchEvent(new Event(type,{bubbles:true}));};
 const session=createColorSession(field.value,{preview:value=>{if(field.isConnected)emit(value,'input');},commit:value=>{if(field.isConnected){field.value=value;emit(value,'change');}},cancel:value=>{if(!field.isConnected)return;field.value=value;if(field.dispatchEvent(new Event(UI_CANCEL_EDIT,{cancelable:true}))) {emit(value,'input');emit(value,'change');}}});
 const finish=(accept:boolean)=>{if(active?.root!==root)return;if(accept&&![...root.querySelectorAll<HTMLInputElement>('input')].every(input=>input.reportValidity()))return;active=undefined;release();session.finish(accept);root.hidePopover();root.remove();};
 const header=document.createElement('header'),swatch=document.createElement('span'),accept=document.createElement('button'),close=document.createElement('button');
 swatch.className='color-picker-swatch';accept.type=close.type='button';accept.textContent='✓';accept.setAttribute('aria-label','Apply color');close.textContent='×';close.setAttribute('aria-label','Cancel color');accept.onclick=()=>finish(true);close.onclick=()=>finish(false);header.append(swatch,accept,close);root.append(header);
 const channels:{range:HTMLInputElement;number:HTMLInputElement}[]=[],hex=document.createElement('input');hex.type='text';hex.maxLength=7;hex.pattern='#[a-fA-F0-9]{6}';hex.required=true;hex.setAttribute('aria-label','Hex color');
 const paint=()=>{const values=colorChannels(session.value);swatch.style.background=session.value;for(const [i,entry] of channels.entries()){entry.range.value=entry.number.value=String(values[i]);const start=[...values],end=[...values];start[i]=0;end[i]=255;entry.range.style.background=`linear-gradient(to right,${channelColor(start)},${channelColor(end)})`;}if(document.activeElement!==hex)hex.value=session.value;};
 const channel=(index:number,value:number)=>{const values=colorChannels(session.value);values[index]=value;const next=channelColor(values);if(next===session.value)return;session.set(next);paint();};
 for(const [index,name] of ['Red','Green','Blue'].entries()){
  const row=document.createElement('label'),caption=document.createElement('span'),range=document.createElement('input'),number=document.createElement('input');caption.textContent=name[0];range.type='range';number.type='number';number.dataset.valuePixelsPerStep='1';range.min=number.min='0';range.max=number.max='255';range.step=number.step='1';number.required=true;range.setAttribute('aria-label',name);number.setAttribute('aria-label',`${name} value`);row.append(caption,range,number);root.append(row);channels.push({range,number});
  let drag:{id:number;scrub:ValueScrub;before:number}|undefined;
  const move=(event:PointerEvent)=>{if(drag?.id!==event.pointerId)return;const value=drag.scrub.sample({x:event.clientX,y:event.clientY});if(value!==undefined)channel(index,value);};
  range.onpointerdown=event=>{if(event.button!==0)return;event.preventDefault();event.stopPropagation();claimUIPress(event.pointerId,event.pointerType,event.buttons);const before=colorChannels(session.value)[index];drag={id:event.pointerId,before,scrub:createValueScrub({origin:{x:event.clientX,y:event.clientY},width:255,value:before,min:0,max:255,step:1,pixelsPerStep:1,axis:{x:1,y:0}})};range.setPointerCapture(event.pointerId);};
  range.onpointermove=move;range.onpointerup=event=>{if(drag?.id!==event.pointerId)return;move(event);drag=undefined;session.flush();range.releasePointerCapture(event.pointerId);};
  const cancel=()=>{if(!drag)return;const before=drag.before;drag=undefined;channel(index,before);};range.onpointercancel=cancel;range.onlostpointercapture=cancel;
  range.oninput=()=>channel(index,Number(range.value));number.oninput=()=>{if(number.value&&number.checkValidity())channel(index,Number(number.value));};
 }
 const hexRow=document.createElement('label'),caption=document.createElement('span');caption.textContent='#';hexRow.append(caption,hex);root.append(hexRow);hex.oninput=()=>{if(hex.checkValidity()){session.set(hex.value.toLowerCase());paint();}};
 document.body.append(root);const releaseWindow=registerWindow(root,()=>finish(false),1000);root.setAttribute('popover','manual');const releaseLayer=registerTopLayerPriority(root,TOP_LAYER_PRIORITY.preview+10),release=()=>{releaseWindow();releaseLayer();};active={field,root,finish};root.showPopover();paint();
 const box=field.getBoundingClientRect(),bounds=root.getBoundingClientRect();root.style.left=`${Math.max(4,Math.min(innerWidth-bounds.width-4,box.left))}px`;root.style.top=`${Math.max(4,Math.min(innerHeight-bounds.height-4,box.bottom+4))}px`;
}
export function closeColorPicker(field:HTMLInputElement){if(active?.field===field)active.finish(false);}
export function installColorPicker(){
 if(installed)return;installed=true;
 const field=(target:EventTarget|null)=>target instanceof HTMLInputElement&&target.type==='color'?target:undefined;
 window.addEventListener('click',event=>{const input=field(event.target);if(!input)return;event.preventDefault();event.stopImmediatePropagation();openColorPicker(input);},true);
 window.addEventListener('pointerdown',event=>{if(active&&event.target instanceof Node&&!active.root.contains(event.target)&&event.target!==active.field)active.finish(true);},true);
 window.addEventListener('keydown',event=>{if(active&&(event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z')active.finish(false);if(active&&(event.key==='Escape'||event.key==='Enter')){event.preventDefault();event.stopImmediatePropagation();active.finish(event.key==='Enter');return;}const input=field(event.target);if(input&&(event.key==='Enter'||event.key===' ')){event.preventDefault();event.stopImmediatePropagation();openColorPicker(input);}},true);
 window.addEventListener('blur',()=>active?.finish(true));
}
