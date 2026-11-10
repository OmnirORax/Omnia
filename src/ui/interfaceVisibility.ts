/** Consume Escape only to restore a hidden interface; otherwise retain normal input ownership. */
export function restoreHiddenUI(event:Pick<KeyboardEvent,'key'|'repeat'|'preventDefault'|'stopImmediatePropagation'>,hidden:boolean,typing:boolean,restore:()=>void){
 if(!hidden||event.key!=='Escape'||event.repeat||typing)return false;
 event.preventDefault();event.stopImmediatePropagation();restore();return true;
}
