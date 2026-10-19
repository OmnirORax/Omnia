import { useEffect, useState, type ReactNode } from "react";
import { Rnd } from "react-rnd";
import { createPortal } from "react-dom";
import { fitWindow, type WindowState } from "./layout";
import { useUI } from "./context";
let front = 100;
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
  className?: string;
  modal?: boolean;
  onInteract?: () => void;
}) {
  const ui = useUI();
  const initial: WindowState = {
    x: x ?? (window.innerWidth - width) / 2,
    y: y ?? Math.max(8, (window.innerHeight - height) / 2),
    width,
    height,
    collapsed: false,
    pinned: false,
  };
  const saved = ui.layout.windows[id] ?? initial;
  const state = fitWindow(saved, window.innerWidth, window.innerHeight);
  const [z, setZ] = useState(() => ++front);
  const set = (patch: Partial<WindowState>) =>
    ui.update((layout) => ({
      ...layout,
      windows: {
        ...layout.windows,
        [id]: fitWindow({ ...state, ...patch }, window.innerWidth, window.innerHeight),
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
  return createPortal(
    <>
      {modal && !state.collapsed && (
        <div className="floating-backdrop" style={{ zIndex: z - 1 }} onClick={onClose} />
      )}
      <Rnd
        className={`floating-window ${className}`}
        position={{ x: state.x, y: state.y }}
        size={{ width: state.width, height: state.collapsed ? "auto" : state.height }}
        style={{ position: "fixed", zIndex: z }}
        minWidth={Math.min(240, window.innerWidth - 16)}
        minHeight={state.collapsed ? 44 : 120}
        maxWidth={Math.max(240, window.innerWidth - 16)}
        maxHeight={Math.max(120, window.innerHeight - 16)}
        dragHandleClassName="floating-title"
        cancel="button,input,select,a"
        disableDragging={state.pinned}
        enableResizing={!state.pinned && !state.collapsed}
        dragGrid={[8, 8]}
        resizeGrid={[8, 8]}
        onMouseDown={() => {
          setZ(++front);
          onInteract?.();
        }}
        onDragStop={(_, data) => set({ x: data.x, y: data.y })}
        onResizeStop={(_, __, ref, ___, position) =>
          set({ width: ref.offsetWidth, height: ref.offsetHeight, ...position })
        }
        resizeHandleComponent={{
          bottomRight: <span className="window-resize-grip" aria-label={`Resize ${label}`} />,
        }}
      >
        <div
          role={role}
          aria-label={label}
          aria-modal={(modal && !state.collapsed) || undefined}
          className="floating-window-content"
          onClick={(e) => e.stopPropagation()}
        >
          <header
            className={`floating-title ${state.pinned ? "is-pinned" : ""}`}
            title={state.pinned ? "Unpin to move or resize" : "Drag to move; edges resize"}
          >
            <strong>{title}</strong>
            <div className="window-tools">
              <button
                aria-label={`${state.collapsed ? "Expand" : "Collapse"} ${label}`}
                aria-expanded={!state.collapsed}
                onClick={() => set({ collapsed: !state.collapsed })}
              >
                {state.collapsed ? "+" : "−"}
              </button>
              <button
                aria-label={`${state.pinned ? "Unpin" : "Pin"} ${label}`}
                aria-pressed={state.pinned}
                onClick={() => set({ pinned: !state.pinned })}
              >
                {state.pinned ? "Unpin" : "Pin"}
              </button>
              {onClose && (
                <button aria-label={closeLabel} onClick={onClose}>
                  ×
                </button>
              )}
            </div>
          </header>
          <div className="floating-body" hidden={state.collapsed}>
            {children}
          </div>
        </div>
      </Rnd>
    </>,
    window.document.body,
  );
}
