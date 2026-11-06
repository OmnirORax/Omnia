/** Native semantics and shared control declarations identify input owners.
 * New controls inherit routing through their normal UI/accessibility metadata. */
export const CONTROL_INPUT_OWNER='button,input,select,textarea,a[href],label,summary,[contenteditable]:not([contenteditable="false"]),[tabindex],[role="button"],[role="slider"],[role="combobox"],[role="textbox"],[data-ui-control],[data-ui-function],[data-range-control],[data-ui-popup-interior],[data-ui-gesture-owner]';
/** Preserve the physical press path when a capture render reparents controls. */
export function controlInputOwner(element:{closest?:(selector:string)=>unknown}|null,path:readonly unknown[]=[]){
 if(path.length)return path.find(node=>!!node&&typeof node==='object'&&'matches' in node&&typeof node.matches==='function'&&node.matches(CONTROL_INPUT_OWNER))??null;
 return element?.closest?.(CONTROL_INPUT_OWNER)??null;
}
type InputElement={contains(node:unknown):boolean;closest?(selector:string):unknown};
/** The nearest owner on the physical press path wins. A registered content root
 * owns its canvas, while nested controls retain their own press and click tail. */
export function surfaceOwnsInput(root:InputElement,element:unknown,path:readonly unknown[]=[]){
 if(path.length){for(const node of path){if(node===root)return true;if(node&&typeof node==='object'&&'matches' in node&&typeof node.matches==='function'&&node.matches(CONTROL_INPUT_OWNER))return false;}return false;}
 if(root!==element&&!root.contains(element))return false;
 const control=(element as InputElement|null)?.closest?.(CONTROL_INPUT_OWNER);
 return !control||control===root||!root.contains(control);
}
