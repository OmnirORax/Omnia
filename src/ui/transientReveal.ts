/** Shared visual location preview for search and appearance instances. Never persists layout. */
export type RevealSession = { stop: (keep?: boolean) => void };
let deferredRestore = 0;
export function transientReveal({
  path,
  locate,
  reveal,
  onReady,
  onMissing,
}: {
  path: string[];
  locate: () => HTMLElement | undefined;
  reveal: (path: string[] | null) => void;
  onReady?: (element: HTMLElement) => void;
  onMissing?: () => void;
}): RevealSession {
  cancelAnimationFrame(deferredRestore);
  const scroll = new Map<Element, { left: number; top: number }>(),
    details: HTMLDetailsElement[] = [],
    raised = new Map<HTMLElement, string>();
  document
    .querySelectorAll<HTMLElement>(
      ".sidebar,.floating-window-content,.ui-panel-body,[data-ui-drop-zone]",
    )
    .forEach((el) => scroll.set(el, { left: el.scrollLeft, top: el.scrollTop }));
  let frame = 0,
    attempts = 0,
    found: HTMLElement | undefined,
    stopped = false;
  const resetScroll = () => {
    for (const [el, p] of scroll)
      if (el.isConnected) {
        el.scrollLeft = p.left;
        el.scrollTop = p.top;
      }
  };
  const seek = () => {
    if (stopped) return;
    found = locate();
    if (found) {
      let el: HTMLElement | null = found;
      while (el) {
        if (!scroll.has(el)) scroll.set(el, { left: el.scrollLeft, top: el.scrollTop });
        if (el instanceof HTMLDetailsElement && !el.open) {
          details.push(el);
          el.open = true;
        }
        if (el.classList.contains("floating-window") && !raised.has(el)) {
          raised.set(el, el.style.zIndex);
          el.style.zIndex = "35000";
        }
        el = el.parentElement;
      }
    }
    if (!found?.getClientRects().length) {
      if (++attempts < 20) {
        frame = requestAnimationFrame(seek);
        return;
      }
      onMissing?.();
      return;
    }
    found.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
    found.classList.add("ui-search-pulsing");
    onReady?.(found);
  };
  reveal(path);
  frame = requestAnimationFrame(seek);
  return {
    stop(keep = false) {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(frame);
      found?.classList.remove("ui-search-pulsing");
      for (const [el, z] of raised) el.style.zIndex = z;
      if (!keep) {
        details.forEach((el) => {
          if (el.isConnected) el.open = false;
        });
        resetScroll();
        deferredRestore = requestAnimationFrame(resetScroll);
      }
      reveal(null);
    },
  };
}
