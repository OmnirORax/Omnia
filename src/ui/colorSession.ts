import {createFramePreview} from '../composer/runtime/ui/framePreview.ts';
export function colorChannels(value:string){
 if(!/^#[a-f\d]{6}$/i.test(value))throw Error('Use a six-digit RGB color.');
 return [1,3,5].map(at=>parseInt(value.slice(at,at+2),16));
}
export function channelColor(channels:readonly number[]){
 if(channels.length!==3||channels.some(value=>!Number.isFinite(value)))throw Error('Invalid RGB channels.');
 return '#'+channels.map(value=>Math.max(0,Math.min(255,Math.round(value))).toString(16).padStart(2,'0')).join('');
}
export function createColorSession(initial:string,host:{preview:(value:string)=>void;commit:(value:string)=>void;cancel:(value:string)=>void},schedule?:(run:()=>void)=>number,cancelFrame?:(id:number)=>void){
 let value=initial,closed=false;
 const preview=createFramePreview(host.preview,schedule,cancelFrame);
 return {get value(){return value;},set(next:string){if(closed)return;colorChannels(next);if(next===value)return;value=next;preview.push(next);},flush:preview.flush,
  finish(accept:boolean){if(closed)return;closed=true;if(accept){preview.flush();host.commit(value);}else{preview.discard();host.cancel(initial);}}};
}
