import {bindOperationValueControl} from './operationValueControl.ts';
import {bindColorSession} from './colorSession.ts';
import {watchFields} from './formState.ts';
import {importFont,isImportedFont} from '../properties/importedFont.ts';
import type { Origin, World } from '../core/model.ts';
import { readPaint, writePaint, resetPaint, type VisualTarget } from '../core/appearance.ts';
import { visualProperties, FONT_SIZE, type Paint } from '../properties/visual.ts';
import { field } from './fields.ts';
import { liveForm } from './liveForm.ts';

export function paintForm(target: VisualTarget, origins: readonly Origin[], read:()=>World, change:(edit:(world:World)=>void,group?:string)=>void, feedback:(message:string)=>void,preview?:(patch?:Paint)=>void,loadDial=()=>import('./operationMathDial.tsx')) {
  let disposed=false;
  const form=document.createElement('form'),initial=readPaint(read(),target,origins[0]);
  const inputs=visualProperties(target==='nodeText'||target==='text',initial).map(definition=>{
    const key=definition.key as keyof Omit<Paint,'gradient'>,entry=field(definition,initial[key]!);form.append(entry.row);return {key,entry,previous:entry.value()};
  });
  const sizeInput=inputs.find(input=>input.key==='fontSize');
  const stopValue=sizeInput&&sizeInput.entry.input instanceof HTMLInputElement?bindOperationValueControl(sizeInput.entry.input,{label:'Font size',min:FONT_SIZE.min,max:FONT_SIZE.max,integer:true,step:1,read:()=>Number(readPaint(read(),target,origins[0]).fontSize),preview:n=>preview?.(n===undefined?undefined:{fontSize:n}),commit:value=>{if(disposed)return;try{change(world=>writePaint(world,target,origins,{fontSize:value}));sizeInput.entry.input.value=String(value);sizeInput.previous=value;}catch(error){feedback(String(error));}},feedback,loadDial}):undefined;
  if(sizeInput&&sizeInput.entry.input instanceof HTMLInputElement)sizeInput.entry.input.type='button';
  if(preview)for(const input of inputs)if(input.entry.input instanceof HTMLInputElement&&input.entry.input.type==='color')bindColorSession(input.entry.input,{
   read:()=>String(readPaint(read(),target,origins[0])[input.key]),preview:value=>preview({[input.key]:value}),cancel:()=>preview(),
   commit:value=>{try{change(world=>writePaint(world,target,origins,{[input.key]:value}));input.previous=value;}catch(error){preview();feedback(String(error));}}
  });
  const stopLive=liveForm(form, group=>{
    const changed=inputs.filter(input=>input.key!=='fontSize'&&input.entry.value()!==input.previous);if(!changed.length)return;
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
      try{const value=await importFont(input.files[0]);if(disposed||!form.isConnected)return;const name=input.files[0].name.replace(/\.(woff2?|ttf|otf)$/i,'').slice(0,160)||'Imported font';change(world=>writePaint(world,target,origins,{font:value,fontName:name}));
        const field=inputs.find(input=>input.key==='font')!;for(const option of Array.from((field.entry.input as HTMLSelectElement).options))if(isImportedFont(option.value))option.remove();const option=document.createElement('option');option.value=value;option.textContent=name;field.entry.input.append(option);field.entry.input.value=value;field.previous=value;
      }catch(error){feedback(error instanceof Error?error.message:String(error));}
    };input.click();};form.append(button);
  }
  const stopFields=watchFields(form,inputs.map(input=>({input:input.entry.input,read:()=>{const paint=readPaint(read(),target,origins[0]);if(input.key==='font'&&isImportedFont(String(paint.font))){let option=Array.from((input.entry.input as HTMLSelectElement).options).find(option=>option.value===paint.font);if(!option){option=document.createElement('option');option.value=paint.font!;input.entry.input.append(option);}option.textContent=paint.fontName??'Imported font';}return paint[input.key];},onSync:()=>{input.previous=input.entry.value();}})));
  form.append(reset);
  return {root:form,dispose(){if(disposed)return;disposed=true;stopValue?.();stopLive();stopFields();}};
}
