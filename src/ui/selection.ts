import {
  canDock,
  dockResident,
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
/** Inclusive visual reading order, tolerating small vertical offsets in a row. */
export function buttonRange(boxes: ButtonBox[], anchor: string, target: string): string[] {
  const rows: { y: number; height: number; boxes: ButtonBox[] }[] = [];
  for (const box of [...boxes].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const row = rows.find(row => Math.abs(box.y - row.y) <= Math.min(12, row.height / 2, box.height / 2));
    if (row) row.boxes.push(box);
    else rows.push({ y: box.y, height: box.height, boxes: [box] });
  }
  const ordered = rows.flatMap(row => row.boxes.sort((a, b) => a.x - b.x).map(box => box.id));
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
/** Equal clear space, preserving reading order, dimensions and the other axis. */
export function arrangeButtons(boxes: ButtonBox[], target: PositionedBox, operation: AlignmentOperation): ButtonBox[] {
  if (operation !== "distributeX" && operation !== "distributeY") return alignButtons(boxes, target, operation);
  if (boxes.length < 3) throw new Error("Select at least three UI items to distribute.");
  const axis = operation === "distributeX" ? "x" : "y", size = axis === "x" ? "width" : "height";
  const ordered = [...boxes].sort((a, b) => a[axis] - b[axis]);
  const gap = (target[size] - ordered.reduce((sum, box) => sum + box[size], 0)) / (ordered.length - 1);
  let position = target[axis];
  const placed = new Map(ordered.map(box => {
    const next = { ...box, [axis]: position };
    position += box[size] + gap;
    return [box.id, next];
  }));
  return boxes.map(box => placed.get(box.id)!);
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
): UILayout {
  if (new Set(boxes.map((b) => b.id)).size !== boxes.length)
    throw new Error("Duplicate selected UI function.");
  for (const b of boxes) {
    if (residentPinned(layout, selectionResident(b.id)))
      throw new Error("Unpin the selected buttons and their frames first.");
    if (target ? !canDock(layout, selectionResident(b.id), target) : residentContextScope(layout, selectionResident(b.id)))
      throw new Error("These actions must stay in their owning menu.");
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
