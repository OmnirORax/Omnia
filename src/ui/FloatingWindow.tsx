import {residentRenderSlice} from './renderSubscriptions';
import { activateFrameContext } from "./ActiveContext";
import { useEffect, useLayoutEffect, type ReactNode } from "react";
import { Rnd } from "react-rnd";
import { createPortal } from "react-dom";
import { fitWindow, getContainer, ownerOf, releaseResident, reopenContainer, type WindowState } from "./layout";
import { useUITracked, UIHomeContext, UIContainerContext, UIPathContext } from "./context";
import { FrameChrome } from "./FrameChrome";
import { DockArea } from "./DockArea";
import { useDockHost } from "./DockHost";
import { useFrameBounds } from "./frameBounds";
import { useDockResident, useDockWorkspace } from "./DockWorkspace";
import { fitDockRect } from "./docking";
import { keepFloatingHandleVisible } from "./positioning";
import { cursorPosition } from "./cursorPosition";
import { useWindowLayer } from "./useWindowLayer";
export { nextWindowLayer } from "./layers";
export function FloatingWindow({
  id,
  title,
  label = title,
  children,
  residentArea,
  footer,
  onClose,
  onMinimize,
  closeLabel = `Close ${label}`,
  width = 420,
  height = 560,
  x,
  y,
  role = "dialog",
  openAtCursor = role === "dialog",
  openingKey,
  className = "",
  modal = false,
  onInteract,
}: {
  id: string;
  title: string;
  label?: string;
  children: ReactNode;
  /** Collections can supply their existing resident renderer, keeping one payload per member. */
  residentArea?: ReactNode;
  /** Non-scrolling actions beneath the window body, using the same theme/ownership. */
  footer?: ReactNode;
  onClose?: () => void | boolean;
  /** Return false to keep the window expanded until pending work is resolved. */
  onMinimize?: () => void | boolean;
  closeLabel?: string;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  role?: "dialog" | "complementary";
  /** Popups open at the pointer; persistent workspace panels opt out. */
  openAtCursor?: boolean;
  openingKey?: string | number;
  className?: string;
  modal?: boolean;
  onInteract?: () => void;
}) {
  const ui = useUITracked(ui=>residentRenderSlice(ui,`window:${id}`));
  const { ref, bounds } = useFrameBounds();
  const initial: WindowState = {
    x: x ?? (window.innerWidth - width) / 2,
    y: y ?? Math.max(8, (window.innerHeight - height) / 2),
    width,
    height,
    collapsed: false,
    pinned: false,
  };
  const saved = ui.layout.windows[id] ?? initial;
  const key = `window:${id}`,
    owner = ownerOf(ui.layout, key),
    host = useDockHost(key);
  const state = fitWindow(saved, window.innerWidth, window.innerHeight);
  const workspace = useDockWorkspace();
  const viewport = { x: 8, y: 8, width: innerWidth-16, height: innerHeight-16 };
  const available = !owner && !openAtCursor && workspace.active ? workspace.floating : viewport;
  const desired = state.collapsed ? { x: saved.x+bounds.x, y: saved.y+bounds.y, width: bounds.width, height: bounds.height } : state;
  const visible = useDockResident(key, saved.floatingOverflow ? keepFloatingHandleVisible(desired, viewport, saved.chrome?.handle) : fitDockRect(desired, available), !saved.closed && !owner && !openAtCursor, saved.floatingOverflow);
  const dockFill = !!host?.classList.contains("ui-dock-fill");
  const stacked = !dockFill && !!owner && getContainer(ui.layout, owner)?.layoutMode === "stacked";
  useLayoutEffect(() => {
    ui.defaults.set(id, initial);
    return () => {
      ui.defaults.delete(id);
    };
  }, [id]);
  const [z, raise] = useWindowLayer();
  useLayoutEffect(() => { if (!saved.closed && !state.collapsed) activateFrameContext(ui, key); }, [id, openingKey]);
  // Mounting a caller-controlled window is an explicit open request. Repair
  // stale closed flags from tab/fallback closes through the same model path.
  useLayoutEffect(() => {
    if (onClose) ui.update(layout => layout.windows[id]?.closed ? reopenContainer(layout, key) : layout);
  }, [id, openingKey]);
  useLayoutEffect(() => {
    if (!openAtCursor) {
      // Reveal a persistent controller without moving it or writing its geometry.
      if (openingKey !== undefined) raise();
      return;
    }
    if (owner) return;
    const point = cursorPosition();
    ui.update(layout => {
      const current = layout.windows[id] ?? initial;
      return {
        ...layout,
        windows: {
          ...layout.windows,
          [id]: fitWindow({ ...current, ...point, collapsed: false, closed: false, floatingOverflow: false }, innerWidth, innerHeight),
        },
      };
    });
    raise();
    // Opening a new target also repositions an editor that is already mounted.
    // Saved coordinate updates during dragging must not recenter it.
  }, [id, openAtCursor, openingKey]);
  const set = (patch: Partial<WindowState>) => {
    if (patch.collapsed === true && !saved.collapsed && onMinimize?.() === false) return false;
    ui.update((layout) => ({
      ...layout,
      windows: {
        ...layout.windows,
        [id]: (() => {
          const next = fitWindow({ ...saved, ...patch }, window.innerWidth, window.innerHeight);
          return next.collapsed && !next.floatingOverflow && !saved.viewport
            ? {
                ...next,
                x:
                  Math.max(
                    8,
                    Math.min((patch.x ?? saved.x) + bounds.x, window.innerWidth - bounds.width - 8),
                  ) - bounds.x,
                y:
                  Math.max(
                    8,
                    Math.min(
                      (patch.y ?? saved.y) + bounds.y,
                      window.innerHeight - bounds.height - 8,
                    ),
                  ) - bounds.y,
              }
            : next;
        })(),
      },
    }));
    return true;
  };
  useEffect(() => {
    const resize = () =>
      ui.update((layout) => ({
        ...layout,
        windows: {
          ...layout.windows,
          [id]: fitWindow(layout.windows[id] ?? initial, window.innerWidth, window.innerHeight),
        },
      }));
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [id, ui.update]);
  if (saved.closed || owner && !host) return null;
  return createPortal(
    <>
      {modal && !state.collapsed && !owner && (
        <div className="floating-backdrop" style={{ zIndex: z - 1 }} onClick={onClose} />
      )}
      <Rnd
        data-ui-free-placement={openAtCursor ? "viewport" : "workspace"}
        className={`floating-window ${state.collapsed ? "is-collapsed" : ""} ${stacked ? "ui-stacked-window" : ""} ${owner ? "docked-window" : ""} ${className}`}
        position={
          owner
            ? { x: 0, y: 0 }
            : { x: visible.x, y: visible.y }
        }
        size={{
          width: stacked ? "100%" : state.collapsed
            ? visible.width
            : owner
              ? Math.min(state.width, host?.clientWidth ?? state.width)
              : visible.width,
          height: stacked ? "auto" : owner ? state.collapsed ? bounds.height : state.height : visible.height,
        }}
        style={{ position: stacked ? "relative" : owner ? "absolute" : "fixed", zIndex: z }}
        minWidth={stacked ? 0 : Math.min(state.collapsed ? 40 : 240, visible.width)}
        minHeight={stacked ? 0 : Math.min(state.collapsed ? 44 : 120, visible.height)}
        maxWidth={saved.floatingOverflow && !owner ? undefined : available.width}
        maxHeight={stacked || saved.floatingOverflow && !owner ? undefined : available.height}
        dragHandleClassName="floating-title"
        cancel="button,input,select,a"
        disableDragging
        enableResizing={!state.viewport && !dockFill && !stacked && ui.canMove(key) && !state.collapsed}
        dragGrid={[8, 8]}
        resizeGrid={[8, 8]}
        onMouseDown={(event) => {
          // Portal events also bubble through their React owner. A child editor
          // must not raise the library/inspector that opened it above itself.
          event.stopPropagation();
          if (!(event.currentTarget instanceof Element) || !event.currentTarget.contains(event.target as Node)) return;
          raise();
          onInteract?.();
        }}
        onDragStop={(_, data) => { set({ x: data.x, y: data.y }); }}
        onResizeStop={(_, __, ref, ___, position) =>
          set({ width: ref.offsetWidth, height: ref.offsetHeight, ...(owner ? {} : position) })
        }
        resizeHandleComponent={{
          bottomRight: <span className="window-resize-grip" aria-label={`Resize ${label}`} />,
        }}
      >
        <div
          ref={ref}
          role={role}
          aria-label={label}
          aria-modal={(modal && !state.collapsed) || undefined}
          className={`floating-window-content ${state.collapsed ? "ui-frame-root" : ""}`}
          style={
            state.collapsed
              ? {
                  width: stacked ? "100%" : state.width,
                  height: 44,
                  position: "relative",
                  left: stacked ? 0 : -bounds.x,
                  top: stacked ? 0 : -bounds.y,
                }
              : undefined
          }
          data-ui-resident-root={key}
          onClick={(e) => e.stopPropagation()}
        >
          <FrameChrome
            container={key}
            title={label}
            state={state}
            onChange={set}
            onClose={
              onClose
                ? () => {
                    // A pending-edit guard can veto closing before ownership changes.
                    if (onClose() === false) return false;
                    if (owner) ui.update((s) => releaseResident(s, key));
                    return true;
                  }
                : undefined
            }
            closeLabel={closeLabel}
          />
          <div className="floating-body" hidden={state.collapsed}>
            <UIHomeContext.Provider value={key}>
              <UIPathContext.Provider value={[key]}><UIContainerContext.Provider value={key}>
                {children}
                {residentArea === undefined ? <DockArea container={key} contour={false} /> : residentArea}
              </UIContainerContext.Provider></UIPathContext.Provider>
            </UIHomeContext.Provider>
          </div>
          {footer && !state.collapsed && <div className="floating-footer" data-appearance-editor>
            <UIHomeContext.Provider value={key}>
              <UIPathContext.Provider value={[key]}><UIContainerContext.Provider value={key}>
                {footer}
              </UIContainerContext.Provider></UIPathContext.Provider>
            </UIHomeContext.Provider>
          </div>}
        </div>
      </Rnd>
    </>,
    owner ? host! : window.document.body,
  );
}
