import {importFont,isImportedFont} from '../properties/importedFont.ts';
import type { Origin, World } from '../core/model.ts';
import { readPaint, writePaint, resetPaint, type VisualTarget } from '../core/appearance.ts';
import { visualProperties, type Paint } from '../properties/visual.ts';
import { field } from './fields.ts';
import { liveForm } from './liveForm.ts';

export function paintForm(target: VisualTarget, origins: readonly Origin[], read:()=>World, change:(edit:(world:World)=>void,group?:string)=>void, feedback:(message:string)=>void) {
  const form=document.createElement('form'),initial=readPaint(read(),target,origins[0]);
  const inputs=visualProperties(target==='nodeText'||target==='text').map(definition=>{
    const key=definition.key as keyof Paint,entry=field(definition,initial[key]!);if(key==='font'&&isImportedFont(String(initial.font))){const option=document.createElement('option');option.value=initial.font!;option.textContent='Imported';entry.input.append(option);entry.input.value=initial.font!;}form.append(entry.row);return {key,entry,previous:entry.value()};
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
      try{const value=await importFont(input.files[0]);if(!form.isConnected)return;change(world=>writePaint(world,target,origins,{font:value}));
        const field=inputs.find(input=>input.key==='font')!;const option=document.createElement('option');option.value=value;option.textContent='Imported';field.entry.input.append(option);field.entry.input.value=value;field.previous=value;
      }catch(error){feedback(error instanceof Error?error.message:String(error));}
    };input.click();};form.append(button);
  }
  form.append(reset);
  return form;
}
