/** UI ownership lasts for the physical press, independently of capture and
 * preview lifetime. Capture loss, Esc and mouse pointercancel are not releases. */
/** Secondary contextmenu may arrive after pointerup has cleared held buttons.
 * Keep that tail associated with its press until dispatch completes. */
export function createPhysicalPressTracker(){
  const held=new Set<number>();let pendingContext:number|undefined,sequence=0;
  return {
    down(id:number,button:number){held.add(id);sequence++;pendingContext=button===2?sequence:undefined;},
    up(id?:number){if(id===undefined)held.clear();else held.delete(id);},
    context(){const press=pendingContext;return()=>{if(pendingContext===press)pendingContext=undefined;};},
    reset(){held.clear();pendingContext=undefined;},
    held:()=>held.size>0,
    opening:()=>held.size>0||pendingContext!==undefined,
  };
}
const physicalPresses=createPhysicalPressTracker();
export const physicalPointerHeld=physicalPresses.held;
export const popupOpeningPress=physicalPresses.opening;
const held = new Map<number, { kind: string; buttons: number }>();
const listeners = new Set<(active: boolean) => void>();
const notify = () => listeners.forEach(listener => listener(held.size > 0));

export const uiPointerHeld = () => held.size > 0;
export function claimUIPress(pointerId: number, pointerType = "mouse", buttons = 1) {
  held.set(pointerId, { kind: pointerType || "mouse", buttons: buttons || 1 });
  notify();
}
export function observeUIPress(listener: (active: boolean) => void) {
  listeners.add(listener);
  listener(held.size > 0);
  return () => { listeners.delete(listener); };
}
export function finishUIPress(event: PointerEvent | MouseEvent) {
  let changed = false;
  if (!("pointerType" in event) || !event.pointerType || event.pointerType === "mouse") {
    for (const [id, press] of held)
      if (press.kind === "mouse" && (event.buttons & press.buttons) === 0) changed = held.delete(id) || changed;
  } else {
    const press = held.get(event.pointerId);
    if (press && (event.buttons & press.buttons) === 0) changed = held.delete(event.pointerId);
  }
  if (changed) notify();
}
export function cancelUITouch(event: PointerEvent) {
  if (event.pointerType && event.pointerType !== "mouse" && held.delete(event.pointerId)) notify();
}

// Install before component listeners can consume pointerup. Mouse events also
// recover a cancelled mouse pointer stream; a no-buttons move proves release.
if (typeof window !== "undefined") {
  const pressed=(event:PointerEvent)=>physicalPresses.down(event.pointerId,event.button);
  const released = (event: MouseEvent) => {if("pointerId" in event)physicalPresses.up(Number(event.pointerId));else physicalPresses.up();finishUIPress(event);};
  // Clear after dispatch, so popups mounted by the contextmenu itself also
  // recognize its origin. No timing window or motion-time checks.
  const context=()=>queueMicrotask(physicalPresses.context());
  const reset=()=>physicalPresses.reset();
  window.addEventListener("contextmenu",context,true);
  window.addEventListener("blur",reset);
  window.addEventListener("pointerdown",pressed,true);
  const moved = (event: MouseEvent) => {
    if (held.size) finishUIPress(event);
  };
  window.addEventListener("pointerup", released, true);
  window.addEventListener("mouseup", released, true);
  window.addEventListener("pointermove", moved, true);
  window.addEventListener("mousemove", moved, true);
  window.addEventListener("pointercancel", cancelUITouch, true);
  if (import.meta.hot) import.meta.hot.dispose(() => {
    window.removeEventListener("contextmenu",context,true);
    window.removeEventListener("blur",reset);
    window.removeEventListener("pointerdown",pressed,true);
    window.removeEventListener("pointerup", released, true);
    window.removeEventListener("mouseup", released, true);
    window.removeEventListener("pointermove", moved, true);
    window.removeEventListener("mousemove", moved, true);
    window.removeEventListener("pointercancel", cancelUITouch, true);
  });
}

/** Content editors keep ordinary gestures; explicit interface selection can still
 * select their containing controls. No DOM discovery or pointer polling. */
export function contentOwnsPointer(target:{closest:(selector:string)=>unknown}|null,interfaceSelection=false):boolean{
  return !interfaceSelection&&!!target?.closest('[data-ui-gesture-owner="content"]');
}

/** React portal events bubble through logical parents. Only the nearest actual
 * surface may interpret a press; parent dials must yield to child popups. */
export function ownsPointerSurface(surface:unknown,target:{closest:(selector:string)=>unknown}|null,selector:string):boolean{
  return !!surface&&!!target&&target.closest(selector)===surface;
}
