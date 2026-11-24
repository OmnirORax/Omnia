import type {KeyBinding} from '@codemirror/view';
import {undo,redo} from '@codemirror/commands';
/** Platform aliases inherit the command's history owner, including rebound keys. */
export function documentHistoryBindings(bindings:readonly KeyBinding[],travel:(direction:'undo'|'redo')=>unknown):KeyBinding[]{
 const route=(run:KeyBinding['run']):KeyBinding['run']=>run===undo?()=>{travel('undo');return true;}:run===redo?()=>{travel('redo');return true;}:run;
 return bindings.map(binding=>({...binding,run:route(binding.run),...(binding.shift?{shift:route(binding.shift)}:{})}));
}
