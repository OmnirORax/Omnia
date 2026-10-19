import { useState } from "react";
import { Rnd } from "react-rnd";
import { useUI } from "./context";
import { nearestSlot, type Cell } from "./layout";
import { FrameShape } from "./UIWorkspace";
const MIME = "application/x-omnium-context-action";
/** Contents/target are supplied by the owner. Only presentation order and shape persist. */
export function EntityMenu<T extends string>({
  kind,
  x,
  y,
  items,
  onChoose,
  bounds,
}: {
  kind: string;
  x: number;
  y: number;
  items: [T, string][];
  onChoose: (id: T) => void;
  bounds: { width: number; height: number };
}) {
  const ui = useUI(),
    [arranging, setArranging] = useState(false);
  const positions: Record<string, Cell> = {};
  for (const [id] of items) {
    const saved = ui.layout.menus[kind]?.[id];
    if (saved) positions[id] = saved;
  }
  for (const [id] of items) {
    if (!positions[id])
      positions[id] = nearestSlot(Object.values(positions), {
        x: 0,
        y: items.findIndex(([a]) => a === id),
      });
  }
  const cells = Object.values(positions),
    minX = Math.min(...cells.map((c) => c.x)),
    minY = Math.min(...cells.map((c) => c.y));
  for (const id in positions)
    positions[id] = { x: positions[id].x - minX, y: positions[id].y - minY };
  const columns = Math.max(...Object.values(positions).map((c) => c.x)) + 1,
    rows = Math.max(...Object.values(positions).map((c) => c.y)) + 1;
  const geometry = ui.layout.windows[`menu:${kind}`],
    cw = Math.max(120, Math.min(240, geometry?.width ? geometry.width / columns : 200)),
    ch = Math.max(48, Math.min(100, geometry?.height ? (geometry.height - 36) / rows : 48));
  const neighbors = Object.values(positions)
    .flatMap((p) => [
      { x: p.x + 1, y: p.y },
      { x: p.x, y: p.y + 1 },
    ])
    .filter((p) => !Object.values(positions).some((c) => c.x === p.x && c.y === p.y));
  const width = Math.min(bounds.width - 16, columns * cw + (arranging ? cw : 0)),
    height = Math.min(bounds.height - 16, rows * ch + 36 + (arranging ? ch : 0));
  return (
    <Rnd
      className="entity-menu"
      position={{
        x: Math.max(0, Math.min(x, bounds.width - width - 8)),
        y: Math.max(0, Math.min(y, bounds.height - height - 8)),
      }}
      size={{ width, height }}
      disableDragging
      enableResizing={{ bottomRight: true }}
      minWidth={Math.min(180, window.innerWidth - 20)}
      minHeight={100}
      onResizeStop={(_, __, ref) =>
        ui.update((s) => ({
          ...s,
          windows: {
            ...s.windows,
            [`menu:${kind}`]: {
              x: 0,
              y: 0,
              width: ref.offsetWidth,
              height: ref.offsetHeight,
              collapsed: false,
              pinned: true,
            },
          },
        }))
      }
    >
      <div role="menu" aria-label={`${kind} actions`} className="entity-menu-content">
        <div className="entity-menu-header">
          <span>{kind} actions</span>
          <button
            aria-pressed={arranging}
            onClick={() => setArranging(!arranging)}
            title="Reorder these actions or drag them into neighboring slots. Actions cannot leave this menu."
          >
            Arrange menu
          </button>
        </div>
        <div
          className="entity-menu-grid"
          style={{
            width: columns * cw + (arranging ? cw : 0),
            height: rows * ch + (arranging ? ch : 0),
          }}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes(MIME)) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
          onDrop={(e) => {
            const entry = e.dataTransfer.getData(MIME).split(":");
            if (entry[0] !== kind || !items.some(([id]) => id === entry[1])) return;
            e.preventDefault();
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect(),
              desired = {
                x: Math.floor((e.clientX - rect.left) / cw),
                y: Math.floor((e.clientY - rect.top) / ch),
              };
            const next = {
              ...positions,
              [entry[1]]: nearestSlot(
                Object.entries(positions)
                  .filter(([id]) => id !== entry[1])
                  .map(([, p]) => p),
                desired,
              ),
            };
            const dx = Math.min(...Object.values(next).map((p) => p.x)),
              dy = Math.min(...Object.values(next).map((p) => p.y));
            for (const id in next) next[id] = { x: next[id].x - dx, y: next[id].y - dy };
            ui.update((s) => ({ ...s, menus: { ...s.menus, [kind]: next } }));
          }}
        >
          <div style={{ transform: `scale(1,${ch / cw})`, transformOrigin: "top left" }}>
            <FrameShape cells={Object.values(positions)} size={cw} />
          </div>
          {arranging &&
            neighbors.map((p) => (
              <div
                key={`${p.x}:${p.y}`}
                className="menu-empty-slot"
                style={{ left: p.x * cw, top: p.y * ch, width: cw, height: ch }}
              >
                Drop action
              </div>
            ))}
          {items.map(([id, label]) => (
            <button
              key={id}
              role="menuitem"
              draggable
              onDragStart={(e) => {
                e.stopPropagation();
                e.dataTransfer.setData(MIME, `${kind}:${id}`);
                e.dataTransfer.effectAllowed = "move";
              }}
              style={{
                left: positions[id].x * cw,
                top: positions[id].y * ch,
                width: cw,
                height: ch,
              }}
              onClick={() => onChoose(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </Rnd>
  );
}
