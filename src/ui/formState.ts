import type {Value} from '../properties/pool.ts';
type Control=Pick<HTMLInputElement,'value'|'type'|'disabled'>&{checked?:boolean};
export type LiveField={input:Control;read:()=>Value|undefined;onSync?:(value:Value)=>void};
/** Compare model values, so unrelated edits preserve a field's unfinished text. */
export function createFieldBinding(field:LiveField){
 let previous=field.read();const available=field.input.disabled;
 return ()=>{
  const value=field.read();if(Object.is(value,previous))return;previous=value;
  field.input.disabled=value===undefined||available;if(value===undefined)return;
  if(field.input.type==='checkbox')field.input.checked=Boolean(value);
  else if(field.input.value!==String(value)&&!(typeof value==='number'&&field.input.value.trim()&&Number(field.input.value)===value))field.input.value=String(value);
  field.onSync?.(value);
 };
}
const forms=new Set<{form:HTMLFormElement;sync:()=>void}>();let pending=false;
export function watchFields(form:HTMLFormElement,fields:readonly LiveField[]){
 const bindings=fields.map(createFieldBinding),entry={form,sync:()=>{for(const sync of bindings)sync();}};forms.add(entry);
 return()=>forms.delete(entry);
}
export function syncLiveForms(){for(const entry of forms){if(!entry.form.isConnected)forms.delete(entry);else if(!entry.form.closest('[hidden]'))entry.sync();}}
/** Model publishes and history notifications share one check before browser paint. */
export function requestFormSync(){if(pending)return;pending=true;queueMicrotask(()=>{pending=false;syncLiveForms();});}
