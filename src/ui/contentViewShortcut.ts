import {matchesShortcut} from './shortcuts.ts';
export function handleContentViewShortcut(event:KeyboardEvent,typing:boolean,toggle:()=>void,binding='V',selecting=false){
 if(typing||event.defaultPrevented||!matchesShortcut(selecting&&!event.altKey?{key:event.key,ctrlKey:false,metaKey:false,shiftKey:false,altKey:false} as KeyboardEvent:event,binding))return false;
 event.preventDefault();event.stopImmediatePropagation();if(!event.repeat)toggle();return true;
}
