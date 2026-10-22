import {
  canDock,
  dockResident,
  releaseResident,
  floatResident,
  getContainer,
  residentContextScope,
  residentKey,
  residentPinned,
  updateContainer,
  validateUILayout,
  type UILayout,
  type UIResident,
} from "./layout.ts";
import type { PositionedBox } from "./positioning.ts";
export type ButtonBox = PositionedBox & { id: string };
/** Existing function IDs stay compatible; complete frame/window keys retain their identity. */
export const selectionResident = (id: string) => /^(frame|window):/.test(id) ? id : `function:${id}`;
export const selectionId = (key: string) => key.startsWith("function:") ? key.slice(9) : key;
/** Visual reading order, tolerating small vertical offsets in a row. */
export function readingOrder(boxes: ButtonBox[]): ButtonBox[] {
  const rows: { y: number; height: number; boxes: ButtonBox[] }[] = [];
  for (const box of [...boxes].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const row = rows.find(row => Math.abs(box.y - row.y) <= Math.min(12, row.height / 2, box.height / 2));
    if (row) row.boxes.push(box);
    else rows.push({ y: box.y, height: box.height, boxes: [box] });
  }
  return rows.flatMap(row => row.boxes.sort((a, b) => a.x - b.x));
}
/** Inclusive forward or reverse range in the same order used for alignment. */
export function buttonRange(boxes: ButtonBox[], anchor: string, target: string): string[] {
  const ordered = readingOrder(boxes).map(box => box.id);
  const first = ordered.indexOf(anchor), last = ordered.indexOf(target);
  if (first < 0 || last < 0) return [];
  return ordered.slice(Math.min(first, last), Math.max(first, last) + 1);
}
export type AlignmentEdge = "left" | "centerX" | "right" | "top" | "centerY" | "bottom";
export type AlignmentOperation = AlignmentEdge | "distributeX" | "distributeY";
export type AlignmentReference = "selection" | "window";
/** Match edges or centers; leave sizes and the other axis untouched. */
export function alignButtons(boxes: ButtonBox[], target: PositionedBox, edge: AlignmentEdge): ButtonBox[] {
  return boxes.map(b => ({
    ...b,
    ...(edge === "left" ? { x: target.x }
      : edge === "centerX" ? { x: target.x + (target.width - b.width) / 2 }
      : edge === "right" ? { x: target.x + target.width - b.width }
      : edge === "top" ? { y: target.y }
      : edge === "centerY" ? { y: target.y + (target.height - b.height) / 2 }
      : { y: target.y + target.height - b.height }),
  }));
}
export type AlignmentSpace = {
  area: PositionedBox;
  obstacles?: Record<string, PositionedBox[]>;
  bounds?: Record<string, PositionedBox>;
  gap?: number;
};
const alignmentNoRoom = "Not enough clear space to align without overlap. Move the selection to a larger area or select fewer items.";
/** Align first, then separate colliding items along the other axis in reading order.
 * No item is resized, no unselected control moves, and failure never returns a partial layout. */
export function arrangeButtons(boxes: ButtonBox[], target: PositionedBox, operation: AlignmentOperation, space: AlignmentSpace): ButtonBox[] {
  const { area, obstacles = {}, bounds: limits = {}, gap = 6 } = space;
  const inside = (box: ButtonBox) => [area, limits[box.id]].filter(Boolean).every(limit =>
    box.x >= limit.x - .01 && box.y >= limit.y - .01 &&
    box.x + box.width <= limit.x + limit.width + .01 && box.y + box.height <= limit.y + limit.height + .01);
  const clear = (box: ButtonBox) => !(obstacles[box.id] ?? []).some(other => intersects(box, other, gap));
  const valid = (placed: ButtonBox[]) => placed.every((box, i) => inside(box) && clear(box) &&
    !placed.slice(i + 1).some(other => intersects(box, other, gap)));
  if (operation === "distributeX" || operation === "distributeY") {
    if (boxes.length < 3) throw new Error("Select at least three UI items to distribute.");
    const axis = operation === "distributeX" ? "x" : "y", size = axis === "x" ? "width" : "height", cross = axis === "x" ? "y" : "x";
    const ordered = [...boxes].sort((a, b) => a[axis] - b[axis] || a[cross] - b[cross]);
    const occupied = ordered.reduce((sum, box) => sum + box[size], 0);
    const extent = Math.max(target[size], occupied + gap * (ordered.length - 1));
    if (extent > area[size] + .01) throw new Error(alignmentNoRoom);
    const spacing = (extent - occupied) / (ordered.length - 1);
    let offset = 0;
    const offsets = ordered.map(box => { const current = offset; offset += box[size] + spacing; return current; });
    const low = Math.max(area[axis], ...ordered.map((box, i) => (limits[box.id]?.[axis] ?? area[axis]) - offsets[i]));
    const high = Math.min(area[axis] + area[size] - extent, ...ordered.map((box, i) => {
      const limit = limits[box.id] ?? area;
      return limit[axis] + limit[size] - box[size] - offsets[i];
    }));
    if (low > high + .01) throw new Error(alignmentNoRoom);
    const preferred = Math.max(low, Math.min(target[axis] + (target[size] - extent) / 2, high));
    const starts = [...new Set([preferred, low, high, ...ordered.flatMap((box, i) => (obstacles[box.id] ?? []).flatMap(other =>
      [other[axis] + other[size] + gap - offsets[i], other[axis] - box[size] - gap - offsets[i]]))])];
    let best: ButtonBox[] | undefined, cost = Infinity;
    for (const start of starts) {
      if (start < low - .01 || start > high + .01) continue;
      const placed = new Map(ordered.map((box, i) => [box.id, { ...box, [axis]: start + offsets[i] }]));
      const result = boxes.map(box => placed.get(box.id)!);
      if (!valid(result)) continue;
      const movement = Math.abs(start - preferred);
      if (movement < cost) { best = result; cost = movement; }
    }
    if (!best) throw new Error(alignmentNoRoom);
    return best;
  }
  const aligned = alignButtons(boxes, target, operation);
  if (valid(aligned)) return aligned;
  const axis = ["left", "centerX", "right"].includes(operation) ? "y" : "x", size = axis === "x" ? "width" : "height";
  const ordered = readingOrder(boxes).map(box => aligned.find(item => item.id === box.id)!);
  const extent = ordered.reduce((sum, box) => sum + box[size], 0) + gap * Math.max(0, ordered.length - 1);
  if (extent > area[size] + .01) throw new Error(alignmentNoRoom);
  const bounds = buttonBounds(boxes);
  const centered = Math.max(area[axis], Math.min(bounds[axis] + (bounds[size] - extent) / 2, area[axis] + area[size] - extent));
  const starts = [...new Set([bounds[axis], centered, area[axis], area[axis] + area[size] - extent,
    ...Object.values(space.bounds ?? {}).map(box => box[axis]),
    ...Object.values(obstacles).flat().map(box => box[axis] + box[size] + gap)])];
  let best: ButtonBox[] | undefined, cost = Infinity;
  for (const preserve of [true, false]) for (const start of starts) {
    const placed: ButtonBox[] = [];
    let cursor = Math.max(area[axis], start);
    for (const box of ordered) {
      const next = { ...box, [axis]: Math.max(cursor, space.bounds?.[box.id]?.[axis] ?? area[axis], preserve ? box[axis] : cursor) };
      const blocked = [...(obstacles[box.id] ?? []), ...placed];
      for (let attempt = 0; attempt <= blocked.length; attempt++) {
        const collisions = blocked.filter(other => intersects(next, other, gap));
        if (!collisions.length) break;
        next[axis] = Math.max(...collisions.map(other => other[axis] + other[size] + gap));
      }
      if (!inside(next) || !clear(next) || placed.some(other => intersects(next, other, gap))) break;
      placed.push(next);
      cursor = next[axis] + next[size] + gap;
    }
    if (placed.length !== boxes.length) continue;
    const movement = placed.reduce((sum, box) => sum + Math.abs(box[axis] - boxes.find(original => original.id === box.id)![axis]), 0);
    if (movement < cost) { best = placed; cost = movement; }
  }
  if (!best) throw new Error(alignmentNoRoom);
  return boxes.map(box => best!.find(item => item.id === box.id)!);
}
export const intersects = (a: PositionedBox, b: PositionedBox, gap = 0) =>
  a.x < b.x + b.width + gap - 0.01 &&
  a.x + a.width + gap > b.x + 0.01 &&
  a.y < b.y + b.height + gap - 0.01 &&
  a.y + a.height + gap > b.y + 0.01;
export function buttonBounds(boxes: PositionedBox[]): PositionedBox {
  const x = Math.min(...boxes.map((b) => b.x)),
    y = Math.min(...boxes.map((b) => b.y));
  return {
    x,
    y,
    width: Math.max(...boxes.map((b) => b.x + b.width)) - x,
    height: Math.max(...boxes.map((b) => b.y + b.height)) - y,
  };
}
/** A whole selection changes ownership/coordinates in one validated UI-history entry. */
export function placeButtons(
  layout: UILayout,
  boxes: ButtonBox[],
  target?: string,
  baseline?: UIResident[],
  index?: number,
): UILayout {
  if (new Set(boxes.map((b) => b.id)).size !== boxes.length)
    throw new Error("Duplicate selected UI function.");
  for (const b of boxes) {
    if (residentPinned(layout, selectionResident(b.id)))
      throw new Error("Unpin the selected buttons and their frames first.");
    if (target ? !canDock(layout, selectionResident(b.id), target) : residentContextScope(layout, selectionResident(b.id)))
      throw new Error("These actions must stay in their owning menu.");
  }
  if (target && getContainer(layout, target)?.layoutMode === "stacked") {
    let next = boxes.reduce((layout, box) => releaseResident(layout, selectionResident(box.id)), layout);
    let at = index ?? getContainer(next, target)?.members?.length ?? 0;
    for (const box of readingOrder(boxes)) next = dockResident(next, selectionResident(box.id), target, at++);
    return validateUILayout(next);
  }
  let next = target && baseline ? updateContainer(layout, target, { members: baseline }) : layout;
  for (const b of boxes) {
    if (target)
      next = dockResident(
        next,
        selectionResident(b.id),
        target,
        getContainer(next, target)?.members?.length ?? 0,
      );
    else {
      const key = selectionResident(b.id);
      next = floatResident(next, key, b.x, b.y);
      if (!key.startsWith("function:")) continue;
      next = {
        ...next,
        items: {
          ...next.items,
          [b.id]: { ...next.items[b.id], size: { width: b.width, height: b.height } },
        },
      };
    }
  }
  if (target)
    next = updateContainer(next, target, {
      members: getContainer(next, target)!.members!.map((m) => {
        const b = boxes.find(b => selectionResident(b.id) === residentKey(m));
        return b
          ? { ...m, position: { x: b.x, y: b.y }, size: { width: b.width, height: b.height } }
          : m;
      }),
    });
  return validateUILayout(next);
}
/** Deterministic 2D packing with a small gap. Existing unselected UI is an obstacle,
 * never pushed aside. Button dimensions and identities are preserved. */
export function compactButtons(
  boxes: ButtonBox[],
  obstacles: PositionedBox[],
  area: PositionedBox,
  gap = 6,
): ButtonBox[] {
  if (boxes.length < 2) return boxes;
  const original = buttonBounds(boxes),
    width = Math.min(
      area.width,
      Math.max(
        ...boxes.map((b) => b.width),
        Math.sqrt(boxes.reduce((sum, b) => sum + (b.width + gap) * (b.height + gap), 0)) * 1.3,
      ),
    );
  const estimatedHeight =
    boxes.reduce((sum, b) => sum + (b.width + gap) * (b.height + gap), 0) / width +
    Math.max(...boxes.map((b) => b.height));
  const anchor = {
    x: Math.max(area.x, Math.min(original.x, area.x + area.width - width)),
    y: Math.max(area.y, Math.min(original.y, area.y + area.height - estimatedHeight)),
  };
  const placed: ButtonBox[] = [];
  // Tall items first avoids leaving a large gap below a row of mixed-size controls.
  const ordered = boxes
    .map((b, index) => ({ ...b, index }))
    .sort((a, b) => b.height - a.height || a.y - b.y || a.x - b.x || a.index - b.index);
  for (const { index: _index, ...box } of ordered) {
    const occupied = [...obstacles, ...placed];
    const candidates = [
      { x: anchor.x, y: anchor.y },
      ...occupied.flatMap((b) => [
        { x: b.x + b.width + gap, y: b.y },
        { x: b.x, y: b.y + b.height + gap },
        { x: anchor.x, y: b.y + b.height + gap },
      ]),
    ].filter(
      (p) =>
        p.x >= area.x &&
        p.y >= area.y &&
        p.x + box.width <= area.x + area.width + 0.01 &&
        p.y + box.height <= area.y + area.height + 0.01,
    );
    const fits = candidates.filter(
      (p) => !occupied.some((b) => intersects({ ...box, ...p }, b, gap)),
    );
    fits.sort((a, b) => {
      const aa = buttonBounds([...placed, { ...box, ...a }]),
        bb = buttonBounds([...placed, { ...box, ...b }]);
      // Prefer the compact column width, then smallest enclosing area and reading order.
      return (
        Number(aa.width > width + 0.01) - Number(bb.width > width + 0.01) ||
        aa.width * aa.height - bb.width * bb.height ||
        a.y - b.y ||
        a.x - b.x
      );
    });
    if (!fits[0])
      throw new Error(
        "Not enough visible space to compact these buttons. Move the group to a larger area first.",
      );
    placed.push({ ...box, ...fits[0] });
  }
  return boxes.map((b) => placed.find((p) => p.id === b.id)!);
}
