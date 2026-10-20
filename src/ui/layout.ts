import type { VisualAsset } from "../graph/assets.ts";
import { validateAsset } from "../graph/assets.ts";
import { dockKeys, insertDockKey, removeDockKey, validateDockNode, type DockNode } from "./dockTree.ts";
import { keepFloatingHandleVisible } from "./positioning.ts";
export type UIArrangement = {
  mode: "free" | "snap";
  grid?: { anchor: string; origin: Cell; pitch: Cell };
};
export type UISize = { width: number; height: number };
export type Cell = { x: number; y: number };
export type WindowState = {
  x: number;
  y: number;
  width: number;
  height: number;
  collapsed: boolean;
  closed?: boolean;
  pinned: boolean;
  members?: UIResident[];
  chrome?: FrameChrome;
  magnetic?: boolean;
  arrangement?: UIArrangement;
  bodyOffset?: Cell;
  dockLayout?: DockNode;
  floatingOverflow?: boolean;
  inline?: {
    parent: string;
    detached?: boolean;
    actionIds?: Record<string, string>;
    handleId?: string;
  };
};
export type UIResident = {
  kind: "function" | "frame" | "window";
  id: string;
  breakBefore?: boolean;
  position?: Cell;
  size?: UISize;
};
export type FrameChrome = {
  style?: FunctionStyle;
  handle?: Cell;
  controls?: Partial<Record<"collapse" | "pin" | "close", Cell>>;
  controlStyles?: Partial<Record<"collapse" | "pin" | "close", FunctionStyle>>;
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
  anchorId?: string;
  size?: UISize;
};
export type UIFrame = {
  id: string;
  name: string;
  x: number;
  y: number;
  cellSize: number;
  collapsed: boolean;
  closed?: boolean;
  pinned: boolean;
  members?: UIResident[];
  width?: number;
  height?: number;
  dockGroup?: boolean;
  dockEdge?: "left" | "right" | "top" | "bottom";
  floatingOverflow?: boolean;
  dockLayout?: DockNode;
  chrome?: FrameChrome;
  magnetic?: boolean;
  arrangement?: UIArrangement;
  bodyOffset?: Cell;
};
export type UILayout = {
  version: 1 | 2;
  windows: Record<string, WindowState>;
  items: Record<string, UIItem>;
  frames: UIFrame[];
  menus: Record<string, Record<string, Cell>>;
  panels: Record<string, boolean>;
  assets: VisualAsset[];
  arrangement?: UIArrangement;
  nativeOrders?: Record<string, string[]>;
  labels?: Record<string, string>;
  hideNames?: boolean;
};
export const UI_LAYOUT_KEY = "omnium.ui.layout.v1";
export const emptyUILayout = (): UILayout => ({
  version: 2,
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
    ![1, 2].includes(value.version as number) ||
    !record(value.windows) ||
    !record(value.items) ||
    !Array.isArray(value.frames) ||
    !record(value.menus) ||
    !record(value.panels) ||
    !Array.isArray(value.assets)
  )
    throw new Error("Invalid UI layout.");
  const layout = value as UILayout;
  if (layout.hideNames !== undefined && typeof layout.hideNames !== "boolean")
    throw new Error("Invalid UI name visibility.");
  if (
    layout.labels !== undefined &&
    (!record(layout.labels) ||
      Object.keys(layout.labels).length > 2000 ||
      Object.entries(layout.labels).some(
        ([id, label]) => !id || id.length > 1000 || typeof label !== "string" || !label.trim() || label.length > 240,
      ))
  )
    throw new Error("Invalid UI display names.");
  if (
    layout.nativeOrders &&
    (!record(layout.nativeOrders) ||
      Object.keys(layout.nativeOrders).length > 500 ||
      Object.entries(layout.nativeOrders).some(
        ([id, order]) =>
          !id ||
          !Array.isArray(order) ||
          order.length > 500 ||
          order.some((item) => typeof item !== "string" || !item || item.length > 200) ||
          new Set(order).size !== order.length,
      ))
  )
    throw new Error("Invalid native UI order.");
  if (layout.arrangement) validateArrangement(layout.arrangement);
  if (
    Object.keys(layout.items).length > 500 ||
    layout.frames.length > 100 ||
    Object.keys(layout.windows).length > 500 ||
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
      w.width < 40 ||
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
      item?.size &&
      (!record(item.size) ||
        !numeric(item.size.width) ||
        !numeric(item.size.height) ||
        item.size.width < 1 ||
        item.size.height < 1)
    )
      throw new Error("Invalid UI function size.");
    if (
      !id ||
      id.length > 200 ||
      !record(item) ||
      !numeric(item.x) ||
      !numeric(item.y) ||
      (item.home !== undefined && typeof item.home !== "boolean") ||
      (item.pinned !== undefined && typeof item.pinned !== "boolean") ||
      (item.anchorId !== undefined &&
        (typeof item.anchorId !== "string" || !item.anchorId || item.anchorId.length > 500))
    )
      throw new Error("Invalid function placement.");
    if (item.frameId !== undefined) {
      if (layout.version === 2)
        throw new Error("Version-2 UI residents use frame membership, not legacy cells.");
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
  if (layout.version === 1) {
    const next = structuredClone(layout);
    next.version = 2;
    for (const f of next.frames) {
      const items = Object.entries(next.items)
        .filter(([, i]) => i.frameId === f.id)
        .sort((a, b) => a[1].cell!.y - b[1].cell!.y || a[1].cell!.x - b[1].cell!.x);
      f.width = Math.max(160, (Math.max(0, ...items.map(([, i]) => i.cell!.x)) + 1) * f.cellSize);
      f.members = items.map(([id, item], index) => ({
        kind: "function",
        id,
        breakBefore: index > 0 && item.cell!.y !== items[index - 1][1].cell!.y,
      }));
    }
    for (const item of Object.values(next.items)) {
      delete item.frameId;
      delete item.cell;
    }
    return validateUILayout(next);
  }
  const owners = new Map<string, string>();
  for (const [id, window] of Object.entries(layout.windows)) {
    const inline = window.inline;
    if (!inline) continue;
    if (
      !record(inline) ||
      typeof inline.parent !== "string" ||
      (inline.parent !== "workspace" && !getContainer(layout, inline.parent)) ||
      (inline.detached !== undefined && typeof inline.detached !== "boolean")
    )
      throw new Error("Invalid embedded UI group home.");
    if (
      inline.handleId !== undefined &&
      (typeof inline.handleId !== "string" || inline.handleId.length > 200)
    )
      throw new Error("Invalid embedded handle identity.");
    if (
      inline.actionIds &&
      (!record(inline.actionIds) ||
        Object.keys(inline.actionIds).length > 1000 ||
        Object.entries(inline.actionIds).some(
          ([path, action]) =>
            path.length > 4000 || typeof action !== "string" || action.length > 200,
        ))
    )
      throw new Error("Invalid embedded action identities.");
    if (!inline.detached && inline.parent !== "workspace")
      owners.set(`window:${id}`, inline.parent);
  }
  for (const [key, container] of containers(layout)) {
    if (container.closed !== undefined && typeof container.closed !== "boolean") throw new Error("Invalid frame visibility.");
    if (container.floatingOverflow !== undefined && typeof container.floatingOverflow !== "boolean") throw new Error("Invalid floating placement.");
    if (container.dockLayout) validateDockNode(container.dockLayout, new Set((container.members ?? []).map(residentKey)));
    if ("dockGroup" in container && container.dockGroup !== undefined && typeof container.dockGroup !== "boolean") throw new Error("Invalid dock group.");
    if ("dockEdge" in container && container.dockEdge !== undefined && (!["left", "right", "top", "bottom"].includes(container.dockEdge) || !container.dockGroup)) throw new Error("Invalid dock edge.");
    if ("height" in container && container.height !== undefined && (!numeric(container.height) || container.height < 40)) throw new Error("Invalid frame height.");
    if (
      container.bodyOffset &&
      (!record(container.bodyOffset) ||
        !numeric(container.bodyOffset.x) ||
        !numeric(container.bodyOffset.y))
    )
      throw new Error("Invalid UI body offset.");
    if (container.arrangement) {
      validateArrangement(container.arrangement);
    }
    if (container.magnetic !== undefined && typeof container.magnetic !== "boolean")
      throw new Error("Invalid frame magnetism.");
    if (
      "width" in container &&
      container.width !== undefined &&
      (!numeric(container.width) || container.width < 40)
    )
      throw new Error("Invalid frame width.");
    const chrome = container.chrome;
    if (chrome) {
      if (!record(chrome)) throw new Error("Invalid frame controls.");
      const points = [chrome.handle, ...Object.values(chrome.controls ?? {})].filter(
        (p) => p !== undefined,
      );
      if (points.some((p) => !record(p) || !numeric(p.x) || !numeric(p.y)))
        throw new Error("Invalid frame control position.");
      if (
        chrome.controls &&
        Object.keys(chrome.controls).some((k) => !["collapse", "pin", "close"].includes(k))
      )
        throw new Error("Invalid frame control.");
      if (chrome.style) validateStyle(chrome.style, layout);
      if (chrome.controlStyles) {
        if (
          !record(chrome.controlStyles) ||
          Object.keys(chrome.controlStyles).some((k) => !["collapse", "pin", "close"].includes(k))
        )
          throw new Error("Invalid frame control styles.");
        Object.values(chrome.controlStyles).forEach((style) => validateStyle(style, layout));
      }
    }
    if (
      container.members !== undefined &&
      (!Array.isArray(container.members) || container.members.length > 500)
    )
      throw new Error("Invalid frame members.");
    for (const member of container.members ?? []) {
      if (!record(member)) throw new Error("Invalid frame member.");
      if (
        member.position &&
        (!record(member.position) || !numeric(member.position.x) || !numeric(member.position.y))
      )
        throw new Error("Invalid UI resident position.");
      if (
        member.size &&
        (!record(member.size) ||
          !numeric(member.size.width) ||
          !numeric(member.size.height) ||
          member.size.width < 1 ||
          member.size.height < 1)
      )
        throw new Error("Invalid UI resident size.");
      if (
        !record(member) ||
        !["function", "frame", "window"].includes(member.kind) ||
        typeof member.id !== "string" ||
        !member.id ||
        member.id.length > 200 ||
        (member.breakBefore !== undefined && typeof member.breakBefore !== "boolean")
      )
        throw new Error("Invalid frame member.");
      if (member.kind === "frame" && !frameIds.has(member.id))
        throw new Error("Missing nested UI frame.");
      if (member.kind === "window" && !layout.windows[member.id])
        throw new Error("Missing nested UI window.");
      const token = residentKey(member);
      const scope = residentContextScope(layout, token),
        targetScope = residentContextScope(layout, key);
      if ((scope || targetScope) && scope !== targetScope)
        throw new Error("Context actions must stay in their owning menu.");
      if (member.kind === "function" && layout.items[member.id]?.anchorId)
        throw new Error("A function cannot be both anchored and frame-owned.");
      if (owners.has(token)) throw new Error("A UI resident cannot belong to two frames.");
      owners.set(token, key);
    }
  }
  for (const start of owners.keys()) {
    let key: string | undefined = start;
    const seen = new Set<string>();
    while (key) {
      if (seen.has(key)) throw new Error("Circular UI frame nesting is not allowed.");
      seen.add(key);
      if (seen.size > 16) throw new Error("UI nesting exceeds 16 levels.");
      key = owners.get(key);
    }
  }
  return layout;
}
function validateArrangement(a: UIArrangement) {
  if (!record(a) || !["free", "snap"].includes(a.mode))
    throw new Error("Invalid UI arrangement mode.");
  if (
    a.grid &&
    (!record(a.grid) ||
      typeof a.grid.anchor !== "string" ||
      !a.grid.anchor ||
      !record(a.grid.origin) ||
      !record(a.grid.pitch) ||
      ![a.grid.origin.x, a.grid.origin.y, a.grid.pitch.x, a.grid.pitch.y].every(numeric) ||
      a.grid.pitch.x < 16 ||
      a.grid.pitch.y < 16)
  )
    throw new Error("Invalid UI snap grid.");
}
function validateStyle(style: FunctionStyle, layout: UILayout) {
  if (
    !record(style) ||
    !["text", "icon"].includes(style.mode) ||
    !["circle", "square", "triangle"].includes(style.geometry) ||
    (style.character !== undefined &&
      (typeof style.character !== "string" || style.character.length > 64)) ||
    (style.assetId !== undefined && !layout.assets.some((a) => a.id === style.assetId))
  )
    throw new Error("Invalid frame appearance.");
}
export const residentKey = (member: Pick<UIResident, "kind" | "id">) =>
  `${member.kind}:${member.id}`;
export const readResident = (key: string): UIResident => ({
  kind: key.slice(0, key.indexOf(":")) as UIResident["kind"],
  id: key.slice(key.indexOf(":") + 1),
});
export function containers(layout: UILayout): [string, UIFrame | WindowState][] {
  return [
    ...layout.frames.map((f) => [`frame:${f.id}`, f] as [string, UIFrame]),
    ...Object.entries(layout.windows).map(
      ([id, w]) => [`window:${id}`, w] as [string, WindowState],
    ),
  ];
}
/** UI-only traversal follows actual ownership, including embedded native homes. */
export function residentBranch(layout: UILayout, root: string): string[] {
  return containers(layout)
    .map(([key]) => key)
    .filter((key) => {
      const seen = new Set<string>();
      let parent: string | undefined = key;
      while (parent && !seen.has(parent)) {
        if (parent === root) return true;
        seen.add(parent);
        parent = ownerOf(layout, parent);
      }
      return false;
    });
}
export function collapseResidentBranch(
  layout: UILayout,
  root: string,
  collapsed: boolean,
): UILayout {
  let next = layout;
  for (const key of residentBranch(layout, root)) next = updateContainer(next, key, { collapsed });
  return next;
}
export function getContainer(layout: UILayout, key: string) {
  if (key.startsWith("window:")) {
    const id = key.slice(7);
    return Object.hasOwn(layout.windows, id) ? layout.windows[id] : undefined;
  }
  if (key.startsWith("frame:")) return layout.frames.find((frame) => frame.id === key.slice(6));
  return undefined;
}
export function ownerOf(layout: UILayout, key: string) {
  const explicit = containers(layout).find(([, c]) =>
    c.members?.some((m) => residentKey(m) === key),
  )?.[0];
  if (explicit) return explicit;
  const inline = key.startsWith("window:") ? layout.windows[key.slice(7)]?.inline : undefined;
  return inline && !inline.detached && inline.parent !== "workspace" ? inline.parent : undefined;
}
/** Reveal follows ownership, including tabs whose contents remain mounted. */
export function activateDockMember(layout: UILayout, key: string): UILayout {
  let next = layout, current: string | undefined = key;
  const seen = new Set<string>();
  const activate = (node: DockNode, member: string): DockNode => node.kind === "tabs"
    ? node.keys.includes(member) ? { ...node, active: member } : node
    : { ...node, first: activate(node.first, member), second: activate(node.second, member) };
  while (current && !seen.has(current)) {
    seen.add(current);
    const parent = ownerOf(next, current);
    const tree = parent && getContainer(next, parent)?.dockLayout;
    if (parent && tree) next = updateContainer(next, parent, { dockLayout: activate(tree, current) });
    current = parent;
  }
  return next;
}
export function residentPinned(layout: UILayout, key: string): boolean {
  const seen = new Set<string>();
  let current: string | undefined = key;
  while (current && !seen.has(current)) {
    seen.add(current);
    const m = readResident(current);
    if ((m.kind === "function" ? layout.items[m.id] : getContainer(layout, current))?.pinned)
      return true;
    current = ownerOf(layout, current);
  }
  return false;
}
export function updateContainer(
  layout: UILayout,
  key: string,
  patch: Partial<UIFrame & WindowState>,
): UILayout {
  const m = readResident(key);
  if (m.kind === "frame")
    return {
      ...layout,
      frames: layout.frames.map((f) => (f.id === m.id ? { ...f, ...patch } : f)),
    };
  if (!layout.windows[m.id]) return layout;
  return {
    ...layout,
    windows: { ...layout.windows, [m.id]: { ...layout.windows[m.id], ...patch } },
  };
}
/** Entity-owned menus keep all nested groups/actions within their original scope. */
export function residentContextScope(layout: UILayout, key: string): string | undefined {
  const direct = contextOwner(key);
  if (direct) return direct;
  const seen = new Set<string>();
  let owner: string | undefined = key;
  while (owner && !seen.has(owner)) {
    if (owner.startsWith("window:context:")) return owner;
    seen.add(owner);
    const inline: WindowState["inline"] = owner.startsWith("window:")
      ? layout.windows[owner.slice(7)]?.inline
      : undefined;
    owner = inline?.parent ?? ownerOf(layout, owner);
  }
  return undefined;
}
export function canDock(layout: UILayout, resident: string, target: string) {
  if (getContainer(layout, target)?.dockLayout && resident.startsWith("function:")) return false;
  const scope = residentContextScope(layout, resident),
    targetScope = residentContextScope(layout, target);
  if ((scope || targetScope) && scope !== targetScope) return false;
  if (
    resident === target ||
    !getContainer(layout, target) ||
    residentPinned(layout, resident) ||
    residentPinned(layout, target)
  )
    return false;
  let key: string | undefined = target;
  while (key) {
    if (key === resident) return false;
    key = ownerOf(layout, key);
  }
  return true;
}
/** Context actions are owned by their live menu, never extracted or given another target. */
export function contextOwner(key: string) {
  const match = /^function:context:([^:]+):/.exec(key);
  return match ? `window:context:${match[1]}` : undefined;
}
export function releaseResident(layout: UILayout, key: string): UILayout {
  let next = layout;
  const resident = readResident(key);
  if (resident.kind === "window" && layout.windows[resident.id]?.inline) {
    const window = layout.windows[resident.id];
    next = {
      ...next,
      windows: {
        ...next.windows,
        [resident.id]: { ...window, inline: { ...window.inline!, detached: true } },
      },
    };
  }
  if (resident.kind === "function" && layout.items[resident.id]?.anchorId) {
    const { anchorId: _anchor, ...item } = layout.items[resident.id];
    next = { ...next, items: { ...next.items, [resident.id]: item } };
  }
  for (const [id, c] of containers(layout))
    if (c.members?.some((m) => residentKey(m) === key))
      next = updateContainer(next, id, {
        members: c.members.filter((m) => residentKey(m) !== key),
        ...(c.dockLayout ? { dockLayout: removeDockKey(c.dockLayout, key) } : {}),
      });
  return next;
}
/** Hide a frame without deleting its controls. Release explicit docking so closed
 * tabs do not leave empty panes; an embedded group's native home is preserved. */
export function closeContainer(layout: UILayout, key: string): UILayout {
  const state = key.startsWith("window:") ? layout.windows[key.slice(7)] : undefined;
  const released = state?.inline && !state.inline.detached ? layout : releaseResident(layout, key);
  return pruneEmptyDockGroups(updateContainer(released, key, { closed: true }));
}
export function pruneEmptyDockGroups(layout: UILayout): UILayout {
  let next = layout;
  for (let i = 0; i < layout.frames.length; i++) {
    const empty = next.frames.find(frame => frame.dockGroup && !frame.members?.length);
    if (!empty) break;
    next = releaseResident({ ...next, frames: next.frames.filter(frame => frame.id !== empty.id) }, `frame:${empty.id}`);
  }
  return next;
}
/** Reorder native controls as siblings; a field never becomes another field's container. */
export function orderNativeFunction(
  layout: UILayout,
  id: string,
  anchor: string,
  homeId: string,
  target: string,
  after: boolean,
): UILayout {
  if (contextOwner(`function:${id}`) || contextOwner(`function:${target}`)) return layout;
  if (functionPinned(layout, id) || functionPinned(layout, target)) return layout;
  const next = releaseResident(layout, `function:${id}`);
  const peers = Object.keys(next.items).filter((key) => next.items[key].anchorId === anchor);
  const order = [...new Set([...(next.nativeOrders?.[anchor] ?? []), homeId, ...peers])].filter(
    (key) => key !== id && (key === homeId || peers.includes(key)),
  );
  const index = order.indexOf(target);
  if (index < 0) return layout;
  order.splice(index + (after ? 1 : 0), 0, id);
  const item = {
    ...next.items[id],
    x: next.items[id]?.x ?? 24,
    y: next.items[id]?.y ?? 180,
    home: id === homeId,
    ...(id === homeId ? {} : { anchorId: anchor }),
  };
  return validateUILayout({
    ...next,
    items: { ...next.items, [id]: item },
    nativeOrders: { ...next.nativeOrders, [anchor]: order },
  });
}
export function dockResident(
  layout: UILayout,
  key: string,
  target: string,
  index: number,
  breakBefore = false,
): UILayout {
  if (!canDock(layout, key, target)) return layout;
  const before = getContainer(layout, target)!.members ?? [];
  const adjusted = index - before.slice(0, index).filter((m) => residentKey(m) === key).length;
  let next = releaseResident(layout, key);
  const members = [...(getContainer(next, target)!.members ?? [])];
  members.splice(Math.max(0, Math.min(members.length, adjusted)), 0, {
    ...readResident(key),
    breakBefore,
  });
  next = updateContainer(next, target, { members });
  const tree = getContainer(next, target)?.dockLayout;
  if (tree && !dockKeys(tree).includes(key))
    next = updateContainer(next, target, { dockLayout: insertDockKey(tree, dockKeys(tree)[0], key, "tab") });
  if (readResident(key).kind === "function") {
    const id = readResident(key).id;
    next = {
      ...next,
      items: {
        ...next.items,
        [id]: {
          ...next.items[id],
          home: false,
          x: next.items[id]?.x ?? 0,
          y: next.items[id]?.y ?? 0,
        },
      },
    };
  }
  return validateUILayout(pruneEmptyDockGroups(next));
}
export function floatResident(layout: UILayout, key: string, x: number, y: number): UILayout {
  if (residentContextScope(layout, key) || key.startsWith("window:context:")) return layout;
  if (residentPinned(layout, key)) return layout;
  const next = releaseResident(layout, key),
    m = readResident(key);
  if (m.kind === "function")
    return validateUILayout({
      ...next,
      items: { ...next.items, [m.id]: { ...next.items[m.id], home: false, x, y } },
    });
  return validateUILayout(pruneEmptyDockGroups(updateContainer(next, key, { x, y, dockEdge: undefined })));
}
export function resetContainer(layout: UILayout, key: string): UILayout {
  if (residentPinned(layout, key)) return layout;
  const c = getContainer(layout, key);
  if (!c) return layout;
  return validateUILayout(
    updateContainer(layout, key, {
      chrome: c.chrome?.style ? { style: c.chrome.style } : undefined,
      members: (c.members ?? []).map(({ position: _position, size: _size, ...m }) => ({
        ...m,
        breakBefore: false,
      })),
      arrangement: undefined,
      bodyOffset: undefined,
      dockLayout: undefined,
      dockEdge: undefined,
      ...(key.startsWith("frame:") ? { width: 280 } : { width: 420, height: 560 }),
    }),
  );
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
  if (w.floatingOverflow) return { ...next, ...keepFloatingHandleVisible({ ...next, width: w.width, height: w.height }, { x: 8, y: 8, width: width-16, height: height-16 }, w.chrome?.handle) };
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
export function functionPinned(layout: UILayout, id: string) {
  return residentPinned(layout, `function:${id}`);
}
export function groupFunctions(
  layout: UILayout,
  a: string,
  b: string,
  x: number,
  y: number,
): UILayout {
  if (a === b || functionPinned(layout, a) || functionPinned(layout, b)) return layout;
  return groupResidents(layout, [`function:${a}`, `function:${b}`], x, y);
}
/** Buttons and complete groups use the same ownership transaction and frame model. */
export function groupResidents(layout: UILayout, keys: string[], x: number, y: number): UILayout {
  if (keys.length < 2 || new Set(keys).size !== keys.length) throw new Error("Select at least two distinct UI items.");
  const scopes = new Set(keys.map(key => residentContextScope(layout, key)));
  if (scopes.size > 1) throw new Error("These items must stay in their separate owning menus.");
  for (const key of keys) {
    if (residentPinned(layout, key)) throw new Error("Unpin the selected items and their frames first.");
    if (!key.startsWith("function:") && !getContainer(layout, key)) throw new Error("Missing selected UI group.");
    let parent = ownerOf(layout, key);
    while (parent) { if (keys.includes(parent)) throw new Error("Select a group or its contents, rather than both."); parent = ownerOf(layout, parent); }
  }
  const id = crypto.randomUUID();
  const released = keys.reduce(releaseResident, layout);
  let next: UILayout = {
    ...released,
    frames: [
      ...released.frames,
      {
        id,
        name: "New frame",
        x,
        y,
        cellSize: 96,
        width: 280,
        collapsed: true,
        pinned: false,
        members: keys.map(readResident),
      },
    ],
    items: {
      ...released.items,
      ...Object.fromEntries(keys.filter(key => key.startsWith("function:")).map(key => { const id = key.slice(9); return [id, { ...released.items[id], home: false, x: 0, y: 0 }]; })),
    },
  };
  const scope = [...scopes][0];
  if (scope) next = updateContainer(next, scope, { members: [...(getContainer(next, scope)?.members ?? []), { kind: "frame", id }] });
  return validateUILayout(pruneEmptyDockGroups(next));
}
export function detachFunction(
  layout: UILayout,
  id: string,
  x: number,
  y: number,
  reset = false,
): UILayout {
  if (functionPinned(layout, id)) return layout;
  const released = releaseResident(layout, `function:${id}`),
    items = { ...released.items };
  if (reset) delete items[id];
  else items[id] = { ...items[id], home: false, x, y };
  return validateUILayout({ ...released, items });
}
