import {residentRenderSlice} from './renderSubscriptions';
import { searchFrame } from "./frameSearchActions";
import { toggleFrameDescendants } from "./frameExpansion";
import { useIconTint } from "../appearance/Styles";
import { useLayoutEffect, type MouseEvent } from "react";
import { ShortcutHint } from "./ShortcutHint";
import { useUITracked } from "./context";
import { startResidentDrag } from "./drag";
import type { WindowState } from "./layout";
import { FrameSearch } from "./FrameSearch";
import { useUILabel } from "./EditableLabel";
import { nameSymbol } from "./nameSymbols";
import { closeContainer } from "./layout";

export function FrameChrome({
  container,
  title: defaultTitle,
  label,
  tooltip,
  state,
  onChange,
  onRename: renameOriginal,
  onClose,
  closeLabel,
  className = "",
  disabled = false,
  fixed = false,
  inline = false,
  legacyHandleId,
  selected = false,
  onToggle,
  symbol,
}: {
  container: string;
  title: string;
  label?: string;
  tooltip?: string;
  state: Pick<WindowState, "collapsed" | "pinned" | "chrome">;
  onChange: (patch: Partial<WindowState>) => void | boolean;
  onRename?: (value: string) => void;
  onClose?: () => void | boolean;
  closeLabel?: string;
  className?: string;
  disabled?: boolean;
  fixed?: boolean;
  inline?: boolean;
  legacyHandleId?: string;
  selected?: boolean;
  onToggle?: (event: MouseEvent<HTMLButtonElement>) => void;
  /** A compact default; saved custom chrome remains authoritative. */
  symbol?:string;
}) {
  const [title, renameLabel] = useUILabel(container, defaultTitle);
  const onRename = renameOriginal
    ? (value: string) => renameOriginal(value.trim().slice(0, 200) || defaultTitle)
    : renameLabel;
  const iconTint = useIconTint(
    container,
    legacyHandleId ? `function:${legacyHandleId}` : undefined,
  );
  const ui = useUITracked(ui=>residentRenderSlice(ui,container)),
    style = state.chrome?.style ?? (symbol?{mode:'icon',geometry:'circle',character:symbol}:{ mode: "text", geometry: "circle" }),
    asset = ui.layout.assets.find((a) => a.id === style.assetId);
  const close = onClose ?? (() => ui.update(layout => closeContainer({
    ...layout, windows: { ...Object.fromEntries(ui.defaults), ...layout.windows },
  }, container)));
  // Search remains a shared contextual renderer; tools live once in Master Controller.
  const operators = <FrameSearch container={container} title={title} renderToggle={false}
    expand={() => { if (state.collapsed && !fixed) onChange({ collapsed: false }); }} />;
  const openFrameMenu = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    ui.frameMenu(container, event.clientX, event.clientY);
  };
  useLayoutEffect(() => {
    const actions = { title, label: label ?? title, state, onChange, onRename, onClose: close, closeLabel, onSearch: () => searchFrame(container), onBranchToggle: () => toggleFrameDescendants(ui, container) };
    ui.frameActions.set(container, actions);
    return () => {
      if (ui.frameActions.get(container) === actions) ui.frameActions.delete(container);
    };
  });
  if (inline)
    return (
      <div className="property-node-heading" data-ui-chrome={container} onContextMenu={openFrameMenu}>
        <div className="ui-inline-frame-bar">
        <button
          type="button"
          className={`property-node-name ${style.mode === "icon" ? `function-icon shape-${style.geometry}` : ""}`}
          data-ui-id="property"
          data-ui-function={legacyHandleId}
          data-ui-inline-handle
          data-ui-drag={container}
          draggable={ui.canMove(container)}
          disabled={disabled}
          aria-disabled={disabled}
          aria-expanded={!state.collapsed}
          aria-pressed={selected}
          aria-label={title}
          data-ui-name={title}
          data-ui-symbol={nameSymbol(container, defaultTitle)}
          title={tooltip ?? (ui.layout.hideNames ? title : "")}
          data-ui-tooltip={tooltip}
          onClick={onToggle ?? (() => onChange({ collapsed: !state.collapsed }))}
          onDragStart={(event) => startResidentDrag(event, container)}
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
              <span style={{ ...iconTint.style, color: iconTint.color ?? iconTint.glyphColor }}>
                {style.character || "○"}
              </span>
            )
          ) : (
            title
          )}
          <ShortcutHint binding={ui.shortcutBindings?.[`button:@frame:${container}`]} />
        </button>
        {operators}
        </div>
      </div>
    );
  return (
    <header
      className={`floating-title frame-chrome ${className} ${state.pinned ? "is-pinned" : ""} ${state.collapsed ? "is-collapsed" : ""}`}
      data-ui-chrome={container}
      data-ui-container-key={container}
      onContextMenu={openFrameMenu}
    >
      <div
        className="ui-frame-tools"
        style={{ left: state.chrome?.handle?.x ?? 0, top: state.chrome?.handle?.y ?? 0 }}
      >
        <div
          className={`ui-frame-handle ${style.mode === "icon" ? `icon-handle shape-${style.geometry}` : ""}`}
          data-ui-drag={fixed ? undefined : container}
          draggable={!fixed && ui.canMove(container)}
          onDragStart={(e) => startResidentDrag(e, container)}
          title={tooltip ?? (ui.layout.hideNames ? title : "")}
          data-ui-tooltip={tooltip}
        >
          <button
            data-ui-name={title}
            data-ui-symbol={nameSymbol(container, defaultTitle)}
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
                <span style={{ ...iconTint.style, color: iconTint.color ?? iconTint.glyphColor }}>
                  {style.character || "○"}
                </span>
              )
            ) : (
              <strong>{title}</strong>
            )}
            <ShortcutHint binding={ui.shortcutBindings?.[`button:@frame:${container}`]} />
          </button>
          {operators}
        </div>
      </div>
    </header>
  );
}
