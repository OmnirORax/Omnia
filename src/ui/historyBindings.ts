import {pointerCommandGate} from '../composer/runtime/ui/pointerCommandGate.ts';
import {featureActionRuntime} from '../composer/runtime/featureActions.ts';
import {matchesShortcut,worldBinding} from './shortcuts.ts';
export function sideButtonAction(button:number,shift:boolean){return button===3||button===4?shift?'configure':button===3?'undo':'redo':undefined;}
/** V1 mouse defaults: MB4 undo, MB5 redo, Shift+either configures history.
 * Consume press, release and auxclick so Chrome never navigates the tab. */
export function installHistoryBindings(actions:{undo:()=>void;redo:()=>void;configure:()=>void;flush?:()=>void;sideButton?:(event:MouseEvent)=>boolean}){
 const gate=pointerCommandGate();
 const run=(event:MouseEvent)=>{
   const action=sideButtonAction(event.button,event.shiftKey);if(!action)return;
   if(!event.defaultPrevented){actions.flush?.();if(actions.sideButton?.(event)){event.preventDefault();event.stopImmediatePropagation();return;}const context=event.button===3?'context.previous':'context.next';if(event.altKey&&featureActionRuntime.available(context))featureActionRuntime.invoke(context);else actions[action]();}
   event.preventDefault();event.stopImmediatePropagation();
 };
 window.addEventListener('pointerdown',event=>{if(sideButtonAction(event.button,event.shiftKey)){gate.pointer(event.button);run(event);}},true);
 window.addEventListener('mousedown',event=>{if(sideButtonAction(event.button,event.shiftKey)){if(gate.mouse(event.button))run(event);else {event.preventDefault();event.stopImmediatePropagation();}}},true);
 const end=(event:MouseEvent)=>{if(sideButtonAction(event.button,event.shiftKey)){gate.release(event.button);event.preventDefault();event.stopImmediatePropagation();}};
 window.addEventListener('pointerup',end,true);window.addEventListener('mouseup',end,true);window.addEventListener('auxclick',end,true);
 window.addEventListener('keydown',event=>{
   if(event.defaultPrevented||event.repeat||typeof Element!=='undefined'&&event.target instanceof Element&&event.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),.cm-editor'))return;
   const undo=matchesShortcut(event,worldBinding('Ctrl+Z')),redo=matchesShortcut(event,worldBinding('Ctrl+Y'))||matchesShortcut(event,worldBinding('Ctrl+Shift+Z'));if(!undo&&!redo)return;
   actions.flush?.();event.preventDefault();event.stopImmediatePropagation();actions[undo?'undo':'redo']();
 },true);
}
