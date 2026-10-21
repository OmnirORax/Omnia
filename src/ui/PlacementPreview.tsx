import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { useUI } from "./context";
import { dockGuides } from "./dockGuides";
import { DockLayoutPreview } from "./DockLayoutPreview";

export function useDockPreview(container: string) {
  const { placementPreview } = useUI();
  return useSyncExternalStore(placementPreview.subscribe, () => {
    const dock = placementPreview.getSnapshot()?.dock;
    return dock?.target === container ? dock : null;
  });
}

export function PlacementPreviewOverlay() {
  const { placementPreview } = useUI();
  const preview = useSyncExternalStore(placementPreview.subscribe, placementPreview.getSnapshot);
  const layer = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = layer.current;
    if (!element) return;
    // Feedback opens after the held payload, so it cannot obscure its guide.
    if (preview) element.showPopover(); else element.hidePopover();
    return () => { if (element.matches(':popover-open')) element.hidePopover(); };
  }, [!!preview]);
  const guides = preview?.frameDock?.bounds ? dockGuides(preview.frameDock.bounds,
    { x: 8, y: 8, width: innerWidth - 16, height: innerHeight - 16 }) : [];
  const rect = preview?.dock?.screenRect ?? preview?.rect;
  return (
    <div ref={layer} popover="manual" className="ui-drag-feedback" aria-hidden="true">
      {preview?.frameLayout && <DockLayoutPreview preview={preview} />}
      {!preview?.frameLayout && rect && (preview?.frameDock || preview?.dock || preview?.destination) && (
        <div
          className="ui-placement-preview"
          data-ui-preview-target={preview?.dock?.target}
          style={{
            left: rect.x,
            top: rect.y,
            width: rect.width,
            height: rect.height,
          }}
        />
      )}
      {preview?.dock?.screenRect && preview.destination && preview.rect && <div className="ui-placement-preview"
        style={{ left: preview.rect.x, top: preview.rect.y, width: preview.rect.width, height: preview.rect.height }} />}
      {preview && <div className="ui-snap-preview">{preview.text}</div>}
      {guides.length > 0 && <div className="ui-dock-guides">
        {guides.map(({ side, symbol, label, rect }) => <span key={side} data-dock-guide={side} title={label}
          className={side === preview?.frameDock?.side ? 'is-active' : ''}
          style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}>{symbol}</span>)}
      </div>}
    </div>
  );
}
