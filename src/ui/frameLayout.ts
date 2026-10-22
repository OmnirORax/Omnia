import { getContainer, residentKey, residentPinned, updateContainer, validateUILayout, type FrameLayoutMode, type FrameLayoutSnapshot, type UILayout } from "./layout.ts";
import { dockKeys, insertDockKey, removeDockKey } from "./dockTree.ts";

export const FRAME_LAYOUTS: { id: FrameLayoutMode; label: string; symbol: string; description: string }[] = [
  { id: "stacked", label: "Stacked sections", symbol: "☰", description: "Full-width sections that stack and resize automatically." },
  { id: "freeform", label: "Freeform", symbol: "◇", description: "Freely arrange contents with the bubble contour." },
];

/** Save presentation only. Current membership always wins over historical layouts. */
export function setFrameLayout(layout: UILayout, key: string, mode: FrameLayoutMode): UILayout {
  const container = getContainer(layout, key);
  if (!container || residentPinned(layout, key) || (container.layoutMode ?? "freeform") === mode) return layout;
  const members = container.members ?? [];
  const snapshot: FrameLayoutSnapshot = {
    order: members.map(residentKey),
    placements: Object.fromEntries(members.map(member => [residentKey(member), {
      position: member.position, size: member.size, breakBefore: member.breakBefore,
    }])),
    bodyOffset: container.bodyOffset, width: container.width, height: container.height,
    dockLayout: container.dockLayout,
  };
  const memory = container.layoutMemory?.[mode];
  const order = [...new Set([...(memory?.order ?? []), ...members.map(residentKey)])];
  const restored = order.flatMap(key => {
    const member = members.find(member => residentKey(member) === key);
    if (!member) return [];
    const placement = memory?.placements[key];
    return [placement ? { ...member, position: placement.position, size: placement.size, breakBefore: placement.breakBefore } : member];
  });
  // A remembered split tree may have lost or acquired members while stacked.
  // Restore it only when every current resident can live in a pane.
  let dockLayout = mode === "freeform" && !restored.some(member => member.kind === "function") ? memory?.dockLayout : undefined;
  for (const key of dockKeys(dockLayout)) if (!restored.some(member => residentKey(member) === key)) dockLayout = removeDockKey(dockLayout, key);
  if (dockLayout) for (const member of restored) if (!dockKeys(dockLayout).includes(residentKey(member)))
    dockLayout = insertDockKey(dockLayout, dockKeys(dockLayout)[0], residentKey(member), "tab");
  return validateUILayout(updateContainer(layout, key, {
    layoutMode: mode,
    layoutMemory: { ...container.layoutMemory, [container.layoutMode ?? "freeform"]: snapshot },
    members: restored, dockLayout,
    bodyOffset: memory?.bodyOffset,
    width: memory?.width ?? container.width,
    height: memory?.height ?? container.height,
  }));
}

export function createUIFrame(layout: UILayout, x: number, y: number, mode: FrameLayoutMode): UILayout {
  return validateUILayout({ ...layout, frames: [...layout.frames, {
    id: crypto.randomUUID(), name: "New frame", x: Math.max(8, x), y: Math.max(8, y),
    cellSize: 96, width: mode === "stacked" ? 300 : 280,
    layoutMode: mode, collapsed: false, pinned: false, members: [],
  }] });
}
