export function handleContentViewShortcut(event:KeyboardEvent,typing:boolean,toggle:()=>void){
 if(typing||event.defaultPrevented||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey||event.key.toLowerCase()!=='v')return false;
 event.preventDefault();event.stopImmediatePropagation();if(!event.repeat)toggle();return true;
}
