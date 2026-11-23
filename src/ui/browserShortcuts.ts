let enabled=false;
export const browserShortcutsEnabled=()=>enabled;
export const enableBrowserShortcuts=(value:boolean)=>{enabled=value;};
/** Cancel browser defaults after website handlers have had their turn.
 * Reserved browser/OS keys may never reach page JavaScript. */
export function blockBrowserShortcut(event:KeyboardEvent){
 if(enabled)return;
 if(event.isComposing||event.getModifierState?.('AltGraph'))return;
 const key=event.key.toLowerCase(),mod=event.ctrlKey||event.metaKey;
 const editing=!event.altKey&&(
  (!event.shiftKey&&['a','c','v','x','z','y','insert'].includes(key))||
  (event.shiftKey&&['v','z'].includes(key))||
  ['arrowleft','arrowright','arrowup','arrowdown','home','end','backspace','delete'].includes(key)
 );
 const functionKey=/^f(?:[1-9]|1[0-9]|2[0-4])$/.test(key)&&key!=='f11';
 const altBrowser=event.altKey&&['arrowleft','arrowright','home','f4','f','e','d',' '].includes(key);
 if((mod&&!editing)||functionKey||altBrowser)event.preventDefault();
}
export function installBrowserShortcutGuard(root:Window=window){
 const guarded=new WeakSet<EventTarget>();
 // Attach after existing handlers on the actual focus target. Unlike a window
 // bubble listener this still runs when a local editor stops propagation, and
 // unlike cancelling during capture it leaves editor commands able to run.
 const capture=(event:KeyboardEvent)=>{
  const target=event.composedPath()[0]??event.target;
  if(!target||guarded.has(target))return;
  guarded.add(target);target.addEventListener('keydown',blockBrowserShortcut as EventListener);
 };
 root.addEventListener('keydown',capture,true);
}
