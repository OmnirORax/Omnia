/** UI ownership lasts for the physical press, independently of capture and
 * preview lifetime. Capture loss, Esc and mouse pointercancel are not releases. */
const physicalPresses=new Set<number>();
export const physicalPointerHeld=()=>physicalPresses.size>0;
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
  const pressed=(event:PointerEvent)=>physicalPresses.add(event.pointerId);
  const released = (event: MouseEvent) => {if("pointerId" in event)physicalPresses.delete(Number(event.pointerId));else physicalPresses.clear();finishUIPress(event);};
  window.addEventListener("pointerdown",pressed,true);
  const moved = (event: MouseEvent) => {
    if(event.buttons===0)physicalPresses.clear();
    if (held.size) finishUIPress(event);
  };
  window.addEventListener("pointerup", released, true);
  window.addEventListener("mouseup", released, true);
  window.addEventListener("pointermove", moved, true);
  window.addEventListener("mousemove", moved, true);
  window.addEventListener("pointercancel", cancelUITouch, true);
  if (import.meta.hot) import.meta.hot.dispose(() => {
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
