import {selectionLatch} from './selectionLatch.ts';
import type {OperationNumber,OperationChoices} from './operationNumber.ts';
/** Shift-after-activation edits a parameter without starting or accepting its operation. */
export function createOperationDial(options:{host:HTMLElement;active:()=>boolean;number:()=>OperationNumber|undefined;changed?:()=>void;feedback:(message:string)=>void;choices?:OperationChoices;mount?:typeof import('./operationMathDial.tsx').mountOperationMathDial}){
 let dispose:(()=>void)|undefined,opened=false,generation=0;
 function close(){if(!opened)return;opened=false;generation++;dispose?.();dispose=undefined;options.host.hidden=true;options.changed?.();}
 function open(){if(!options.active())return false;if(opened)return true;const number=options.number();if(!number)return false;opened=true;options.host.hidden=false;const epoch=++generation;
  const mount=options.mount?Promise.resolve({mountOperationMathDial:options.mount}):import('./operationMathDial.tsx');
  void mount.then(module=>{if(opened&&epoch===generation&&options.active())dispose=module.mountOperationMathDial(options.host,number,close,options.choices);}).catch(error=>{close();options.feedback(String(error));});options.changed?.();return true;
 }
 return {open,close,get active(){return opened;},key(event:KeyboardEvent){if(event.key!=='Shift'||event.repeat||!options.active()||event.ctrlKey||event.metaKey||event.altKey)return false;selectionLatch.use();event.preventDefault();event.stopImmediatePropagation();if(opened)close();else open();return true;}};
}
