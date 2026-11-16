import {matchesShortcut} from './shortcuts.ts';
export function handleContentViewShortcut(event:KeyboardEvent,typing:boolean,toggle:()=>void,binding='V'){
 if(typing||event.defaultPrevented||!matchesShortcut(event,binding))return false;
 event.preventDefault();event.stopImmediatePropagation();if(!event.repeat)toggle();return true;
}
