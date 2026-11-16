import {matchesShortcut} from './shortcuts.ts';
export function handleContentViewShortcut(event:KeyboardEvent,typing:boolean,toggle:()=>void,binding='V',selecting=false){
 if(typing||event.defaultPrevented||!matchesShortcut(selecting&&!event.altKey?{key:event.key,ctrlKey:false,metaKey:false,shiftKey:false,altKey:false} as KeyboardEvent:event,binding))return false;
 event.preventDefault();event.stopImmediatePropagation();if(!event.repeat)toggle();return true;
}

export function heldContentAction(toggle:()=>void){let key='',used=false;return {get active(){return !!key;},press(value:string){key=value.toLowerCase();used=false;},consume(){if(key)used=true;},release(value:string){if(!key||value.toLowerCase()!==key)return false;const apply=!used;key='';used=false;if(apply)toggle();return true;},cancel(){key='';used=false;}};}
