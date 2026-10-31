/** A physical press can emit pointerdown + compatibility mousedown; mouse chords
 * can emit only mousedown. Dispatch each once without a timeout or frame polling. */
export function pointerCommandGate(){
 let pointerButton:number|undefined;
 return {
  pointer(button:number){pointerButton=button;},
  mouse(button:number){if(pointerButton===button){pointerButton=undefined;return false;}return true;},
  release(button:number){if(pointerButton===button)pointerButton=undefined;},
 };
}
