import { claimUIPress, observeUIPress, uiPointerHeld } from "./ui/pointerOwnership";

/** A press belongs to the surface where it began, until its actual release.
 * OrbitControls listens on document; pointer capture alone cannot isolate it
 * from UI gestures or clear its state after an interrupted canvas gesture. */
export function guardCameraPointer(
  canvas: HTMLCanvasElement,
  setUIActive: (active: boolean) => void,
  cancelWorkspaceGesture: () => void,
) {
  const world = new Set<number>();
  const cancelWorld = () => {
    if (!world.size) return;
    const pointers = [...world];
    world.clear();
    for (const id of pointers)
      if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    cancelWorkspaceGesture();
  };
  // Explicit drag claims also reach us when a UI handler consumes pointerdown
  // before this listener runs (for example a selected-button gesture).
  const unsubscribe = observeUIPress(active => {
    setUIActive(active);
    if (active) cancelWorld();
  });
  const down = (event: PointerEvent) => {
    if (!event.composedPath().includes(canvas)) {
      claimUIPress(event.pointerId, event.pointerType, event.buttons);
      return;
    }
    if (uiPointerHeld()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    // A fresh press with the same pointer means its earlier release was lost.
    if (world.has(event.pointerId)) cancelWorld();
    world.add(event.pointerId);
  };
  const up = (event: PointerEvent) => {
    if (event.type === "pointerup" && event.buttons !== 0) return;
    if (event.type === "pointercancel" && world.has(event.pointerId)) {
      event.stopImmediatePropagation();
      cancelWorld();
    }
    world.delete(event.pointerId);
  };
  const lost = (event: PointerEvent) => {
    if (event.target === canvas && world.has(event.pointerId)) cancelWorld();
  };
  const blur = () => {
    cancelWorld();
    // Focus loss is not evidence that a held mouse button was released.
    setUIActive(uiPointerHeld());
  };
  window.addEventListener("pointerdown", down, true);
  window.addEventListener("pointerup", up, true);
  window.addEventListener("pointercancel", up, true);
  window.addEventListener("lostpointercapture", lost, true);
  window.addEventListener("blur", blur);
  return {
    owns: (event: PointerEvent) => !uiPointerHeld() && world.has(event.pointerId),
    dispose: () => {
      unsubscribe();
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", up, true);
      window.removeEventListener("lostpointercapture", lost, true);
      window.removeEventListener("blur", blur);
    },
  };
}
