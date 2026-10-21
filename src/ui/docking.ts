import { canDock, dockResident, getContainer, ownerOf, pruneEmptyDockGroups, readResident, releaseResident, residentContextScope, residentKey, residentPinned, updateContainer, validateUILayout, type UILayout } from "./layout.ts";
import { dockKeys, dockTabs, insertDockKey, type DockSide, type DockNode } from "./dockTree.ts";

export type DockRect = { x: number; y: number; width: number; height: number };
export type FrameDock = { target?: string; side: DockSide; rect: DockRect; bounds?: DockRect; edge?: Exclude<DockSide, "tab">;
  tabOwner?: string;
  host?: { container: string; order: string; keys: string[] } };
/** One allocation for every edge and the remaining workspace, independent of rendering. */
export function workspaceDockRects(layout: UILayout, area: DockRect) {
  const edges = ["left", "right", "top", "bottom"] as const;
  const groups = Object.fromEntries(edges.map(edge => [edge, layout.frames.find(frame => frame.dockEdge === edge && !ownerOf(layout, `frame:${frame.id}`))]));
  const sizes = { left: 0, right: 0, top: 0, bottom: 0 };
  for (const edge of edges) {
    const group = groups[edge]; if (!group) continue;
    const vertical = edge === "left" || edge === "right", extent = vertical ? area.width : area.height;
    sizes[edge] = group.collapsed ? vertical ? 150 : 44 : Math.min(Math.max(vertical ? 180 : 120, (vertical ? group.width : group.height) ?? extent * (vertical ? .25 : .28)), extent * .45);
  }
  for (const [a, b, extent, minimum] of [["left", "right", area.width, 480], ["top", "bottom", area.height, 240]] as const) {
    const total = sizes[a] + sizes[b], budget = Math.max(0, extent - Math.min(minimum, extent * .5));
    if (total > budget) { sizes[a] *= budget / total; sizes[b] *= budget / total; }
  }
  const { left, right, top, bottom } = sizes;
  const center = { x: area.x + left, y: area.y + top, width: Math.max(0, area.width-left-right), height: Math.max(0, area.height-top-bottom) };
  const docks: Partial<Record<Exclude<DockSide, "tab">, DockRect>> = {};
  for (const edge of edges) if (groups[edge]) docks[edge] = edge === "left" || edge === "right"
    ? { x: edge === "left" ? area.x : area.x+area.width-right, y: center.y, width: sizes[edge], height: groups[edge]!.collapsed ? Math.min(44, center.height) : center.height }
    : { x: area.x, y: edge === "top" ? area.y : area.y+area.height-bottom, width: area.width, height: sizes[edge] };
  return { area, center, docks, sizes, active: edges.some(edge => !!groups[edge]) };
}
export function edgeDockRect(layout: UILayout, edge: Exclude<DockSide, "tab">, area: DockRect): DockRect {
  // Also allocate the proposed edge before it exists, using the same constraints as commit.
  const proposed = layout.frames.some(frame => frame.dockEdge === edge) ? layout : { ...layout, frames: [...layout.frames, {
    id: "@dock-preview", name: "", x: 0, y: 0, cellSize: 96, collapsed: false, pinned: false, dockEdge: edge,
  }] };
  return workspaceDockRects(proposed, area).docks[edge]!;
}
export function fitDockRect(rect: DockRect, area: DockRect): DockRect {
  const width = Math.min(rect.width, area.width), height = Math.min(rect.height, area.height);
  return { width, height, x: Math.max(area.x, Math.min(rect.x, area.x+area.width-width)), y: Math.max(area.y, Math.min(rect.y, area.y+area.height-height)) };
}
/** Preserve free placements where possible; allocate gaps when docks consume their space.
 * When requested sizes cannot coexist, give each resident a smaller disjoint cell. */
export function fitDockResidents(residents: Record<string, DockRect>, area: DockRect): Record<string, DockRect> {
  const entries = Object.entries(residents).sort(([a, ar], [b, br]) => br.width*br.height-ar.width*ar.height || a.localeCompare(b));
  const placed: Record<string, DockRect> = {}, gap = 8;
  const overlaps = (a: DockRect, b: DockRect) => a.x < b.x+b.width+gap && a.x+a.width+gap > b.x && a.y < b.y+b.height+gap && a.y+a.height+gap > b.y;
  for (const [key, source] of entries) {
    const box = fitDockRect(source, area), occupied = Object.values(placed);
    const xs = [box.x, area.x, area.x+area.width-box.width, ...occupied.flatMap(other => [other.x-box.width-gap, other.x+other.width+gap])];
    const ys = [box.y, area.y, area.y+area.height-box.height, ...occupied.flatMap(other => [other.y-box.height-gap, other.y+other.height+gap])];
    const candidates = xs.flatMap(x => ys.map(y => ({ ...box, x, y }))).filter(rect => rect.x >= area.x && rect.y >= area.y && rect.x+rect.width <= area.x+area.width+.01 && rect.y+rect.height <= area.y+area.height+.01 && !occupied.some(other => overlaps(rect, other)));
    candidates.sort((a,b) => Math.hypot(a.x-box.x,a.y-box.y)-Math.hypot(b.x-box.x,b.y-box.y) || a.y-b.y || a.x-b.x);
    if (candidates.length) { placed[key] = candidates[0]; continue; }
    const columns = Math.max(1, Math.min(entries.length, Math.ceil(Math.sqrt(entries.length*area.width/Math.max(1,area.height))))), rows = Math.ceil(entries.length/columns);
    const pitchX = area.width/columns, pitchY = area.height/rows;
    return Object.fromEntries(entries.map(([id, rect], index) => [id, {
      x: area.x + index%columns*pitchX, y: area.y + Math.floor(index/columns)*pitchY,
      width: Math.min(rect.width, Math.max(1,pitchX-gap)), height: Math.min(rect.height, Math.max(1,pitchY-gap)),
    }]));
  }
  return placed;
}
const splitRoot = (tree: DockNode, key: string, side: DockSide): DockNode => {
  if (side === "tab") return insertDockKey(tree, dockKeys(tree)[0], key, side);
  const before = side === "left" || side === "top";
  return { kind: "split", axis: side === "left" || side === "right" ? "horizontal" : "vertical", ratio: 0.5,
    first: before ? dockTabs(key) : tree, second: before ? tree : dockTabs(key) };
};
/** One layout transaction: transfer ownership and change its dock presentation. */
export function dockFrame(layout: UILayout, key: string, intent: FrameDock): UILayout {
  if (!/^(frame|window):/.test(key) || !getContainer(layout, key) || residentPinned(layout, key) || residentContextScope(layout, key)) return layout;
  let target = intent.target;
  if (intent.edge) target = layout.frames.find(frame => frame.dockEdge === intent.edge && `frame:${frame.id}` !== key)?.id;
  if (intent.edge && target) target = `frame:${target}`;
  if (target && !canDock(layout, key, target)) return layout;
  const parent = target && (ownerOf(layout, target) ?? intent.host?.container);
  if (parent && !canDock(layout, key, parent)) return layout;
  // A tab-bar drop joins that bar, even when its active tab is itself a split group.
  const tabOwner = intent.side === "tab" && intent.tabOwner === parent && parent && getContainer(layout, parent)?.dockLayout ? parent : undefined;
  const root = tabOwner || (target && getContainer(layout, target)?.dockLayout ? target
    : parent && getContainer(layout, parent)?.dockLayout ? parent : undefined);
  if (root && !dockKeys(getContainer(layout, root)?.dockLayout).some(member => member !== key)) return layout;
  let next = releaseResident(layout, key);
  next = updateContainer(next, key, { collapsed: false, dockEdge: undefined });
  const native = target?.startsWith("window:") ? layout.windows[target.slice(7)]?.nativeStrip : undefined;
  if (target && native && !getContainer(next, target)?.dockLayout) {
    const container = getContainer(next, target)!, contents = getContainer(next, native.contents);
    if (!contents || !("inline" in contents) || !contents.inline) return layout;
    let members = container.members ?? [];
    // Adopt the live native collection as one ordinary window. Its controls and
    // extra residents stay together; only the outer presentation becomes split.
    if (!contents.inline.detached) {
      if (key === native.contents) return layout;
      next = updateContainer(next, native.contents, { members,
        inline: { ...contents.inline, detached: true }, collapsed: false, closed: false });
      members = [readResident(native.contents)];
    } else if (key === native.contents && !members.length) {
      // Returning the original collection to an empty native home restores it.
      next = updateContainer(next, target, { members: contents.members ?? [] });
      return validateUILayout(updateContainer(next, native.contents, { members: [], inline: { ...contents.inline, detached: false } }));
    }
    if (members.some(member => member.kind === "function")) {
      const id = crypto.randomUUID();
      next = { ...next, frames: [...next.frames, {
        id, name: "Panels", x: intent.rect.x, y: intent.rect.y, width: intent.rect.width,
        cellSize: 96, layoutMode: "stacked", collapsed: false, pinned: false, members,
      }] };
      members = [readResident(`frame:${id}`)];
    }
    const keys = members.map(residentKey), tree = keys.length ? { kind: "tabs" as const, keys, active: keys[0] } : undefined;
    return validateUILayout(pruneEmptyDockGroups(updateContainer(next, target, {
      ...intent.rect, members: [...members, readResident(key)],
      dockLayout: tree ? splitRoot(tree, key, intent.side) : dockTabs(key),
    })));
  }
  if (intent.edge && !target && key.startsWith("frame:") && getContainer(layout, key) && "dockGroup" in getContainer(layout, key)! && getContainer(layout, key)!.dockLayout) {
    return validateUILayout(pruneEmptyDockGroups(updateContainer(next, key, { dockEdge: intent.edge, ...intent.rect })));
  }
  if (root) {
    const container = getContainer(next, root)!;
    const tree = container.dockLayout!;
    next = updateContainer(next, root, {
      members: [...(container.members ?? []), readResident(key)],
      dockLayout: target === root || intent.edge ? splitRoot(tree, key, intent.side) : insertDockKey(tree, target!, key, intent.side),
    });
  } else {
    const id = crypto.randomUUID(), groupKey = `frame:${id}`;
    const original = parent && getContainer(layout, parent)?.members?.find(member => residentKey(member) === target);
    if (target) next = updateContainer(releaseResident(next, target), target, { collapsed: false });
    const tree = target ? splitRoot(dockTabs(target), key, intent.side) : dockTabs(key);
    next = { ...next, frames: [...next.frames, {
      id, name: "Dock group", x: intent.rect.x, y: intent.rect.y,
      width: intent.rect.width, height: intent.rect.height, cellSize: 96,
      collapsed: false, pinned: false, dockGroup: true, dockEdge: intent.edge,
      dockLayout: tree, members: dockKeys(tree).map(readResident),
    }] };
    if (parent) {
      const members = getContainer(layout, parent)?.members ?? [];
      next = dockResident(next, groupKey, parent, original ? members.findIndex(member => residentKey(member) === target) : members.length);
      if (original) next = updateContainer(next, parent, { members: getContainer(next, parent)!.members!.map(member => residentKey(member) === groupKey ? { ...member, position: original.position, size: original.size } : member) });
      if (intent.host) {
        const keys = intent.host.keys.filter(key => key !== groupKey), index = keys.indexOf(target!);
        keys.splice(Math.max(0, index), 0, groupKey);
        next = { ...next, nativeOrders: { ...next.nativeOrders, [intent.host.order]: keys } };
      }
    }
  }
  return validateUILayout(pruneEmptyDockGroups(next));
}
