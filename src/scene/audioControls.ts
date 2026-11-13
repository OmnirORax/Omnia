import { field } from '../ui/fields.ts';
import { liveForm } from '../ui/liveForm.ts';
import { property } from '../properties/pool.ts';
import type { AudioResponse } from './audioResponse.ts';
export const definitions=[
 {key:'lightMax',property:property({key:'audio.lightMax',label:'Light max (%)',kind:'number',min:0,max:200}),scale:100},
 {key:'bounceMax',property:property({key:'audio.bounceMax',label:'Bounce max (%)',kind:'number',min:0,max:50}),scale:100},
 {key:'cooldownMs',property:property({key:'audio.cooldownMs',label:'Cooldown (ms)',kind:'number',min:0,max:10000}),scale:1},
] as const;
export function audioControls(host:{read:()=>AudioResponse;write:(value:AudioResponse,group:string)=>void;subscribe:(listener:()=>void)=>()=>void;error:(error:unknown)=>void}){
 const root=document.createElement('form'),current=host.read();
 const fields=definitions.map(d=>{const entry=field(d.property,current[d.key]*d.scale);root.append(entry.row);return{...d,...entry};});
 const disposeForm=liveForm(root,group=>{try{const next={...host.read()};for(const f of fields)next[f.key]=Number(f.value())/f.scale;host.write(next,group);}catch(error){host.error(error);}});
 const unsubscribe=host.subscribe(()=>{const value=host.read();for(const f of fields)if(document.activeElement!==f.input)f.input.value=String(Math.round(value[f.key]*f.scale*10000)/10000);});
 return{root,dispose(){disposeForm();unsubscribe();}};
}
