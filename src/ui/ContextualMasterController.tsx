import { useEffect, useRef, type ReactNode, type WheelEvent } from "react";
import { createPortal } from "react-dom";
import { useActiveLayer } from "./ActiveContext";

/** Transient contextual projection: reuse the caller's controls, never open or
 * persist unrelated controller categories just to invoke a common operation. */
export function ContextualMasterController({ title, hint, position, onClose, onWheel, children }: {
  title: string; hint?: string; position: { x: number; y: number } | null;
  onClose: () => void; onWheel?: (event: WheelEvent) => void; children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  useActiveLayer(!!position, root, onClose);
  useEffect(() => {
    const node = root.current; if (!node || !onWheel) return;
    const preventScroll = (event: globalThis.WheelEvent) => event.preventDefault();
    node.addEventListener("wheel", preventScroll, { passive: false });
    return () => node.removeEventListener("wheel", preventScroll);
  }, [!!position, !!onWheel]);
  return position && createPortal(<div ref={root} className="contextual-master-controller ui-frame-search-popup" data-context-controller data-ui-search
    role="dialog" aria-label={`Master controller — ${title}`} onWheel={onWheel}
    style={{ left: Math.max(8, Math.min(position.x, innerWidth - 320)), top: Math.max(8, Math.min(position.y, innerHeight - 420)) }}>
    <strong>Master controller · {title}</strong>{hint && <p>{hint}</p>}{children}
  </div>, document.body);
}
