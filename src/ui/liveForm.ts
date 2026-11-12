let sequence = 0;
const pending = new Set<() => void>();
const flushPending = () => { for (const flush of [...pending]) flush(); };
document.addEventListener('pointerdown', flushPending, true);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' || event.key === 'Enter' || (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') flushPending();
}, true);
window.addEventListener('pagehide', flushPending);
/** Commit valid edits by the next frame; change/Enter flush the last value.
 * Each form has its own undo group so typing and slider drags coalesce. */
export function liveForm(form: HTMLFormElement, commit: (group: string) => void) {
  const group = `form:${++sequence}`;
  let frame = 0;
  const flush = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    pending.delete(flush);
    if (form.checkValidity()) commit(group);
  };
  form.addEventListener('input', () => { if (!frame) { pending.add(flush); frame = requestAnimationFrame(flush); } });
  form.addEventListener('change', flush);
  form.addEventListener('submit', event => { event.preventDefault(); flush(); });
}
