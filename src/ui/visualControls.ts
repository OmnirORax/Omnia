import {createOperationNumber} from './operationNumber.ts';
import {bindColorSession} from './colorSession.ts';
import {watchFields} from './formState.ts';
import {importFont,isImportedFont} from '../properties/importedFont.ts';
import type { Origin, World } from '../core/model.ts';
import { readPaint, writePaint, resetPaint, type VisualTarget } from '../core/appearance.ts';
import { visualProperties, FONT_SIZE, type Paint } from '../properties/visual.ts';
import { field } from './fields.ts';
import { liveForm } from './liveForm.ts';

let closeFontDial:(()=>void)|undefined;
export function paintForm(target: VisualTarget, origins: readonly Origin[], read:()=>World, change:(edit:(world:World)=>void,group?:string)=>void, feedback:(message:string)=>void,preview?:(patch?:Paint)=>void) {
  const form=document.createElement('form'),initial=readPaint(read(),target,origins[0]);
  const inputs=visualProperties(target==='nodeText'||target==='text',initial).map(definition=>{
    const key=definition.key as keyof Paint,entry=field(definition,initial[key]!);form.append(entry.row);return {key,entry,previous:entry.value()};
  });
  const sizeInput=inputs.find(input=>input.key==='fontSize');
  if(sizeInput&&sizeInput.entry.input instanceof HTMLInputElement){const button=sizeInput.entry.input;button.type='button';button.onclick=async event=>{
   const bounds=button.getBoundingClientRect(),placement={target:{x:bounds.left,y:bounds.top,width:bounds.width,height:bounds.height},requested:{x:event.detail?event.clientX:bounds.left+bounds.width/2,y:event.detail?event.clientY:bounds.top+bounds.height/2}};
   closeFontDial?.();const host=document.createElement('div');host.className='operation-number-dial';host.dataset.inputOwner='';Object.assign(host.style,{position:'fixed',left:`${placement.requested.x}px`,top:`${placement.requested.y}px`,zIndex:'10000'});document.body.append(host);let dispose:(()=>void)|undefined,closed=false;
   const close=()=>{if(closed)return;closed=true;dispose?.();host.remove();preview?.();if(closeFontDial===close)closeFontDial=undefined;};closeFontDial=close;host.tabIndex=-1;host.focus();host.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close();}},true);
   const number=createOperationNumber({label:'Font size',value:Number(readPaint(read(),target,origins[0]).fontSize),min:FONT_SIZE.min,max:FONT_SIZE.max,integer:true,apply:(value,phase)=>{if(phase==='commit'){try{change(world=>writePaint(world,target,origins,{fontSize:value}));button.value=String(value);sizeInput.previous=value;}catch(error){feedback(String(error));}queueMicrotask(close);}else preview?.(phase==='preview'?{fontSize:value}:undefined);},reject:feedback});
   try{const module=await import('./operationMathDial.tsx');if(!closed)dispose=module.mountOperationMathDial(host,number,close,undefined,placement);}catch(error){close();feedback(String(error));}
  };}
  if(preview)for(const input of inputs)if(input.entry.input instanceof HTMLInputElement&&input.entry.input.type==='color')bindColorSession(input.entry.input,{
   read:()=>String(readPaint(read(),target,origins[0])[input.key]),preview:value=>preview({[input.key]:value}),cancel:()=>preview(),
   commit:value=>{try{change(world=>writePaint(world,target,origins,{[input.key]:value}));input.previous=value;}catch(error){preview();feedback(String(error));}}
  });
  liveForm(form, group=>{
    const changed=inputs.filter(input=>input.entry.value()!==input.previous);if(!changed.length)return;
    const patch=Object.fromEntries(changed.map(input=>[input.key,input.entry.value()])) as Paint;
    try{change(world=>writePaint(world,target,origins,patch),group);for(const input of changed)input.previous=input.entry.value();}
    catch(error){feedback(error instanceof Error?error.message:String(error));}
  });
  const reset=document.createElement('button');reset.type='button';reset.textContent='Reset';
  reset.onclick=()=>{
    try{
      change(world=>resetPaint(world,target,origins));const paint=readPaint(read(),target,origins[0]);
      for(const input of inputs){input.entry.input.value=String(paint[input.key]);input.previous=input.entry.value();}
    }catch(error){feedback(error instanceof Error?error.message:String(error));}
  };
  if(target==='text'||target==='nodeText'){
    const button=document.createElement('button');button.type='button';button.textContent='Import font';
    button.onclick=()=>{const input=document.createElement('input');input.type='file';input.accept='.woff,.woff2,.ttf,.otf';input.onchange=async()=>{
      if(!input.files?.[0])return;
      try{const value=await importFont(input.files[0]);if(!form.isConnected)return;const name=input.files[0].name.replace(/\.(woff2?|ttf|otf)$/i,'').slice(0,160)||'Imported font';change(world=>writePaint(world,target,origins,{font:value,fontName:name}));
        const field=inputs.find(input=>input.key==='font')!;for(const option of Array.from((field.entry.input as HTMLSelectElement).options))if(isImportedFont(option.value))option.remove();const option=document.createElement('option');option.value=value;option.textContent=name;field.entry.input.append(option);field.entry.input.value=value;field.previous=value;
      }catch(error){feedback(error instanceof Error?error.message:String(error));}
    };input.click();};form.append(button);
  }
  watchFields(form,inputs.map(input=>({input:input.entry.input,read:()=>{const paint=readPaint(read(),target,origins[0]);if(input.key==='font'&&isImportedFont(String(paint.font))){let option=Array.from((input.entry.input as HTMLSelectElement).options).find(option=>option.value===paint.font);if(!option){option=document.createElement('option');option.value=paint.font!;input.entry.input.append(option);}option.textContent=paint.fontName??'Imported font';}return paint[input.key];},onSync:()=>{input.previous=input.entry.value();}})));
  form.append(reset);
  return form;
}
