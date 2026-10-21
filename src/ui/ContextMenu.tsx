import { createContext, useContext, useId, useLayoutEffect, useState, type ComponentPropsWithRef } from "react";
import { createPortal } from "react-dom";
import { nextMenuLayer } from "./layers";
const MenuFamily = createContext<string | null>(null);
/** Include portaled submenus in the parent's outside-click boundary. */
export function contextMenuRoots(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return [...document.querySelectorAll<HTMLElement>("[data-ui-menu-family]")]
    .filter(element => element.dataset.uiMenuFamily === root.dataset.uiMenuFamily);
}

/** Escape frame stacking/clipping and rise above the window that opened this menu. */
export function ContextMenu({ opening, className = "", style, onMouseDown, ...props }:
  ComponentPropsWithRef<"div"> & { opening: object }) {
  const inherited = useContext(MenuFamily), id = useId(), family = inherited ?? id;
  const [layer, setLayer] = useState(nextMenuLayer);
  useLayoutEffect(() => { setLayer(nextMenuLayer()); }, [opening]);
  return <MenuFamily.Provider value={family}>{createPortal(<div
    {...props}
    role="menu"
    data-ui-menu-family={family}
    className={`ui-background-menu ${className}`}
    style={{ ...style, zIndex: layer }}
    onMouseDown={event => {
      // Portal events retain React ancestry; never raise a former frame owner.
      event.stopPropagation();
      onMouseDown?.(event);
    }}
    onContextMenu={event => { event.preventDefault(); event.stopPropagation(); }}
  />, document.body)}</MenuFamily.Provider>;
}
