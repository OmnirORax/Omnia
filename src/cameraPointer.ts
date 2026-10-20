/** A press belongs to the surface where it began, until its actual release.
 * OrbitControls listens on document; pointer capture alone cannot isolate it
 * from UI gestures or clear its state after an interrupted canvas gesture. */
export function guardCameraPointer(
  canvas: HTMLCanvasElement,
  setUIActive: (active: boolean) => void,
  cancelWorkspaceGesture: () => void,
) {
  const world = new Set<number>();
  const ui = new Set<number>();
  const cancelWorld = () => {
    if (!world.size) return;
    const pointers = [...world];
    world.clear();
    for (const id of pointers)
      if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    cancelWorkspaceGesture();
  };
  const down = (event: PointerEvent) => {
    if (!event.composedPath().includes(canvas)) {
      ui.add(event.pointerId);
      setUIActive(true);
      cancelWorld();
      return;
    }
    if (ui.size) {
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
    if (ui.delete(event.pointerId)) setUIActive(ui.size > 0);
  };
  const lost = (event: PointerEvent) => {
    if (event.target === canvas && world.has(event.pointerId)) cancelWorld();
  };
  const blur = () => {
    cancelWorld();
    ui.clear();
    setUIActive(false);
  };
  window.addEventListener("pointerdown", down, true);
  window.addEventListener("pointerup", up, true);
  window.addEventListener("pointercancel", up, true);
  window.addEventListener("lostpointercapture", lost, true);
  window.addEventListener("blur", blur);
  return {
    owns: (event: PointerEvent) => !ui.size && world.has(event.pointerId),
    dispose: () => {
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", up, true);
      window.removeEventListener("lostpointercapture", lost, true);
      window.removeEventListener("blur", blur);
    },
  };
}
