import {matchesShortcut} from './shortcuts.ts';
type Key=Pick<KeyboardEvent,'key'|'code'|'ctrlKey'|'metaKey'|'shiftKey'|'altKey'>;
const identity=(event:Key)=>event.code||event.key.toLowerCase();
/** Holds app commands until release; chord consumers suppress their prefix action. */
export function createReleaseShortcuts(){
 const pending=new Map<string,{event:Key;run:()=>void;used:boolean;held:Key[]}>();let executing:Key[]=[];
 return {press(event:Key,run:()=>void,prefixes:readonly string[]=[]){const id=identity(event);if(pending.has(id))return;const held=[...pending.values()].map(item=>item.event);for(const binding of prefixes)for(const item of pending.values())if(matchesShortcut(item.event as KeyboardEvent,binding))item.used=true;pending.set(id,{event,run,used:false,held});},
 held(binding:string){return [...pending.values()].some(item=>matchesShortcut(item.event as KeyboardEvent,binding))||executing.some(event=>matchesShortcut(event as KeyboardEvent,binding));},
 consume(binding:string){for(const item of pending.values())if(matchesShortcut(item.event as KeyboardEvent,binding))item.used=true;},
 release(event:Key){const id=identity(event),item=pending.get(id);if(!item)return false;pending.delete(id);if(!item.used){executing=item.held;try{item.run();}finally{executing=[];}}return true;},cancel(){pending.clear();executing=[];}};
}
export const releaseShortcuts=createReleaseShortcuts();
/** Replay only application key commands; ordinary text/native clipboard stay native. */
export function installReleaseShortcuts(accept:(event:KeyboardEvent)=>boolean,prefixes:(event:KeyboardEvent)=>string[]=()=>[]){
 const replay=new WeakSet<Event>(),captured=new Set<string>();
 window.addEventListener('keydown',event=>{if(!event.isTrusted||replay.has(event))return;if(captured.has(identity(event))){event.preventDefault();event.stopImmediatePropagation();return;}if(!accept(event))return;event.preventDefault();event.stopImmediatePropagation();const target=event.target,focus=document.activeElement;const init:KeyboardEventInit={key:event.key,code:event.code,ctrlKey:event.ctrlKey,metaKey:event.metaKey,altKey:event.altKey,shiftKey:event.shiftKey,bubbles:true,cancelable:true};captured.add(identity(event));releaseShortcuts.press(event,()=>{if(!(target instanceof Node)||!target.isConnected)return;const editing=document.activeElement instanceof Element?document.activeElement.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])'):null,owner=target instanceof Element?target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])'):null;if(editing&&editing!==owner&&document.activeElement!==focus)return;for(const type of ['keydown','keyup']){const next=new KeyboardEvent(type,init);replay.add(next);(target.isConnected?target:window).dispatchEvent(next);}},prefixes(event));},true);
 window.addEventListener('keyup',event=>{if(!event.isTrusted||replay.has(event)||!captured.has(identity(event)))return;captured.delete(identity(event));event.preventDefault();event.stopImmediatePropagation();releaseShortcuts.release(event);},true);
 const cancel=()=>{captured.clear();releaseShortcuts.cancel();};window.addEventListener('blur',cancel);document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();});
}
