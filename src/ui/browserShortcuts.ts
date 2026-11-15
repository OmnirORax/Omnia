let enabled=false;
export const browserShortcutsEnabled=()=>enabled;
export const enableBrowserShortcuts=(value:boolean)=>{enabled=value;};
/** Cancel browser defaults after website handlers have had their turn.
 * Reserved browser/OS keys may never reach page JavaScript. */
export function blockBrowserShortcut(event:KeyboardEvent){
 if(enabled)return;
 const key=event.key.toLowerCase(),mod=event.ctrlKey||event.metaKey;
 if((mod&&(/^[0-9]$/.test(key)||['w','n','t','l','r','p','s','o','h','j','d','f','g','e','u','+','=','-','0','tab','f4'].includes(key)))||['f1','f3','f5','f6','f10','f12'].includes(key)||(event.altKey&&['arrowleft','arrowright','home','f4'].includes(key)))event.preventDefault();
}
export function installBrowserShortcutGuard(){window.addEventListener('keydown',blockBrowserShortcut);}
