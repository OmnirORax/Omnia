import { captureNativeActions, NativeActions } from "./NativeActions";
import { UINameInput } from "./EditableLabel";
import { NamePresentation } from "./NamePresentation";
import { createTransientStore } from "./transientStore";
import { PlacementPreviewOverlay } from "./PlacementPreview";
import { captureUIPointer } from "./drag";
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
import {
  UIContext,
  UIHomeContext,
  useUI,
  type UIFunction,
  type UIContextValue,
  type UICommand,
} from "./context";
import { useDragActivationGuard } from "./activationGuard";
import { useButtonSelection, ButtonSelectionOverlay } from "./useButtonSelection";
import { FloatingWindow } from "./FloatingWindow";
import {
  detachFunction,
  functionPinned,
  type UILayout,
  type UIFrame,
  type FunctionStyle,
} from "./layout";
import { VisualControls } from "../VisualControls";
import { ShortcutHint } from "./ShortcutHint";
import { FrameChrome } from "./FrameChrome";
import { GlobalSearch, type GlobalSearchProps } from "./GlobalSearch";
import { FrameSearch } from "./FrameSearch";
import { DockArea } from "./DockArea";
import { DockHost } from "./DockHost";
import {
  canDock,
  dockResident,
  floatResident,
  ownerOf,
  getContainer,
  updateContainer,
  releaseResident,
  residentKey,
  readResident,
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
  type DockPreview,
  type Rect,
} from "./drag";
import type { VisualAsset } from "../graph/assets";
import { snapPosition, snapshotPositions } from "./positioning";
import { insertFrameBeside, type InsertSide } from "./frameInsertion";
import { LIBRARY_CATEGORIES, libraryCategory } from "./catalog";
import { useFrameBounds, residentBounds } from "./frameBounds";
import { buttonShortcutId, isTypingTarget, normalizeKey, type ButtonShortcuts } from "../workspaceActions";
const MIME = "application/x-omnium-function";
const defaultStyle: FunctionStyle = { mode: "text", geometry: "circle" };
const dropGeometrySelector = "[data-ui-drop-zone],[data-ui-resident-root],[data-ui-inline-group],[data-ui-frame-slot],[data-ui-slot-key],.ui-frame-handle,[data-ui-inline-handle],[data-ui-chrome],[data-ui-native-anchor]";
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
  if (ui.layout.panels[id] || owner)
    return (
      <FloatingWindow
        id={`panel:${id}`}
        title={title}
        width={400}
        height={560}
        onClose={() =>
          ui.update((s) => ({ ...releaseResident(s, key), panels: { ...s.panels, [id]: false } }))
        }
        closeLabel={`Dock ${title}`}
      >
        <section className={className}>{children}</section>
      </FloatingWindow>
    );
  if (!menu && !ui.layout.panels["@organized"]) return (
    <section className={`ui-docked-panel ${className}`} data-ui-resident-root={key}>
      <div className="ui-legacy-search"><FrameSearch container={key} title={title} expand={() => {}} /></div>
      <button className="detach-panel" title={`Float ${title}`} aria-label={`Undock ${id} panel`} data-ui-drag={key} draggable onDragStart={e => startResidentDrag(e, key)} onClick={() => float(true)}>↗</button>
      <UIHomeContext.Provider value={key}>{children}<DockArea container={key} contour={false} /></UIHomeContext.Provider>
    </section>
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
      <UIHomeContext.Provider value={key}>
        {children}
        <DockArea container={key} contour={false} />
      </UIHomeContext.Provider>
      </div>
    </section>
  );
}
function FunctionFrame({ frame }: { frame: UIFrame }) {
  const { ref, bounds } = useFrameBounds();
  const ui = useUI(),
    key = `frame:${frame.id}`,
    nested = !!ownerOf(ui.layout, key),
    width = Math.max(64, Math.min(frame.width ?? 280, window.innerWidth - 24));
  const patch = (change: Partial<UIFrame>) => ui.update((s) => updateContainer(s, key, change));
  return (
    <Rnd
      className={`function-frame contour-frame ${nested ? "nested-ui-frame" : ""} ${frame.collapsed ? "collapsed" : ""}`}
      style={
        {
          pointerEvents: "none",
          position: nested ? "relative" : "fixed",
          zIndex: 70,
          "--ui-frame-top": `${Math.max(8, Math.min(frame.y, window.innerHeight - 60))}px`,
        } as React.CSSProperties
      }
      position={
        nested
          ? { x: 0, y: 0 }
          : {
              x: Math.max(8, Math.min(frame.x + bounds.x, window.innerWidth - bounds.width - 8)),
              y: Math.max(8, Math.min(frame.y + bounds.y, window.innerHeight - bounds.height - 8)),
            }
      }
      size={{ width: bounds.width, height: bounds.height }}
      disableDragging
      enableResizing={
        !residentPinned(ui.layout, key) && !frame.collapsed
          ? { right: true, bottomRight: true }
          : false
      }
      resizeHandleStyles={{
        right: { pointerEvents: "auto" },
        bottomRight: { pointerEvents: "auto" },
      }}
      minWidth={40}
      maxWidth={window.innerWidth - 24}
      onResizeStop={(_, __, element) => patch({ width: element.offsetWidth })}
    >
      <div
        ref={ref}
        className="ui-frame-root"
        data-ui-resident-root={key}
        style={{ width, position: "relative", left: -bounds.x, top: -bounds.y }}
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
                  delete items[member.id];
                  next = { ...next, items };
                } else
                  next = updateContainer(next, memberKey, { x: frame.x + 24, y: frame.y + 64 });
              }
              return { ...next, frames: next.frames.filter((f) => f.id !== frame.id) };
            });
          }}
        />
        {!frame.collapsed && <DockArea container={key} />}
      </div>
    </Rnd>
  );
}
type Preview = {
  dock?: DockPreview;
  rect?: Rect;
  text: string;
  group?: string;
  control?: { owner: string; control: string; x: number; y: number };
  native?: { id: string; anchor: string; homeId: string; target: string; after: boolean };
  frameStrip?: { target: string; orderId: string; keys: string[]; nativeKeys: string[]; peer: string; after: boolean };
};
type DragState = {
  key: string;
  width: number;
  height: number;
  dx: number;
  dy: number;
  originOffset: { x: number; y: number };
  slots: Map<string, { key: string; r: Rect }[]>;
  targetBounds: Map<Element, DOMRect>;
  zoneOrigins: Map<Element, { x: number; y: number }>;
  cancelled?: boolean;
  control?: { owner: string; control: string };
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
  ], [definitions, registered]);
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
  const [anchorTarget, setAnchorTarget] = useState<string | null>(null);
  const [placementPreview] = useState(() => createTransientStore<Preview | null>(null));
  const [menu, setMenu] = useState<{ x: number; y: number; owner?: string } | null>(null);
  const menuRoot = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const node = menuRoot.current;
    if (!node || !menu) return;
    const r = node.getBoundingClientRect();
    node.style.left = `${Math.max(8, Math.min(menu.x, window.innerWidth - r.width - 8))}px`;
    node.style.top = `${Math.max(8, Math.min(menu.y, window.innerHeight - r.height - 8))}px`;
  }, [menu, layout]);
  const defaults = useRef(new Map<string, WindowState>()).current;
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
  const createFrame = (x: number, y: number) =>
    update((s) => {
      const desired = { x: Math.max(8, x), y: Math.max(8, y) };
      const position =
        s.arrangement?.mode === "snap" && s.arrangement.grid
          ? snapPosition(
              desired,
              { width: 280, height: 100 },
              s.arrangement.grid,
              [
                ...document.querySelectorAll<HTMLElement>(
                  "[data-ui-resident-root],[data-ui-function]:not([data-ui-palette])",
                ),
              ]
                .filter((el) => el.getClientRects().length)
                .map((el) => el.getBoundingClientRect()),
            )
          : desired;
      return {
        ...s,
        frames: [
          ...s.frames,
          {
            id: crypto.randomUUID(),
            name: "New frame",
            x: position.x,
            y: position.y,
            cellSize: 96,
            width: 280,
            collapsed: false,
            pinned: false,
            members: [],
          },
        ],
      };
    });
  const ensure = (s: UILayout) => ({
    ...s,
    windows: { ...Object.fromEntries(defaults), ...s.windows },
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
    setAnchorTarget(null); placementPreview.set(null); setMenu(null); setQuery("");
    onReset();
  };
  const resetRef = useRef(reset); resetRef.current = reset;
  useEffect(() => { if (command?.action === "reset") resetRef.current(); }, [command?.sequence]);
  const chooseMode = (owner: string, mode: "free" | "snap") => {
    setMenu(null);
    if (mode === "snap") {
      setAnchorTarget(owner);
      return;
    }
    setAnchorTarget(null);
    update((s) =>
      owner === "@workspace"
        ? { ...s, arrangement: { mode } }
        : updateContainer(ensure(s), owner, { arrangement: { mode } }),
    );
  };
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
    if (!anchorTarget) return;
    const pick = (e: MouseEvent) => {
      const target = e.target as Element;
      const element = target.closest<HTMLElement>("[data-ui-function],.ui-frame-handle");
      e.preventDefault();
      e.stopImmediatePropagation();
      if (!element) return;
      const zone = element.closest<HTMLElement>("[data-ui-drop-zone]");
      if (
        anchorTarget !== "@workspace" &&
        zone?.dataset.uiDropZone !== anchorTarget &&
        element.closest<HTMLElement>("[data-ui-resident-root]")?.dataset.uiResidentRoot !==
          anchorTarget &&
        element.closest<HTMLElement>("[data-ui-chrome]")?.dataset.uiChrome !== anchorTarget
      )
        return;
      const r = element.getBoundingClientRect();
      const key = element.dataset.uiFunction
        ? `function:${element.dataset.uiFunction}`
        : element.dataset.uiDrag!;
      update((previous) => {
        const s = ensure(previous);
        if (anchorTarget === "@workspace")
          return {
            ...s,
            arrangement: {
              mode: "snap",
              grid: {
                anchor: key,
                origin: { x: r.x, y: r.y },
                pitch: { x: Math.max(16, r.width + 12), y: Math.max(16, r.height + 12) },
              },
            },
          };
        const body = [...document.querySelectorAll<HTMLElement>("[data-ui-drop-zone]")].find(
          (n) => n.dataset.uiDropZone === anchorTarget,
        );
        if (!body) return previous;
        const bounds = body.getBoundingClientRect(),
          ox = Number(body.dataset.originX || 0),
          oy = Number(body.dataset.originY || 0);
        const boxes = new Map(
          [...body.querySelectorAll<HTMLElement>(":scope > [data-ui-slot-key]")].map((n) => {
            const b = n.getBoundingClientRect();
            return [
              n.dataset.uiSlotKey!,
              { x: b.x - bounds.x + ox, y: b.y - bounds.y + oy, width: b.width, height: b.height },
            ] as const;
          }),
        );
        const c = getContainer(s, anchorTarget)!;
        return updateContainer(s, anchorTarget, {
          members: snapshotPositions(c.members ?? [], boxes, residentKey),
          arrangement: {
            mode: "snap",
            grid: {
              anchor: key,
              origin: { x: r.x - bounds.x + ox, y: r.y - bounds.y + oy },
              pitch: { x: Math.max(16, r.width + 12), y: Math.max(16, r.height + 12) },
            },
          },
        });
      });
      setAnchorTarget(null);
    };
    const block = (e: Event) => {
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    const cancel = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAnchorTarget(null);
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    window.addEventListener("pointerdown", block, true);
    window.addEventListener("click", pick, true);
    window.addEventListener("keydown", cancel, true);
    return () => {
      window.removeEventListener("pointerdown", block, true);
      window.removeEventListener("click", pick, true);
      window.removeEventListener("keydown", cancel, true);
    };
  }, [anchorTarget]);
  useEffect(() => {
    let previewFrame = 0;
    let pointer: { down: PointerEvent; started: boolean; release?: () => void } | null = null;
    let pendingPoint: { x: number; y: number } | null = null;
    const cancelFrame = () => {
      cancelAnimationFrame(previewFrame); previewFrame = 0; pendingPoint = null;
    };
    let layoutSource: UILayout | undefined, dragLayout: UILayout;
    const effectiveLayout = () => {
      if (layoutSource !== current.current.layout) {
        layoutSource = current.current.layout;
        dragLayout = ensure(layoutSource);
      }
      return dragLayout;
    };
    const show = (value: Preview | null) => {
      const old = placementPreview.getSnapshot();
      if (JSON.stringify(old) !== JSON.stringify(value)) placementPreview.set(value);
    };
    const start = (event: MouseEvent) => {
      cancelFrame(); layoutSource = undefined;
      const target = event.target as Element;
      if (target.closest("input,select,textarea")) return;
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
      const root =
        mini ??
        (fn && key.startsWith("function:")
          ? fn
          : (handle?.closest<HTMLElement>("[data-ui-resident-root]") ?? handle));
      const r = root ? residentBounds(root) : undefined;
      if (!r) return;
      const slots = new Map(
        [...document.querySelectorAll<HTMLElement>("[data-ui-drop-zone]")].map((zone) => [
          zone.dataset.uiDropZone!,
          [...zone.querySelectorAll<HTMLElement>(":scope > [data-ui-slot-key]")].map((slot) => ({
            key: slot.dataset.uiSlotKey!,
            r: slot.getBoundingClientRect(),
          })),
        ]),
      );
      // In-flow ghosts can enlarge/reflow their dock. They must not change the
      // hit regions or coordinate origin used to decide this same gesture.
      const targetBounds = new Map(
        [...document.querySelectorAll(dropGeometrySelector)].map(el => [el, el.getBoundingClientRect()]),
      );
      const zoneOrigins = new Map(
        [...document.querySelectorAll<HTMLElement>("[data-ui-drop-zone]")].map(el => [el, {
          x: Number(el.dataset.originX || 0), y: Number(el.dataset.originY || 0),
        }]),
      );
      drag.current = {
        key,
        width: r.width,
        height: r.height,
        dx: event.clientX - r.x,
        dy: event.clientY - r.y,
        originOffset: {
          x: (root?.getBoundingClientRect().x ?? r.x) - r.x,
          y: (root?.getBoundingClientRect().y ?? r.y) - r.y,
        },
        slots,
        targetBounds,
        zoneOrigins,
        control: mini
          ? { owner: mini.dataset.uiControlOwner!, control: mini.dataset.uiControl! }
          : undefined,
      };
    };
    const resolve = (x: number, y: number): Preview | null => {
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
        const container = getContainer(s, source.control.owner);
        const grid =
          container?.arrangement?.mode === "snap" ? container.arrangement.grid : undefined;
        if (grid) {
          const body = [...document.querySelectorAll<HTMLElement>("[data-ui-drop-zone]")].find(
            (n) => n.dataset.uiDropZone === source.control!.owner,
          );
          const b = body ? boundsOf(body) : undefined;
          const origin = b
            ? {
                x: b.x - r.x - (body ? originOf(body).x : 0) + grid.origin.x,
                y: b.y - r.y - (body ? originOf(body).y : 0) + grid.origin.y,
              }
            : grid.origin;
          position = snapPosition(
            position,
            source,
            { ...grid, origin },
            [...element.querySelectorAll<HTMLElement>(".frame-mini-control,.ui-frame-handle")]
              .filter((n) => n.dataset.uiControl !== source.control!.control)
              .map((n) => {
                const q = boundsOf(n);
                return { x: q.x - r.x, y: q.y - r.y, width: q.width, height: q.height };
              }),
          );
        }
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
            text, rect,
            frameStrip: { target: hit.target, orderId: hit.strip.dataset.uiFrameOrder!, nativeKeys: JSON.parse(hit.strip.dataset.uiFrameNative ?? "[]"), peer: hit.key, after, keys: [...hit.strip.querySelectorAll<HTMLElement>(":scope > [data-ui-frame-slot]")].sort((a,b) => Number(getComputedStyle(a).order) - Number(getComputedStyle(b).order)).map(el => el.dataset.uiFrameSlot!) },
          };
          const c = getContainer(s, hit.target)!;
          const bounds = boundsOf(hit.zone);
          const ox = originOf(hit.zone).x, oy = originOf(hit.zone).y;
          const boxes = new Map((source.slots.get(hit.target) ?? []).map(slot => [slot.key, { x: slot.r.x - bounds.x + ox + hit.zone.scrollLeft, y: slot.r.y - bounds.y + oy + hit.zone.scrollTop, width: slot.r.width, height: slot.r.height }]));
          if (boxes.has(hit.key)) {
            const insertion = insertFrameBeside(c.members ?? [], boxes, source.key, source, hit.key, hit.side, c.arrangement);
            if (insertion.baseline.some(member => { const box = boxes.get(residentKey(member)); return box && residentPinned(s, residentKey(member)) && (member.position?.x !== box.x || member.position?.y !== box.y); })) return { text: "Unpin neighboring frames before shifting them" };
            return { text, rect, dock: { key: source.key, target: hit.target, index: (c.members ?? []).findIndex(m => residentKey(m) === hit.key) + (after ? 1 : 0), breakBefore: false, width: source.width, height: source.height, ...insertion } };
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
        const position =
          c.arrangement?.mode === "snap" && c.arrangement.grid
            ? snapPosition(
                desired,
                source,
                c.arrangement.grid,
                [...boxes].filter(([key]) => key !== source.key).map(([, box]) => box),
              )
            : desired;
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
              : c.arrangement?.mode === "snap"
                ? "Snap to available cell"
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
        s.arrangement?.mode !== "snap" &&
        !ownerOf(s, `function:${other.dataset.uiFunction}`) &&
        !residentPinned(s, `function:${other.dataset.uiFunction}`)
      )
        return {
          text: "Group into a collapsed frame",
          group: `function:${other.dataset.uiFunction}`,
          rect: boundsOf(other),
        };
      const desired = {
        x: Math.max(
          8,
          Math.min(
            window.innerWidth - Math.min(source.width, window.innerWidth - 16),
            x - source.dx,
          ),
        ),
        y: Math.max(8, Math.min(window.innerHeight - 44, y - source.dy)),
      };
      const occupied = [
        ...document.querySelectorAll<HTMLElement>(
          "[data-ui-resident-root],[data-ui-function]:not([data-ui-palette])",
        ),
      ]
        .filter(
          (el) =>
            el.getClientRects().length &&
            (el.dataset.uiResidentRoot ?? `function:${el.dataset.uiFunction}`) !== source.key &&
            !ownerOf(s, el.dataset.uiResidentRoot ?? `function:${el.dataset.uiFunction}`),
        )
        .map((el) => boundsOf(el));
      const position =
        s.arrangement?.mode === "snap" && s.arrangement.grid
          ? snapPosition(desired, source, s.arrangement.grid, occupied)
          : desired;
      if (
        position.x < 0 ||
        position.y < 0 ||
        position.x > window.innerWidth - 24 ||
        position.y > window.innerHeight - 24
      )
        return { text: "No visible cell here; choose another position or anchor" };
      return {
        text: s.arrangement?.mode === "snap" ? "Workspace snap" : "Place freely",
        rect: { ...position, width: source.width, height: source.height },
      };
    };
    const over = (e: globalThis.DragEvent) => {
      if (!drag.current || drag.current.cancelled) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
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
        if (p.group) {
          if (residentPinned(s, source.key)) return previous;
          s = releaseResident(releaseResident(s, source.key), p.group);
          const id = crypto.randomUUID();
          const frame: UIFrame = {
            id,
            name: "New frame",
            x: e.clientX,
            y: e.clientY,
            width: 280,
            cellSize: 96,
            collapsed: true,
            pinned: false,
            members: [readResident(p.group), readResident(source.key)],
          };
          const items = { ...s.items };
          for (const key of [source.key, p.group])
            if (key.startsWith("function:")) {
              const id = readResident(key).id;
              items[id] = { ...items[id], home: false, x: 0, y: 0 };
            }
          return validateUILayout({ ...s, items, frames: [...s.frames, frame] });
        }
        if (p.rect) {
          const next = floatResident(
            s,
            source.key,
            p.rect.x + source.originOffset.x,
            p.rect.y + source.originOffset.y,
          );
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
      if (target.closest("input,select,textarea,a,[contenteditable=true],.window-resize-grip")) return;
      const handle = target.closest<HTMLElement>("[data-ui-control],[data-ui-drag],[data-ui-function]");
      if (!handle?.draggable) return;
      pointer = { down: event, started: false };
    };
    const pointerMove = (event: PointerEvent) => {
      const active = pointer;
      if (!active || event.pointerId !== active.down.pointerId) return;
      if (!active.started) {
        if (Math.hypot(event.clientX - active.down.clientX, event.clientY - active.down.clientY) <= 5) return;
        if (!(active.down.target instanceof Element) || !active.down.target.isConnected) { cancelPointer(); return; }
        start(active.down);
        if (!drag.current) { cancelPointer(); return; }
        active.started = true;
        active.release = captureUIPointer(event.pointerId);
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
    const captureLost = (event: PointerEvent) => {
      if (event.target === document.documentElement) pointerCancel(event);
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
    window.addEventListener("lostpointercapture", captureLost, true);
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
      window.removeEventListener("lostpointercapture", captureLost, true);
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
      if (!(menu || configured || configuredFrame || configuredControl || shortcutField || shortcutNotice)) return;
      // Closing a UI editor must not also clear the graph selection it edits.
      e.preventDefault(); e.stopPropagation();
      setMenu(null); configure(null); configureFrame(null); configureControl(null);
      setShortcutField(null); setShortcutNotice("");
    };
    window.addEventListener("keydown", close, true);
    return () => window.removeEventListener("keydown", close, true);
  }, [menu, configured, configuredFrame, configuredControl, shortcutField, shortcutNotice, shortcuts?.capturing]);
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
          configureFrame(null);
          configureControl(null);
          configure(id);
        },
        configureFrame: (owner) => {
          configure(null);
          configureControl(null);
          configureFrame(owner);
          setMenu(null);
        },
        configureControl: (owner, control) => {
          configure(null);
          configureFrame(null);
          configureControl({ owner, control });
        },
        anchorTarget,
        chooseMode,
        createFrame,
        library: () => setLibraryOpen(true),
        frameMenu,
        placementPreview,
        defaults,
        frameActions,
        renderResident,
        selectedFunctions: buttonSelection.ids,
        selectingUI: buttonSelection.mode,
        selectionMenu: buttonSelection.openMenu,
      }}
    >
      <AppearanceProvider bridge={appearance}>
      <AppearanceStyles />
      <NativeActions />
      <NamePresentation />
      {children}
      {search && <GlobalSearch {...search} />}
      <div hidden ref={shortcutRunners} aria-hidden="true">
        {functions.filter(fn => !fn.control && fn.available !== false && Object.hasOwn(shortcuts?.bindings ?? {}, `button:${fn.id}`)).map(fn => <span key={fn.id} data-shortcut-runner={fn.id}>{fn.element}</span>)}
      </div>
      {shortcutField && <FloatingWindow id="shortcut-field" title={functions.find(fn => fn.id === shortcutField)?.label ?? "Setting"} width={350} height={300} onClose={() => setShortcutField(null)}>{functions.find(fn => fn.id === shortcutField && fn.available !== false)?.element ?? <p>Open the relevant context to edit this setting.</p>}</FloatingWindow>}
      {shortcutNotice && <div className="ui-anchor-prompt ui-shortcut-notice" role="status">{shortcutNotice}<button onClick={() => setShortcutNotice("")}>Dismiss</button></div>}
      <ButtonSelectionOverlay selection={buttonSelection} />
      {anchorTarget && (
        <div className="ui-anchor-prompt" role="status">
          Snap: click{" "}
          {anchorTarget === "@workspace"
            ? "an icon or frame handle in the workspace"
            : "an icon in this frame"}{" "}
          to set the grid. Esc cancels.
        </div>
      )}
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
            <div
              className="ui-free-function"
              key={id}
              style={{
                left: Math.max(
                  8,
                  Math.min(placement.x, window.innerWidth - (placement.size?.width ?? 100)),
                ),
                top: Math.max(
                  8,
                  Math.min(placement.y, window.innerHeight - (placement.size?.height ?? 82) - 8),
                ),
                width: placement.size?.width,
                maxWidth: placement.size ? "none" : undefined,
              }}
            >
              {renderResident({ kind: "function", id })}
            </div>
          ))}
        {layout.frames
          .filter((f) => !ownerOf(layout, `frame:${f.id}`))
          .map((f) => (
            <FunctionFrame frame={f} key={f.id} />
          ))}
      </div>
      <PlacementPreviewOverlay />
      {menu && (
        <div
          ref={menuRoot}
          className="ui-background-menu"
          role="menu"
          aria-label="UI frame settings"
          style={{
            left: Math.min(menu.x, window.innerWidth - 250),
            top: Math.min(menu.y, window.innerHeight - 230),
          }}
        >
          <button onClick={() => chooseMode(menu.owner ?? "@workspace", "free")}>
            Free-hand mode
            {(menuContainer?.arrangement ?? layout.arrangement)?.mode !== "snap" ? " ✓" : ""}
          </button>
          <button onClick={() => chooseMode(menu.owner ?? "@workspace", "snap")}>
            Snap mode · choose anchor
          </button>
          {menu.owner && menuContainer && (
            <>
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
        </div>
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
            Drag functions, field edges and frame handles to arrange them. Free-hand preserves your
            chosen positions. Snap uses a clicked anchor and leaves occupied cells in place.
            Right-click a frame for its placement mode. Drag its faded background to move contents
            together. Esc cancels. Shift+MB4/MB5 undo and redo the UI.
          </p>
          <button onClick={() => createFrame(120, 180)}>Create UI frame</button>
          <input
            aria-label="Find UI function"
            placeholder="Find a function…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="function-library categorized-library">
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
                  <details key={category} open={!!query || undefined}>
                    <summary>
                      {category} <small>{entries.length}</small>
                    </summary>
                    {entries.map((fn) => (
                      <div className="library-entry" key={fn.id}>
                        <FunctionElement fn={fn} palette />
                        {fn.available === false && (
                          <small>Choose its editing context to use this field</small>
                        )}
                      </div>
                    ))}
                  </details>
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
          <ContextualAppearance owner={configuredFrame ?? (selected ? `function:${selected.id}` : configuredControl?.owner ?? '')} label={configuredFrame ? frameActions.get(configuredFrame)?.title ?? configuredFrame : selected?.label ?? 'Frame control'} control={selected?.control} />
          {configuredFrame && frameActions.get(configuredFrame)?.onRename && (
            <label>
              Name
              <UINameInput
                label="Frame name"
                value={layout.labels?.[configuredFrame] ?? frameActions.get(configuredFrame)!.title}
                onRename={(name) => frameActions.get(configuredFrame)?.onRename?.(name)}
              />
            </label>
          )}
          {!configuredControl && (
            <>
              <label>
                Display
                <select
                  aria-label={configuredFrame ? "Frame handle display" : "Function display"}
                  value={style.mode}
                  onChange={(e) => setStyle({ mode: e.target.value as FunctionStyle["mode"] })}
                >
                  <option value="text">Text</option>
                  <option value="icon">Icon button</option>
                </select>
              </label>
              <label>
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
              </label>
            </>
          )}
          {shortcuts && (() => {
            const target = configuredControl ? `@control:${configuredControl.control}:${configuredControl.owner}` : configuredFrame ? `@frame:${configuredFrame}` : selected!.id;
            const id = buttonShortcutId(target);
            const label = configuredControl ? `${configuredControl.control} ${frameActions.get(configuredControl.owner)?.title ?? "frame"}` : configuredFrame ? frameActions.get(configuredFrame)?.title ?? "Frame" : selected!.label;
            return <div className="binding-row"><span>Shortcut</span><button aria-label="Assign button shortcut" onClick={() => shortcuts.onCapture(id, label)}>{shortcuts.capturing === id ? "Press a key…" : shortcuts.bindings[id] || "Assign shortcut"}</button><button aria-label="Clear button shortcut" onClick={() => shortcuts.onClear(id)}>Clear</button></div>;
          })()}
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
          {selected && (
            <>
              <button
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
              >
                {item?.pinned ? "Unpin function" : "Pin function"}
              </button>
              <button
                disabled={functionPinned(layout, selected.id)}
                onClick={() => update((s) => detachFunction(s, selected.id, 0, 0, true))}
              >
                Return to default location
              </button>
            </>
          )}
        </FloatingWindow>
      )}
      </AppearanceProvider>
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
      <FunctionControl id="ui:placementMode" />
    </>
  );
}
export function UIPlacementControl() {
  const ui = useUI();
  return (
    <label>
      UI placement
      <span className="ui-placement-options">
        <select
          aria-label="UI placement mode"
          value={
            ui.anchorTarget === "@workspace" ? "anchor" : (ui.layout.arrangement?.mode ?? "free")
          }
          onChange={(e) => ui.chooseMode("@workspace", e.target.value === "free" ? "free" : "snap")}
        >
          <option value="free">Free-hand</option>
          <option value="snap">Snap</option>
          {ui.anchorTarget === "@workspace" && <option value="anchor">Click an anchor…</option>}
        </select>
        <button type="button" onClick={() => ui.chooseMode("@workspace", "snap")}>
          Anchor
        </button>
      </span>
    </label>
  );
}
