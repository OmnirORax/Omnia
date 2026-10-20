import type { Cell, UIArrangement, UIResident, UISize } from "./layout.ts";
export type PositionedBox = Cell & UISize;
/** Floating content may leave the screen; keep a usable part of its handle reachable. */
export function keepFloatingHandleVisible(rect: PositionedBox, area: PositionedBox, handle: Cell = { x: 0, y: 0 }): PositionedBox {
  const width = Math.min(64, rect.width, area.width), height = Math.min(32, rect.height, area.height);
  return { ...rect,
    x: Math.max(area.x-handle.x, Math.min(rect.x, area.x+area.width-handle.x-width)),
    y: Math.max(area.y-handle.y, Math.min(rect.y, area.y+area.height-handle.y-height)),
  };
}
/** Whole-cell occupied volumes: a wide field reserves several cells. */
function cellBox(box: PositionedBox, grid: NonNullable<UIArrangement["grid"]>) {
  const x = Math.floor((box.x - grid.origin.x) / grid.pitch.x + 1e-7),
    y = Math.floor((box.y - grid.origin.y) / grid.pitch.y + 1e-7);
  return {
    x,
    y,
    right: Math.ceil((box.x + box.width + 10 - grid.origin.x) / grid.pitch.x - 1e-7),
    bottom: Math.ceil((box.y + box.height + 10 - grid.origin.y) / grid.pitch.y - 1e-7),
  };
}
export function snapPosition(
  desired: Cell,
  size: UISize,
  grid: NonNullable<UIArrangement["grid"]>,
  occupied: PositionedBox[],
): Cell {
  const cx = Math.round((desired.x - grid.origin.x) / grid.pitch.x),
    cy = Math.round((desired.y - grid.origin.y) / grid.pitch.y);
  const obstacles = occupied.map((r) => cellBox(r, grid));
  const fits = (x: number, y: number) => {
    const b = cellBox(
      { x: grid.origin.x + x * grid.pitch.x, y: grid.origin.y + y * grid.pitch.y, ...size },
      grid,
    );
    return obstacles.every(
      (o) => b.x >= o.right || b.right <= o.x || b.y >= o.bottom || b.bottom <= o.y,
    );
  };
  let best: Cell | undefined;
  const distance = (p: Cell) => Math.hypot(p.x - desired.x, p.y - desired.y);
  for (let radius = 0; radius < 200; radius++) {
    const candidates: Cell[] = [];
    for (let dy = -radius; dy <= radius; dy++)
      for (let dx = -radius; dx <= radius; dx++)
        if (Math.max(Math.abs(dx), Math.abs(dy)) === radius && fits(cx + dx, cy + dy))
          candidates.push({
            x: grid.origin.x + (cx + dx) * grid.pitch.x,
            y: grid.origin.y + (cy + dy) * grid.pitch.y,
          });
    if (best) candidates.push(best);
    best = candidates.sort((a, b) => distance(a) - distance(b) || a.y - b.y || a.x - b.x)[0];
    if (best && distance(best) < (radius + 0.5) * Math.min(grid.pitch.x, grid.pitch.y)) return best;
  }
  if (best) return best;
  throw new Error("No available snap cell near this anchor.");
}
export function snapshotPositions(
  members: UIResident[],
  boxes: Map<string, PositionedBox>,
  keyOf: (m: UIResident) => string,
): UIResident[] {
  return members.map((m) => {
    const b = boxes.get(keyOf(m));
    return b
      ? { ...m, position: { x: b.x, y: b.y }, size: { width: b.width, height: b.height } }
      : m;
  });
}
