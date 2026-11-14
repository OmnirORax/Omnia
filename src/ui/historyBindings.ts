import {pointerCommandGate} from '../composer/runtime/ui/pointerCommandGate.ts';
import {featureActionRuntime} from '../composer/runtime/featureActions.ts';
export function sideButtonAction(button:number,shift:boolean){return button===3||button===4?shift?'configure':button===3?'undo':'redo':undefined;}
/** V1 mouse defaults: MB4 undo, MB5 redo, Shift+either configures history.
 * Consume press, release and auxclick so Chrome never navigates the tab. */
export function installHistoryBindings(actions:{undo:()=>void;redo:()=>void;configure:()=>void;flush?:()=>void}){
 const gate=pointerCommandGate();
 const run=(event:MouseEvent)=>{
   const action=sideButtonAction(event.button,event.shiftKey);if(!action)return;
   if(!event.defaultPrevented){actions.flush?.();const context=event.button===3?'context.previous':'context.next';if(event.altKey&&featureActionRuntime.available(context))featureActionRuntime.invoke(context);else actions[action]();}
   event.preventDefault();event.stopImmediatePropagation();
 };
 window.addEventListener('pointerdown',event=>{if(sideButtonAction(event.button,event.shiftKey)){gate.pointer(event.button);run(event);}},true);
 window.addEventListener('mousedown',event=>{if(sideButtonAction(event.button,event.shiftKey)){if(gate.mouse(event.button))run(event);else {event.preventDefault();event.stopImmediatePropagation();}}},true);
 const end=(event:MouseEvent)=>{if(sideButtonAction(event.button,event.shiftKey)){gate.release(event.button);event.preventDefault();event.stopImmediatePropagation();}};
 window.addEventListener('pointerup',end,true);window.addEventListener('mouseup',end,true);window.addEventListener('auxclick',end,true);
 window.addEventListener('keydown',event=>{
   if(event.defaultPrevented||event.repeat||!(event.ctrlKey||event.metaKey)||event.altKey)return;
   const key=event.key.toLowerCase();if(key!=='z'&&key!=='y')return;
   actions.flush?.();event.preventDefault();event.stopImmediatePropagation();actions[key==='y'||event.shiftKey?'redo':'undo']();
 },true);
}
