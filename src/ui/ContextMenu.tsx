import { useLayoutEffect, useState, type ComponentPropsWithRef } from "react";
import { createPortal } from "react-dom";
import { nextMenuLayer } from "./layers";

/** Escape frame stacking/clipping and rise above the window that opened this menu. */
export function ContextMenu({ opening, className = "", style, onMouseDown, ...props }:
  ComponentPropsWithRef<"div"> & { opening: object }) {
  const [layer, setLayer] = useState(nextMenuLayer);
  useLayoutEffect(() => { setLayer(nextMenuLayer()); }, [opening]);
  return createPortal(<div
    {...props}
    role="menu"
    className={`ui-background-menu ${className}`}
    style={{ ...style, zIndex: layer }}
    onMouseDown={event => {
      // Portal events retain React ancestry; never raise a former frame owner.
      event.stopPropagation();
      onMouseDown?.(event);
    }}
    onContextMenu={event => { event.preventDefault(); event.stopPropagation(); }}
  />, document.body);
}
