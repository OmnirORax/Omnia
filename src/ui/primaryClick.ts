/** A mouse click belongs to the control present at press time, even if a
 * synchronous render replaces the popup/control before release. */
export function createPrimaryClickGate() {
  let press: {path:readonly unknown[];used:boolean}|undefined;
  return {
    press(path:readonly unknown[]){press={path,used:false};},
    cancel(){press=undefined;},
    click(control:unknown,detail:number){
      // Keyboard activation and element.click() have no physical mouse press.
      if(detail===0)return true;
      if(!press||press.used)return false;
      press.used=true;
      return !control||press.path.includes(control);
    },
  };
}
export function installPrimaryClickGate() {
  const gate=createPrimaryClickGate();
  const control='button,input,select,textarea,a,[role="button"],[data-ui-control]';
  window.addEventListener('pointerdown',event=>{if(event.button===0)gate.press(event.composedPath());},true);
  window.addEventListener('click',event=>{
    if(event.button!==0)return;
    const owner=event.composedPath().find(node=>node instanceof Element&&node.matches(control));
    if(!gate.click(owner,event.detail)){event.preventDefault();event.stopImmediatePropagation();}
  },true);
  window.addEventListener('pointercancel',()=>gate.cancel(),true);
  window.addEventListener('blur',()=>gate.cancel());
}
