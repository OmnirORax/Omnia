import { useUI } from "./context";
import { getContainer, closeContainer } from "./layout";
import { startResidentDrag } from "./drag";

/** Shared by ordinary frame headers and dock tabs whose original header is hidden. */
export function FrameCloseButton({ container, title, onClose, label }: {
  container: string; title: string; onClose?: () => void; label?: string;
}) {
  const ui = useUI();
  const state = getContainer(ui.layout, container);
  const position = state?.chrome?.controls?.close;
  const style = state?.chrome?.controlStyles?.close;
  const asset = ui.layout.assets.find(asset => asset.id === style?.assetId);
  return <button type="button" className="ui-frame-close frame-mini-control"
    aria-label={label ?? `Close ${title}`} title={ui.layout.hideNames ? label ?? `Close ${title}` : ""}
    data-ui-control="close" data-ui-control-owner={container}
    draggable={!state?.pinned}
    style={position ? { left: position.x, top: position.y, right: "auto" } : undefined}
    onDragStart={event => startResidentDrag(event, container)}
    onContextMenu={event => { event.preventDefault(); event.stopPropagation(); ui.configureControl(container, "close"); }}
    onClick={event => {
      event.stopPropagation();
      const close = onClose ?? ui.frameActions.get(container)?.onClose;
      if (close) close();
      else ui.update(layout => closeContainer({ ...layout, windows: { ...Object.fromEntries(ui.defaults), ...layout.windows } }, container));
    }}>
    {style?.mode === "icon" ? asset ? <img src={asset.dataUrl} alt="" /> : style.character || "×" : "×"}
  </button>;
}
