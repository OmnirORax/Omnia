import {matchesShortcut} from './shortcuts.ts';
type Key=Pick<KeyboardEvent,'key'|'code'|'ctrlKey'|'metaKey'|'shiftKey'|'altKey'>;
const identity=(event:Key)=>event.code||event.key.toLowerCase();
/** Holds app commands until release; chord consumers suppress their prefix action. */
export function createReleaseShortcuts(){
 const pending=new Map<string,{event:Key;run:()=>void;used:boolean;held:Key[];cancel?:()=>void}>();let executing:Key[]=[];
 return {press(event:Key,run:()=>void,prefixes:readonly string[]=[],cancel?:()=>void){const id=identity(event);if(pending.has(id))return;const held=[...pending.values()].map(item=>item.event);for(const binding of prefixes)for(const item of pending.values())if(matchesShortcut(item.event as KeyboardEvent,binding)){item.used=true;item.cancel?.();item.cancel=undefined;}pending.set(id,{event,run,used:false,held,cancel});},
 held(binding:string){return [...pending.values()].some(item=>matchesShortcut(item.event as KeyboardEvent,binding))||executing.some(event=>matchesShortcut(event as KeyboardEvent,binding));},
 consume(binding:string){for(const item of pending.values())if(matchesShortcut(item.event as KeyboardEvent,binding)){item.used=true;item.cancel?.();item.cancel=undefined;}},
 release(event:Key){const id=identity(event),item=pending.get(id);if(!item)return false;pending.delete(id);if(!item.used){executing=item.held;try{item.run();}finally{executing=[];}}return true;},cancel(){for(const item of pending.values())item.cancel?.();pending.clear();executing=[];}};
}
export const releaseShortcuts=createReleaseShortcuts();
/** Replay only application key commands; ordinary text/native clipboard stay native. */
export function installReleaseShortcuts(accept:(event:KeyboardEvent)=>boolean,prefixes:(event:KeyboardEvent)=>string[]=()=>[],begin?:(event:KeyboardEvent)=>{release:()=>void;cancel:()=>void}|undefined){
 const replay=new WeakSet<Event>(),captured=new Set<string>();
 window.addEventListener('keydown',event=>{if(!event.isTrusted||replay.has(event))return;if(captured.has(identity(event))){event.preventDefault();event.stopImmediatePropagation();return;}if(!accept(event))return;event.preventDefault();event.stopImmediatePropagation();const target=event.target,focus=document.activeElement;const init:KeyboardEventInit={key:event.key,code:event.code,ctrlKey:event.ctrlKey,metaKey:event.metaKey,altKey:event.altKey,shiftKey:event.shiftKey,bubbles:true,cancelable:true};captured.add(identity(event));const session=begin?.(event);releaseShortcuts.press(event,()=>{if(!(target instanceof Node)||!target.isConnected){session?.cancel();return;}const editing=document.activeElement instanceof Element?document.activeElement.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])'):null,owner=target instanceof Element?target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])'):null;if(editing&&editing!==owner&&document.activeElement!==focus){session?.cancel();return;}if(session){session.release();return;}for(const type of ['keydown','keyup']){const next=new KeyboardEvent(type,init);replay.add(next);(target.isConnected?target:window).dispatchEvent(next);}},prefixes(event),session?.cancel);},true);
 window.addEventListener('keyup',event=>{if(!event.isTrusted||replay.has(event)||!captured.has(identity(event)))return;captured.delete(identity(event));event.preventDefault();event.stopImmediatePropagation();releaseShortcuts.release(event);},true);
 const cancel=()=>{captured.clear();releaseShortcuts.cancel();};window.addEventListener('blur',cancel);document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();});
}

/** Held-prefix commands share suppression and release-order behavior. Prefix modifiers
 * belong to the prefix, so Shift+V then Q remains Q rather than Shift+Q. */
export function createHeldCommands<E extends Pick<KeyboardEvent,'ctrlKey'|'metaKey'|'shiftKey'|'altKey'>=Key>(queue:ReturnType<typeof createReleaseShortcuts>,read:()=>readonly {binding:string;run:(command:string)=>void}[],commands:()=>readonly {id:string;binding:string}[],matches:(event:E,binding:string)=>boolean=(event,binding)=>matchesShortcut(event as unknown as KeyboardEvent,binding)){
 return {match(event:E){for(const prefix of [...read()].reverse()){if(!prefix.binding||!queue.held(prefix.binding))continue;
 const mods=prefix.binding.split('+');
 for(const command of commands()){const own=command.binding.split('+'),strip=(modifier:string)=>mods.includes(modifier)&&!own.includes(modifier),suffix={...event,key:'key' in event?event.key:undefined,code:'code' in event?event.code:undefined,button:'button' in event?event.button:undefined,ctrlKey:event.ctrlKey&&!strip('Ctrl'),metaKey:event.metaKey&&!strip('Cmd')&&!strip('Ctrl'),altKey:event.altKey&&!strip('Alt'),shiftKey:event.shiftKey&&!strip('Shift')};
 if(matches(suffix as E,command.binding))return {prefix:prefix.binding,run:()=>prefix.run(command.id)};
 }
 }return undefined;}};
}
