import { cursorPosition } from './cursorPosition';
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ContextMenu } from "./ContextMenu";

/** One hover/focus flyout behavior for context-menu command groups. */
export function ContextSubmenu({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false), [position, setPosition] = useState({ left: 8, top: 8 });
  const trigger = useRef<HTMLButtonElement>(null), popup = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const skipFocus = useRef(false);
  const show=()=>{clearTimeout(timer.current);if(!open){const point=cursorPosition();setPosition({left:point.x,top:point.y});setOpen(true);}};
  const leave = () => { timer.current = setTimeout(() => setOpen(false), 160); };
  useEffect(() => () => clearTimeout(timer.current), []);
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
