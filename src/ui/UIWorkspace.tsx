import {
  cloneElement,
  useEffect,
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
  frameCells,
  groupFunctions,
  placeInFrame,
  detachFunction,
  functionPinned,
  type UILayout,
  type UIFrame,
  type FunctionStyle,
} from "./layout";
import { VisualControls } from "../VisualControls";
const MIME = "application/x-omnium-function";
const defaultStyle: FunctionStyle = { mode: "text", geometry: "circle" };
export function FunctionControl({ id, palette = false }: { id: string; palette?: boolean }) {
  const ui = useUI(),
    fn = ui.functions.find((f) => f.id === id),
    item = ui.layout.items[id];
  if (!fn || (!palette && item && !item.home)) return null;
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
    draggable: !item?.pinned && !ui.layout.frames.find((f) => f.id === item?.frameId)?.pinned,
    onDragStart: (e: DragEvent) => {
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
  const float = (value: boolean) =>
    ui.update((layout) => ({ ...layout, panels: { ...layout.panels, [id]: value } }));
  if (ui.layout.panels[id])
    return (
      <FloatingWindow
        id={`panel:${id}`}
        title={title}
        width={400}
        height={560}
        onClose={() => float(false)}
        closeLabel={`Dock ${title}`}
      >
        <section className={className}>{children}</section>
      </FloatingWindow>
    );
  return (
    <section className={`ui-docked-panel ${className}`}>
      <button
        className="detach-panel"
        title={`Float ${title}`}
        aria-label={`Undock ${id} panel`}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(MIME, `panel:${id}`);
        }}
        onClick={() => float(true)}
      >
        ↗
      </button>
      {children}
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
    members = Object.entries(ui.layout.items).filter(([, i]) => i.frameId === frame.id);
  const cells = frameCells(ui.layout, frame.id),
    occupied = cells.length ? cells : [{ x: 0, y: 0 }];
  const columns = Math.max(...occupied.map((c) => c.x)) + 1,
    rows = Math.max(...occupied.map((c) => c.y)) + 1;
  const frameWidth = Math.min(
      window.innerWidth - 16,
      frame.collapsed ? 240 : Math.max(240, columns * frame.cellSize),
    ),
    frameHeight = Math.min(
      window.innerHeight - 16,
      frame.collapsed ? 44 : rows * frame.cellSize + 44,
    );
  const change = (patch: Partial<UIFrame>) =>
    ui.update((layout) => ({
      ...layout,
      frames: layout.frames.map((f) => (f.id === frame.id ? { ...f, ...patch } : f)),
    }));
  return (
    <Rnd
      className={`function-frame ${frame.collapsed ? "collapsed" : ""}`}
      style={
        {
          zIndex: 70,
          pointerEvents: "none",
          "--ui-cell-size": `${frame.cellSize}px`,
        } as React.CSSProperties
      }
      position={{
        x: Math.max(0, Math.min(frame.x, window.innerWidth - frameWidth)),
        y: Math.max(0, Math.min(frame.y, window.innerHeight - frameHeight)),
      }}
      size={{ width: frameWidth, height: frameHeight }}
      disableDragging={frame.pinned}
      enableResizing={!frame.pinned && !frame.collapsed ? { bottomRight: true } : false}
      resizeHandleStyles={{ bottomRight: { pointerEvents: "auto" } }}
      minWidth={Math.min(window.innerWidth - 16, Math.max(240, columns * 48))}
      minHeight={frame.collapsed ? 44 : Math.min(window.innerHeight - 16, rows * 48 + 44)}
      dragHandleClassName="ui-frame-header"
      cancel="button,input"
      dragGrid={[8, 8]}
      onDragStop={(_, d) => change({ x: Math.max(0, d.x), y: Math.max(0, d.y) })}
      onResizeStop={(_, __, ref, delta) =>
        change({
          cellSize: Math.min(
            220,
            Math.max(
              48,
              Math.round(
                (Math.abs(delta.width / columns) >= Math.abs(delta.height / rows)
                  ? ref.offsetWidth / columns
                  : (ref.offsetHeight - 44) / rows) / 4,
              ) * 4,
            ),
          ),
        })
      }
    >
      <div
        className="ui-frame-header"
        data-ui-frame={frame.id}
        title={frame.pinned ? "Unpin to rearrange this frame" : "Drag frame header to move"}
      >
        <span className="ui-frame-grip" title="Drag UI frame">
          ⠿
        </span>
        <input
          aria-label="UI frame name"
          title={frame.name}
          value={frame.name}
          maxLength={200}
          onChange={(e) => change({ name: e.target.value })}
        />
        <button
          aria-label={`${frame.collapsed ? "Expand" : "Collapse"} UI frame ${frame.name}`}
          onClick={() => change({ collapsed: !frame.collapsed })}
        >
          {frame.collapsed ? "+" : "−"}
        </button>
        <button
          aria-label={`${frame.pinned ? "Unpin" : "Pin"} UI frame ${frame.name}`}
          onClick={() => change({ pinned: !frame.pinned })}
        >
          {frame.pinned ? "Unpin" : "Pin"}
        </button>
        <button
          aria-label={`Remove UI frame ${frame.name}`}
          disabled={frame.pinned}
          onClick={() => {
            if (
              members.length &&
              !window.confirm(
                "Remove this UI frame and return its functions to their default locations? Your graph will not change.",
              )
            )
              return;
            ui.update((s) => ({
              ...s,
              frames: s.frames.filter((f) => f.id !== frame.id),
              items: Object.fromEntries(
                Object.entries(s.items).filter(([, i]) => i.frameId !== frame.id),
              ),
            }));
          }}
        >
          ×
        </button>
      </div>
      {!frame.collapsed && (
        <div
          className="ui-frame-slots"
          data-ui-frame={frame.id}
          data-cell-size={frame.cellSize}
          style={{ width: columns * frame.cellSize, height: rows * frame.cellSize }}
        >
          <FrameShape cells={occupied} size={frame.cellSize} />
          {!members.length && (
            <div
              className="empty-ui-slot"
              style={{ width: frame.cellSize, height: frame.cellSize }}
            >
              Drop a function here
            </div>
          )}
          {members.map(([id, item]) => (
            <div
              key={id}
              className="ui-frame-cell"
              style={{
                left: item.cell!.x * frame.cellSize,
                top: item.cell!.y * frame.cellSize,
                width: frame.cellSize,
                height: frame.cellSize,
              }}
            >
              {ui.functions.find((f) => f.id === id) ? (
                <FunctionElement fn={ui.functions.find((f) => f.id === id)!} resident />
              ) : (
                <span>Unavailable function: {id}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </Rnd>
  );
}
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
    [configured, configure] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ x: number; y: number; text: string } | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const current = useRef({ layout, update });
  current.current = { layout, update };
  const createFrame = (x: number, y: number) =>
    update((s) => ({
      ...s,
      frames: [
        ...s.frames,
        {
          id: crypto.randomUUID(),
          name: "New frame",
          x: Math.max(0, Math.round(x / 8) * 8),
          y: Math.max(0, Math.round(y / 8) * 8),
          cellSize: 96,
          collapsed: false,
          pinned: false,
        },
      ],
    }));
  useEffect(() => {
    let draggingId = "";
    const start = (e: globalThis.DragEvent) => {
      draggingId =
        (e.target as Element)?.closest<HTMLElement>("[data-ui-function]")?.dataset.uiFunction ?? "";
    };
    const targetAt = (x: number, y: number) => {
      const target = document
        .elementsFromPoint(x, y)
        .find(
          (e) =>
            e.closest("[data-ui-frame]") ||
            (e.closest<HTMLElement>("[data-ui-function]")?.dataset.uiFunction !== draggingId &&
              e.closest<HTMLElement>("[data-ui-function]")?.dataset.uiPalette !== "true" &&
              e.closest("[data-ui-function]")),
        );
      if (!target) {
        const nearFrame = [
          ...document.querySelectorAll<HTMLElement>("[data-ui-frame].ui-frame-slots"),
        ]
          .map((e) => {
            const r = e.getBoundingClientRect();
            return {
              e,
              distance: Math.hypot(
                Math.max(r.left - x, 0, x - r.right),
                Math.max(r.top - y, 0, y - r.bottom),
              ),
            };
          })
          .filter((p) => p.distance < 24)
          .sort((a, b) => a.distance - b.distance)[0]?.e;
        if (nearFrame) return { frame: nearFrame, fn: undefined };
        const nearby = [
          ...document.querySelectorAll<HTMLElement>("[data-ui-function]:not([data-ui-palette])"),
        ]
          .filter((e) => e.dataset.uiFunction !== draggingId)
          .map((e) => {
            const r = e.getBoundingClientRect();
            return {
              e,
              distance: Math.hypot(
                Math.max(r.left - x, 0, x - r.right),
                Math.max(r.top - y, 0, y - r.bottom),
              ),
            };
          })
          .filter((p) => p.distance < 20)
          .sort((a, b) => a.distance - b.distance)[0]?.e;
        return { frame: nearby?.closest<HTMLElement>("[data-ui-frame]"), fn: nearby };
      }
      return {
        frame: target?.closest<HTMLElement>("[data-ui-frame]"),
        fn: target?.closest<HTMLElement>("[data-ui-function]"),
      };
    };
    const over = (e: globalThis.DragEvent) => {
      if (!e.dataTransfer?.types.includes(MIME)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const target = targetAt(e.clientX, e.clientY);
      setPreview({
        x: e.clientX + 12,
        y: e.clientY + 12,
        text: target.frame
          ? "Snap into frame"
          : target.fn
            ? "Group into a collapsed frame"
            : "Place function here",
      });
    };
    const drop = (e: globalThis.DragEvent) => {
      const id = e.dataTransfer?.getData(MIME);
      if (!id) return;
      e.preventDefault();
      e.stopPropagation();
      setPreview(null);
      const target = targetAt(e.clientX, e.clientY);
      current.current.update((s) => {
        if (s.items[id]?.pinned || s.frames.find((f) => f.id === s.items[id]?.frameId)?.pinned)
          return s;
        if (target.frame) {
          const rect = target.frame.getBoundingClientRect(),
            frame = s.frames.find((f) => f.id === target.frame!.dataset.uiFrame);
          if (!frame) return s;
          return placeInFrame(s, id, frame.id, {
            x: Math.round((e.clientX - rect.left) / frame.cellSize - 0.5),
            y: Math.round((e.clientY - rect.top) / frame.cellSize - 0.5),
          });
        }
        const other = target.fn?.dataset.uiFunction;
        if (other && other !== id) return groupFunctions(s, id, other, e.clientX, e.clientY);
        return detachFunction(
          s,
          id,
          Math.max(0, Math.round((e.clientX - 40) / 8) * 8),
          Math.max(0, Math.round((e.clientY - 24) / 8) * 8),
        );
      });
    };
    const end = () => setPreview(null);
    window.addEventListener("dragstart", start);
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    window.addEventListener("dragend", end);
    return () => {
      window.removeEventListener("dragstart", start);
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
      window.removeEventListener("dragend", end);
    };
  }, []);
  const selected = functions.find((f) => f.id === configured),
    item = configured ? layout.items[configured] : undefined,
    style = item?.style ?? defaultStyle;
  const setStyle = (patch: Partial<FunctionStyle>) =>
    configured &&
    update((s) => ({
      ...s,
      items: {
        ...s.items,
        [configured]: {
          ...s.items[configured],
          home: s.items[configured]?.home ?? !s.items[configured],
          x: s.items[configured]?.x ?? 24,
          y: s.items[configured]?.y ?? 180,
          style: { ...style, ...patch },
        },
      },
    }));
  return (
    <UIContext.Provider
      value={{
        layout,
        update,
        functions,
        configure,
        createFrame,
        library: () => setLibraryOpen(true),
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
          .filter(([, i]) => !i.frameId && !i.home)
          .map(([id, placement]) => (
            <div
              className="ui-free-function"
              key={id}
              style={{
                left: Math.max(0, Math.min(placement.x, window.innerWidth - 100)),
                top: Math.max(0, Math.min(placement.y, window.innerHeight - 90)),
              }}
            >
              {functions.find((f) => f.id === id) ? (
                <FunctionElement fn={functions.find((f) => f.id === id)!} resident />
              ) : (
                <span>Unavailable function: {id}</span>
              )}
            </div>
          ))}
        {layout.frames.map((f) => (
          <FunctionFrame frame={f} key={f.id} />
        ))}
      </div>
      {preview && (
        <div className="ui-snap-preview" style={{ left: preview.x, top: preview.y }}>
          {preview.text}
        </div>
      )}
      {menu && (
        <div
          className="ui-background-menu"
          style={{
            left: Math.min(menu.x, window.innerWidth - 200),
            top: Math.min(menu.y, window.innerHeight - 110),
          }}
        >
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
            Drag functions into the workspace or a frame. Drop one on another to create a collapsed,
            nameable frame. Right-click a function to choose text, icon, geometry, or pin it.
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
      {selected && (
        <FloatingWindow
          id="function-appearance"
          className="function-appearance"
          title={`Arrange: ${selected.label}`}
          width={370}
          height={580}
          onClose={() => configure(null)}
        >
          <label>
            Display
            <select
              aria-label="Function display"
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
              aria-label="Function geometry"
              value={style.geometry}
              onChange={(e) => setStyle({ geometry: e.target.value as FunctionStyle["geometry"] })}
            >
              <option value="circle">Circle (O)</option>
              <option value="square">Square</option>
              <option value="triangle">Triangle</option>
            </select>
          </label>
          <VisualControls
            key={configured}
            label="Function"
            allowModels={false}
            iconColor="#254e73"
            value={{ assetId: style.assetId, character: style.character, showText: false }}
            assets={layout.assets}
            onChange={(v) => setStyle({ mode: "icon", assetId: v.assetId, character: v.character })}
            onAsset={(asset, visual) =>
              update((s) => ({
                ...s,
                assets: [...s.assets, asset],
                items: {
                  ...s.items,
                  [selected.id]: {
                    ...s.items[selected.id],
                    home: s.items[selected.id]?.home ?? !s.items[selected.id],
                    x: s.items[selected.id]?.x ?? 24,
                    y: s.items[selected.id]?.y ?? 180,
                    style: {
                      ...style,
                      mode: "icon",
                      character: undefined,
                      assetId: visual.assetId,
                    },
                  },
                },
              }))
            }
          />
          <button
            onClick={() =>
              update((s) => ({
                ...s,
                items: {
                  ...s.items,
                  [selected.id]: {
                    ...s.items[selected.id],
                    home: s.items[selected.id]?.home ?? !s.items[selected.id],
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
