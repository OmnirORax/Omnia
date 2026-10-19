import type { VisualAsset } from "../graph/assets.ts";
import { validateAsset } from "../graph/assets.ts";
export type Cell = { x: number; y: number };
export type WindowState = {
  x: number;
  y: number;
  width: number;
  height: number;
  collapsed: boolean;
  pinned: boolean;
};
export type FunctionStyle = {
  mode: "text" | "icon";
  geometry: "circle" | "square" | "triangle";
  character?: string;
  assetId?: string;
};
export type UIItem = {
  x: number;
  y: number;
  home?: boolean;
  frameId?: string;
  cell?: Cell;
  style?: FunctionStyle;
  pinned?: boolean;
};
export type UIFrame = {
  id: string;
  name: string;
  x: number;
  y: number;
  cellSize: number;
  collapsed: boolean;
  pinned: boolean;
};
export type UILayout = {
  version: 1;
  windows: Record<string, WindowState>;
  items: Record<string, UIItem>;
  frames: UIFrame[];
  menus: Record<string, Record<string, Cell>>;
  panels: Record<string, boolean>;
  assets: VisualAsset[];
};
export const UI_LAYOUT_KEY = "omnium.ui.layout.v1";
export const emptyUILayout = (): UILayout => ({
  version: 1,
  windows: {},
  items: {},
  frames: [],
  menus: {},
  panels: {},
  assets: [],
});
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const numeric = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= 100000;
const cell = (v: unknown): v is Cell =>
  record(v) &&
  Number.isInteger(v.x) &&
  Number.isInteger(v.y) &&
  Math.abs(v.x as number) < 100 &&
  Math.abs(v.y as number) < 100;
export function validateUILayout(value: unknown): UILayout {
  if (
    !record(value) ||
    value.version !== 1 ||
    !record(value.windows) ||
    !record(value.items) ||
    !Array.isArray(value.frames) ||
    !record(value.menus) ||
    !record(value.panels) ||
    !Array.isArray(value.assets)
  )
    throw new Error("Invalid UI layout.");
  const layout = value as UILayout;
  if (
    Object.keys(layout.items).length > 500 ||
    layout.frames.length > 100 ||
    Object.keys(layout.windows).length > 100 ||
    Object.keys(layout.menus).length > 50 ||
    layout.assets.length > 100
  )
    throw new Error("UI layout exceeds its size limits.");
  layout.assets.forEach(validateAsset);
  if (
    new Set(layout.assets.map((a) => a.id)).size !== layout.assets.length ||
    layout.assets.some((a) => a.kind !== "image") ||
    layout.assets.reduce((sum, a) => sum + a.dataUrl.length, 0) > 3_500_000
  )
    throw new Error("Invalid UI icon assets.");
  for (const w of Object.values(layout.windows))
    if (
      !record(w) ||
      ![w.x, w.y, w.width, w.height].every(numeric) ||
      w.width < 120 ||
      w.height < 40 ||
      typeof w.collapsed !== "boolean" ||
      typeof w.pinned !== "boolean"
    )
      throw new Error("Invalid window geometry.");
  const frameIds = new Set<string>();
  for (const f of layout.frames) {
    if (
      !record(f) ||
      typeof f.id !== "string" ||
      !f.id ||
      frameIds.has(f.id) ||
      typeof f.name !== "string" ||
      f.name.length > 200 ||
      ![f.x, f.y, f.cellSize].every(numeric) ||
      f.cellSize < 48 ||
      f.cellSize > 220 ||
      typeof f.collapsed !== "boolean" ||
      typeof f.pinned !== "boolean"
    )
      throw new Error("Invalid UI frame.");
    frameIds.add(f.id);
  }
  const occupied = new Set<string>();
  for (const [id, item] of Object.entries(layout.items)) {
    if (
      !id ||
      id.length > 200 ||
      !record(item) ||
      !numeric(item.x) ||
      !numeric(item.y) ||
      (item.home !== undefined && typeof item.home !== "boolean") ||
      (item.pinned !== undefined && typeof item.pinned !== "boolean")
    )
      throw new Error("Invalid function placement.");
    if (item.frameId !== undefined) {
      if (item.home || !frameIds.has(item.frameId) || !cell(item.cell))
        throw new Error("Missing UI frame or slot.");
      const slot = `${item.frameId}:${item.cell.x}:${item.cell.y}`;
      if (occupied.has(slot)) throw new Error("Two functions occupy the same slot.");
      occupied.add(slot);
    }
    if (item.style) {
      const s = item.style;
      if (
        !["text", "icon"].includes(s.mode) ||
        !["circle", "square", "triangle"].includes(s.geometry) ||
        (s.character !== undefined &&
          (typeof s.character !== "string" || s.character.length > 64)) ||
        (s.assetId !== undefined && !layout.assets.some((a) => a.id === s.assetId))
      )
        throw new Error("Invalid function appearance.");
    }
  }
  for (const menu of Object.values(layout.menus))
    if (
      !record(menu) ||
      Object.keys(menu).length > 60 ||
      !Object.values(menu).every(cell) ||
      new Set(Object.values(menu).map((p) => `${p.x}:${p.y}`)).size !== Object.keys(menu).length
    )
      throw new Error("Invalid context menu layout.");
  if (Object.values(layout.panels).some((v) => typeof v !== "boolean"))
    throw new Error("Invalid panel layout.");
  return layout;
}
export function loadUILayout(fallback = emptyUILayout()): UILayout {
  try {
    const raw = localStorage.getItem(UI_LAYOUT_KEY);
    return raw ? validateUILayout(JSON.parse(raw)) : fallback;
  } catch {
    return fallback;
  }
}
export function fitWindow(w: WindowState, width: number, height: number): WindowState {
  const minWidth = Math.min(240, Math.max(120, width - 16));
  const next = {
    ...w,
    width: Math.min(Math.max(minWidth, w.width), Math.max(120, width - 16)),
    height: Math.min(Math.max(120, w.height), Math.max(120, height - 16)),
  };
  next.x = Math.max(0, Math.min(next.x, Math.max(0, width - next.width)));
  next.y = Math.max(0, Math.min(next.y, Math.max(0, height - (next.collapsed ? 44 : next.height))));
  return next;
}
export function nearestSlot(occupied: Cell[], desired: Cell): Cell {
  if (!occupied.length) return { x: 0, y: 0 };
  const taken = new Set(occupied.map((c) => `${c.x}:${c.y}`));
  const candidates = occupied
    .flatMap((c) => [
      { x: c.x - 1, y: c.y },
      { x: c.x + 1, y: c.y },
      { x: c.x, y: c.y - 1 },
      { x: c.x, y: c.y + 1 },
    ])
    .filter((c) => !taken.has(`${c.x}:${c.y}`) && Math.abs(c.x) < 99 && Math.abs(c.y) < 99);
  candidates.sort(
    (a, b) =>
      Math.hypot(a.x - desired.x, a.y - desired.y) - Math.hypot(b.x - desired.x, b.y - desired.y) ||
      a.y - b.y ||
      a.x - b.x,
  );
  if (!candidates[0]) throw new Error("No available neighboring UI slot.");
  return candidates[0];
}
export function frameCells(layout: UILayout, id: string) {
  return Object.values(layout.items)
    .filter((i) => i.frameId === id)
    .map((i) => i.cell!);
}
export function functionPinned(layout: UILayout, id: string) {
  return !!(
    layout.items[id]?.pinned ||
    layout.frames.find((f) => f.id === layout.items[id]?.frameId)?.pinned
  );
}
export function normalizeFrame(layout: UILayout, id: string): UILayout {
  const cells = frameCells(layout, id);
  if (!cells.length) return layout;
  const dx = Math.min(...cells.map((c) => c.x)),
    dy = Math.min(...cells.map((c) => c.y));
  return {
    ...layout,
    frames: layout.frames.map((f) =>
      f.id === id ? { ...f, x: f.x + dx * f.cellSize, y: f.y + dy * f.cellSize } : f,
    ),
    items: Object.fromEntries(
      Object.entries(layout.items).map(([key, i]) => [
        key,
        i.frameId === id ? { ...i, cell: { x: i.cell!.x - dx, y: i.cell!.y - dy } } : i,
      ]),
    ),
  };
}
export function placeInFrame(
  layout: UILayout,
  functionId: string,
  frameId: string,
  desired: Cell,
): UILayout {
  if (
    !layout.frames.some((f) => f.id === frameId && !f.pinned) ||
    functionPinned(layout, functionId)
  )
    return layout;
  const others = Object.entries(layout.items)
    .filter(([id, i]) => id !== functionId && i.frameId === frameId)
    .map(([, i]) => i.cell!);
  const slot = nearestSlot(others, desired);
  let next = normalizeFrame(
    {
      ...layout,
      items: {
        ...layout.items,
        [functionId]: { ...layout.items[functionId], home: false, x: 0, y: 0, frameId, cell: slot },
      },
    },
    frameId,
  );
  if (layout.items[functionId]?.frameId && layout.items[functionId].frameId !== frameId)
    next = normalizeFrame(next, layout.items[functionId].frameId!);
  return validateUILayout(next);
}
export function groupFunctions(
  layout: UILayout,
  a: string,
  b: string,
  x: number,
  y: number,
): UILayout {
  if (a === b || functionPinned(layout, a) || functionPinned(layout, b)) return layout;
  const id = crypto.randomUUID();
  let next = {
    ...layout,
    frames: [
      ...layout.frames,
      { id, name: "New frame", x, y, cellSize: 96, collapsed: true, pinned: false },
    ],
    items: {
      ...layout.items,
      [a]: { ...layout.items[a], home: false, x: 0, y: 0, frameId: id, cell: { x: 0, y: 0 } },
      [b]: { ...layout.items[b], home: false, x: 0, y: 0, frameId: id, cell: { x: 1, y: 0 } },
    },
  };
  for (const old of new Set([layout.items[a]?.frameId, layout.items[b]?.frameId]))
    if (old) next = normalizeFrame(next, old);
  return validateUILayout(next);
}
export function detachFunction(
  layout: UILayout,
  id: string,
  x: number,
  y: number,
  reset = false,
): UILayout {
  if (functionPinned(layout, id)) return layout;
  const oldFrame = layout.items[id]?.frameId,
    items = { ...layout.items };
  if (reset) delete items[id];
  else items[id] = { ...items[id], home: false, frameId: undefined, cell: undefined, x, y };
  const next = { ...layout, items };
  return validateUILayout(oldFrame ? normalizeFrame(next, oldFrame) : next);
}
