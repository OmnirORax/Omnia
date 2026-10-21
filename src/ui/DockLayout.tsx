import { useEffect, useRef, useState } from "react";
import { DockFillContext, useUI } from "./context";
import { getContainer, updateContainer } from "./layout";
import { dockSplitStyle, updateDockNode, type DockNode } from "./dockTree";
import { DockHost } from "./DockHost";
import { captureUIPointer, startResidentDrag } from "./drag";
import { FrameSearch, nameFor } from "./FrameSearch";
import { useIconTint } from "../appearance/Styles";
import { ShortcutHint } from "./ShortcutHint";
import { nameSymbol } from "./nameSymbols";
import { FrameCloseButton } from "./FrameCloseButton";

export function DockLayout({ container }: { container: string }) {
  const ui = useUI(), tree = getContainer(ui.layout, container)?.dockLayout;
  return tree ? <DockBranch node={tree} path={[]} container={container} /> : null;
}
function DockBranch({ node, path, container }: { node: DockNode; path: number[]; container: string }) {
  const ui = useUI();
  if (node.kind === "split") return <DockSplit node={node} path={path} container={container} />;
  return <div className="ui-dock-pane" data-ui-dock-pane={node.active} data-ui-dock-owner={container}>
    <div className="ui-dock-tab-strip" onContextMenu={event => {
      event.preventDefault(); event.stopPropagation(); ui.frameMenu(container, event.clientX, event.clientY);
    }}>
    <div className="ui-dock-tabs" role="tablist" aria-label="Docked frames">
      {node.keys.map(key => {
        const title = nameFor(ui, key), state = getContainer(ui.layout, key), style = state?.chrome?.style;
        return <span key={key} className="ui-dock-tab-with-close" data-ui-dock-tab={key}><button type="button" role="tab" aria-selected={key === node.active}
          className={`ui-dock-tab ${style?.mode === "icon" ? `function-icon shape-${style.geometry}` : ""}`}
          data-ui-drag={key} data-ui-inline-handle data-ui-name={title} data-ui-symbol={nameSymbol(key, title)} data-ui-proxy-for={key}
          aria-label={title} title={ui.layout.hideNames || style?.mode === "icon" ? title : ""}
          draggable={ui.canMove(key)}
          onDragStart={event => startResidentDrag(event, key)}
          onContextMenu={event => { event.preventDefault(); event.stopPropagation(); ui.frameMenu(key, event.clientX, event.clientY); }}
          onClick={() => ui.update(layout => {
            const current = getContainer(layout, container)?.dockLayout;
            return current ? updateContainer(updateContainer(layout, key, { collapsed: false }), container, { dockLayout: updateDockNode(current, path, value => value.kind === "tabs" ? { ...value, active: key } : value) }) : layout;
          })}
        ><DockTabLabel id={key} title={title} /><ShortcutHint binding={ui.shortcutBindings?.[`button:@frame:${key}`]} /></button><FrameCloseButton container={key} title={title} /></span>;
      })}
    </div>
    <FrameSearch container={node.active} title={nameFor(ui, node.active)} expand={() => {}} />
    </div>
    {node.keys.map(key => <div className="ui-dock-tab-body" role="tabpanel" data-ui-dock-content={key} hidden={key !== node.active} key={key} aria-label={nameFor(ui, key)}>
      {key.startsWith("window:")
        ? <DockHost id={key} width={320} height={400} fill />
        : <DockFrameHost id={key} />}
    </div>)}
  </div>;
}
function DockTabLabel({ id, title }: { id: string; title: string }) {
  const ui = useUI(), style = getContainer(ui.layout, id)?.chrome?.style;
  const tint = useIconTint(id), asset = ui.layout.assets.find(asset => asset.id === style?.assetId);
  if (style?.mode !== "icon") return title;
  return asset ? tint.color ? <span className="appearance-icon-mask" style={{ ...tint.style, backgroundColor: tint.color, maskImage: `url("${asset.dataUrl}")`, WebkitMaskImage: `url("${asset.dataUrl}")` }} />
    : <img src={asset.dataUrl} alt="" style={tint.style} />
    : <span style={{ ...tint.style, color: tint.color ?? tint.glyphColor }}>{style.character || "○"}</span>;
}
function DockFrameHost({ id }: { id: string }) {
  const ui = useUI();
  return <DockFillContext.Provider value={true}><div className="ui-dock-fill">{ui.renderResident({ kind: "frame", id: id.slice(6) })}</div></DockFillContext.Provider>;
}
function DockSplit({ node, path, container }: { node: Extract<DockNode, { kind: "split" }>; path: number[]; container: string }) {
  const ui = useUI(), root = useRef<HTMLDivElement>(null), [draft, setDraft] = useState<number>();
  const latest = useRef({ ui, node, path }); latest.current = { ui, node, path };
  const gesture = useRef<{ pointer: number; start: number; extent: number; ratio: number; release: () => void } | null>(null);
  const commit = (ratio: number) => latest.current.ui.update(layout => {
    const current = getContainer(layout, container)?.dockLayout;
    return current ? updateContainer(layout, container, { dockLayout: updateDockNode(current, latest.current.path, value => value.kind === "split" ? { ...value, ratio } : value) }) : layout;
  });
  useEffect(() => {
    const cancel = () => { const active = gesture.current; gesture.current = null; active?.release(); setDraft(undefined); };
    const move = (event: PointerEvent) => {
      const active = gesture.current;
      if (!active || active.pointer !== event.pointerId) return;
      if (!(event.buttons & 1)) { cancel(); return; }
      event.preventDefault(); event.stopImmediatePropagation();
      const point = latest.current.node.axis === "horizontal" ? event.clientX : event.clientY;
      const limit = Math.max(0.1, Math.min(0.45, 90 / active.extent));
      active.ratio = Math.max(limit, Math.min(1 - limit, (point - active.start) / active.extent));
      setDraft(active.ratio);
    };
    const up = (event: PointerEvent) => {
      const active = gesture.current;
      if (!active || active.pointer !== event.pointerId || event.button !== 0) return;
      event.preventDefault(); event.stopImmediatePropagation();
      gesture.current = null; active.release(); commit(active.ratio); setDraft(undefined);
    };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape" && gesture.current) { event.preventDefault(); event.stopImmediatePropagation(); cancel(); } };
    const cancelled = (event: PointerEvent) => { if (gesture.current?.pointer === event.pointerId) cancel(); };
    window.addEventListener("pointermove", move, true); window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", cancelled, true); window.addEventListener("keydown", key, true); window.addEventListener("blur", cancel);
    return () => {
      gesture.current?.release(); gesture.current = null;
      window.removeEventListener("pointermove", move, true); window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", cancelled, true); window.removeEventListener("keydown", key, true); window.removeEventListener("blur", cancel);
    };
  }, []);
  const ratio = draft ?? node.ratio, horizontal = node.axis === "horizontal";
  return <div ref={root} className={`ui-dock-split ${horizontal ? "is-horizontal" : "is-vertical"}`}
    style={dockSplitStyle(node.axis, ratio)}>
    <DockBranch node={node.first} path={[...path, 0]} container={container} />
    <div role="separator" tabIndex={0} aria-label="Resize dock split" aria-orientation={horizontal ? "vertical" : "horizontal"}
      aria-valuenow={Math.round(ratio * 100)} aria-disabled={!ui.canMove(container)} className="ui-dock-divider" data-ui-resize
      onPointerDown={event => {
        if (event.button !== 0 || !ui.canMove(container)) return;
        event.preventDefault(); event.stopPropagation();
        const bounds = root.current!.getBoundingClientRect();
        gesture.current = { pointer: event.pointerId, start: horizontal ? bounds.x : bounds.y, extent: horizontal ? bounds.width : bounds.height, ratio: node.ratio, release: captureUIPointer(event.pointerId, event.pointerType) };
      }}
      onKeyDown={event => {
        if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key) || !ui.canMove(container)) return;
        event.preventDefault(); event.stopPropagation();
        commit(Math.max(0.1, Math.min(0.9, node.ratio + (["ArrowRight", "ArrowDown"].includes(event.key) ? 0.025 : -0.025))));
      }} />
    <DockBranch node={node.second} path={[...path, 1]} container={container} />
  </div>;
}
