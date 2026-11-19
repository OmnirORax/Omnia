import {cursorPosition} from '../composer/runtime/ui/cursorPosition.ts';
import {formatMathConfiguration,positionCursorReadout} from './cursorReadout.ts';
import type {ConfirmedMathValue} from './operationNumber.ts';
let output:HTMLOutputElement|undefined,owner:string|undefined,text='',point={x:0,y:0},frame=0,listening:Window|undefined,size={width:0,height:0};
/** One shared confirmed-value readout; pointer transport never derives values. */
export function showMathCursorReadout(id:string,label:string,config:ConfirmedMathValue,host?:HTMLElement){
 if(typeof document==='undefined'||typeof window==='undefined')return;
 if(listening!==window){listening=window;window.addEventListener('pointermove',event=>{point={x:event.clientX,y:event.clientY};if(owner&&!frame)frame=requestAnimationFrame(()=>{frame=0;if(output&&owner){output.hidden=false;positionCursorReadout(output,point,36,size);}});});}
 point=cursorPosition();
 const next=`${label} · ${formatMathConfiguration(config)}`;
 if(!output?.isConnected){output=document.createElement('output');output.className='axis-coordinate math-cursor-readout';(host??document.body).append(output);text='';}
 owner=id;output.hidden=false;if(text!==next){text=next;output.textContent=next;size={width:output.offsetWidth??0,height:output.offsetHeight??0};}
 positionCursorReadout(output,point,36,size);
}
export function clearMathCursorReadout(id:string){if(owner!==id)return;owner=undefined;if(output)output.hidden=true;}
