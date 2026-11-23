import {matchesShortcut} from './shortcuts.ts';
export type KeyboardLock={lock:(keys?:string[])=>Promise<void>;unlock:()=>void};
type Host={keyboard?:KeyboardLock;fullscreen:()=>boolean;enter:()=>Promise<void>;exit:()=>Promise<void>;changed:()=>void};
/** Explicit fullscreen session; never reacquire keyboard permission on exit. */
export function createImmersiveMode(host:Host){
 const keyboard=typeof host.keyboard?.lock==='function'&&typeof host.keyboard.unlock==='function'?host.keyboard:undefined;
 let phase:'off'|'entering'|'active'|'leaving'='off',generation=0,ownsFullscreen=false,pending=false;
 const update=(next:typeof phase)=>{phase=next;host.changed();};
 const release=()=>{keyboard?.unlock();};
 return {
  get phase(){return phase;},
  get supported(){return !!keyboard;},
  async enter(){
   if(pending||phase!=='off')return;
   if(!keyboard)throw Error('Keyboard Lock is unavailable in this browser.');
   if(host.fullscreen())throw Error('Exit fullscreen, then enter Immersive mode.');
   const token=++generation;pending=true;update('entering');
   try{
    await host.enter();ownsFullscreen=true;
    if(token!==generation){if(host.fullscreen())await host.exit();ownsFullscreen=false;return;}
    // Deliver every browser-supported key to app handlers, including reserved
    // shortcuts. Browsers retain their mandatory long-Escape escape hatch.
    await keyboard.lock();
    if(token!==generation||!host.fullscreen()){release();if(token===generation)update('off');return;}
    update('active');
   }catch(error){
    release();
    if(ownsFullscreen&&host.fullscreen())await host.exit().catch(()=>{});
    ownsFullscreen=false;update('off');
    throw Error(`Immersive mode could not start: ${error instanceof Error?error.message:String(error)}`);
   }finally{pending=false;}
  },
  async leave(){
   ++generation;release();update('leaving');
   try{if(ownsFullscreen&&host.fullscreen())await host.exit();}
   finally{ownsFullscreen=false;update('off');}
  },
  fullscreenChanged(){if(!host.fullscreen()&&phase!=='off'){++generation;release();ownsFullscreen=false;update('off');}},
 };
}

/** Called during window capture so editor-local key handlers cannot swallow F11. */
export function handleImmersiveShortcut(event:KeyboardEvent,toggle:()=>void,binding='F11'){
 if(!matchesShortcut(event,binding))return false;
 event.preventDefault();event.stopImmediatePropagation();
 if(!event.repeat)toggle();
 return true;
}
