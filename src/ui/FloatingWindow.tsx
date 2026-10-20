import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { Rnd } from "react-rnd";
import { createPortal } from "react-dom";
import { fitWindow, ownerOf, releaseResident, residentPinned, type WindowState } from "./layout";
import { useUI, UIHomeContext, UIContainerContext } from "./context";
import { FrameChrome } from "./FrameChrome";
import { DockArea } from "./DockArea";
import { useDockHost } from "./DockHost";
import { useFrameBounds } from "./frameBounds";
import { useDockResident, useDockWorkspace } from "./DockWorkspace";
import { fitDockRect } from "./docking";
import { keepFloatingHandleVisible } from "./positioning";
import { cursorPosition } from "./cursorPosition";
let front = 100;
export const nextWindowLayer = () => ++front;
export function FloatingWindow({
  id,
  title,
  label = title,
  children,
  onClose,
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
  onClose?: () => void;
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
  const ui = useUI();
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
  useLayoutEffect(() => {
    ui.defaults.set(id, initial);
    return () => {
      ui.defaults.delete(id);
    };
  }, [id]);
  const [z, setZ] = useState(nextWindowLayer);
  useLayoutEffect(() => {
    if (!openAtCursor || owner) return;
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
    setZ(nextWindowLayer());
    // Opening a new target also repositions an editor that is already mounted.
    // Saved coordinate updates during dragging must not recenter it.
  }, [id, openAtCursor, openingKey]);
  const set = (patch: Partial<WindowState>) =>
    ui.update((layout) => ({
      ...layout,
      windows: {
        ...layout.windows,
        [id]: (() => {
          const next = fitWindow({ ...saved, ...patch }, window.innerWidth, window.innerHeight);
          return next.collapsed && !next.floatingOverflow
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
        className={`floating-window ${state.collapsed ? "is-collapsed" : ""} ${owner ? "docked-window" : ""} ${className}`}
        position={
          owner
            ? { x: 0, y: 0 }
            : { x: visible.x, y: visible.y }
        }
        size={{
          width: state.collapsed
            ? visible.width
            : owner
              ? Math.min(state.width, host?.clientWidth ?? state.width)
              : visible.width,
          height: owner ? state.collapsed ? bounds.height : state.height : visible.height,
        }}
        style={{ position: owner ? "absolute" : "fixed", zIndex: z }}
        minWidth={Math.min(state.collapsed ? 40 : 240, visible.width)}
        minHeight={Math.min(state.collapsed ? 44 : 120, visible.height)}
        maxWidth={saved.floatingOverflow && !owner ? undefined : available.width}
        maxHeight={saved.floatingOverflow && !owner ? undefined : available.height}
        dragHandleClassName="floating-title"
        cancel="button,input,select,a"
        disableDragging
        enableResizing={!dockFill && !residentPinned(ui.layout, key) && !state.collapsed}
        dragGrid={[8, 8]}
        resizeGrid={[8, 8]}
        onMouseDown={(event) => {
          // Portal events also bubble through their React owner. A child editor
          // must not raise the library/inspector that opened it above itself.
          event.stopPropagation();
          if (!(event.currentTarget instanceof Element) || !event.currentTarget.contains(event.target as Node)) return;
          setZ(nextWindowLayer());
          onInteract?.();
        }}
        onDragStop={(_, data) => set({ x: data.x, y: data.y })}
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
                  width: state.width,
                  height: 44,
                  position: "relative",
                  left: -bounds.x,
                  top: -bounds.y,
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
                    if (owner) ui.update((s) => releaseResident(s, key));
                    onClose();
                  }
                : undefined
            }
            closeLabel={closeLabel}
          />
          <div className="floating-body" hidden={state.collapsed}>
            <UIHomeContext.Provider value={key}>
              <UIContainerContext.Provider value={key}>
                {children}
                <DockArea container={key} contour={false} />
              </UIContainerContext.Provider>
            </UIHomeContext.Provider>
          </div>
        </div>
      </Rnd>
    </>,
    owner ? host! : window.document.body,
  );
}
