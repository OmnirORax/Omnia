import { residentKey, type UIResident, type UISize } from "./layout.ts";
import type { PositionedBox } from "./positioning.ts";

export type InsertSide = "left" | "right" | "top" | "bottom";
/** Open a slot by pushing only intersecting neighbors along the insertion axis. */
export function insertFrameBeside(members: UIResident[], boxes: Map<string, PositionedBox>, source: string, size: UISize, peer: string, side: InsertSide) {
  const horizontal = side === "left" || side === "right", axis = horizontal ? "x" : "y", extent = horizontal ? "width" : "height";
  const forward = side === "right" || side === "bottom", sign = forward ? 1 : -1, gap = 8;
  const anchor = boxes.get(peer)!;
  const position = { x: anchor.x, y: anchor.y };
  position[axis] = forward ? anchor[axis] + anchor[extent] + gap : anchor[axis] - size[extent] - gap;
  const placed = new Map([...boxes].filter(([key]) => key !== source).map(([key, box]) => [key, { ...box }]));
  const queue: PositionedBox[] = [{ ...position, ...size }];
  const overlaps = (a: PositionedBox, b: PositionedBox) => a.x < b.x + b.width + gap - 1e-6 && a.x + a.width + gap > b.x + 1e-6 && a.y < b.y + b.height + gap - 1e-6 && a.y + a.height + gap > b.y + 1e-6;
  for (let n = 0; n < queue.length && n < (placed.size + 1) ** 2; n++) {
    const obstacle = queue[n];
    for (const [key, box] of placed) {
      if (box === obstacle || !overlaps(box, obstacle)) continue;
      // Keep the chosen neighbor fixed; only the newly opened side shifts.
      if (key === peer) continue;
      const next = forward ? obstacle[axis] + obstacle[extent] + gap : obstacle[axis] - box[extent] - gap;
      if (sign * (next - box[axis]) <= 1e-6) continue;
      box[axis] = next; queue.push(box);
    }
  }
  return { position, baseline: members.map(member => { const box = placed.get(residentKey(member)); return box ? { ...member, position: { x: box.x, y: box.y }, size: { width: box.width, height: box.height } } : member; }) };
}
