import { DEFAULT_SPATIAL_SETTINGS, type GridSpacing, type SpatialSettings } from "./graph/layout3d.ts";

export const ACTIONS = [
  { id: "selectAll", category: "Selection", label: "Select visible nodes", defaultKey: "Ctrl+A" },
  { id: "deleteSelected", category: "Selection", label: "Delete selected concepts and subnodes", defaultKey: "Delete" },
  { id: "shortcuts", category: "Workspace", label: "Toggle shortcut display", defaultKey: "Shift+?" },
  { id: "focus", category: "Navigation", label: "Focus selected", defaultKey: "F" },
  { id: "fitLocal", category: "Navigation", label: "Fit local system", defaultKey: "Shift+F" },
  { id: "fitAll", category: "Navigation", label: "Fit entire atlas", defaultKey: "" },
  { id: "back", category: "Navigation", label: "Back to previous focus", defaultKey: "" },
  { id: "newNode", category: "Structure creation", label: "New node", defaultKey: "N" },
  { id: "newChild", category: "Structure creation", label: "New child", defaultKey: "Shift+N" },
  { id: "connect", category: "Relationships", label: "Connect from selected", defaultKey: "L" },
  { id: "expand", category: "Expansion", label: "Expand or collapse selected", defaultKey: "E" },
  { id: "expandAll", category: "Expansion", label: "Expand or collapse entire subtree", defaultKey: "Shift+E" },
  { id: "toggleSnap", category: "Spatial editing", label: "Toggle snapping", defaultKey: "G" },
  { id: "axisX", category: "Spatial editing", label: "Constrain drag to X", defaultKey: "X" },
  { id: "axisY", category: "Spatial editing", label: "Constrain drag to Y", defaultKey: "Y" },
  { id: "axisZ", category: "Spatial editing", label: "Constrain drag to Z", defaultKey: "Z" },
  { id: "compactSelected", category: "Spatial editing", label: "Compact selected subsystem", defaultKey: "" },
  { id: "compactFrame", category: "Spatial editing", label: "Compact current frame", defaultKey: "" },
  { id: "compactAll", category: "Spatial editing", label: "Compact entire atlas", defaultKey: "" },
  { id: "undo", category: "History", label: "Undo", defaultKey: "Ctrl+Z" },
  { id: "redo", category: "History", label: "Redo", defaultKey: "Ctrl+Shift+Z" },
  { id: "cancel", category: "Workspace", label: "Cancel or close menu", defaultKey: "Esc" },
  { id: "settings", category: "Workspace", label: "Workspace settings", defaultKey: "" },
] as const;
export type ActionId = (typeof ACTIONS)[number]["id"];
export type MouseAction = "pan" | "rotate" | "none";
export type SubtreeModifier = "shift" | "alt" | "ctrl" | "none";
export type WorkspaceSettings = {
  spatial: SpatialSettings;
  mouse: { leftEmpty: MouseAction; rightEmpty: MouseAction; subtreeModifier: SubtreeModifier; selectionModifier: SubtreeModifier; nestModifier: SubtreeModifier; backButton: ActionId; forwardButton: ActionId };
  bindings: Record<ActionId, string>;
};
export const SETTINGS_KEY = "omnium.workspace.settings.v1";
export function defaultSettings(): WorkspaceSettings {
  return { spatial: { ...DEFAULT_SPATIAL_SETTINGS }, mouse: { leftEmpty: "pan", rightEmpty: "rotate", subtreeModifier: "shift", selectionModifier: "ctrl", nestModifier: "shift", backButton: "undo", forwardButton: "redo" },
    bindings: Object.fromEntries(ACTIONS.map((action) => [action.id, action.defaultKey])) as Record<ActionId, string> };
}
export function normalizeKey(event: KeyboardEvent): string {
  const key = event.key === "Escape" ? "Esc" : event.key.length === 1 ? event.key.toUpperCase() : event.key;
  return [event.ctrlKey || event.metaKey ? "Ctrl" : "", event.altKey ? "Alt" : "", event.shiftKey ? "Shift" : "", key].filter(Boolean).join("+");
}
export function actionForKey(bindings: WorkspaceSettings["bindings"], key: string): ActionId | null {
  return ACTIONS.find((action) => bindings[action.id] === key)?.id ?? null;
}
export function keyConflict(bindings: WorkspaceSettings["bindings"], actionId: ActionId, key: string): ActionId | null {
  if (!key) return null;
  return ACTIONS.find((action) => action.id !== actionId && bindings[action.id] === key)?.id ?? null;
}
export function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
}
export function subtreeGesture(event: Pick<MouseEvent, "shiftKey" | "altKey" | "ctrlKey" | "metaKey">, modifier: SubtreeModifier): boolean {
  return modifier === "shift" ? event.shiftKey : modifier === "alt" ? event.altKey : modifier === "ctrl" ? event.ctrlKey || event.metaKey : false;
}
export function loadSettings(): WorkspaceSettings {
  const defaults = defaultSettings();
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaults;
    const value = JSON.parse(raw) as Partial<WorkspaceSettings>;
    const spacing = value.spatial?.spacing;
    const permitted: GridSpacing[] = [0, 0.25, 0.5, 1, 2, 5];
    if (spacing !== undefined && permitted.includes(spacing)) defaults.spatial.spacing = spacing;
    if (typeof value.spatial?.radius === "number" && value.spatial.radius >= 0.25 && value.spatial.radius <= 3) defaults.spatial.radius = value.spatial.radius;
    if (typeof value.spatial?.clearance === "number" && value.spatial.clearance >= 0 && value.spatial.clearance <= 2) defaults.spatial.clearance = value.spatial.clearance;
    if (["pan", "rotate", "none"].includes(value.mouse?.leftEmpty ?? "")) defaults.mouse.leftEmpty = value.mouse!.leftEmpty;
    if (["pan", "rotate", "none"].includes(value.mouse?.rightEmpty ?? "")) defaults.mouse.rightEmpty = value.mouse!.rightEmpty;
    if (["shift", "alt", "ctrl", "none"].includes(value.mouse?.subtreeModifier ?? "")) defaults.mouse.subtreeModifier = value.mouse!.subtreeModifier;
    for (const field of ["selectionModifier", "nestModifier"] as const) if (["shift", "alt", "ctrl", "none"].includes(value.mouse?.[field] ?? "")) defaults.mouse[field] = value.mouse![field];
    for (const field of ["backButton", "forwardButton"] as const) if (ACTIONS.some((a) => a.id === value.mouse?.[field])) defaults.mouse[field] = value.mouse![field];
    for (const action of ACTIONS) if (typeof value.bindings?.[action.id] === "string" && value.bindings[action.id].length <= 32) defaults.bindings[action.id] = value.bindings[action.id];
    return defaults;
  } catch { return defaults; }
}
