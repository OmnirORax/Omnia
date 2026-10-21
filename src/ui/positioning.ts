import type { Cell, UIResident, UISize } from "./layout.ts";
export type PositionedBox = Cell & UISize;
/** Floating content may leave the screen; keep a usable part of its handle reachable. */
export function keepFloatingHandleVisible(rect: PositionedBox, area: PositionedBox, handle: Cell = { x: 0, y: 0 }): PositionedBox {
  const width = Math.min(64, rect.width, area.width), height = Math.min(32, rect.height, area.height);
  return { ...rect,
    x: Math.max(area.x-handle.x, Math.min(rect.x, area.x+area.width-handle.x-width)),
    y: Math.max(area.y-handle.y, Math.min(rect.y, area.y+area.height-handle.y-height)),
  };
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
