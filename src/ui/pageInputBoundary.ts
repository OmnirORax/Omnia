/** Browser chrome is outside app input. Focus loss is never a UI command.
 * Only input owners subscribe to suspension, to release held/unfinished input.
 * Renderers may still observe visibilitychange to pause/resume their clocks.
 */
export const PAGE_INPUT_SUSPEND = "omnium:page-input-suspend";

export function installPageInputBoundary() {
  const focusLoss = (event: Event) => {
    if (document.hasFocus() && !document.hidden) return;
    // Keep native browser focus behavior, but prevent app blur/focusout handlers
    // (including React's delegated handlers) from interpreting it as an action.
    event.stopImmediatePropagation();
    if (event.target === window) window.dispatchEvent(new Event(PAGE_INPUT_SUSPEND));
  };
  window.addEventListener("blur", focusLoss, true);
  window.addEventListener("focusout", focusLoss, true);
  return () => {
    window.removeEventListener("blur", focusLoss, true);
    window.removeEventListener("focusout", focusLoss, true);
  };
}
