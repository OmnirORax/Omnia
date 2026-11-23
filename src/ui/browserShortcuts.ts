/** Physical browser-command keys only. Never capture system modifiers or Tab:
 * Keyboard Lock cannot distinguish Ctrl+Tab from the OS's Alt+Tab. */
export const BROWSER_LOCK_CODES=Object.freeze([
 ...Array.from({length:10},(_,i)=>`Digit${i}`),
 ...Array.from({length:26},(_,i)=>`Key${String.fromCharCode(65+i)}`),
 ...Array.from({length:12},(_,i)=>`F${i+1}`),
 'Escape','Minus','Equal',
]);
let enabled=false;
export const browserShortcutsEnabled=()=>enabled;
export const enableBrowserShortcuts=(value:boolean)=>{enabled=value;};
/** Cancel browser defaults after website handlers have had their turn.
 * Reserved browser/OS keys may never reach page JavaScript. */
export function blockBrowserShortcut(event:KeyboardEvent,mac=typeof navigator!=='undefined'&&/Mac/.test(navigator.platform)){
 if(enabled||event.metaKey&&!mac)return;
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
  guarded.add(target);target.addEventListener('keydown',event=>blockBrowserShortcut(event as KeyboardEvent));
 };
 root.addEventListener('keydown',capture,true);
}
