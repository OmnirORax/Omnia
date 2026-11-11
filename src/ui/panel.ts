export function panel(title: string, onClose?: () => void | boolean) {
  const root = document.createElement('section'); root.className = 'panel'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', title);
  root.dataset.inputOwner = '';
  const heading = document.createElement('header'), caption = document.createElement('span'), close = document.createElement('button'), body = document.createElement('div');
  caption.textContent = title; close.textContent = '×'; close.setAttribute('aria-label', 'Close'); body.className = 'panel-body';
  const dispose = () => { if (onClose?.() === false) return; root.remove(); };
  root.addEventListener('keydown', event => { if (event.key === 'Escape') { event.stopPropagation(); dispose(); } });
  close.onclick = dispose; heading.append(caption, close); root.append(heading, body); document.body.append(root);
  heading.onpointerdown = event => {
    if (event.target === close || event.button !== 0) return;
    const box = root.getBoundingClientRect(), start = { x: event.clientX, y: event.clientY };
    heading.setPointerCapture(event.pointerId);
    heading.onpointermove = move => { root.style.left = `${Math.max(0, Math.min(innerWidth - 40, box.left + move.clientX - start.x))}px`; root.style.top = `${Math.max(0, Math.min(innerHeight - 30, box.top + move.clientY - start.y))}px`; root.style.right = 'auto'; };
    heading.onpointerup = heading.onpointercancel = () => { heading.onpointermove = null; };
  };
  return { root, body, close: dispose };
}
