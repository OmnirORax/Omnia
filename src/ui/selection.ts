import {
  canDock,
  contextOwner,
  dockResident,
  floatResident,
  functionPinned,
  getContainer,
  updateContainer,
  validateUILayout,
  type UILayout,
  type UIResident,
} from "./layout.ts";
import type { PositionedBox } from "./positioning.ts";
export type ButtonBox = PositionedBox & { id: string };
export type AlignmentEdge = "left" | "right" | "top" | "bottom";
export function nearestButtonEdge(box: PositionedBox, x: number, y: number): AlignmentEdge {
  const distances: [AlignmentEdge, number][] = [
    ["left", Math.abs(x - box.x)],
    ["right", Math.abs(x - box.x - box.width)],
    ["top", Math.abs(y - box.y)],
    ["bottom", Math.abs(y - box.y - box.height)],
  ];
  distances.sort((a, b) => a[1] - b[1]);
  return distances[0][0];
}
/** Match the clicked target edge. The other coordinate and all sizes stay authored. */
export function alignButtons(boxes: ButtonBox[], target: PositionedBox, edge: AlignmentEdge): ButtonBox[] {
  return boxes.map(b => ({
    ...b,
    ...(edge === "left" ? { x: target.x }
      : edge === "right" ? { x: target.x + target.width - b.width }
      : edge === "top" ? { y: target.y }
      : { y: target.y + target.height - b.height }),
  }));
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
    if (functionPinned(layout, b.id))
      throw new Error("Unpin the selected buttons and their frames first.");
    if (target ? !canDock(layout, `function:${b.id}`, target) : contextOwner(`function:${b.id}`))
      throw new Error("These actions must stay in their owning menu.");
  }
  let next = target && baseline ? updateContainer(layout, target, { members: baseline }) : layout;
  for (const b of boxes) {
    if (target)
      next = dockResident(
        next,
        `function:${b.id}`,
        target,
        getContainer(next, target)?.members?.length ?? 0,
      );
    else {
      next = floatResident(next, `function:${b.id}`, b.x, b.y);
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
        const b = m.kind === "function" ? boxes.find((b) => b.id === m.id) : undefined;
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
