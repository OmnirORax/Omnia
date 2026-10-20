import { useSyncExternalStore } from "react";
import { useUI } from "./context";

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
  return (
    <>
      {preview?.rect && (
        <div
          className="ui-placement-preview"
          style={{
            left: preview.rect.x,
            top: preview.rect.y,
            width: preview.rect.width,
            height: preview.rect.height,
          }}
        />
      )}
      {preview && <div className="ui-snap-preview">{preview.text}</div>}
      {preview?.frameDock?.bounds && <div className="ui-dock-guides" aria-hidden="true" style={{
        left: preview.frameDock.bounds.x, top: preview.frameDock.bounds.y,
        width: preview.frameDock.bounds.width, height: preview.frameDock.bounds.height,
      }}>
        {(["left", "right", "top", "bottom", "tab"] as const).map(side => <span key={side} className={`dock-guide-${side} ${side === preview.frameDock?.side ? "is-active" : ""}`}>{side === "tab" ? "▣" : side === "left" ? "◧" : side === "right" ? "◨" : side === "top" ? "⬒" : "⬓"}</span>)}
      </div>}
    </>
  );
}
