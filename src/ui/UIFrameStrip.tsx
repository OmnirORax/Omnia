import { Children, isValidElement, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Rnd } from "react-rnd";
import { flushSync } from "react-dom";
import { useUI } from "./context";
import { getContainer, ownerOf, residentKey, residentPinned, updateContainer, type WindowState } from "./layout";
import { DockArea } from "./DockArea";
import { FloatingWindow } from "./FloatingWindow";
import { useDockWorkspace } from "./DockWorkspace";
import { useUILabel } from "./EditableLabel";

/** Native menu/sidebar frames and user-docked frames share one reorderable row/column. */
export function UIFrameStrip({ id, title = "Panels", vertical = false, children }: { id: string; title?: string; vertical?: boolean; children: ReactNode }) {
  const ui = useUI(), container = `window:native:${id}`;
  const contentsId = `native-content:${id}`, contents = `window:${contentsId}`;
  const [name, rename] = useUILabel(contents, title);
  const root = useRef<Rnd>(null);
  const [resizingWidth, setResizingWidth] = useState<number>();
  const workspace = useDockWorkspace();
  const allocation = useSyncExternalStore(ui.placementPreview.subscribe, () => ui.placementPreview.getSnapshot()?.allocation);
  const native = Children.toArray(children).filter(isValidElement<{ id: string }>).filter(child => typeof child.props.id === "string");
  const nativeKeys = native.map(child => `window:panel:${child.props.id}`);
  const away = vertical && !!ui.layout.windows[contentsId]?.inline?.detached;
  const initial: WindowState = { x: 0, y: 0, width: 300, height: 560, collapsed: false, pinned: false, members: [],
    ...(vertical ? { layoutMode: "stacked", nativeStrip: { contents, vertical } } : {}) };
  useLayoutEffect(() => {
    ui.defaults.set(`native:${id}`, initial);
    if (vertical) ui.defaults.set(contentsId, { ...initial, nativeStrip: undefined, x: 320, y: 100, inline: { parent: container } });
    return () => { ui.defaults.delete(`native:${id}`); if (vertical) ui.defaults.delete(contentsId); };
  }, [id, vertical, away]);
  useLayoutEffect(() => {
    if (!vertical || away) return;
    const actions = { title: name, label: name, state: initial, onRename: rename,
      onChange: (patch: Partial<WindowState>) => ui.update(layout => updateContainer({
        ...layout, windows: { ...Object.fromEntries(ui.defaults), ...layout.windows },
      }, contents, patch)) };
    ui.frameActions.set(contents, actions);
    return () => { if (ui.frameActions.get(contents) === actions) ui.frameActions.delete(contents); };
  });
  const projected = getContainer(allocation?.layout ?? ui.layout, container);
  const maxWidth = Math.max(160, workspace.center.width * .75);
  const requestedWidth = resizingWidth ?? (projected?.dockLayout || ui.layout.windows[`native:${id}`] ? projected?.width : undefined);
  const allocatedWidth = vertical && requestedWidth !== undefined ? Math.min(requestedWidth, maxWidth) : undefined;
  useLayoutEffect(() => {
    const parent = root.current?.resizableElement.current?.parentElement;
    if (!parent || allocatedWidth === undefined) return;
    const width = parent.style.width, basis = parent.style.flexBasis;
    const extent = allocatedWidth + parent.offsetWidth - parent.clientWidth;
    parent.style.width = `${extent}px`;
    parent.style.flexBasis = `${extent}px`;
    return () => { parent.style.width = width; parent.style.flexBasis = basis; };
  }, [allocatedWidth]);
  // Once split, the original live collection occupies a normal dock tab. The
  // native root owns panes, while that tab retains the collection's extras.
  const rowContainer = away ? contents : container;
  const members = getContainer(ui.layout, rowContainer)?.members ?? [];
  // Older sidebar order stores plain panel IDs. Keep those templates working.
  const saved = (ui.layout.nativeOrders?.[id] ?? []).map(key => nativeKeys.includes(`window:panel:${key}`) ? `window:panel:${key}` : key);
  const keys = [...new Set([...saved, ...nativeKeys, ...members.map(residentKey)])];
  const rows = <div className={`ui-frame-strip ${vertical ? "is-vertical" : ""}`} data-ui-frame-strip={rowContainer} data-ui-frame-order={id} data-ui-frame-native={JSON.stringify(nativeKeys)}>
    {native.map(child => {
      const key = `window:panel:${child.props.id}`;
      const away = !!ownerOf(ui.layout, key) || ui.layout.panels[child.props.id];
      return <div key={key} className={`ui-native-frame-slot ${away ? "is-away" : ""}`} data-ui-frame-slot={away ? undefined : key} style={{ order: keys.indexOf(key) }}>{child}</div>;
    })}
    {members.filter(m => !nativeKeys.includes(residentKey(m))).map(member => <div key={residentKey(member)} className="ui-native-frame-slot" data-ui-frame-slot={residentKey(member)} style={{ order: keys.indexOf(residentKey(member)) }}>{ui.renderResident(member)}</div>)}
  </div>;
  if (!vertical) return rows;
  return <Rnd ref={root} className="ui-native-strip-frame" data-ui-resident-root={container}
    style={{ position: "relative" }} position={{ x: 0, y: 0 }} size={{ width: allocatedWidth ?? "100%", height: "100%" }} disableDragging
    minWidth={160} maxWidth={maxWidth} enableResizing={residentPinned(ui.layout, container) ? false : { right: true }}
    resizeHandleStyles={{ right: { right: 0, width: 8, pointerEvents: "auto", zIndex: 2 } }}
    resizeHandleComponent={{ right: <span className="ui-native-strip-resize" data-ui-resize aria-label={`Resize ${name}`} /> }}
    // Freeze percentage sizing in pixels before the resizer captures its origin;
    // otherwise widening its flex parent feeds back into the held frame's width.
    onResizeStart={(_, __, element) => flushSync(() => setResizingWidth(element.offsetWidth))}
    onResize={(_, __, element) => setResizingWidth(element.offsetWidth)}
    onResizeStop={(_, __, element) => {
      const width = element.offsetWidth;
      ui.update(layout => updateContainer({ ...layout, windows: { ...Object.fromEntries(ui.defaults), ...layout.windows } }, container, { width }));
      setResizingWidth(undefined);
    }}>
    {away ? <>
      <DockArea container={container} contour={false} />
      <FloatingWindow id={contentsId} title={title} role="complementary" openAtCursor={false} className="ui-native-strip-window" residentArea={null}>{rows}</FloatingWindow>
    </> : rows}
  </Rnd>;
}
