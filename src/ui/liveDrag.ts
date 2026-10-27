/** Lift the real UI payload without reparenting React's DOM or changing saved
 * layout. The top layer escapes dock clipping; an inert spacer keeps drop
 * geometry stable. Restore before committing through the existing history. */
export function dragSurface(root: HTMLElement): HTMLElement {
  const parent = root.parentElement;
  return parent?.matches('.floating-window,.function-frame,[data-ui-floating-surface]') ? parent : root;
}

type LiftBounds = { rect: { x: number; y: number; width: number; height: number }; display?: string };

export function beginLiveDrag(sources: HTMLElement[], bounds = new Map<HTMLElement, LiftBounds>()) {
  const roots = [...new Set(sources)].filter(root => !sources.some(parent => parent !== root && parent.contains(root)));
  // Read every source before lifting any of them out of the layout.
  const snapshots = roots.map(element => {
    const override = bounds.get(element);
    const rect = override?.rect ?? element.getBoundingClientRect(), computed = getComputedStyle(element);
    // A fixed surface already portalled to body needs only a compositor move.
    // Lifting it through the top layer on every grab unnecessarily changes its
    // formatting context and invalidates the entire heavy window's layout.
    const direct = !override && element.parentElement === document.body && computed.position === 'fixed'
      && !element.matches(':popover-open');
    if (direct) {
      const fixed: Record<string, string> = { 'z-index': '30001', 'will-change': 'transform', transition: 'none' };
      return { element, fixed, spacer: undefined,
        saved: [...Object.keys(fixed), 'transform'].map(name => [name, element.style.getPropertyValue(name), element.style.getPropertyPriority(name)]),
        popover: element.getAttribute('popover'), direct: true, transform: computed.transform === 'none' ? '' : computed.transform };
    }
    const fixed: Record<string, string> = {
      position: 'fixed', right: 'auto', bottom: 'auto', left: `${rect.x}px`, top: `${rect.y}px`,
      width: `${rect.width}px`, height: `${rect.height}px`, 'box-sizing': 'border-box',
      'min-width': '0', 'min-height': '0', 'max-width': 'none', 'max-height': 'none',
      transform: 'none', translate: 'none', rotate: 'none', scale: 'none',
      transition: 'none', animation: 'none', 'z-index': '30001', 'will-change': 'transform',
    };
    // Suppress popover UA defaults while retaining the payload's appearance.
    for (const name of ['display', 'background-color', 'color', 'overflow-x', 'overflow-y', 'box-shadow'])
      fixed[name] = computed.getPropertyValue(name);
    if (override?.display) fixed.display = override.display;
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
      popover: element.getAttribute('popover'), direct: false, transform: '' };
  });
  let active = true;
  const restore = () => {
    if (!active) return;
    active = false;
    for (const { element, spacer, saved, popover, direct } of snapshots) {
      if (!element.classList.contains('ui-live-drag')) continue;
      if (!direct) {
        element.hidePopover();
        if (popover === null) element.removeAttribute('popover'); else element.setAttribute('popover', popover);
      }
      element.classList.remove('ui-live-drag');
      for (const [name, value, priority] of saved) {
        if (value) element.style.setProperty(name, value, priority); else element.style.removeProperty(name);
      }
      spacer?.remove();
    }
  };
  try {
    for (const { element, spacer, fixed, direct } of snapshots) {
      if (spacer) element.before(spacer);
      element.classList.add('ui-live-drag');
      for (const [name, value] of Object.entries(fixed)) element.style.setProperty(name, value, 'important');
      if (!direct) {
        element.setAttribute('popover', 'manual');
        element.showPopover();
      }
    }
  } catch (error) { restore(); throw error; }
  return {
    move(dx: number, dy: number) {
      if (!active) return;
      for (const { element, transform } of snapshots)
        element.style.setProperty('transform', `translate3d(${dx}px,${dy}px,0) ${transform}`, 'important');
    },
    restore,
  };
}

/** Carry the actual resident with its floating chrome, not a detached tab/body
 * approximation. The shared strip and all sibling payloads stay at home. */
export function beginLiveTabDrag(pane: HTMLElement, handle: HTMLElement, key: string, resident?: HTMLElement | null):
  ReturnType<typeof beginLiveDrag> & { origin?: { x: number; y: number } } {
  const tab = handle.closest<HTMLElement>('[data-ui-dock-tab]');
  if (resident && tab) {
    const surface = dragSurface(resident);
    const rect = pane.getBoundingClientRect();
    const tabGrip = handle.getBoundingClientRect();
    const visibility = [tab.style.getPropertyValue('visibility'), tab.style.getPropertyPriority('visibility')];
    const restoreTab = () => {
      if (visibility[0]) tab.style.setProperty('visibility', visibility[0], visibility[1]);
      else tab.style.removeProperty('visibility');
    };
    tab.style.setProperty('visibility', 'hidden', 'important');
    let live: ReturnType<typeof beginLiveDrag> | undefined;
    try {
      const lifted = beginLiveDrag([surface], new Map([[surface, { rect, display: 'block' }]]));
      live = lifted;
      // The floating title has different padding and a different horizontal
      // origin from this tab's position in the shared strip. Align the actual
      // grip before the first paint, preserving the pixel originally grabbed.
      const chrome = [...resident.querySelectorAll<HTMLElement>('[data-ui-chrome]')]
        .find(element => element.dataset.uiChrome === key);
      const grip = chrome?.querySelector<HTMLElement>('.ui-frame-handle > button,[data-ui-inline-handle]') ?? chrome;
      const floatingGrip = grip?.getBoundingClientRect();
      const shift = floatingGrip?.width && floatingGrip.height
        ? { x: tabGrip.x - floatingGrip.x, y: tabGrip.y - floatingGrip.y } : { x: 0, y: 0 };
      lifted.move(shift.x, shift.y);
      return { origin: { x: rect.x + shift.x, y: rect.y + shift.y },
        move(dx, dy) { lifted.move(shift.x + dx, shift.y + dy); },
        restore() { try { lifted.restore(); } finally { restoreTab(); } } };
    } catch (error) { try { live?.restore(); } finally { restoreTab(); } throw error; }
  }
  // A context-unavailable resident may only have its mounted placeholder.
  const body = [...pane.children].find((element): element is HTMLElement =>
    element instanceof HTMLElement && element.dataset.uiDockContent === key);
  if (!tab || !body) return beginLiveDrag([dragSurface(handle)]);
  const visibleBody = [...pane.children].find((element): element is HTMLElement =>
    element instanceof HTMLElement && element.matches('.ui-dock-tab-body:not([hidden])'));
  // Inactive tabs retain their mounted payload. Borrow only the visible slot's
  // geometry, without activating a tab or writing an extra history operation.
  const bounds = new Map<HTMLElement, LiftBounds>();
  if (body.hidden && visibleBody) bounds.set(body, { rect: visibleBody.getBoundingClientRect(), display: 'block' });
  return beginLiveDrag([body, tab], bounds);
}
