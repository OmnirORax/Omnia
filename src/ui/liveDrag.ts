/** Lift the real UI payload without reparenting React's DOM or changing saved
 * layout. The top layer escapes dock clipping; an inert spacer keeps drop
 * geometry stable. Restore before committing through the existing history. */
export function dragSurface(root: HTMLElement): HTMLElement {
  const parent = root.parentElement;
  return parent?.matches('.floating-window,.function-frame,[data-ui-floating-surface]') ? parent : root;
}

export function beginLiveDrag(sources: HTMLElement[]) {
  const roots = [...new Set(sources)].filter(root => !sources.some(parent => parent !== root && parent.contains(root)));
  // Read every source before lifting any of them out of the layout.
  const snapshots = roots.map(element => {
    const rect = element.getBoundingClientRect(), computed = getComputedStyle(element);
    const fixed: Record<string, string> = {
      position: 'fixed', right: 'auto', bottom: 'auto', left: `${rect.x}px`, top: `${rect.y}px`,
      width: `${rect.width}px`, height: `${rect.height}px`, 'box-sizing': 'border-box',
      'min-width': '0', 'min-height': '0', 'max-width': 'none', 'max-height': 'none',
      transform: 'none', translate: 'none', rotate: 'none', scale: 'none',
      transition: 'none', animation: 'none', 'z-index': '30001',
    };
    // Suppress popover UA defaults while retaining the payload's appearance.
    for (const name of ['display', 'background-color', 'color', 'overflow-x', 'overflow-y', 'box-shadow'])
      fixed[name] = computed.getPropertyValue(name);
    for (const side of ['top', 'right', 'bottom', 'left']) {
      fixed[`margin-${side}`] = '0';
      for (const name of [`padding-${side}`, ...['width', 'style', 'color'].map(part => `border-${side}-${part}`)])
        fixed[name] = computed.getPropertyValue(name);
    }
    const spacer = document.createElement('div');
    spacer.dataset.uiNativeTag = 'transparent';
    spacer.dataset.uiDragSpacer = '';
    spacer.setAttribute('aria-hidden', 'true');
    spacer.inert = true;
    for (const name of ['display', 'margin', 'flex', 'align-self', 'order', 'grid-area', 'vertical-align'])
      spacer.style.setProperty(name, computed.getPropertyValue(name), 'important');
    for (const [name, value] of Object.entries({ width: `${rect.width}px`, height: `${rect.height}px`,
      'box-sizing': 'border-box', visibility: 'hidden', 'pointer-events': 'none' }))
      spacer.style.setProperty(name, value, 'important');
    return { element, fixed, spacer: ['absolute', 'fixed'].includes(computed.position) ? undefined : spacer,
      saved: Object.keys(fixed).map(name => [name, element.style.getPropertyValue(name), element.style.getPropertyPriority(name)]),
      popover: element.getAttribute('popover') };
  });
  let active = true;
  const restore = () => {
    if (!active) return;
    active = false;
    for (const { element, spacer, saved, popover } of snapshots) {
      if (!element.classList.contains('ui-live-drag')) continue;
      element.hidePopover();
      if (popover === null) element.removeAttribute('popover'); else element.setAttribute('popover', popover);
      element.classList.remove('ui-live-drag');
      for (const [name, value, priority] of saved) {
        if (value) element.style.setProperty(name, value, priority); else element.style.removeProperty(name);
      }
      spacer?.remove();
    }
  };
  try {
    for (const { element, spacer, fixed } of snapshots) {
      if (spacer) element.before(spacer);
      element.classList.add('ui-live-drag');
      for (const [name, value] of Object.entries(fixed)) element.style.setProperty(name, value, 'important');
      element.setAttribute('popover', 'manual');
      element.showPopover();
    }
  } catch (error) { restore(); throw error; }
  return {
    move(dx: number, dy: number) {
      if (!active) return;
      for (const { element } of snapshots)
        element.style.setProperty('transform', `translate3d(${dx}px,${dy}px,0)`, 'important');
    },
    restore,
  };
}
