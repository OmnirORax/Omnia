import { canDock, dockResident, getContainer, ownerOf, pruneEmptyDockGroups, readResident, releaseResident, residentContextScope, residentKey, residentPinned, updateContainer, validateUILayout, type UILayout } from "./layout.ts";
import { dockKeys, dockTabs, insertDockKey, type DockSide, type DockNode } from "./dockTree.ts";

export type DockRect = { x: number; y: number; width: number; height: number };
export type FrameDock = { target?: string; side: DockSide; rect: DockRect; bounds?: DockRect; edge?: Exclude<DockSide, "tab"> };
export function edgeDockRect(layout: UILayout, edge: Exclude<DockSide, "tab">, area: DockRect): DockRect {
  const group = layout.frames.find(frame => frame.dockEdge === edge);
  const height = Math.min(Math.max(120, group?.height ?? area.height * 0.28), area.height * 0.45);
  if (edge === "top" || edge === "bottom") return { ...area, height, y: edge === "top" ? area.y : area.y + area.height - height };
  const top = layout.frames.some(frame => frame.dockEdge === "top") ? edgeDockRect(layout, "top", area).height : 0;
  const bottom = layout.frames.some(frame => frame.dockEdge === "bottom") ? edgeDockRect(layout, "bottom", area).height : 0;
  const width = Math.min(Math.max(180, group?.width ?? area.width * 0.25), area.width * 0.45);
  return { x: edge === "left" ? area.x : area.x + area.width - width, y: area.y + top, width, height: area.height - top - bottom };
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
  const parent = target && ownerOf(layout, target);
  const root = target && getContainer(layout, target)?.dockLayout ? target
    : parent && getContainer(layout, parent)?.dockLayout ? parent : undefined;
  if (root && !dockKeys(getContainer(layout, root)?.dockLayout).some(member => member !== key)) return layout;
  let next = releaseResident(layout, key);
  next = updateContainer(next, key, { collapsed: false, dockEdge: undefined });
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
    if (parent && original) {
      next = dockResident(next, groupKey, parent, getContainer(layout, parent)!.members!.findIndex(member => residentKey(member) === target));
      next = updateContainer(next, parent, { members: getContainer(next, parent)!.members!.map(member => residentKey(member) === groupKey ? { ...member, position: original.position, size: original.size } : member) });
    }
  }
  return validateUILayout(pruneEmptyDockGroups(next));
}
