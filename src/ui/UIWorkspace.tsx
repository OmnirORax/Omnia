import { captureNativeActions, NativeActions } from "./NativeActions";
import { UINameInput } from "./EditableLabel";
import { withControlCaption } from "./captions";
import { UIField } from "./UIField";
import { UIAction } from "./UIAction";
import { UISection } from "./UISection";
import { UIEditor } from "./UIEditor";
import { CustomControls, CustomControlSettings } from "./CustomControls";
import { removeCustomControl } from "./authoring";
import { useOutsideDismiss } from "./useOutsideDismiss";
import { ContextMenu, contextMenuRoots } from "./ContextMenu";
import { ContextSubmenu } from "./ContextSubmenu";
import { AlignmentControls } from "./AlignmentControls";
import { selectionId } from "./selection";
import { cursorPosition, useCursorTracking } from "./cursorPosition";
import { createUIFrame, FRAME_LAYOUTS, setFrameLayout } from "./frameLayout";
import { NamePresentation } from "./NamePresentation";
import { createTransientStore } from "./transientStore";
import { PlacementPreviewOverlay } from "./PlacementPreview";
import { captureUIPointer } from "./drag";
import { beginLiveDrag, dragSurface } from "./liveDrag";
import { dockGuideAt } from "./dockGuides";
import { AppearanceProvider, type AppearanceBridge } from "../appearance/Context";
import { AppearanceStyles, useIconTint } from "../appearance/Styles";
import { ContextualAppearance } from "../appearance/ContextualEditor";
import {
  cloneElement,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useCallback,
  useContext,
  useMemo,
  type DragEvent,
  type ReactNode,
  type ReactElement,
} from "react";
import { Rnd } from "react-rnd";
import { createPortal } from "react-dom";
import {
  UIContext,
  UIHomeContext,
  UIPathContext,
  UIContainerContext,
  DockFillContext,
  useUI,
  type UIFunction,
  type UIContextValue,
  type UICommand,
} from "./context";
import { useDragActivationGuard } from "./activationGuard";
import { useButtonSelection, ButtonSelectionOverlay } from "./useButtonSelection";
import { FloatingWindow, nextWindowLayer } from "./FloatingWindow";
import { EmbeddedGroup } from "./EmbeddedGroup";
import {
  detachFunction,
  functionPinned,
  type UILayout,
  type UIFrame,
  type FunctionStyle,
  type FrameLayoutMode,
} from "./layout";
import { VisualControls } from "../VisualControls";
import { ShortcutHint } from "./ShortcutHint";
import { FrameChrome } from "./FrameChrome";
import { GlobalSearch, type GlobalSearchProps } from "./GlobalSearch";
import { DockArea } from "./DockArea";
import { DockHost } from "./DockHost";
import {
  canDock,
  dockResident,
  floatResident,
  ownerOf,
  getContainer,
  groupResidents,
  updateContainer,
  releaseResident,
  closeContainer,
  residentKey,
  residentPinned,
  resetContainer,
  validateUILayout,
  orderNativeFunction,
  residentContextScope,
  type WindowState,
  type UIResident,
} from "./layout";
import {
  DOCK_DISTANCE,
  rectDistance,
  startResidentDrag,
  type PlacementPreview,
  type Rect,
} from "./drag";
import type { VisualAsset } from "../graph/assets";
import { keepFloatingHandleVisible, snapshotPositions } from "./positioning";
import { insertFrameBeside, type InsertSide } from "./frameInsertion";
import { DockLayout } from "./DockLayout";
import { dockFrame, edgeDockRect, fitDockRect, workspaceDockRects, type DockRect, type FrameDock } from "./docking";
import { DockWorkspace, dockWorkspaceArea, useDockResident, useDockWorkspace } from "./DockWorkspace";
import type { DockSide } from "./dockTree";
import { LIBRARY_CATEGORIES, libraryCategory } from "./catalog";
import { useFrameBounds, residentBounds } from "./frameBounds";
import { buttonShortcutId, isTypingTarget, normalizeKey, type ButtonShortcuts } from "../workspaceActions";
const MIME = "application/x-omnium-function";
const defaultStyle: FunctionStyle = { mode: "text", geometry: "circle" };
const dropGeometrySelector = "[data-ui-drop-zone],[data-ui-resident-root],[data-ui-inline-group],[data-ui-frame-slot],[data-ui-slot-key],[data-ui-dock-pane],.ui-structured-body,.ui-embedded-dock-layout,.ui-frame-handle,[data-ui-inline-handle],[data-ui-chrome],[data-ui-native-anchor]";
export function FunctionControl({ id, palette = false }: { id: string; palette?: boolean }) {
  const ui = useUI(),
    fn = ui.functions.find((f) => f.id === id),
    item = ui.layout.items[id];
  const scope = useContext(UIHomeContext),
    anchor = `${scope}|${id}`;
  if (palette) return fn ? <FunctionElement fn={fn} palette /> : null;
  const peers = ui.functions.filter((f) => ui.layout.items[f.id]?.anchorId === anchor);
  const order = [
    ...new Set([...(ui.layout.nativeOrders?.[anchor] ?? []), id, ...peers.map((f) => f.id)]),
  ];
  return (
    <>
      {order.map((key) => {
        const current = key === id ? fn : peers.find((f) => f.id === key);
        const visible =
          key !== id ||
          (!ownerOf(ui.layout, `function:${id}`) && !item?.anchorId && (!item || item.home));
        return current && visible ? (
          <FunctionElement key={key} fn={current} nativeAnchor={{ key: anchor, id }} />
        ) : null;
      })}
    </>
  );
}
function FunctionElement({
  fn,
  palette = false,
  resident = false,
  nativeAnchor,
}: {
  fn: UIFunction;
  palette?: boolean;
  resident?: boolean;
  nativeAnchor?: { key: string; id: string };
}) {
  const ui = useUI(),
    item = ui.layout.items[fn.id],
    style = item?.style ?? defaultStyle;
  const iconTint = useIconTint(`function:${fn.id}`);
  const [controlOpen, setControlOpen] = useState(false);
  const shortcut = ui.shortcutBindings?.[buttonShortcutId(fn.id)];
  const asset = ui.layout.assets.find((a) => a.id === style.assetId);
  const content =
    palette || (resident && style.mode === "text") ? (
      fn.label
    ) : style.mode === "text" ? (
      ((fn.element.props as { children?: ReactNode }).children ?? fn.label)
    ) : asset ? (
      iconTint.color ? <span className="appearance-icon-mask" style={{ ...iconTint.style, backgroundColor: iconTint.color, maskImage: `url("${asset.dataUrl}")`, WebkitMaskImage: `url("${asset.dataUrl}")` }} /> : <img src={asset.dataUrl} alt="" style={iconTint.style}/>
    ) : (
      <span style={{...iconTint.style,color:iconTint.color}}>{style.character || "○"}</span>
    );
  const original = fn.element as ReactElement<{
    onClick?: () => void;
    disabled?: boolean;
    children?: ReactNode;
    className?: string;
    onMouseEnter?: () => void;
  }>;
  const shared = {
    "aria-keyshortcuts": shortcut?.replace(/Ctrl/g, "Control").replace(/Esc/g, "Escape"),
    "data-ui-function": fn.id,
    "data-ui-palette": palette ? "true" : undefined,
    "data-ui-resident": resident ? "true" : undefined,
    "data-ui-native-anchor": nativeAnchor?.key,
    "data-ui-native-home": nativeAnchor?.id,
    title: ui.layout.hideNames ? fn.label : "",
    draggable:
      (!fn.control || palette || style.mode === "icon") && !functionPinned(ui.layout, fn.id),
    onDragStart: (e: DragEvent) => {
      if ((e.target as Element).closest("input,select,textarea")) return;
      e.dataTransfer.setData(MIME, fn.id);
      e.dataTransfer.effectAllowed = "move";
    },
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!palette && ui.selectedFunctions.has(fn.id) && ui.selectedFunctions.size > 1) {
        ui.selectionMenu(e.clientX, e.clientY);
        return;
      }
      ui.configure(fn.id);
    },
  };
  const modeClass =
    !palette && style.mode === "icon" ? `function-icon shape-${style.geometry}` : "function-text";
  const button =
    fn.control && !palette && style.mode === "text" ? (
      <div {...shared} className="ui-form-control">
        {["top", "right", "bottom", "left"].map((edge) => (
          <span
            key={edge}
            className={`ui-field-edge edge-${edge}`}
            title={ui.layout.hideNames ? fn.label : ""}
            data-ui-drag={`function:${fn.id}`}
            draggable={!functionPinned(ui.layout, fn.id)}
            onDragStart={(e) => startResidentDrag(e, `function:${fn.id}`)}
          />
        ))}
        {fn.element}
        <ShortcutHint binding={shortcut} />
      </div>
    ) : (
      cloneElement(fn.control ? <button onClick={() => setControlOpen(true)} /> : original, {
        ...shared,
        "data-ui-name": fn.label,
        disabled: false,
        "aria-disabled": original.props.disabled || undefined,
        "aria-pressed":
          fn.id === "ui:select"
            ? ui.selectingUI
            : original.props["aria-pressed" as keyof typeof original.props],
        onClick: original.props.disabled
          ? undefined
          : fn.control
            ? () => setControlOpen(true)
            : original.props.onClick,
        "aria-label": palette
          ? `Place ${fn.label}`
          : (original.props["aria-label" as keyof typeof original.props] ??
            (resident || style.mode === "icon" ? fn.label : undefined)),
        className: `${original.props.className ?? ""} ui-function ${modeClass} ${!palette && ui.selectedFunctions.has(fn.id) ? "ui-selected" : ""}`,
        children: <>{content}{(palette || style.mode === "text") && <ShortcutHint binding={shortcut} />}</>,
      })
    );
  return (
    <>
      {shortcut && !palette && style.mode === "icon" ? <span className="ui-icon-shortcut">{button}<ShortcutHint binding={shortcut} /></span> : button}
      {controlOpen && (
        <FloatingWindow
          id={`control:${fn.id}`}
          title={fn.label}
          width={340}
          height={240}
          onClose={() => setControlOpen(false)}
        >
          {fn.element}
        </FloatingWindow>
      )}
    </>
  );
}
export function UIPanel({
  id,
  title,
  children,
  className = "",
  menu = false,
}: {
  id: string;
  title: string;
  children: ReactNode;
  className?: string;
  menu?: boolean;
}) {
  const ui = useUI();
  const key = `window:panel:${id}`,
    owner = ownerOf(ui.layout, key);
  const root = useRef<HTMLElement>(null);
  const initial: WindowState = { x: 320, y: 160, width: menu ? 320 : 400, height: 560, collapsed: menu, pinned: false };
  const state = ui.layout.windows[`panel:${id}`] ?? initial;
  const [popup, setPopup] = useState({ left: 0, height: 480 });
  const patch = (change: Partial<WindowState>) => ui.update(layout => ({
    ...layout,
    windows: { ...layout.windows, [`panel:${id}`]: { ...(layout.windows[`panel:${id}`] ?? initial), ...change } },
  }));
  useLayoutEffect(() => {
    if (!menu || state.collapsed || owner || ui.layout.panels[id]) return;
    const fit = () => {
      const r = root.current?.getBoundingClientRect(); if (!r) return;
      const width = Math.min(state.width, window.innerWidth - 24);
      setPopup({ left: Math.max(8 - r.left, Math.min(0, window.innerWidth - r.left - width - 12)), height: Math.max(100, window.innerHeight - r.bottom - 12) });
    };
    fit(); window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [menu, state.collapsed, state.width, owner, ui.layout.panels[id]]);
  useEffect(() => {
    if (!menu || state.collapsed || ui.layout.panels[id] || owner) return;
    const close = (event: PointerEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key !== "Escape" : root.current?.contains(event.target as Node)) return;
      // Do not unmount an active native drag source, or close over a child editor.
      if (event instanceof PointerEvent && (event.buttons !== 1 || (event.target as Element).closest(".floating-window,.ui-background-menu,.ui-selection-tools,[data-ui-search]"))) return;
      patch({ collapsed: true });
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", close);
    return () => { window.removeEventListener("pointerdown", close); window.removeEventListener("keydown", close); };
  }, [menu, state.collapsed, ui.layout.panels[id], owner]);
  useLayoutEffect(() => {
    if (ui.layout.panels[id] || owner) return;
    ui.defaults.set(`panel:${id}`, initial);
    return () => {
      ui.defaults.delete(`panel:${id}`);
    };
  }, [id, ui.layout.panels[id], owner]);
  const float = (value: boolean) =>
    ui.update((layout) => ({ ...layout, panels: { ...layout.panels, [id]: value } }));
  if (state.closed) return null;
  if (ui.layout.panels[id] || owner)
    return (
      <FloatingWindow
        id={`panel:${id}`}
        openAtCursor={false}
        title={title}
        width={400}
        height={560}
        onClose={() =>
          ui.update((s) => ({ ...closeContainer(s, key), panels: { ...s.panels, [id]: false } }))
        }
        closeLabel={`Close ${title}`}
      >
        <section className={className}>{children}</section>
      </FloatingWindow>
    );
  return (
    <section
      ref={root}
      className={`ui-docked-panel ${menu ? "ui-menu-panel" : ""}`}
      data-ui-resident-root={key}
      style={{ order: menu ? undefined : ui.layout.nativeOrders?.["@sidebar"]?.indexOf(id) }}
      onClick={event => {
        if (menu && !event.defaultPrevented && !event.ctrlKey && !event.metaKey && !ui.selectingUI && !ui.selectedFunctions.size && (event.target as Element).closest("button[data-ui-function]")) patch({ collapsed: true });
      }}
    >
      <FrameChrome container={key} title={title} state={state} onChange={patch} />
      {!menu && <button
        className="detach-panel"
        title={`Float ${title}`}
        aria-label={`Undock ${id} panel`}
        data-ui-drag={key}
        draggable
        onDragStart={(e) => startResidentDrag(e, key)}
        onClick={() => float(true)}
      >↗</button>}
      <div className={`ui-panel-body ${className}`} hidden={state.collapsed} style={menu ? { width: Math.min(state.width, window.innerWidth - 24), left: popup.left, maxHeight: popup.height } : undefined}>
      <UIHomeContext.Provider value={key}><UIPathContext.Provider value={[key]}><UIContainerContext.Provider value={key}>
        {children}
        <DockArea container={key} contour={false} />
      </UIContainerContext.Provider></UIPathContext.Provider></UIHomeContext.Provider>
      </div>
    </section>
  );
}
function FunctionFrame({ frame }: { frame: UIFrame }) {
  const { ref, bounds, element } = useFrameBounds();
  const [z, setZ] = useState(nextWindowLayer);
  const ui = useUI(),
    dockFill = useContext(DockFillContext),
    key = `frame:${frame.id}`,
    parent = ownerOf(ui.layout, key),
    nested = !!parent,
    stackedParent = !!parent && getContainer(ui.layout, parent)?.layoutMode === "stacked",
    width = Math.max(64, frame.floatingOverflow ? frame.width ?? 280 : Math.min(frame.width ?? 280, window.innerWidth - 24));
  useEffect(() => {
    if (!element || nested) return;
    // Portal children bubble through their former React owner, so focus follows DOM ownership.
    const raise = () => setZ(nextWindowLayer());
    element.addEventListener("mousedown", raise);
    return () => element.removeEventListener("mousedown", raise);
  }, [element, nested]);
  const workspace = useDockWorkspace();
  const edgeBounds = frame.dockEdge && !nested ? workspace.docks[frame.dockEdge] : undefined;
  const structured = !!frame.dockLayout;
  const stacked = frame.layoutMode === "stacked";
  const rectangular = structured || stacked;
  const desired = { x: frame.x + (rectangular ? 0 : bounds.x), y: frame.y + (rectangular ? 0 : bounds.y), width: rectangular ? width : bounds.width, height: structured && !frame.collapsed ? frame.height ?? 420 : bounds.height };
  const viewport = { x: 8, y: 8, width: innerWidth-16, height: innerHeight-16 };
  const visible = useDockResident(key, frame.floatingOverflow ? keepFloatingHandleVisible(desired, viewport, frame.chrome?.handle) : fitDockRect(desired, workspace.active ? workspace.floating : viewport), !nested && !edgeBounds, frame.floatingOverflow);
  const patch = (change: Partial<UIFrame>) => ui.update((s) => updateContainer(s, key, change));
  const content = (
    <Rnd
      className={`function-frame contour-frame ${structured ? "ui-structured-frame" : ""} ${stacked ? "ui-stacked-frame" : ""} ${nested ? "nested-ui-frame" : ""} ${frame.collapsed ? "collapsed" : ""}`}
      style={
        {
          pointerEvents: rectangular ? "auto" : "none",
          position: nested ? "relative" : "fixed",
          zIndex: z,
          "--ui-frame-top": `${Math.max(8, Math.min(frame.y, window.innerHeight - 60))}px`,
        } as React.CSSProperties
      }
      position={
        edgeBounds ? { x: edgeBounds.x, y: edgeBounds.y } : nested
          ? { x: 0, y: 0 }
          : {
              x: visible.x,
              y: visible.y,
            }
      }
      size={{ width: stackedParent ? "100%" : edgeBounds?.width ?? (!nested ? visible.width : rectangular ? width : bounds.width), height: edgeBounds?.height ?? (!nested ? visible.height : structured && !frame.collapsed ? frame.height ?? 420 : bounds.height) }}
      disableDragging
      enableResizing={
        !dockFill && !stackedParent && !residentPinned(ui.layout, key) && !frame.collapsed
          ? frame.dockEdge ? { [frame.dockEdge === "left" ? "right" : frame.dockEdge === "right" ? "left" : frame.dockEdge === "top" ? "bottom" : "top"]: true } : structured ? true : { right: true, bottomRight: true }
          : false
      }
      resizeHandleStyles={{
        right: { pointerEvents: "auto" },
        bottomRight: { pointerEvents: "auto" },
      }}
      minWidth={40}
      maxWidth={frame.floatingOverflow && !nested && !edgeBounds ? undefined : window.innerWidth - 24}
      onResizeStop={(_, __, element, ___, position) => patch({ width: element.offsetWidth, ...(structured ? { height: element.offsetHeight, ...(!frame.dockEdge ? position : {}) } : {}) })}
    >
      <div
        ref={ref}
        className={`ui-frame-root ${stacked ? "ui-stacked-frame-root" : ""}`}
        data-ui-resident-root={key}
        style={{ width: rectangular || stackedParent ? "100%" : !nested ? Math.min(width, visible.width) : width, height: structured ? "100%" : undefined, maxHeight: !nested && workspace.active ? stacked ? Math.max(44, workspace.floating.y + workspace.floating.height - visible.y) : visible.height : undefined, overflow: !nested && workspace.active ? "auto" : undefined, position: "relative", left: rectangular ? 0 : -bounds.x, top: rectangular ? 0 : -bounds.y }}
      >
        <FrameChrome
          container={key}
          title={frame.name}
          label={`UI frame ${frame.name}`}
          state={frame}
          className="ui-frame-header"
          onChange={patch}
          onRename={(name) => patch({ name })}
          closeLabel={`Remove UI frame ${frame.name}`}
          onClose={() => {
            if (residentPinned(ui.layout, key)) return;
            if (
              (frame.members?.length ?? 0) &&
              !window.confirm(
                "Remove this frame? Its functions return to their default locations; nested frames and windows remain available. Your graph will not change.",
              )
            )
              return;
            ui.update((s) => {
              let next = releaseResident(s, key);
              for (const member of frame.members ?? []) {
                const memberKey = residentKey(member);
                next = releaseResident(next, memberKey);
                if (member.kind === "function") {
                  const items = { ...next.items };
                  if (next.customControls?.[member.id]) items[member.id] = {
                    ...items[member.id], home: false, x: frame.x + 24, y: frame.y + 64,
                  };
                  else delete items[member.id];
                  next = { ...next, items };
                } else
                  next = updateContainer(next, memberKey, { x: frame.x + 24, y: frame.y + 64 });
              }
              return { ...next, frames: next.frames.filter((f) => f.id !== frame.id) };
            });
          }}
        />
        {structured ? <div className="ui-structured-body" hidden={frame.collapsed}><DockLayout container={key} /></div> : <DockArea container={key} hidden={frame.collapsed} />}
      </div>
    </Rnd>
  );
  return nested ? content : createPortal(content, document.body);
}
function FreeFunction({ id, x, y, width, height, children }: { id: string; x: number; y: number; width?: number; height?: number; children: ReactNode }) {
  const workspace = useDockWorkspace();
  const area = workspace.active ? workspace.floating : { x: 8, y: 8, width: innerWidth-16, height: innerHeight-16 };
  const visible = useDockResident(`function:${id}`, fitDockRect({ x, y, width: width ?? 100, height: height ?? 82 }, area));
  return <div className="ui-free-function" style={{ left: visible.x, top: visible.y, width: width ? visible.width : undefined, maxWidth: workspace.active ? visible.width : area.width }}>{children}</div>;
}
type Preview = PlacementPreview & {
  floatingOverflow?: boolean;
  group?: string;
  control?: { owner: string; control: string; x: number; y: number };
  native?: { id: string; anchor: string; homeId: string; target: string; after: boolean };
  frameStrip?: { target: string; orderId: string; keys: string[]; nativeKeys: string[]; peer: string; after: boolean };
};
type DragState = {
  key: string;
  start: { x: number; y: number };
  width: number;
  height: number;
  dx: number;
  dy: number;
  originOffset: { x: number; y: number };
  slots: Map<string, { key: string; r: Rect }[]>;
  targetZones: Map<string, HTMLElement>;
  targetBounds: Map<Element, DOMRect>;
  zoneOrigins: Map<Element, { x: number; y: number }>;
  cancelled?: boolean;
  control?: { owner: string; control: string };
  fromDockPane?: boolean;
  live?: ReturnType<typeof beginLiveDrag>;
};
export function UIWorkspace({
  layout,
  update,
  functions: definitions,
  children,
  command,
  onReset,
  shortcuts,
  search,
  appearance,
}: {
  layout: UILayout;
  update: (change: (layout: UILayout) => UILayout) => void;
  functions: UIFunction[];
  children: ReactNode;
  command?: UICommand | null;
  onReset: () => void;
  shortcuts?: ButtonShortcuts;
  search?: GlobalSearchProps;
  appearance?: AppearanceBridge;
}) {
  useCursorTracking();
  const suppressActivation = useDragActivationGuard();
  const sources = useRef(new Map<string, Map<symbol, UIFunction>>()).current;
  const [registered, setRegistered] = useState<Record<string, UIFunction>>({});
  const registerFunction = useCallback(
    (fn: UIFunction) => {
      const token = Symbol(fn.id),
        entries = sources.get(fn.id) ?? new Map<symbol, UIFunction>();
      entries.set(token, fn);
      sources.set(fn.id, entries);
      setRegistered((old) => ({ ...old, [fn.id]: fn }));
      return () => {
        entries.delete(token);
        const remaining = [...entries.values()].at(-1);
        setRegistered((old) => ({
          ...old,
          [fn.id]: remaining ?? {
            ...fn,
            available: false,
            element: (
              <p>Select the relevant node or relationship to edit {fn.label.toLowerCase()}.</p>
            ),
          },
        }));
      };
    },
    [sources],
  );
  const functions = useMemo(() => [
    ...new Map([...definitions, ...Object.values(registered)].map((fn) => [fn.id, fn])).values(),
  ].filter(fn => !fn.id.startsWith("ui:custom:") || !!layout.customControls?.[fn.id]).map(fn => {
    const caption = layout.labels?.[`function:${fn.id}`];
    return caption ? { ...fn, label: caption, element: withControlCaption(fn.element, caption) } : fn;
  }), [definitions, registered, layout.labels, layout.customControls]);
  const libraryOpen = layout.panels["@library"] ?? false;
  const setLibraryOpen = (value: boolean) =>
    update((s) => ({ ...s, panels: { ...s.panels, "@library": value } }));
  const [query, setQuery] = useState(""),
    [configured, configure] = useState<string | null>(null),
    [configuredFrame, configureFrame] = useState<string | null>(null);
  const [configuredControl, configureControl] = useState<{
    owner: string;
    control: "collapse" | "pin" | "close";
  } | null>(null);
  const [appearanceOpening, setAppearanceOpening] = useState(0);
  const reopenAppearance = () => setAppearanceOpening(value => value + 1);
  const [placementPreview] = useState(() => createTransientStore<Preview | null>(null));
  const [menu, setMenu] = useState<{ x: number; y: number; owner?: string } | null>(null);
  const [creatingFrame, setCreatingFrame] = useState<{ x: number; y: number } | null>(null);
  const menuRoot = useRef<HTMLDivElement>(null);
  const creationRoot = useRef<HTMLDivElement>(null);
  useOutsideDismiss(!!menu, () => contextMenuRoots(menuRoot.current), () => setMenu(null));
  useOutsideDismiss(!!creatingFrame, () => contextMenuRoots(creationRoot.current), () => setCreatingFrame(null));
  useLayoutEffect(() => {
    for (const [node, opening] of [[menuRoot.current, menu], [creationRoot.current, creatingFrame]] as const) {
      if (!node || !opening) continue;
      const r = node.getBoundingClientRect();
      node.style.left = `${Math.max(8, Math.min(opening.x, window.innerWidth - r.width - 8))}px`;
      node.style.top = `${Math.max(8, Math.min(opening.y, window.innerHeight - r.height - 8))}px`;
    }
  }, [menu, creatingFrame, layout]);
  const defaults = useRef(new Map<string, WindowState>()).current;
  const dockProjection = useRef<((key: string, rect: DockRect) => DockRect) | undefined>(undefined);
  const frameActions = useRef<UIContextValue["frameActions"]>(new Map()).current;
  const current = useRef({ layout, update, functions });
  current.current = { layout, update, functions };
  const drag = useRef<DragState | null>(null);
  const [shortcutField, setShortcutField] = useState<string | null>(null);
  const [shortcutNotice, setShortcutNotice] = useState("");
  const shortcutRunners = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const invoke = (id: string) => {
      if (!id.startsWith("button:") || shortcuts?.capturing || shortcuts?.blocked) return;
      const target = id.slice(7);
      setShortcutNotice("");
      if (target.startsWith("@frame:")) {
        const frame = frameActions.get(target.slice(7));
        if (frame) frame.onChange({ collapsed: !frame.state.collapsed });
        else setShortcutNotice("Open this frame before using its shortcut.");
        return;
      }
      if (target.startsWith("@control:")) {
        const [, control, ...owner] = target.split(":");
        const frame = frameActions.get(owner.join(":"));
        if (frame) {
          if (control === "close") frame.onClose?.();
          if (control === "pin") frame.onChange({ pinned: !frame.state.pinned });
          if (control === "collapse") frame.onChange({ collapsed: !frame.state.collapsed });
        }
        return;
      }
      const fn = current.current.functions.find(f => f.id === target);
      if (!fn || fn.available === false) {
        if (shortcuts?.onInvoke?.(target)) return;
        setShortcutNotice(target.startsWith("context:node:") ? "Select a node to use this shortcut." : target.startsWith("context:selection:") ? "Select nodes to use this shortcut." : "This action needs its relevant node, relationship or window open.");
        return;
      }
      setShortcutNotice("");
      if (fn.control) { setShortcutField(target); return; }
      const runner = Array.from(shortcutRunners.current?.children ?? []).find(el => el.getAttribute("data-shortcut-runner") === target);
      runner?.querySelector<HTMLButtonElement>("button")?.click();
    };
    const keydown = (event: KeyboardEvent) => {
      if (shortcuts?.capturing || shortcuts?.blocked || event.defaultPrevented || event.repeat || isTypingTarget(event.target)) return;
      const key = normalizeKey(event);
      const id = Object.entries(shortcuts?.bindings ?? {}).find(([id, binding]) => id.startsWith("button:") && binding && binding === key)?.[0];
      if (!id) return;
      event.preventDefault(); event.stopPropagation(); invoke(id);
    };
    const run = (event: Event) => invoke((event as CustomEvent<string>).detail);
    window.addEventListener("keydown", keydown, true);
    window.addEventListener("omnium:invoke-button", run);
    return () => { window.removeEventListener("keydown", keydown, true); window.removeEventListener("omnium:invoke-button", run); };
  }, [shortcuts, frameActions]);

  const frameMenu = (owner: string, x: number, y: number) => setMenu({ owner, x, y });
  const createFrame = (x: number, y: number, mode?: FrameLayoutMode) => {
    if (!mode) { setCreatingFrame({ x, y }); return; }
    update(layout => createUIFrame(layout, x, y, mode));
    setCreatingFrame(null);
  };
  const ensure = (s: UILayout) => ({
    ...s,
    windows: Object.fromEntries([...new Set([...defaults.keys(), ...Object.keys(s.windows)])].map(id => [id, { ...defaults.get(id), ...s.windows[id] }])),
  });
  const buttonSelection = useButtonSelection({
    layout: ensure(layout),
    update,
    functions,
    command,
    suppress: suppressActivation,
  });
  const reset = () => {
    buttonSelection.clear();
    configure(null); configureFrame(null); configureControl(null);
    placementPreview.set(null); setMenu(null); setQuery("");
    setCreatingFrame(null);
    onReset();
  };
  const resetRef = useRef(reset); resetRef.current = reset;
  useEffect(() => { if (command?.action === "reset") resetRef.current(); }, [command?.sequence]);
  useEffect(() => { if (command?.action === "createFrame") setCreatingFrame(cursorPosition()); }, [command?.sequence]);
  useEffect(() => {
    // Prevent the browser menu everywhere in the app; custom menus still receive this event.
    const prevent = (e: Event) => e.preventDefault();
    const fallback = (e: MouseEvent) => {
      const target = e.target as Element;
      if (
        !target.closest(
          ".toolbar,.floating-window-content,.ui-docked-panel,.ui-workspace-overlay",
        ) ||
        target.closest('[role="menu"]')
      )
        return;
      const owner = target.closest<HTMLElement>("[data-ui-resident-root]")?.dataset.uiResidentRoot;
      setMenu({
        x: e.clientX,
        y: e.clientY,
        owner: owner?.startsWith("function:") ? undefined : owner,
      });
    };
    document.addEventListener("contextmenu", prevent, true);
    document.addEventListener("contextmenu", fallback);
    return () => {
      document.removeEventListener("contextmenu", prevent, true);
      document.removeEventListener("contextmenu", fallback);
    };
  }, []);
  useEffect(() => {
    let previewFrame = 0;
    let pointer: { down: PointerEvent; started: boolean; release?: () => void } | null = null;
    let pendingPoint: { x: number; y: number } | null = null;
    const cancelFrame = () => {
      cancelAnimationFrame(previewFrame); previewFrame = 0; pendingPoint = null;
    };
    let layoutSource: UILayout | undefined, dragLayout: UILayout;
    let frameProjection: { layout: UILayout; intent: string; feedback: Pick<Preview, 'rect' | 'frameLayout' | 'allocation'> } | undefined;
    const effectiveLayout = () => {
      if (layoutSource !== current.current.layout) {
        layoutSource = current.current.layout;
        dragLayout = ensure(layoutSource);
      }
      return dragLayout;
    };
    const show = (value: Preview | null) => {
      const old = placementPreview.getSnapshot();
      // The cached projected layout is transient and compared by identity;
      // never serialize the whole UI layout on every pointer movement.
      if (old?.allocation !== value?.allocation || JSON.stringify(old && { ...old, allocation: undefined }) !== JSON.stringify(value && { ...value, allocation: undefined })) placementPreview.set(value);
    };
    const start = (event: MouseEvent) => {
      cancelFrame(); layoutSource = undefined; frameProjection = undefined;
      const target = event.target as Element;
      if (target.closest("input,select,textarea,[data-ui-search]")) return;
      const mini = target.closest<HTMLElement>("[data-ui-control]");
      const handle = target.closest<HTMLElement>("[data-ui-drag]");
      const fn = target.closest<HTMLElement>("[data-ui-function]");
      const key =
        mini?.dataset.uiControlOwner ??
        handle?.dataset.uiDrag ??
        (fn ? `function:${fn.dataset.uiFunction}` : "");
      if (!key) return;
      const nativeOwner =
        fn?.closest<HTMLElement>("[data-ui-resident-root]")?.dataset.uiResidentRoot;
      if (
        fn &&
        !fn.dataset.uiPalette &&
        nativeOwner &&
        residentPinned(ensure(current.current.layout), nativeOwner)
      ) {
        event.preventDefault();
        return;
      }
      const tabPane = handle?.getAttribute("role") === "tab" ? handle.closest<HTMLElement>("[data-ui-dock-pane]") : null;
      const represented = handle && [...document.querySelectorAll<HTMLElement>("[data-ui-resident-root]")].find(element => element.dataset.uiResidentRoot === key);
      const root =
        mini ??
        (fn && key.startsWith("function:")
          ? fn
          : tabPane ?? (represented?.getClientRects().length ? represented : (handle?.closest<HTMLElement>("[data-ui-resident-root]") ?? handle)));
      const r = root ? residentBounds(root) : undefined;
      if (!r) return;
      const targetZones = new Map(
        [...document.querySelectorAll<HTMLElement>("[data-ui-drop-zone]")].map(zone => [zone.dataset.uiDropZone!, zone]),
      );
      const slots = new Map(
        [...targetZones].map(([key, zone]) => [
          key,
          [...zone.querySelectorAll<HTMLElement>(":scope > [data-ui-slot-key]")].map((slot) => ({
            key: slot.dataset.uiSlotKey!,
            r: slot.getBoundingClientRect(),
          })),
        ]),
      );
      // Resolve against one gesture snapshot while the real payload follows
      // the pointer. Its spacer preserves drop regions and coordinate origins.
      const targetBounds = new Map(
        [...document.querySelectorAll<HTMLElement>(dropGeometrySelector)].map(el => {
          const box = el.hasAttribute('data-ui-resident-root') ? residentBounds(el) : el.getBoundingClientRect();
          return [el, new DOMRect(box.x, box.y, box.width, box.height)] as const;
        }),
      );
      const zoneOrigins = new Map(
        [...document.querySelectorAll<HTMLElement>("[data-ui-drop-zone]")].map(el => [el, {
          x: Number(el.dataset.originX || 0), y: Number(el.dataset.originY || 0),
        }]),
      );
      drag.current = {
        key,
        start: { x: event.clientX, y: event.clientY },
        width: r.width,
        height: r.height,
        dx: event.clientX - r.x,
        dy: event.clientY - r.y,
        originOffset: {
          x: (root?.getBoundingClientRect().x ?? r.x) - r.x,
          y: (root?.getBoundingClientRect().y ?? r.y) - r.y,
        },
        slots,
        targetZones,
        fromDockPane: !!tabPane,
        targetBounds,
        zoneOrigins,
        control: mini
          ? { owner: mini.dataset.uiControlOwner!, control: mini.dataset.uiControl! }
          : undefined,
        live: root ? beginLiveDrag([dragSurface(root)]) : undefined,
      };
    };
    const frameDockIntent = (source: DragState, s: UILayout, x: number, y: number, elements: Element[]): FrameDock | undefined => {
      if (source.control || source.key.startsWith("function:") || residentContextScope(s, source.key)) return;
      const viewport = { x: 8, y: 8, width: innerWidth - 16, height: innerHeight - 16 };
      const previous = placementPreview.getSnapshot()?.frameDock;
      // Guide cells and the diagonal travel gaps keep one target active, even
      // beyond a compact frame's bounds. A new cell still switches immediately.
      const chosen = previous?.bounds && dockGuideAt(previous.bounds, viewport, x, y, previous.side);
      if (chosen && previous?.target && canDock(s, source.key, previous.target)) return { ...previous, side: chosen };
      const area = dockWorkspaceArea();
      // Native strips have a real outer frame as well as individual sections.
      // Resolve that narrow border before the nested section under the pointer;
      // its interior retains ordinary section insertion and handle targeting.
      for (const surface of document.querySelectorAll<HTMLElement>('.ui-native-strip-frame[data-ui-resident-root]')) {
        const target = surface.dataset.uiResidentRoot!, state = getContainer(s, target);
        if (!state || !canDock(s, source.key, target)) continue;
        const bounds = source.targetBounds.get(surface) ?? surface.getBoundingClientRect();
        if (!bounds.width || !bounds.height || rectDistance(x, y, bounds) > 5) continue;
        const near = { left: Math.abs(x-bounds.x), right: Math.abs(bounds.right-x), top: Math.abs(y-bounds.y), bottom: Math.abs(bounds.bottom-y) };
        const side = (Object.keys(near) as Exclude<DockSide, 'tab'>[]).sort((a,b) => near[a]-near[b]).find(side => near[side] <= 12);
        if (!side) continue;
        const sourceState = getContainer(s, source.key);
        const horizontal = side === 'left' || side === 'right';
        const width = !state.dockLayout && horizontal
          ? Math.min(bounds.width + (sourceState?.width ?? 280) + 6, workspaceDockRects(s, area).center.width * .75) : bounds.width;
        return { target, side, bounds, rect: { x: bounds.x, y: bounds.y, width, height: bounds.height } };
      }
      const distances = { left: x - area.x, right: area.x + area.width - x, top: y - area.y, bottom: area.y + area.height - y };
      const edge = (Object.keys(distances) as Exclude<DockSide, "tab">[]).find(side => distances[side] >= -8 && distances[side] <= 14);
      if (edge && source.key.startsWith("frame:") && s.frames.find(frame => `frame:${frame.id}` === source.key)?.dockEdge === edge) return;
      if (edge && x >= area.x - 8 && x <= area.x + area.width + 8 && y >= area.y - 8 && y <= area.y + area.height + 8) {
        const existing = s.frames.find(frame => frame.dockEdge === edge && `frame:${frame.id}` !== source.key);
        if (existing && !canDock(s, source.key, `frame:${existing.id}`)) return;
        return { edge, side: edge, rect: edgeDockRect(s, edge, area) };
      }
      for (const element of elements) {
        if (element.closest("[data-ui-ghost],.ui-drag-source,[data-ui-search],.ui-background-menu")) continue;
        const enclosingPane = element.closest<HTMLElement>("[data-ui-dock-pane]");
        const nativeRows = element.closest<HTMLElement>("[data-ui-frame-strip]");
        // Splitting the sidebar must not turn its ordinary sections into the
        // enclosing Sidebar tab's full-surface docking target.
        const pane = nativeRows && enclosingPane?.contains(nativeRows) ? null : enclosingPane;
        const root = element.closest<HTMLElement>("[data-ui-resident-root]");
        if (root?.matches('.ui-native-strip-frame')) continue;
        const target = pane ? element.closest<HTMLElement>('[role="tab"][data-ui-drag]')?.dataset.uiDrag ?? pane.dataset.uiDockPane : root?.dataset.uiResidentRoot;
        // A sidebar row's empty space is not a frame target. Its actual handle
        // still is; ordinary buttons continue through the existing group logic.
        const surface = pane ?? (root?.matches(".ui-docked-panel:not(.ui-menu-panel)")
          ? element.closest<HTMLElement>(".ui-frame-handle") : root);
        if (!target || !surface || source.key === target || !canDock(s, source.key, target)) continue;
        const bounds = source.targetBounds.get(surface) ?? surface.getBoundingClientRect();
        if (!bounds.width || !bounds.height || rectDistance(x, y, bounds) !== 0) continue;
        const near = { left: x - bounds.left, right: bounds.right - x, top: y - bounds.top, bottom: bounds.bottom - y };
        const header = !!element.closest("[data-ui-chrome],.ui-dock-tab-strip");
        const stacked = getContainer(s, target)?.layoutMode === "stacked";
        // A title/tab strip groups panels. The outermost edge still allows a split.
        // A stacked body's interior inserts rows; its frame edges still split.
        // Once shown, the existing retained-guide path enables all five choices.
        const side = (!stacked || header ? dockGuideAt(bounds, viewport, x, y) : undefined) ?? (Object.keys(near) as Exclude<DockSide, "tab">[]).sort((a,b) => near[a]-near[b]).find(side => near[side] < (header ? 6 : Math.min(26, (side === "left" || side === "right" ? bounds.width : bounds.height) * 0.18)));
        const center = !stacked && Math.abs(x-bounds.x-bounds.width/2) <= 32 && Math.abs(y-bounds.y-bounds.height/2) <= 32;
        if (!side && !header && !center) return;
        const width = Math.min(area.width, Math.max(280, bounds.width)), height = Math.min(area.height, Math.max(220, bounds.height));
        const rect = { x: Math.max(area.x, Math.min(bounds.x, area.x+area.width-width)), y: Math.max(area.y, Math.min(bounds.y, area.y+area.height-height)), width, height };
        const slot = root?.closest<HTMLElement>("[data-ui-frame-slot]");
        const strip = slot?.dataset.uiFrameSlot === target ? slot.closest<HTMLElement>("[data-ui-frame-strip]") : null;
        const host = strip ? { container: strip.dataset.uiFrameStrip!, order: strip.dataset.uiFrameOrder!, keys: [...strip.querySelectorAll<HTMLElement>(":scope > [data-ui-frame-slot]")].sort((a,b) => Number(a.style.order)-Number(b.style.order)).map(slot => slot.dataset.uiFrameSlot!) } : undefined;
        return { target, side: side ?? "tab", rect, bounds, host };
      }
    };
    const frameFeedback = (source: DragState, layout: UILayout, intent: FrameDock): Pick<Preview, 'rect' | 'frameLayout' | 'allocation'> => {
      const signature = JSON.stringify(intent);
      if (frameProjection?.layout === layout && frameProjection.intent === signature) return frameProjection.feedback;
      // Project the actual transaction, never construct a second docking model.
      const projected = dockFrame(layout, source.key, intent);
      const groupKey = ownerOf(projected, source.key) ?? source.key;
      const group = getContainer(projected, groupKey);
      let rect = intent.rect;
      let title: string | undefined = group && 'nativeStrip' in group && group.nativeStrip ? undefined : group && 'name' in group ? group.name : 'Dock group';
      if (getContainer(layout, groupKey)?.dockLayout && !intent.edge) {
        const root = [...document.querySelectorAll<HTMLElement>('[data-ui-resident-root]')].find(el => el.dataset.uiResidentRoot === groupKey);
        const body = root && [...root.querySelectorAll<HTMLElement>('.ui-structured-body,.ui-embedded-dock-layout')]
          .find(el => el.closest('[data-ui-resident-root]') === root && el.getClientRects().length);
        if (body) { rect = source.targetBounds.get(body) ?? body.getBoundingClientRect(); title = undefined; }
      }
      const feedback = { rect, allocation: projected === layout ? undefined : { layout: projected, source: source.key, root: groupKey },
        frameLayout: group?.dockLayout ? { tree: group.dockLayout, source: source.key, title } : undefined };
      frameProjection = { layout, intent: signature, feedback };
      return feedback;
    };
    const resolveTarget = (x: number, y: number): Preview | null => {
      const source = drag.current;
      if (!source || source.cancelled) return null;
      const s = effectiveLayout();
      const boundsOf = (element: Element): DOMRect => source.targetBounds.get(element) ?? element.getBoundingClientRect();
      const originOf = (element: HTMLElement) => source.zoneOrigins.get(element) ?? { x: Number(element.dataset.originX || 0), y: Number(element.dataset.originY || 0) };
      if (source.control) {
        const element = [...document.querySelectorAll<HTMLElement>("[data-ui-chrome]")].find(
          (e) => e.dataset.uiChrome === source.control!.owner,
        );
        if (!element) return null;
        const r = boundsOf(element);
        let position = { x: x - source.dx - r.x, y: y - source.dy - r.y };
        const px = position.x,
          py = position.y;
        if (Math.abs(px) > 1000 || Math.abs(py) > 1000 || residentPinned(s, source.control.owner))
          return { text: "Unpin this frame before rearranging its controls" };
        return {
          text: "Move this frame control",
          control: { ...source.control, x: px, y: py },
          rect: { x: r.x + px, y: r.y + py, width: source.width, height: source.height },
        };
      }
      if (residentPinned(s, source.key)) return { text: "Unpin to rearrange" };
      // Native dragging leaves the source at its old location. Look through that
      // surface so it cannot block a destination underneath it. Descendant frames
      // retain their own roots, allowing cycle/pinning rejection to remain explicit.
      const hitElements = document.elementsFromPoint(x, y).filter(el => {
        if (el.closest("[data-ui-ghost],.ui-drag-source")) return false;
        const target = el.closest(dropGeometrySelector);
        return !target || rectDistance(x, y, boundsOf(target)) === 0;
      });
      const frameDock = frameDockIntent(source, s, x, y, hitElements);
      if (frameDock) {
        const side = frameDock.side;
        return { frameDock, ...frameFeedback(source, s, frameDock), text: frameDock.edge ? `Dock at ${side} workspace edge` : side === "tab" ? "Group as tabs" : `Dock ${side} · resize with the divider` };
      }
      if (
        source.key.startsWith("window:") &&
        s.windows[source.key.slice(7)]?.inline &&
        hitElements[0]?.closest<HTMLElement>("[data-ui-resident-root]")?.dataset.uiResidentRoot ===
          source.key
      )
        return { text: "Drop outside this group to move it; Esc cancels" };
      const elements = hitElements.filter(
        (el) =>
          el.closest<HTMLElement>("[data-ui-resident-root]")?.dataset.uiResidentRoot !==
            source.key &&
          `function:${el.closest<HTMLElement>("[data-ui-function]")?.dataset.uiFunction}` !==
            source.key,
      );
      const scope = residentContextScope(s, source.key);
      if (scope) {
        const area = [...document.querySelectorAll<HTMLElement>("[data-ui-drop-zone]")].find(
          (el) => el.dataset.uiDropZone === scope,
        );
        if (!area || rectDistance(x, y, boundsOf(area)) > DOCK_DISTANCE)
          return { text: "This control stays in its owning menu" };
      }
      // Stacked containers insert a row; they never save arbitrary XY placement.
      const stackHandle = elements[0]?.closest<HTMLElement>(".ui-frame-handle,[data-ui-inline-handle]")?.dataset.uiDrag;
      const pointedZone = elements[0]?.closest<HTMLElement>("[data-ui-drop-zone]");
      const stackTarget = stackHandle && getContainer(s, stackHandle)?.layoutMode === "stacked"
        ? stackHandle : pointedZone?.dataset.uiDropZone;
      if (stackTarget && getContainer(s, stackTarget)?.layoutMode === "stacked" && stackTarget !== source.key) {
        if (!canDock(s, source.key, stackTarget)) return { text: "Cannot place items in a pinned frame or inside themselves" };
        const zone = source.targetZones.get(stackTarget);
        const bounds = zone && boundsOf(zone);
        const members = getContainer(s, stackTarget)?.members ?? [];
        const slots = (source.slots.get(stackTarget) ?? []).filter(slot => slot.key !== source.key);
        const before = stackHandle === stackTarget ? undefined : slots.find(slot => y < slot.r.y + slot.r.height / 2);
        const last = slots.at(-1)?.r;
        return {
          text: `Insert into ${frameActions.get(stackTarget)?.title ?? "stacked frame"}`,
          destination: true,
          rect: bounds ? { x: bounds.x, y: before?.r.y ?? (last ? last.y + last.height : bounds.y + 12), width: bounds.width, height: 4 } : undefined,
          dock: { key: source.key, target: stackTarget,
            index: before ? members.findIndex(member => residentKey(member) === before.key) : members.length,
            breakBefore: false, width: source.width, height: source.height },
        };
      }
      const hitOwner = elements[0]?.closest<HTMLElement>("[data-ui-resident-root],.toolbar");
      const peer =
        elements[0]?.closest<HTMLElement>("[data-ui-native-anchor]") ??
        (hitOwner
          ? [...hitOwner.querySelectorAll<HTMLElement>("[data-ui-native-anchor]")]
              .filter(
                (el) =>
                  el.getClientRects().length &&
                  `function:${el.dataset.uiFunction}` !== source.key &&
                  el.closest("[data-ui-resident-root],.toolbar") === hitOwner,
              )
              .map((el) => ({ el, d: rectDistance(x, y, boundsOf(el)) }))
              .filter((item) => item.d <= 12)
              .sort((a, b) => a.d - b.d)[0]?.el
          : undefined);
      const sourceFn = current.current.functions.find((fn) => `function:${fn.id}` === source.key);
      if (
        sourceFn &&
        peer &&
        peer.dataset.uiFunction !== sourceFn.id &&
        (sourceFn.control ||
          current.current.functions.find((fn) => fn.id === peer.dataset.uiFunction)?.control)
      ) {
        const target = peer.dataset.uiFunction!;
        const targetOwner =
          peer.closest<HTMLElement>("[data-ui-resident-root]")?.dataset.uiResidentRoot;
        if (functionPinned(s, target) || (targetOwner && residentPinned(s, targetOwner)))
          return { text: "Unpin this field or window before rearranging" };
        const r = boundsOf(peer),
          parentStyle = peer.parentElement ? getComputedStyle(peer.parentElement) : null;
        const horizontal = parentStyle?.display === "flex" && parentStyle.flexDirection === "row";
        const after = horizontal ? x > r.x + r.width / 2 : y > r.y + r.height / 2;
        return {
          text: `Place ${sourceFn.label} ${after ? "after" : "before"} ${current.current.functions.find((fn) => fn.id === target)?.label ?? "field"}`,
          destination: true,
          native: {
            id: sourceFn.id,
            anchor: peer.dataset.uiNativeAnchor!,
            homeId: peer.dataset.uiNativeHome!,
            target,
            after,
          },
          rect: horizontal
            ? { x: after ? r.right : r.left, y: r.y, width: 4, height: r.height }
            : { x: r.x, y: after ? r.bottom : r.top, width: r.width, height: 4 },
        };
      }
      // A frame's edge/gap means sibling insertion. Resolve it before handle
      // nesting or nearest-container magnetism can steal the drop.
      if (!source.key.startsWith("function:")) {
        const choices = [...document.querySelectorAll<HTMLElement>("[data-ui-frame-slot],[data-ui-slot-key]")].flatMap(slot => {
          const key = slot.dataset.uiFrameSlot ?? slot.dataset.uiSlotKey!;
          if ((!key.startsWith("frame:") && !key.startsWith("window:")) || key === source.key || !slot.getClientRects().length || slot.closest("[data-ui-ghost],.ui-drag-source")) return [];
          const strip = slot.hasAttribute("data-ui-frame-slot") ? slot.parentElement : null;
          const zone = strip ?? slot.parentElement?.closest<HTMLElement>("[data-ui-drop-zone]");
          const target = strip?.dataset.uiFrameStrip ?? zone?.dataset.uiDropZone;
          if (!zone || !target || !canDock(s, source.key, target)) return [];
          const r = boundsOf(slot);
          if (!r.width || !r.height || rectDistance(x, y, r) > 14) return [];
          if (rectDistance(x, y, r) === 0 && !elements.some(el => slot.contains(el))) return [];
          const vertical = strip?.classList.contains("is-vertical");
          const sides: InsertSide[] = strip ? vertical ? ["top", "bottom"] : ["left", "right"] : ["left", "right", "top", "bottom"];
          const distances = { left: Math.abs(x - r.left), right: Math.abs(x - r.right), top: Math.abs(y - r.top), bottom: Math.abs(y - r.bottom) };
          const side = sides.sort((a, b) => distances[a] - distances[b])[0];
          const horizontal = side === "left" || side === "right";
          const band = Math.min(22, (horizontal ? r.width : r.height) * 0.3);
          if (distances[side] > band) return [];
          return [{ slot, key, strip, zone, target, r, side, distance: distances[side] }];
        }).sort((a, b) => a.distance - b.distance || a.r.width * a.r.height - b.r.width * b.r.height);
        const hit = choices[0];
        if (hit) {
          const after = hit.side === "right" || hit.side === "bottom";
          const horizontal = hit.side === "left" || hit.side === "right";
          const rect = horizontal ? { x: after ? hit.r.right : hit.r.left, y: hit.r.y, width: 4, height: hit.r.height } : { x: hit.r.x, y: after ? hit.r.bottom : hit.r.top, width: hit.r.width, height: 4 };
          const text = `Insert ${frameActions.get(source.key)?.title ?? "frame"} ${after ? "after" : "before"} ${frameActions.get(hit.key)?.title ?? "frame"}`;
          if (hit.strip) return {
            text, rect, destination: true,
            frameStrip: { target: hit.target, orderId: hit.strip.dataset.uiFrameOrder!, nativeKeys: JSON.parse(hit.strip.dataset.uiFrameNative ?? "[]"), peer: hit.key, after, keys: [...hit.strip.querySelectorAll<HTMLElement>(":scope > [data-ui-frame-slot]")].sort((a,b) => Number(getComputedStyle(a).order) - Number(getComputedStyle(b).order)).map(el => el.dataset.uiFrameSlot!) },
          };
          const c = getContainer(s, hit.target)!;
          const bounds = boundsOf(hit.zone);
          const ox = originOf(hit.zone).x, oy = originOf(hit.zone).y;
          const boxes = new Map((source.slots.get(hit.target) ?? []).map(slot => [slot.key, { x: slot.r.x - bounds.x + ox + hit.zone.scrollLeft, y: slot.r.y - bounds.y + oy + hit.zone.scrollTop, width: slot.r.width, height: slot.r.height }]));
          if (boxes.has(hit.key)) {
            const insertion = insertFrameBeside(c.members ?? [], boxes, source.key, source, hit.key, hit.side);
            if (insertion.baseline.some(member => { const box = boxes.get(residentKey(member)); return box && residentPinned(s, residentKey(member)) && (member.position?.x !== box.x || member.position?.y !== box.y); })) return { text: "Unpin neighboring frames before shifting them" };
            return { text, rect, destination: true, dock: { key: source.key, target: hit.target, index: (c.members ?? []).findIndex(m => residentKey(m) === hit.key) + (after ? 1 : 0), breakBefore: false, width: source.width, height: source.height, ...insertion } };
          }
        }
      }
      const candidateHandle = elements[0]?.closest<HTMLElement>(".ui-frame-handle,[data-ui-inline-handle]");
      const handleBounds = candidateHandle ? boundsOf(candidateHandle) : undefined;
      // Dock into the middle of a handle; its perimeter belongs to adjacent placement.
      const inset = handleBounds ? Math.min(18, handleBounds.width / 4) : 0;
      const handle =
        handleBounds &&
        x >= handleBounds.left + inset &&
        x <= handleBounds.right - inset &&
        y >= handleBounds.top + 4 &&
        y <= handleBounds.bottom - 4
          ? candidateHandle
          : undefined;
      const handleTarget = handle?.dataset.uiDrag;
      const directInline =
        elements[0]?.closest<HTMLElement>("[data-ui-inline-group]")?.dataset.uiInlineGroup;
      const inlineTarget = handleTarget ?? directInline;
      const inlineRoot = elements[0]?.closest<HTMLElement>("[data-ui-inline-group]");
      if (
        inlineTarget &&
        getContainer(s, inlineTarget) &&
        "inline" in getContainer(s, inlineTarget)! &&
        (getContainer(s, inlineTarget) as WindowState).inline
      ) {
        if (!canDock(s, source.key, inlineTarget))
          return { text: "Cannot place a group inside itself, its descendants or a pinned group" };
        return {
          text: `Add to ${frameActions.get(inlineTarget)?.title ?? "group"}`,
          rect: inlineRoot ? boundsOf(inlineRoot) : undefined,
          dock: {
            key: source.key,
            target: inlineTarget,
            index: getContainer(s, inlineTarget)?.members?.length ?? 0,
            breakBefore: false,
            width: source.width,
            height: source.height,
          },
        };
      }
      if (handleTarget && handleTarget !== source.key && !canDock(s, source.key, handleTarget))
        return { text: "Cannot dock into a pinned frame or into this frame’s own contents" };
      const directZone = elements
        .map((e) => e.closest<HTMLElement>("[data-ui-drop-zone]"))
        .find(Boolean);
      if (
        directZone &&
        directZone.dataset.uiDropZone !== source.key &&
        !source.key.startsWith("function:") &&
        !canDock(s, source.key, directZone.dataset.uiDropZone!)
      )
        return { text: "Cannot dock into a pinned frame or into this frame’s own contents" };
      let zone = elements
        .map((e) => e.closest<HTMLElement>("[data-ui-drop-zone]"))
        .find((e) => e && canDock(s, source.key, e.dataset.uiDropZone!));
      const zones = [...document.querySelectorAll<HTMLElement>("[data-ui-drop-zone]")];
      if (handleTarget && canDock(s, source.key, handleTarget))
        zone = zones.find((e) => e.dataset.uiDropZone === handleTarget);
      else {
        const owner = ownerOf(s, source.key),
          own = zones.find((e) => e.dataset.uiDropZone === owner);
        if (
          own &&
          rectDistance(x, y, boundsOf(own)) === 0 &&
          canDock(s, source.key, owner!)
        )
          zone = own;
      }
      if (!zone && (!handleTarget || handleTarget === source.key))
        zone = [...document.querySelectorAll<HTMLElement>("[data-ui-drop-zone]")]
          .filter((e) => e.getClientRects().length && canDock(s, source.key, e.dataset.uiDropZone!))
          .map((e) => ({ e, distance: rectDistance(x, y, boundsOf(e)) }))
          .filter((p) => p.distance <= DOCK_DISTANCE)
          .sort(
            (a, b) =>
              a.distance - b.distance ||
              boundsOf(a.e).width * boundsOf(a.e).height -
                boundsOf(b.e).width * boundsOf(b.e).height,
          )[0]?.e;
      if (zone) {
        const target = zone.dataset.uiDropZone!,
          c = getContainer(s, target)!,
          members = c.members ?? [];
        const bounds = boundsOf(zone);
        const ox = originOf(zone).x,
          oy = originOf(zone).y;
        const boxes = new Map(
          (source.slots.get(target) ?? []).map((slot) => [
            slot.key,
            {
              x: slot.r.x - bounds.x + ox + zone.scrollLeft,
              y: slot.r.y - bounds.y + oy + zone.scrollTop,
              width: slot.r.width,
              height: slot.r.height,
            },
          ]),
        );
        const baseline = snapshotPositions(members, boxes, residentKey);
        const desired =
          handleTarget === target
            ? {
                x: 12,
                y: Math.max(12, ...[...boxes.values()].map((box) => box.y + box.height + 14)),
              }
            : {
                x: x - source.dx - bounds.x + ox + zone.scrollLeft,
                y: y - source.dy - bounds.y + oy + zone.scrollTop,
              };
        const position = desired;
        // Keep a useful reading order without using array insertion to push visual neighbors.
        const nearest = (source.slots.get(target) ?? [])
          .filter((slot) => slot.key !== source.key)
          .sort((a, b) => rectDistance(x, y, a.r) - rectDistance(x, y, b.r))[0];
        const breakBefore = !!nearest && y > nearest.r.y + nearest.r.height + 6;
        const index = nearest
          ? members.findIndex((m) => residentKey(m) === nearest.key) +
            (x > nearest.r.x + nearest.r.width / 2 || breakBefore ? 1 : 0)
          : members.length;
        return {
          text:
            handleTarget === target
              ? `Add to ${"name" in c ? c.name : "window"}`
              : "Place freely",
          dock: {
            key: source.key,
            target,
            index,
            breakBefore,
            width: source.width,
            height: source.height,
            position,
            baseline,
          },
        };
      }
      // A collapsed frame can accept a resident through its attached handle.
      const tab = handle?.closest<HTMLElement>("[data-ui-chrome]");
      if (tab && canDock(s, source.key, tab.dataset.uiChrome!)) {
        const target = tab.dataset.uiChrome!,
          r = boundsOf(tab);
        const members = getContainer(s, target)?.members ?? [];
        const position =
          members.length && members.every((m) => m.position && m.size)
            ? { x: 12, y: Math.max(...members.map((m) => m.position!.y + m.size!.height)) + 14 }
            : undefined;
        return {
          text: `Add to ${getContainer(s, target) && "name" in getContainer(s, target)! ? (getContainer(s, target) as UIFrame).name : "collapsed window"}`,
          dock: {
            key: source.key,
            target,
            index: members.length,
            breakBefore: false,
            width: source.width,
            height: source.height,
            position,
          },
          rect: r,
        };
      }
      let other = elements
        .map((e) => e.closest<HTMLElement>("[data-ui-function]:not([data-ui-palette])"))
        .find((e) => e && `function:${e.dataset.uiFunction}` !== source.key);

      if (
        other &&
        !sourceFn?.control &&
        !current.current.functions.find((fn) => fn.id === other.dataset.uiFunction)?.control &&
        !current.current.functions.find((fn) => fn.id === other.dataset.uiFunction)?.scope &&
        !ownerOf(s, `function:${other.dataset.uiFunction}`) &&
        !residentPinned(s, `function:${other.dataset.uiFunction}`)
      )
        return {
          text: "Group into a collapsed frame",
          destination: true,
          group: `function:${other.dataset.uiFunction}`,
          rect: boundsOf(other),
        };
      const freeArea = workspaceDockRects(s, dockWorkspaceArea());
      const movingFrame = /^(frame|window):/.test(source.key);
      const desired = movingFrame ? { x: x-source.dx, y: y-source.dy } : {
        x: Math.max(
          8,
          Math.min(
            window.innerWidth - Math.min(source.width, window.innerWidth - 16),
            x - source.dx,
          ),
        ),
        y: Math.max(8, Math.min(window.innerHeight - 44, y - source.dy)),
      };
      const viewport = { x: 8, y: 8, width: innerWidth-16, height: innerHeight-16 };
      const rectangle = { ...desired, width: source.width, height: source.height };
      const overflow = movingFrame && (rectangle.x < viewport.x || rectangle.y < viewport.y || rectangle.x+rectangle.width > viewport.x+viewport.width || rectangle.y+rectangle.height > viewport.y+viewport.height);
      if (overflow) return { text: "Place freely", floatingOverflow: true, rect: keepFloatingHandleVisible(rectangle, viewport, getContainer(s, source.key)?.chrome?.handle) };
      const canvas = document.querySelector(".canvas")?.getBoundingClientRect();
      const floatingArea = canvas ? { x: Math.max(freeArea.center.x, canvas.x), y: freeArea.center.y, width: Math.min(freeArea.center.width, canvas.width), height: freeArea.center.height } : freeArea.center;
      const fitted = fitDockRect({ ...desired, width: source.width, height: source.height }, floatingArea);
      const position = freeArea.active ? dockProjection.current?.(source.key, fitted) ?? fitted : { ...desired, width: source.width, height: source.height };
      if (
        position.x < 0 ||
        position.y < 0 ||
        position.x > window.innerWidth - 24 ||
        position.y > window.innerHeight - 24
      )
        return { text: "Choose a visible position" };
      return {
        text: "Place freely",
        rect: position,
      };
    };
    const resolve = (x: number, y: number): Preview | null => {
      const proposal = resolveTarget(x, y), source = drag.current;
      if (!proposal?.dock || !source) return proposal;
      const dock = proposal.dock, zone = source.targetZones.get(dock.target);
      if (getContainer(effectiveLayout(), dock.target)?.layoutMode === "stacked") return proposal;
      const bounds = zone && source.targetBounds.get(zone);
      // Closed contents have no measurable layout; retain their existing append
      // behavior rather than turning zero-sized DOM boxes into saved positions.
      if (!zone || !bounds || !zone.getClientRects().length) return proposal;
      const origin = source.zoneOrigins.get(zone) ?? { x: 0, y: 0 };
      const boxes = new Map((source.slots.get(dock.target) ?? []).map(slot => [slot.key, {
        x: slot.r.x - bounds.x + origin.x + zone.scrollLeft,
        y: slot.r.y - bounds.y + origin.y + zone.scrollTop,
        width: slot.r.width, height: slot.r.height,
      }]));
      const container = getContainer(effectiveLayout(), dock.target)!;
      const baseline = dock.baseline ?? snapshotPositions(container.members ?? [], boxes, residentKey);
      const obstacles = [...boxes].filter(([key]) => key !== source.key).map(([, box]) => box);
      let position = dock.position;
      if (!position) {
        position = { x: 12, y: Math.max(12, ...obstacles.map(box => box.y + box.height + 14)) };
      }
      return { ...proposal, dock: {
        ...dock, baseline, position,
        screenRect: {
          x: bounds.x - origin.x - zone.scrollLeft + position.x,
          y: bounds.y - origin.y - zone.scrollTop + position.y,
          width: dock.width, height: dock.height,
        },
      } };
    };
    const over = (e: globalThis.DragEvent) => {
      if (!drag.current || drag.current.cancelled) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
      const source = drag.current;
      // dx/dy retain the exact grab point, independent of docking proposals.
      // Transform writes stay on the pointer path; expensive hit testing is batched.
      source.live?.move(e.clientX - source.start.x, e.clientY - source.start.y);
      pendingPoint = { x: e.clientX, y: e.clientY };
      if (!previewFrame) previewFrame = requestAnimationFrame(() => {
        previewFrame = 0;
        const point = pendingPoint; pendingPoint = null;
        if (point && drag.current && !drag.current.cancelled) show(resolve(point.x, point.y));
      });
    };
    const drop = (e: MouseEvent) => {
      const source = drag.current;
      if (!source || source.cancelled) return;
      e.preventDefault();
      e.stopPropagation();
      cancelFrame();
      const p = resolve(e.clientX, e.clientY);
      source.live?.restore();
      show(null);
      drag.current = null;
      if (!p) return;
      current.current.update((previous) => {
        let s = ensure(previous);
        const payload = getContainer(s, source.key);
        if (payload && "inline" in payload && payload.inline) {
          const root = [...document.querySelectorAll<HTMLElement>("[data-ui-inline-group]")].find(
            (root) => root.dataset.uiInlineGroup === source.key,
          );
          if (root)
            s = updateContainer(s, source.key, {
              inline: {
                ...payload.inline,
                actionIds: { ...payload.inline.actionIds, ...captureNativeActions(root) },
              },
            });
        }
        if (p.frameDock) return dockFrame(s, source.key, p.frameDock);
        if (p.frameStrip) {
          const strip = p.frameStrip;
          if (!canDock(s, source.key, strip.target)) return previous;
          const order = strip.keys.filter(key => key !== source.key);
          order.splice(order.indexOf(strip.peer) + (strip.after ? 1 : 0), 0, source.key);
          if (strip.nativeKeys.includes(source.key)) {
            s = releaseResident(s, source.key);
            const id = source.key.slice("window:panel:".length);
            s = { ...s, panels: { ...s.panels, [id]: false } };
          } else s = dockResident(s, source.key, strip.target, (getContainer(s, strip.target)?.members ?? []).length);
          return validateUILayout({ ...s, nativeOrders: { ...s.nativeOrders, [strip.orderId]: order } });
        }
        if (p.native) {
          const n = p.native;
          return orderNativeFunction(s, n.id, n.anchor, n.homeId, n.target, n.after);
        }
        if (p.control) {
          const c = getContainer(s, p.control.owner)!;
          return updateContainer(s, p.control.owner, {
            chrome: {
              ...c.chrome,
              controls: {
                ...c.chrome?.controls,
                [p.control.control]: { x: p.control.x, y: p.control.y },
              },
            },
          });
        }
        if (p.dock) {
          const d = p.dock;
          if (d.baseline) s = updateContainer(s, d.target, { members: d.baseline });
          s = dockResident(s, source.key, d.target, d.index, d.breakBefore);
          const destination = getContainer(s, d.target);
          if (destination && "inline" in destination && destination.inline)
            s = updateContainer(s, d.target, { collapsed: false });
          if (d.position)
            s = updateContainer(s, d.target, {
              members: getContainer(s, d.target)!.members!.map((m) =>
                residentKey(m) === source.key
                  ? { ...m, position: d.position, size: { width: d.width, height: d.height } }
                  : m,
              ),
            });
          return s;
        }
        if (p.group) return groupResidents(s, [p.group, source.key], e.clientX, e.clientY);
        if (p.rect) {
          let next = floatResident(
            s,
            source.key,
            p.rect.x + source.originOffset.x,
            p.rect.y + source.originOffset.y,
          );
          if (/^(frame|window):/.test(source.key) && (p.floatingOverflow || getContainer(s, source.key)?.floatingOverflow)) next = updateContainer(next, source.key, {
            floatingOverflow: !!p.floatingOverflow,
            ...(p.floatingOverflow && !getContainer(s, source.key)?.collapsed ? { width: p.rect.width, height: p.rect.height } : {}),
          });
          if (source.fromDockPane) next = updateContainer(next, source.key, { width: Math.max(160, source.width), height: Math.max(120, source.height) });
          return source.key.startsWith("window:panel:")
            ? {
                ...next,
                panels: { ...next.panels, [source.key.slice("window:panel:".length)]: true },
              }
            : next;
        }
        return previous;
      });
    };
    const end = () => {
      cancelFrame();
      drag.current?.live?.restore();
      drag.current = null;
      show(null);
    };
    const cancelPointer = () => {
      const active = pointer; pointer = null;
      end(); active?.release?.();
    };
    const pointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || pointer || event.defaultPrevented) return;
      const target = event.target as Element;
      if (target.closest("input,select,textarea,a,[contenteditable=true],[data-ui-search],.window-resize-grip,[data-ui-resize]")) return;
      const handle = target.closest<HTMLElement>("[data-ui-control],[data-ui-drag],[data-ui-function]");
      if (!handle?.draggable) return;
      pointer = { down: event, started: false };
    };
    const pointerMove = (event: PointerEvent) => {
      const active = pointer;
      if (!active || event.pointerId !== active.down.pointerId) return;
      if ((event.buttons & 1) === 0) { cancelPointer(); return; }
      if (!active.started) {
        if (Math.hypot(event.clientX - active.down.clientX, event.clientY - active.down.clientY) <= 5) return;
        if (!(active.down.target instanceof Element) || !active.down.target.isConnected) { cancelPointer(); return; }
        start(active.down);
        if (!drag.current) { cancelPointer(); return; }
        active.started = true;
        active.release = captureUIPointer(event.pointerId, event.pointerType);
      }
      event.preventDefault(); event.stopImmediatePropagation();
      over(event as unknown as globalThis.DragEvent);
    };
    const pointerUp = (event: PointerEvent) => {
      const active = pointer;
      if (!active || event.pointerId !== active.down.pointerId || event.button !== 0) return;
      pointer = null;
      try { if (active.started) drop(event); }
      finally { active.release?.(); }
    };
    const pointerCancel = (event: PointerEvent) => {
      if (pointer?.down.pointerId === event.pointerId) cancelPointer();
    };
    const preventContext = (event: Event) => {
      if (pointer?.started) { event.preventDefault(); event.stopImmediatePropagation(); }
    };
    const nativeStart = (event: globalThis.DragEvent) => {
      if (pointer) { event.preventDefault(); event.stopImmediatePropagation(); return; }
      start(event);
    };
    const nativeEnd = () => { if (!pointer) end(); };
    const nativeDrop = (event: globalThis.DragEvent) => { if (!pointer) drop(event); };
    const keydown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && (drag.current || pointer?.started)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        cancelPointer();
      }
    };
    window.addEventListener("pointerdown", pointerDown, true);
    window.addEventListener("pointermove", pointerMove, true);
    window.addEventListener("pointerup", pointerUp, true);
    window.addEventListener("pointercancel", pointerCancel, true);
    window.addEventListener("contextmenu", preventContext, true);
    window.addEventListener("blur", cancelPointer);
    window.addEventListener("dragstart", nativeStart, true);
    window.addEventListener("dragover", over, true);
    window.addEventListener("drop", nativeDrop, true);
    window.addEventListener("dragend", nativeEnd);
    window.addEventListener("keydown", keydown, true);
    return () => {
      cancelPointer();
      window.removeEventListener("pointerdown", pointerDown, true);
      window.removeEventListener("pointermove", pointerMove, true);
      window.removeEventListener("pointerup", pointerUp, true);
      window.removeEventListener("pointercancel", pointerCancel, true);
      window.removeEventListener("contextmenu", preventContext, true);
      window.removeEventListener("blur", cancelPointer);
      window.removeEventListener("dragstart", nativeStart, true);
      window.removeEventListener("dragover", over, true);
      window.removeEventListener("drop", nativeDrop, true);
      window.removeEventListener("dragend", nativeEnd);
      window.removeEventListener("keydown", keydown, true);
    };
  }, []);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || shortcuts?.capturing) return;
      if (!(menu || creatingFrame || configured || configuredFrame || configuredControl || shortcutField || shortcutNotice)) return;
      // Closing a UI editor must not also clear the graph selection it edits.
      e.preventDefault(); e.stopPropagation();
      setMenu(null); configure(null); configureFrame(null); configureControl(null);
      setShortcutField(null); setShortcutNotice("");
      setCreatingFrame(null);
    };
    window.addEventListener("keydown", close, true);
    return () => window.removeEventListener("keydown", close, true);
  }, [menu, creatingFrame, configured, configuredFrame, configuredControl, shortcutField, shortcutNotice, shortcuts?.capturing]);
  const selected = functions.find((f) => f.id === configured),
    item = configured ? layout.items[configured] : undefined;
  const selectedOwner = configuredControl?.owner ?? configuredFrame;
  const selectedContainer = selectedOwner ? getContainer(ensure(layout), selectedOwner) : undefined;
  const style = configuredControl
    ? (selectedContainer?.chrome?.controlStyles?.[configuredControl.control] ?? {
        ...defaultStyle,
        mode: "icon" as const,
      })
    : configuredFrame
      ? (selectedContainer?.chrome?.style ?? defaultStyle)
      : (item?.style ?? defaultStyle);
  const setStyle = (patch: Partial<FunctionStyle>, asset?: VisualAsset) =>
    update((previous) => {
      const s = asset ? { ...previous, assets: [...previous.assets, asset] } : previous;
      if (configuredControl) {
        const next = ensure(s),
          c = getContainer(next, configuredControl.owner)!;
        return updateContainer(next, configuredControl.owner, {
          chrome: {
            ...c.chrome,
            controlStyles: {
              ...c.chrome?.controlStyles,
              [configuredControl.control]: { ...style, ...patch },
            },
          },
        });
      }
      if (configuredFrame) {
        const next = ensure(s),
          c = getContainer(next, configuredFrame)!;
        return updateContainer(next, configuredFrame, {
          chrome: { ...c.chrome, style: { ...style, ...patch } },
        });
      }
      if (!configured) return s;
      return {
        ...s,
        items: {
          ...s.items,
          [configured]: {
            ...s.items[configured],
            home: s.items[configured]?.home ?? !ownerOf(s, `function:${configured}`),
            x: s.items[configured]?.x ?? 24,
            y: s.items[configured]?.y ?? 180,
            style: { ...style, ...patch },
          },
        },
      };
    });
  const renderResident = (member: UIResident) => {
    if (member.kind === "frame") {
      const frame = layout.frames.find((f) => f.id === member.id);
      return frame ? <FunctionFrame frame={frame} /> : null;
    }
    if (member.kind === "window") {
      const w = layout.windows[member.id];
      return (
        <DockHost
          id={`window:${member.id}`}
          width={w?.width ?? 380}
          height={w?.collapsed ? 44 : (w?.height ?? 400)}
          collapsed={w?.collapsed}
          autoSize={!!w?.inline}
          stacked={getContainer(layout, ownerOf(layout, `window:${member.id}`) ?? "")?.layoutMode === "stacked"}
        />
      );
    }
    const fn = functions.find((f) => f.id === member.id);
    return fn ? (
      <FunctionElement fn={fn} resident />
    ) : (
      <span>Unavailable function: {member.id}</span>
    );
  };
  const menuContainer = menu?.owner ? getContainer(ensure(layout), menu.owner) : undefined;
  return (
    <UIContext.Provider
      value={{
        layout,
        update,
        functions,
        shortcutBindings: shortcuts?.bindings,
        registerFunction,
        configure: (id) => {
          if (id) reopenAppearance();
          configureFrame(null);
          configureControl(null);
          configure(id);
        },
        configureFrame: (owner) => {
          reopenAppearance();
          configure(null);
          configureControl(null);
          configureFrame(owner);
          setMenu(null);
        },
        configureControl: (owner, control) => {
          reopenAppearance();
          configure(null);
          configureFrame(null);
          configureControl({ owner, control });
        },
        createFrame,
        library: () => setLibraryOpen(true),
        frameMenu,
        placementPreview,
        defaults,
        frameActions,
        renderResident,
        selectedFunctions: new Set([...buttonSelection.ids].filter(id => !/^(frame|window):/.test(id))),
        selectingUI: buttonSelection.mode,
        selectionMenu: buttonSelection.openMenu,
      }}
    >
      <DockWorkspace projection={dockProjection}>
      <AppearanceProvider bridge={appearance}>
      <AppearanceStyles />
      <NativeActions />
      <CustomControls />
      <UIEditor />
      <NamePresentation />
      {children}
      {search && <GlobalSearch {...search} />}
      <div hidden ref={shortcutRunners} aria-hidden="true">
        {functions.filter(fn => !fn.control && fn.available !== false && Object.hasOwn(shortcuts?.bindings ?? {}, `button:${fn.id}`)).map(fn => <span key={fn.id} data-shortcut-runner={fn.id}>{fn.element}</span>)}
      </div>
      {shortcutField && <FloatingWindow id="shortcut-field" openingKey={shortcutField} title={functions.find(fn => fn.id === shortcutField)?.label ?? "Setting"} width={350} height={300} onClose={() => setShortcutField(null)}>{functions.find(fn => fn.id === shortcutField && fn.available !== false)?.element ?? <p>Open the relevant context to edit this setting.</p>}</FloatingWindow>}
      {shortcutNotice && <div className="ui-anchor-prompt ui-shortcut-notice" role="status">{shortcutNotice}<button onClick={() => setShortcutNotice("")}>Dismiss</button></div>}
      <ButtonSelectionOverlay selection={buttonSelection} />
      <div
        className="ui-workspace-overlay"
        onContextMenu={(e) => {
          e.preventDefault();
          setMenu({ x: e.clientX, y: e.clientY });
        }}
      >
        {Object.entries(layout.items)
          .filter(([id, i]) => !i.home && !i.anchorId && !ownerOf(layout, `function:${id}`))
          .map(([id, placement]) => (
            <FreeFunction
              key={id} id={id}
              x={placement.x} y={placement.y} width={placement.size?.width} height={placement.size?.height}
            >
              {renderResident({ kind: "function", id })}
            </FreeFunction>
          ))}
        {layout.frames
          .filter((f) => !ownerOf(layout, `frame:${f.id}`))
          .map((f) => (
            <FunctionFrame frame={f} key={f.id} />
          ))}
      </div>
      <PlacementPreviewOverlay />
      {creatingFrame && <ContextMenu ref={creationRoot} opening={creatingFrame} aria-label="Create frame"
        style={{ left: creatingFrame.x, top: creatingFrame.y }}>
        <div className="ui-frame-layout-choices">{FRAME_LAYOUTS.map(mode => <div key={mode.id}>
          <UIAction id={`ui:createFrame:${mode.id}`} label={mode.label} category="Interface"
            onClick={() => createFrame(creatingFrame.x, creatingFrame.y, mode.id)} />
          <p>{mode.description}</p>
        </div>)}</div>
      </ContextMenu>}
      {menu && (
        <ContextMenu
          opening={menu}
          ref={menuRoot}
          aria-label="UI frame settings"
          style={{
            left: Math.min(menu.x, window.innerWidth - 250),
            top: Math.min(menu.y, window.innerHeight - 230),
          }}
        >
          <button className="ui-popup-close" aria-label="Close frame menu" onClick={() => setMenu(null)}>×</button>
          {(menu.owner || buttonSelection.ids.size > 0) && <ContextSubmenu label="Align">
            <AlignmentControls count={menu.owner ? 1 : buttonSelection.ids.size}
              onArrange={(operation, reference) => {
                buttonSelection.arrange(operation, reference, menu.owner ? new Set([selectionId(menu.owner)]) : undefined);
                setMenu(null);
              }} />
          </ContextSubmenu>}
          {menu.owner && menuContainer && (
            <>
              <ContextSubmenu label="Layout">
                {FRAME_LAYOUTS.map(mode => <div key={mode.id} className={`ui-frame-layout-option ${(menuContainer.layoutMode ?? "freeform") === mode.id ? "is-current" : ""}`}>
                  <UIAction id={`ui:frameLayout:${mode.id}`} label={mode.label} category="Interface"
                    disabled={residentPinned(ensure(layout), menu.owner!) || (menuContainer.layoutMode ?? "freeform") === mode.id}
                    onClick={() => { update(layout => setFrameLayout(ensure(layout), menu.owner!, mode.id)); setMenu(null); }} />
                </div>)}
              </ContextSubmenu>
              {frameActions.get(menu.owner)?.onRename && (
                <label className="frame-name-editor">
                  Frame name
                  <UINameInput
                    label="UI frame name"
                    value={
                      "name" in menuContainer
                        ? menuContainer.name
                        : layout.labels?.[menu.owner] ?? frameActions.get(menu.owner)!.title
                    }
                    onRename={(name) => frameActions.get(menu.owner!)?.onRename?.(name)}
                  />
                </label>
              )}
              <button
                onClick={() => {
                  const a = frameActions.get(menu.owner!);
                  if (a) a.onChange({ pinned: !a.state.pinned });
                  else
                    update((s) =>
                      updateContainer(ensure(s), menu.owner!, { pinned: !menuContainer.pinned }),
                    );
                  setMenu(null);
                }}
              >
                {menuContainer.pinned ? "Unpin frame" : "Pin frame"}
              </button>
              {frameActions.get(menu.owner)?.onClose && (
                <button
                  onClick={() => {
                    frameActions.get(menu.owner!)?.onClose?.();
                    setMenu(null);
                  }}
                >
                  {frameActions.get(menu.owner)?.closeLabel ??
                    `Close ${frameActions.get(menu.owner)?.title}`}
                </button>
              )}
              <button
                onClick={() => {
                  configure(null);
                  configureControl(null);
                  reopenAppearance();
                  configureFrame(menu.owner!);
                  setMenu(null);
                }}
              >
                Frame handle appearance
              </button>
              <button
                disabled={residentPinned(ensure(layout), menu.owner)}
                onClick={() => {
                  update((s) => resetContainer(ensure(s), menu.owner!));
                  setMenu(null);
                }}
              >
                Reset this frame’s arrangement
              </button>
              {ownerOf(layout, menu.owner) && (
                <button
                  onClick={() => {
                    update((s) => floatResident(s, menu.owner!, menu.x, menu.y));
                    setMenu(null);
                  }}
                >
                  Undock frame
                </button>
              )}
            </>
          )}
          <button onClick={() => { update(layout => ({ ...layout, panels: { ...layout.panels, "@devMode": !layout.panels["@devMode"] } })); setMenu(null); }}>
            {layout.panels["@devMode"] ? "Exit UI edit mode" : "UI edit mode"}
          </button>
          <button
            onClick={() => {
              createFrame(menu.x, menu.y);
              setMenu(null);
            }}
          >
            Create UI frame
          </button>
          <button
            onClick={() => {
              setLibraryOpen(true);
              setMenu(null);
            }}
          >
            UI library
          </button>
          <button onClick={() => setMenu(null)}>Close</button>
        </ContextMenu>
      )}
      {libraryOpen && (
        <FloatingWindow
          id="function-library"
          title="UI library"
          width={430}
          height={580}
          onClose={() => setLibraryOpen(false)}
        >
          <p>
            Drag functions, field edges and frame handles to arrange them. Select items and use
            Align to match edges, centers or spacing relative to the window or selection.
            Right-click a frame for its placement mode. Drag its faded background to move contents
            together. Esc cancels. Shift+MB4/MB5 undo and redo the UI.
          </p>
          <button onClick={() => createFrame(120, 180)}>Create UI frame</button>
          <UIField id="ui:library:find" label="Find a UI function" category="Interface"><label>Find a function<input
            aria-label="Find UI function"
            placeholder="Find a function…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          /></label></UIField>
          <div className="function-library categorized-library">
            {Object.entries(layout.windows).some(([, state]) => state.closed) && (
              <UISection id="closed-frames" title="Closed frames">
                {Object.entries(layout.windows).filter(([, state]) => state.closed).map(([id]) => {
                  const key = `window:${id}`;
                  const title = layout.labels?.[key] ?? frameActions.get(key)?.title ?? id.replace(/^panel:/, "");
                  return <button key={id} onClick={() => update(layout => updateContainer(layout, key, { closed: false, collapsed: false }))}>Open {title}</button>;
                })}
              </UISection>
            )}
            {LIBRARY_CATEGORIES.map((category) => {
              const entries = functions
                .filter(
                  (fn) =>
                    !fn.scope &&
                    libraryCategory(fn) === category &&
                    `${fn.label} ${fn.id} ${category}`.toLowerCase().includes(query.toLowerCase()),
                )
                .sort((a, b) => a.label.localeCompare(b.label));
              return (
                entries.length > 0 && (
                  <UISection key={category} id={`library-${category}`} title={category} defaultExpanded={false} expanded={query ? true : undefined}>
                    <small>{entries.length} controls</small>
                    {entries.map((fn) => (
                      <div className="library-entry" key={fn.id}>
                        <FunctionElement fn={fn} palette />
                        {fn.available === false && (
                          <small>Choose its editing context to use this field</small>
                        )}
                      </div>
                    ))}
                  </UISection>
                )
              );
            })}
            {!functions.some((fn) =>
              `${fn.label} ${fn.id} ${libraryCategory(fn)}`
                .toLowerCase()
                .includes(query.toLowerCase()),
            ) && <p>No matching controls.</p>}
          </div>
          <button onClick={reset}>Reset to default</button>
        </FloatingWindow>
      )}
      {(selected || selectedContainer) && (
        <FloatingWindow
          id="function-appearance"
          openingKey={appearanceOpening}
          className="function-appearance"
          title={
            configuredControl
              ? `Arrange ${configuredControl.control} icon`
              : configuredFrame
                ? `Arrange frame: ${layout.labels?.[configuredFrame] ?? frameActions.get(configuredFrame)?.title ?? configuredFrame}`
                : `Arrange: ${selected!.label}`
          }
          width={370}
          height={580}
          onClose={() => {
            configure(null);
            configureFrame(null);
            configureControl(null);
          }}
        >
          <EmbeddedGroup id="arrange:appearance" title="Appearance" className="arrange-section">
            <ContextualAppearance owner={configuredFrame ?? (selected ? `function:${selected.id}` : configuredControl?.owner ?? '')} label={configuredFrame ? frameActions.get(configuredFrame)?.title ?? configuredFrame : selected?.label ?? 'Frame control'} control={selected?.control} />
          </EmbeddedGroup>
          {selected && layout.customControls?.[selected.id] && <UISection id="custom-field-settings" title="Field settings">
            <CustomControlSettings key={selected.id} id={selected.id} />
            <button onClick={() => { update(layout => removeCustomControl(layout, selected.id)); configure(null); }}>Remove custom field</button>
          </UISection>}
          {!configuredControl && (
            <EmbeddedGroup id="arrange:display" title={configuredFrame ? "Frame handle" : "Display"} className="arrange-section">
              {selected && <UIField id="ui:editor:functionName" label="Function name" category="Interface"><label>Name<UINameInput label="Function name" value={layout.labels?.[`function:${selected.id}`] ?? selected.label}
                onRename={name => update(layout => ({ ...layout, labels: { ...layout.labels, [`function:${selected.id}`]: name } }))} /></label></UIField>}
              {configuredFrame && frameActions.get(configuredFrame)?.onRename && (
                <UIField id="ui:editor:frameName" label="Frame name" category="Interface"><label>
                  Name
                  <UINameInput
                    label="Frame name"
                    value={layout.labels?.[configuredFrame] ?? frameActions.get(configuredFrame)!.title}
                    onRename={(name) => frameActions.get(configuredFrame)?.onRename?.(name)}
                  />
                </label></UIField>
              )}
              <UIField id="ui:editor:display" label="Control display" category="Interface"><label>
                Display
                <select
                  aria-label={configuredFrame ? "Frame handle display" : "Function display"}
                  value={style.mode}
                  onChange={(e) => setStyle({ mode: e.target.value as FunctionStyle["mode"] })}
                >
                  <option value="text">Text</option>
                  <option value="icon">Icon button</option>
                </select>
              </label></UIField>
              <UIField id="ui:editor:geometry" label="Control geometry" category="Interface"><label>
                Geometry
                <select
                  aria-label={configuredFrame ? "Frame handle geometry" : "Function geometry"}
                  value={style.geometry}
                  onChange={(e) =>
                    setStyle({ geometry: e.target.value as FunctionStyle["geometry"] })
                  }
                >
                  <option value="circle">Circle (O)</option>
                  <option value="square">Square</option>
                  <option value="triangle">Triangle</option>
                </select>
              </label></UIField>
            </EmbeddedGroup>
          )}
          {shortcuts && (
            <EmbeddedGroup id="arrange:shortcut" title="Shortcut" className="arrange-section">
              {(() => {
                const target = configuredControl ? `@control:${configuredControl.control}:${configuredControl.owner}` : configuredFrame ? `@frame:${configuredFrame}` : selected!.id;
                const id = buttonShortcutId(target);
                const label = configuredControl ? `${configuredControl.control} ${frameActions.get(configuredControl.owner)?.title ?? "frame"}` : configuredFrame ? frameActions.get(configuredFrame)?.title ?? "Frame" : selected!.label;
                return <UIField id="ui:editor:shortcut" label="Control shortcut" category="Interface"><div className="binding-row"><span>Shortcut</span><button aria-label="Assign button shortcut" onClick={() => shortcuts.onCapture(id, label)}>{shortcuts.capturing === id ? "Press a key…" : shortcuts.bindings[id] || "Assign shortcut"}</button><button aria-label="Clear button shortcut" onClick={() => shortcuts.onClear(id)}>Clear</button></div></UIField>;
              })()}
            </EmbeddedGroup>
          )}
          <EmbeddedGroup
            id="arrange:visual"
            title={configuredControl ? "Frame control visual" : configuredFrame ? "Frame handle visual" : "Function visual"}
            className="arrange-section"
          >
            <VisualControls
              key={
                configuredControl
                  ? `${configuredControl.owner}:${configuredControl.control}`
                  : (configuredFrame ?? configured)
              }
              label={
                configuredControl ? "Frame control" : configuredFrame ? "Frame handle" : "Function"
              }
              allowModels={false}
              iconColor={configuredControl ? "#829eb9" : "#254e73"}
              value={{ assetId: style.assetId, character: style.character, showText: false }}
              assets={layout.assets}
              onChange={(v) => setStyle({ mode: "icon", assetId: v.assetId, character: v.character })}
              onAsset={(asset, visual) =>
                setStyle({ mode: "icon", character: undefined, assetId: visual.assetId }, asset)
              }
            />
          </EmbeddedGroup>
          {selected && (
            <EmbeddedGroup id="arrange:placement" title="Placement" className="arrange-section">
              <UIAction id="ui:editor:pinFunction" label={item?.pinned ? "Unpin function" : "Pin function"}
                onClick={() =>
                  update((s) => ({
                    ...s,
                    items: {
                      ...s.items,
                      [selected.id]: {
                        ...s.items[selected.id],
                        home: s.items[selected.id]?.home ?? !ownerOf(s, `function:${selected.id}`),
                        x: s.items[selected.id]?.x ?? 24,
                        y: s.items[selected.id]?.y ?? 180,
                        pinned: !s.items[selected.id]?.pinned,
                      },
                    },
                  }))
                }
              />
              <UIAction id="ui:editor:returnFunction" label="Return to default location"
                disabled={functionPinned(layout, selected.id)}
                onClick={() => update((s) => detachFunction(s, selected.id, 0, 0, true))}
              />
            </EmbeddedGroup>
          )}
        </FloatingWindow>
      )}
      </AppearanceProvider>
      </DockWorkspace>
    </UIContext.Provider>
  );
}
export function UIArrangeButtons() {
  return (
    <>
      <FunctionControl id="ui:arrange" />
      <FunctionControl id="ui:createFrame" />
      <FunctionControl id="ui:select" />
      <FunctionControl id="ui:compact" />
      <FunctionControl id="ui:align" />
    </>
  );
}
