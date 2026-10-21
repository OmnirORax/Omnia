import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ContextMenu } from "./ContextMenu";

/** One hover/focus flyout behavior for context-menu command groups. */
export function ContextSubmenu({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false), [position, setPosition] = useState({ left: 8, top: 8 });
  const trigger = useRef<HTMLButtonElement>(null), popup = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const skipFocus = useRef(false);
  const show = () => { clearTimeout(timer.current); setOpen(true); };
  const leave = () => { timer.current = setTimeout(() => setOpen(false), 160); };
  useEffect(() => () => clearTimeout(timer.current), []);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const anchor = trigger.current?.getBoundingClientRect(), rect = popup.current?.getBoundingClientRect();
      if (!anchor || !rect) return;
      const next = {
        left: Math.max(8, Math.min(anchor.right + 3 + rect.width <= innerWidth - 8 ? anchor.right + 3 : anchor.left - rect.width - 3, innerWidth - rect.width - 8)),
        top: Math.max(8, Math.min(anchor.top, innerHeight - rect.height - 8)),
      };
      setPosition(previous => previous.left === next.left && previous.top === next.top ? previous : next);
    };
    place();
    const observer = new ResizeObserver(place);
    if (popup.current) observer.observe(popup.current);
    window.addEventListener("resize", place);
    return () => { observer.disconnect(); window.removeEventListener("resize", place); };
  }, [open]);
  return <div className="ui-context-submenu" onPointerEnter={show} onPointerLeave={leave}>
    <button ref={trigger} type="button" role="menuitem" aria-label={label} aria-haspopup="menu" aria-expanded={open}
      onFocus={() => { if (skipFocus.current) skipFocus.current = false; else show(); }} onClick={show} onKeyDown={event => {
        if (event.key === "ArrowRight") {
          event.preventDefault(); show();
          requestAnimationFrame(() => popup.current?.querySelector<HTMLElement>("input,select,button")?.focus());
        }
      }}>{label}<span aria-hidden="true">›</span></button>
    {open && <ContextMenu ref={popup} opening={position} aria-label={`${label} options`}
      className="ui-context-submenu-popup" style={position} onPointerEnter={show} onPointerLeave={leave}
      onKeyDown={event => { if (event.key === "ArrowLeft") { event.preventDefault(); setOpen(false); skipFocus.current = true; trigger.current?.focus(); } }}>
      {children}
    </ContextMenu>}
  </div>;
}
