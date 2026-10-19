import {
  cloneElement,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
  type ReactElement,
} from "react";
import { Rnd } from "react-rnd";
import { UIContext, useUI, type UIFunction } from "./context";
import { FloatingWindow } from "./FloatingWindow";
import {
  emptyUILayout,
  detachFunction,
  functionPinned,
  type UILayout,
  type UIFrame,
  type FunctionStyle,
} from "./layout";
import { VisualControls } from "../VisualControls";
import { FrameChrome } from "./FrameChrome";
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
  type WindowState,
  type UIResident,
} from "./layout";
import {
  DOCK_DISTANCE,
  MAGNET_DISTANCE,
  magnetActive,
  rectDistance,
  startResidentDrag,
  type DockPreview,
  type Rect,
} from "./drag";
import type { VisualAsset } from "../graph/assets";
const MIME = "application/x-omnium-function";
const defaultStyle: FunctionStyle = { mode: "text", geometry: "circle" };
export function FunctionControl({ id, palette = false }: { id: string; palette?: boolean }) {
  const ui = useUI(),
    fn = ui.functions.find((f) => f.id === id),
    item = ui.layout.items[id];
  if (!fn || (!palette && (ownerOf(ui.layout, `function:${id}`) || (item && !item.home))))
    return null;
  return <FunctionElement fn={fn} palette={palette} />;
}
function FunctionElement({
  fn,
  palette = false,
  resident = false,
}: {
  fn: UIFunction;
  palette?: boolean;
  resident?: boolean;
}) {
  const ui = useUI(),
    item = ui.layout.items[fn.id],
    style = item?.style ?? defaultStyle;
  const [controlOpen, setControlOpen] = useState(false);
  const asset = ui.layout.assets.find((a) => a.id === style.assetId);
  const content =
    palette || (resident && style.mode === "text") ? (
      fn.label
    ) : style.mode === "text" ? (
      ((fn.element.props as { children?: ReactNode }).children ?? fn.label)
    ) : asset ? (
      <img src={asset.dataUrl} alt="" />
    ) : (
      <span>{style.character || "○"}</span>
    );
  const original = fn.element as ReactElement<{
    onClick?: () => void;
    disabled?: boolean;
    children?: ReactNode;
    className?: string;
    onMouseEnter?: () => void;
  }>;
  const shared = {
    "data-ui-function": fn.id,
    "data-ui-palette": palette ? "true" : undefined,
    "data-ui-resident": resident ? "true" : undefined,
    title: `${fn.label}${item?.pinned ? " (pinned)" : " · drag to arrange; right-click to customize"}`,
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
      ui.configure(fn.id);
    },
  };
  const modeClass =
    !palette && style.mode === "icon" ? `function-icon shape-${style.geometry}` : "function-text";
  const button =
    fn.control && !palette && style.mode === "text" ? (
      <div {...shared} className="ui-form-control">
        <span
          className="ui-field-grip"
          title={`Drag ${fn.label}`}
          aria-label="Move field"
          data-ui-drag={`function:${fn.id}`}
          draggable={!functionPinned(ui.layout, fn.id)}
          onDragStart={(e) => startResidentDrag(e, `function:${fn.id}`)}
        >
          ⠿
        </span>
        {fn.element}
      </div>
    ) : (
      cloneElement(fn.control ? <button onClick={() => setControlOpen(true)} /> : original, {
        ...shared,
        disabled: false,
        "aria-disabled": original.props.disabled || undefined,
        onClick: original.props.disabled
          ? undefined
          : fn.control
            ? () => setControlOpen(true)
            : original.props.onClick,
        "aria-label": palette
          ? `Place ${fn.label}`
          : (original.props["aria-label" as keyof typeof original.props] ??
            (resident || style.mode === "icon" ? fn.label : undefined)),
        className: `${original.props.className ?? ""} ui-function ${modeClass}`,
        children: content,
      })
    );
  return (
    <>
      {button}
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
}: {
  id: string;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const ui = useUI();
  const key = `window:panel:${id}`,
    owner = ownerOf(ui.layout, key);
  useLayoutEffect(() => {
    if (ui.layout.panels[id] || owner) return;
    ui.defaults.set(`panel:${id}`, {
      x: 320,
      y: 160,
      width: 400,
      height: 560,
      collapsed: false,
      pinned: false,
    });
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
  return (
    <section className={`ui-docked-panel ${className}`} data-ui-resident-root={key}>
      <button
        className="detach-panel"
        title={`Float ${title}`}
        aria-label={`Undock ${id} panel`}
        data-ui-drag={key}
        draggable
        onDragStart={(e) => startResidentDrag(e, key)}
        onClick={() => float(true)}
      >
        ↗
      </button>
      {children}
      <DockArea container={key} contour={false} />
    </section>
  );
}
export function FrameShape({ cells, size }: { cells: { x: number; y: number }[]; size: number }) {
  const occupied = new Set(cells.map((c) => `${c.x}:${c.y}`));
  return (
    <svg
      className="frame-shape"
      aria-hidden="true"
      width={(Math.max(0, ...cells.map((c) => c.x)) + 1) * size}
      height={(Math.max(0, ...cells.map((c) => c.y)) + 1) * size}
    >
      {cells.map((c) => {
        const x = c.x * size,
          y = c.y * size;
        return (
          <g key={`${c.x}:${c.y}`}>
            <rect x={x} y={y} width={size} height={size} fill="#e9f1fbf2" />
            {!occupied.has(`${c.x}:${c.y - 1}`) && <path d={`M${x},${y + 1}H${x + size}`} />}
            {!occupied.has(`${c.x}:${c.y + 1}`) && <path d={`M${x},${y + size - 1}H${x + size}`} />}
            {!occupied.has(`${c.x - 1}:${c.y}`) && <path d={`M${x + 1},${y}V${y + size}`} />}
            {!occupied.has(`${c.x + 1}:${c.y}`) && <path d={`M${x + size - 1},${y}V${y + size}`} />}
          </g>
        );
      })}
    </svg>
  );
}
function FunctionFrame({ frame }: { frame: UIFrame }) {
  const ui = useUI(),
    key = `frame:${frame.id}`,
    nested = !!ownerOf(ui.layout, key),
    width = Math.max(160, Math.min(frame.width ?? 280, window.innerWidth - 24));
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
              x: Math.max(8, Math.min(frame.x, window.innerWidth - width - 8)),
              y: Math.max(8, Math.min(frame.y, window.innerHeight - 60)),
            }
      }
      size={{ width, height: "auto" }}
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
      minWidth={160}
      maxWidth={window.innerWidth - 24}
      onResizeStop={(_, __, element) => patch({ width: element.offsetWidth })}
    >
      <div className="ui-frame-root" data-ui-resident-root={key}>
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
};
type DragState = {
  key: string;
  width: number;
  height: number;
  dx: number;
  dy: number;
  slots: Map<string, { key: string; r: Rect }[]>;
  cancelled?: boolean;
  control?: { owner: string; control: string };
};
export function UIWorkspace({
  layout,
  update,
  functions,
  children,
}: {
  layout: UILayout;
  update: (change: (layout: UILayout) => UILayout) => void;
  functions: UIFunction[];
  children: ReactNode;
}) {
  const libraryOpen = layout.panels["@library"] ?? false;
  const setLibraryOpen = (value: boolean) =>
    update((s) => ({ ...s, panels: { ...s.panels, "@library": value } }));
  const [query, setQuery] = useState(""),
    [configured, configure] = useState<string | null>(null),
    [configuredFrame, configureFrame] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null),
    previewRef = useRef(preview);
  previewRef.current = preview;
  const [menu, setMenu] = useState<{ x: number; y: number; owner?: string } | null>(null);
  const defaults = useRef(new Map<string, WindowState>()).current;
  const current = useRef({ layout, update, functions });
  current.current = { layout, update, functions };
  const drag = useRef<DragState | null>(null);
  const frameMenu = (owner: string, x: number, y: number) => setMenu({ owner, x, y });
  const createFrame = (x: number, y: number) =>
    update((s) => ({
      ...s,
      frames: [
        ...s.frames,
        {
          id: crypto.randomUUID(),
          name: "New frame",
          x: Math.max(8, Math.round(x / 8) * 8),
          y: Math.max(8, Math.round(y / 8) * 8),
          cellSize: 96,
          width: 280,
          collapsed: false,
          pinned: false,
          members: [],
        },
      ],
    }));
  const ensure = (s: UILayout) => ({
    ...s,
    windows: { ...Object.fromEntries(defaults), ...s.windows },
  });
  useEffect(() => {
    const show = (value: Preview | null) => {
      previewRef.current = value;
      setPreview((old) => (JSON.stringify(old) === JSON.stringify(value) ? old : value));
    };
    const start = (event: MouseEvent) => {
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
      const root =
        mini ??
        (fn && key.startsWith("function:")
          ? fn
          : (handle?.closest<HTMLElement>("[data-ui-resident-root]") ?? handle));
      const r = root?.getBoundingClientRect();
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
      drag.current = {
        key,
        width: r.width,
        height: r.height,
        dx: event.clientX - r.x,
        dy: event.clientY - r.y,
        slots,
        control: mini
          ? { owner: mini.dataset.uiControlOwner!, control: mini.dataset.uiControl! }
          : undefined,
      };
    };
    const resolve = (x: number, y: number): Preview | null => {
      const source = drag.current;
      if (!source || source.cancelled) return null;
      const s = ensure(current.current.layout);
      if (source.control) {
        const element = [...document.querySelectorAll<HTMLElement>("[data-ui-chrome]")].find(
          (e) => e.dataset.uiChrome === source.control!.owner,
        );
        if (!element) return null;
        const r = element.getBoundingClientRect(),
          px = Math.round((x - source.dx - r.x) / 4) * 4,
          py = Math.round((y - source.dy - r.y) / 4) * 4;
        if (Math.abs(px) > 1000 || Math.abs(py) > 1000 || residentPinned(s, source.control.owner))
          return { text: "Unpin this frame before rearranging its controls" };
        return {
          text: "Move this frame control",
          control: { ...source.control, x: px, y: py },
          rect: { x: r.x + px, y: r.y + py, width: source.width, height: source.height },
        };
      }
      if (residentPinned(s, source.key)) return { text: "Unpin to rearrange" };
      const elements = document.elementsFromPoint(x, y);
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
      if (!zone)
        zone = [...document.querySelectorAll<HTMLElement>("[data-ui-drop-zone]")]
          .filter((e) => e.getClientRects().length && canDock(s, source.key, e.dataset.uiDropZone!))
          .map((e) => ({ e, distance: rectDistance(x, y, e.getBoundingClientRect()) }))
          .filter((p) => p.distance <= DOCK_DISTANCE)
          .sort(
            (a, b) =>
              a.distance - b.distance ||
              a.e.getBoundingClientRect().width * a.e.getBoundingClientRect().height -
                b.e.getBoundingClientRect().width * b.e.getBoundingClientRect().height,
          )[0]?.e;
      if (zone) {
        const target = zone.dataset.uiDropZone!,
          c = getContainer(s, target)!,
          members = c.members ?? [];
        const slots = (source.slots.get(target) ?? []).filter((slot) => slot.key !== source.key);
        const nearest = slots
          .map((slot) => ({ ...slot, distance: rectDistance(x, y, slot.r) }))
          .sort((a, b) => a.distance - b.distance)[0];
        let index = members.length,
          breakBefore = false,
          magnetic = false,
          sameCategory = false;
        if (nearest) {
          const memberIndex = members.findIndex((m) => residentKey(m) === nearest.key);
          const tall =
              nearest.r.height > 100 &&
              x > nearest.r.x + nearest.r.width * 0.25 &&
              x < nearest.r.x + nearest.r.width * 0.75,
            after = tall
              ? y > nearest.r.y + nearest.r.height / 2
              : x > nearest.r.x + nearest.r.width / 2;
          breakBefore = y > nearest.r.y + nearest.r.height + 6;
          index = memberIndex + (after || breakBefore ? 1 : 0);
          const from = current.current.functions.find(
            (f) => `function:${f.id}` === source.key,
          )?.category;
          const to = current.current.functions.find(
            (f) => `function:${f.id}` === nearest.key,
          )?.category;
          sameCategory = !!from && from === to;
          magnetic = magnetActive(x, y, nearest.r, sameCategory, c.magnetic !== false);
        }
        return {
          text: magnetic ? "Magnetic snap" : "Insert here",
          dock: {
            key: source.key,
            target,
            index,
            breakBefore: magnetic ? false : breakBefore,
            width: Math.min(source.width, Math.max(120, zone.clientWidth - 24)),
            height: source.height,
            magnetic,
          },
        };
      }
      // A collapsed frame can accept a resident through its attached handle.
      const tab = elements
        .map((e) => e.closest<HTMLElement>("[data-ui-chrome]"))
        .find((e) => e && canDock(s, source.key, e.dataset.uiChrome!));
      if (tab) {
        const target = tab.dataset.uiChrome!,
          r = tab.getBoundingClientRect();
        return {
          text: "Insert into collapsed frame",
          dock: {
            key: source.key,
            target,
            index: getContainer(s, target)?.members?.length ?? 0,
            breakBefore: false,
            width: source.width,
            height: source.height,
          },
          rect: r,
        };
      }
      let other = elements
        .map((e) => e.closest<HTMLElement>("[data-ui-function]:not([data-ui-palette])"))
        .find((e) => e && `function:${e.dataset.uiFunction}` !== source.key);
      if (!other) {
        const category = current.current.functions.find(
          (f) => `function:${f.id}` === source.key,
        )?.category;
        other = [
          ...document.querySelectorAll<HTMLElement>("[data-ui-function]:not([data-ui-palette])"),
        ]
          .filter(
            (e) =>
              e.getClientRects().length &&
              `function:${e.dataset.uiFunction}` !== source.key &&
              !ownerOf(s, `function:${e.dataset.uiFunction}`) &&
              !!category &&
              current.current.functions.find((f) => f.id === e.dataset.uiFunction)?.category ===
                category,
          )
          .map((e) => ({ e, distance: rectDistance(x, y, e.getBoundingClientRect()) }))
          .filter((p) => p.distance <= MAGNET_DISTANCE)
          .sort((a, b) => a.distance - b.distance)[0]?.e;
      }
      if (
        other &&
        !ownerOf(s, `function:${other.dataset.uiFunction}`) &&
        !residentPinned(s, `function:${other.dataset.uiFunction}`)
      )
        return {
          text: "Group into a collapsed frame",
          group: `function:${other.dataset.uiFunction}`,
          rect: other.getBoundingClientRect(),
        };
      return {
        text: "Place here",
        rect: {
          x: Math.max(
            8,
            Math.min(
              window.innerWidth - Math.min(source.width, window.innerWidth - 16),
              Math.round((x - source.dx) / 8) * 8,
            ),
          ),
          y: Math.max(8, Math.min(window.innerHeight - 44, Math.round((y - source.dy) / 8) * 8)),
          width: source.width,
          height: source.height,
        },
      };
    };
    const over = (e: globalThis.DragEvent) => {
      if (!drag.current || drag.current.cancelled) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
      show(resolve(e.clientX, e.clientY));
    };
    const drop = (e: MouseEvent) => {
      const source = drag.current;
      if (!source || source.cancelled) return;
      e.preventDefault();
      e.stopPropagation();
      const p = resolve(e.clientX, e.clientY);
      show(null);
      drag.current = null;
      if (!p) return;
      current.current.update((previous) => {
        let s = ensure(previous);
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
        if (p.dock)
          return dockResident(s, source.key, p.dock.target, p.dock.index, p.dock.breakBefore);
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
          const next = floatResident(s, source.key, p.rect.x, p.rect.y);
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
      drag.current = null;
      show(null);
    };
    const keydown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && drag.current) {
        e.preventDefault();
        e.stopImmediatePropagation();
        drag.current.cancelled = true;
        show(null);
      }
    };
    window.addEventListener("dragstart", start, true);
    window.addEventListener("dragover", over, true);
    window.addEventListener("drop", drop, true);
    window.addEventListener("dragend", end);
    window.addEventListener("keydown", keydown, true);
    return () => {
      window.removeEventListener("dragstart", start, true);
      window.removeEventListener("dragover", over, true);
      window.removeEventListener("drop", drop, true);
      window.removeEventListener("dragend", end);
      window.removeEventListener("keydown", keydown, true);
    };
  }, []);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenu(null);
        configure(null);
        configureFrame(null);
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  const selected = functions.find((f) => f.id === configured),
    item = configured ? layout.items[configured] : undefined;
  const selectedContainer = configuredFrame
    ? getContainer(ensure(layout), configuredFrame)
    : undefined;
  const style = configuredFrame
    ? (selectedContainer?.chrome?.style ?? defaultStyle)
    : (item?.style ?? defaultStyle);
  const setStyle = (patch: Partial<FunctionStyle>, asset?: VisualAsset) =>
    update((previous) => {
      const s = asset ? { ...previous, assets: [...previous.assets, asset] } : previous;
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
        configure: (id) => {
          configureFrame(null);
          configure(id);
        },
        createFrame,
        library: () => setLibraryOpen(true),
        frameMenu,
        preview: preview?.dock ?? null,
        defaults,
        renderResident,
      }}
    >
      {children}
      <div
        className="ui-workspace-overlay"
        onContextMenu={(e) => {
          e.preventDefault();
          setMenu({ x: e.clientX, y: e.clientY });
        }}
      >
        {Object.entries(layout.items)
          .filter(([id, i]) => !i.home && !ownerOf(layout, `function:${id}`))
          .map(([id, placement]) => (
            <div
              className="ui-free-function"
              key={id}
              style={{
                left: Math.max(8, Math.min(placement.x, window.innerWidth - 100)),
                top: Math.max(8, Math.min(placement.y, window.innerHeight - 90)),
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
      {menu && (
        <div
          className="ui-background-menu"
          role="menu"
          aria-label="UI frame settings"
          style={{
            left: Math.min(menu.x, window.innerWidth - 250),
            top: Math.min(menu.y, window.innerHeight - 230),
          }}
        >
          {menu.owner && menuContainer && (
            <>
              <button
                role="menuitemcheckbox"
                aria-checked={menuContainer.magnetic !== false}
                onClick={() => {
                  const key = menu.owner!;
                  update((s) =>
                    updateContainer(ensure(s), key, { magnetic: menuContainer.magnetic === false }),
                  );
                  setMenu(null);
                }}
              >
                Category magnetism: {menuContainer.magnetic === false ? "Off" : "On"}
              </button>
              <button
                onClick={() => {
                  configure(null);
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
            Functions
          </button>
          <button onClick={() => setMenu(null)}>Close</button>
        </div>
      )}
      {libraryOpen && (
        <FloatingWindow
          id="function-library"
          title="Functions & UI frames"
          width={430}
          height={580}
          onClose={() => setLibraryOpen(false)}
        >
          <p>
            Drag functions, field grips and frame handles to arrange them. Drop between residents to
            insert. Nearby category magnetism releases outside its range; right-click the frame to
            toggle it. Esc cancels. Shift+MB4/MB5 undo and redo the UI.
          </p>
          <button onClick={() => createFrame(120, 180)}>Create UI frame</button>
          <input
            aria-label="Find UI function"
            placeholder="Find a function…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="function-library">
            {functions
              .filter((f) => f.label.toLowerCase().includes(query.toLowerCase()))
              .map((fn) => (
                <FunctionElement key={fn.id} fn={fn} palette />
              ))}
          </div>
          <button
            onClick={() => {
              if (window.confirm("Reset only the UI arrangement? Your graph will be preserved."))
                update(() => emptyUILayout());
            }}
          >
            Reset UI arrangement
          </button>
        </FloatingWindow>
      )}
      {(selected || selectedContainer) && (
        <FloatingWindow
          id="function-appearance"
          className="function-appearance"
          title={configuredFrame ? "Arrange frame handle" : `Arrange: ${selected!.label}`}
          width={370}
          height={580}
          onClose={() => {
            configure(null);
            configureFrame(null);
          }}
        >
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
              onChange={(e) => setStyle({ geometry: e.target.value as FunctionStyle["geometry"] })}
            >
              <option value="circle">Circle (O)</option>
              <option value="square">Square</option>
              <option value="triangle">Triangle</option>
            </select>
          </label>
          <VisualControls
            key={configuredFrame ?? configured}
            label={configuredFrame ? "Frame handle" : "Function"}
            allowModels={false}
            iconColor="#254e73"
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
    </UIContext.Provider>
  );
}
export function UIArrangeButtons() {
  return (
    <>
      <FunctionControl id="ui:arrange" />
      <FunctionControl id="ui:createFrame" />
    </>
  );
}
