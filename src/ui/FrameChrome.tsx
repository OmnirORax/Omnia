import { useUI } from "./context";
import { CONTROL_MIME, startResidentDrag } from "./drag";
import type { FrameChrome as Chrome, WindowState } from "./layout";
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
}) {
  const ui = useUI(),
    style = state.chrome?.style ?? { mode: "text", geometry: "circle" },
    asset = ui.layout.assets.find((a) => a.id === style.assetId);
  const actions = [
    {
      id: "collapse",
      label: `${state.collapsed ? "Expand" : "Collapse"} ${label}`,
      text: state.collapsed ? "+" : "−",
      run: () => onChange({ collapsed: !state.collapsed }),
    },
    {
      id: "pin",
      label: `${state.pinned ? "Unpin" : "Pin"} ${label}`,
      text: state.pinned ? "Unpin" : "Pin",
      run: () => onChange({ pinned: !state.pinned }),
    },
    ...(onClose
      ? [{ id: "close", label: closeLabel ?? `Close ${title}`, text: "×", run: onClose }]
      : []),
  ];
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
        data-ui-drag={container}
        draggable={!state.pinned}
        onDragStart={(e) => startResidentDrag(e, container)}
        title={`${title} · drag to move or dock; right-click to customize`}
      >
        {style.mode === "icon" ? (
          <button
            aria-label={`Toggle frame ${title}`}
            onClick={() => onChange({ collapsed: !state.collapsed })}
          >
            {asset ? <img src={asset.dataUrl} alt="" /> : style.character || "○"}
          </button>
        ) : onRename ? (
          <input
            aria-label="UI frame name"
            value={title}
            maxLength={200}
            onChange={(e) => onRename(e.target.value)}
          />
        ) : (
          <strong>{title}</strong>
        )}
      </div>
      <div className="window-tools">
        {actions.map((a, index) => {
          const p = state.chrome?.controls?.[a.id as keyof NonNullable<Chrome["controls"]>];
          const custom =
            state.chrome?.controlStyles?.[a.id as keyof NonNullable<Chrome["controlStyles"]>];
          const icon = ui.layout.assets.find((asset) => asset.id === custom?.assetId);
          return (
            <button
              key={a.id}
              className="frame-mini-control"
              data-ui-control={a.id}
              data-ui-control-owner={container}
              style={
                p ? { left: p.x, top: p.y } : { right: (actions.length - index - 1) * 34, top: 0 }
              }
              aria-label={a.label}
              aria-pressed={a.id === "pin" ? state.pinned : undefined}
              draggable={!state.pinned}
              title={`${a.label} · drag to rearrange`}
              onDragStart={(e) => {
                e.stopPropagation();
                e.dataTransfer.setData(
                  CONTROL_MIME,
                  JSON.stringify({ owner: container, control: a.id }),
                );
                e.dataTransfer.effectAllowed = "move";
              }}
              onClick={a.run}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                ui.configureControl(container, a.id as "collapse" | "pin" | "close");
              }}
            >
              {icon ? (
                <img src={icon.dataUrl} alt="" />
              ) : (
                custom?.character ||
                (a.id === "pin" ? (
                  <svg
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                  >
                    <path d="m8 3 8 0-1 6 4 4v2h-6v6l-2 2v-8H5v-2l4-4Z" />
                  </svg>
                ) : (
                  a.text
                ))
              )}
            </button>
          );
        })}
      </div>
    </header>
  );
}
