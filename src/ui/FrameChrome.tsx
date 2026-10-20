import { useIconTint } from "../appearance/Styles";
import { useLayoutEffect, type MouseEvent } from "react";
import { ShortcutHint } from "./ShortcutHint";
import { useUI } from "./context";
import { startResidentDrag } from "./drag";
import type { WindowState } from "./layout";
import { FrameSearch } from "./FrameSearch";
import { useUILabel } from "./EditableLabel";

export function FrameChrome({
  container,
  title: defaultTitle,
  label,
  state,
  onChange,
  onRename: renameOriginal,
  onClose,
  closeLabel,
  className = "",
  fixed = false,
  inline = false,
  legacyHandleId,
  selected = false,
  onToggle,
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
  inline?: boolean;
  legacyHandleId?: string;
  selected?: boolean;
  onToggle?: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const [title, renameLabel] = useUILabel(container, defaultTitle);
  const onRename = renameOriginal
    ? (value: string) => renameOriginal(value.trim().slice(0, 200) || defaultTitle)
    : renameLabel;
  const iconTint = useIconTint(
    container,
    legacyHandleId ? `function:${legacyHandleId}` : undefined,
  );
  const ui = useUI(),
    style = state.chrome?.style ?? { mode: "text", geometry: "circle" },
    asset = ui.layout.assets.find((a) => a.id === style.assetId);
  useLayoutEffect(() => {
    const actions = { title, label: label ?? title, state, onChange, onRename, onClose, closeLabel };
    ui.frameActions.set(container, actions);
    return () => {
      if (ui.frameActions.get(container) === actions) ui.frameActions.delete(container);
    };
  });
  if (inline)
    return (
      <div className="property-node-heading" data-ui-chrome={container}>
        <button
          type="button"
          className={`property-node-name ${style.mode === "icon" ? `function-icon shape-${style.geometry}` : ""}`}
          data-ui-id="property"
          data-ui-function={legacyHandleId}
          data-ui-inline-handle
          data-ui-drag={container}
          draggable={!state.pinned}
          aria-expanded={!state.collapsed}
          aria-pressed={selected}
          aria-label={title}
          title={`${title} · click to expand/collapse; drag to move; right-click to customize`}
          onClick={onToggle ?? (() => onChange({ collapsed: !state.collapsed }))}
          onDragStart={(event) => startResidentDrag(event, container)}
          onContextMenu={(event) => {
            event.preventDefault();
            event.stopPropagation();
            ui.configureFrame(container);
          }}
        >
          {style.mode === "icon" ? (
            asset ? (
              iconTint.color ? (
                <span
                  className="appearance-icon-mask"
                  style={{
                    ...iconTint.style,
                    backgroundColor: iconTint.color,
                    maskImage: `url("${asset.dataUrl}")`,
                    WebkitMaskImage: `url("${asset.dataUrl}")`,
                  }}
                />
              ) : (
                <img src={asset.dataUrl} alt="" style={iconTint.style} />
              )
            ) : (
              <span style={{ ...iconTint.style, color: iconTint.color }}>
                {style.character || "○"}
              </span>
            )
          ) : (
            title
          )}
          <ShortcutHint binding={ui.shortcutBindings?.[`button:@frame:${container}`]} />
        </button>
      </div>
    );
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
        className="ui-frame-tools"
        style={{ left: state.chrome?.handle?.x ?? 0, top: state.chrome?.handle?.y ?? 0 }}
      >
        <div
          className={`ui-frame-handle ${style.mode === "icon" ? `icon-handle shape-${style.geometry}` : ""}`}
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
                <>
                  {iconTint.color ? (
                    <span
                      className="appearance-icon-mask"
                      style={{
                        ...iconTint.style,
                        backgroundColor: iconTint.color,
                        maskImage: `url("${asset.dataUrl}")`,
                        WebkitMaskImage: `url("${asset.dataUrl}")`,
                      }}
                    />
                  ) : (
                    <img src={asset.dataUrl} alt="" style={iconTint.style} />
                  )}
                </>
              ) : (
                <span style={{ ...iconTint.style, color: iconTint.color }}>
                  {style.character || "○"}
                </span>
              )
            ) : (
              <strong>{title}</strong>
            )}
            <ShortcutHint binding={ui.shortcutBindings?.[`button:@frame:${container}`]} />
          </button>
        </div>
        <FrameSearch
          container={container}
          title={title}
          expand={() => {
            if (state.collapsed && !fixed) onChange({ collapsed: false });
          }}
        />
      </div>
    </header>
  );
}
