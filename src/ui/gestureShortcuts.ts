import type {ShortcutDefinition} from './shortcuts.ts';
import {POINTER_BINDINGS,PREVIEW_BINDING} from './pointerBindings.ts';
/** One editable activation per owner; click/drag phases share its binding. */
export const WORLD_GESTURES:ShortcutDefinition[]=[
 ...POINTER_BINDINGS.filter(item=>item.category==='Omnium'),PREVIEW_BINDING,
 {category:'Omnium',id:'world:V',label:'View contents / hierarchy modifier',defaultKey:'V'},
];
export const DOCUMENT_GESTURES:ShortcutDefinition[]=POINTER_BINDINGS.filter(item=>item.category==='Document');
