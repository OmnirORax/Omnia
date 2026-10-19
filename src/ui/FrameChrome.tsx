import { useLayoutEffect } from "react";
import { useUI } from "./context";
import { startResidentDrag } from "./drag";
import type { WindowState } from "./layout";

export function FrameChrome({
  container,
  title,
  label = title,
  state,
  onChange,
  onRename,
  onClose,
  closeLabel,
  className = "",
  fixed = false,
}: {
  container: string;
  title: string;
  label?: string;
  state: Pick<WindowState, "collapsed" | "pinned" | "chrome">;
  onChange: (patch: Partial<WindowState>) => void;
  onRename?: (value: string) => void;
  onClose?: () => void;
  closeLabel?: string;
  className?: string;
  fixed?: boolean;
}) {
  const ui = useUI(),
    style = state.chrome?.style ?? { mode: "text", geometry: "circle" },
    asset = ui.layout.assets.find((a) => a.id === style.assetId);
  useLayoutEffect(() => {
    const actions = { title, label, state, onChange, onRename, onClose, closeLabel };
    ui.frameActions.set(container, actions);
    return () => {
      if (ui.frameActions.get(container) === actions) ui.frameActions.delete(container);
    };
  });
  return (
    <header
      className={`floating-title frame-chrome ${className} ${state.pinned ? "is-pinned" : ""}`}
      data-ui-chrome={container}
      data-ui-container-key={container}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        ui.frameMenu(container, e.clientX, e.clientY);
      }}
    >
      <div
        className={`ui-frame-handle ${style.mode === "icon" ? `icon-handle shape-${style.geometry}` : ""}`}
        style={{ left: state.chrome?.handle?.x ?? 0, top: state.chrome?.handle?.y ?? 0 }}
        data-ui-drag={fixed ? undefined : container}
        draggable={!fixed && !state.pinned}
        onDragStart={(e) => startResidentDrag(e, container)}
        title={`${title} · ${fixed ? "right-click to arrange" : "click to collapse/expand; drag to move or dock; right-click for settings"}`}
      >
        <button
          aria-label={`Toggle frame ${title}`}
          aria-expanded={!state.collapsed}
          onClick={() => !fixed && onChange({ collapsed: !state.collapsed })}
        >
          {style.mode === "icon" ? (
            asset ? (
              <img src={asset.dataUrl} alt="" />
            ) : (
              style.character || "○"
            )
          ) : (
            <strong>{title}</strong>
          )}
        </button>
      </div>
    </header>
  );
}
