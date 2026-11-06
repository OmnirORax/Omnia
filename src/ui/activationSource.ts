/** Click activation is independent of arrangement permission. Only an actual
 * draggable handle or active resize surface may arm drag-tail suppression.
 * Resolve the nearest owner: a fixed child button does not inherit its frame's
 * drag capability. No layout reads or registry discovery on pointer motion. */
export function dragActivationSource(target:Element):boolean {
 if(target.closest('input,select,textarea,[contenteditable=true]'))return false;
 if(target.closest('[data-ui-resize]:not([aria-disabled=true]),.window-resize-grip,.ui-bubble-drag'))return true;
 const handle=target.closest<HTMLElement>('[data-ui-control],[data-ui-drag],[data-ui-function]');
 return !!handle?.draggable;
}
