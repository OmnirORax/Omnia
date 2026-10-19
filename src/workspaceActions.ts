import { DEFAULT_SPATIAL_SETTINGS, type GridSpacing, type SpatialSettings } from "./graph/layout3d.ts";

export const ACTIONS = [
  { id: "ui:arrange", category: "Workspace", label: "UI library", defaultKey: "Ctrl+Alt+U" },
  { id: "ui:createFrame", category: "Workspace", label: "Create UI frame", defaultKey: "" },
  { id: "ui:reset", category: "Workspace", label: "Reset to default", defaultKey: "" },
  { id: "ui:undo", category: "UI history", label: "Undo UI", defaultKey: "" },
  { id: "ui:redo", category: "UI history", label: "Redo UI", defaultKey: "" },
  { id: "ui:select", category: "UI editing", label: "Select UI buttons", defaultKey: "" },
  { id: "ui:compact", category: "UI editing", label: "Compact selected UI", defaultKey: "" },
  { id: "ui:align", category: "UI editing", label: "Align UI", defaultKey: "" },
  { id: "selectAll", category: "Selection", label: "Select visible nodes", defaultKey: "Ctrl+A" },
  { id: "deleteSelected", category: "Selection", label: "Delete selected concepts and subnodes", defaultKey: "Delete" },
  { id: "shortcuts", category: "Workspace", label: "Toggle shortcut display", defaultKey: "Shift+?" },
  { id: "focus", category: "Navigation", label: "Focus selected", defaultKey: "F" },
  { id: "isolateFocus", category: "Navigation", label: "Focus context only", defaultKey: "" },
  { id: "fitLocal", category: "Navigation", label: "Fit local system", defaultKey: "Shift+F" },
  { id: "fitAll", category: "Navigation", label: "Fit entire atlas", defaultKey: "" },
  { id: "back", category: "Navigation", label: "Back to previous focus", defaultKey: "" },
  { id: "zoom100", category: "Navigation", label: "Reset zoom to 100%", defaultKey: "" },
  { id: "cameraOrigin", category: "Navigation", label: "Go to world origin", defaultKey: "" },
  { id: "rollLeft", category: "Navigation", label: "Roll view left 90°", defaultKey: "" },
  { id: "rollRight", category: "Navigation", label: "Roll view right 90°", defaultKey: "" },
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
  { id: "compactAll", category: "Spatial editing", label: "Compact selected / all", defaultKey: "" },
  { id: "undo", category: "History", label: "Undo", defaultKey: "Ctrl+Z" },
  { id: "redo", category: "History", label: "Redo", defaultKey: "Ctrl+Shift+Z" },
  { id: "cancel", category: "Workspace", label: "Cancel or close menu", defaultKey: "Esc" },
  { id: "settings", category: "Workspace", label: "Workspace settings", defaultKey: "" },
  { id: "theme", category: "Workspace", label: "Toggle neon appearance", defaultKey: "" },
  { id: "appearance", category: "Workspace", label: "Theme / aesthetics", defaultKey: "" },
] as const;
export type ActionId = (typeof ACTIONS)[number]["id"];
export type MouseAction = "pan" | "rotate" | "none";
export type SubtreeModifier = "shift" | "alt" | "ctrl" | "none";
export type WorkspaceSettings = {
  spatial: SpatialSettings;
  isolateFocus: boolean;
  appearance: { theme: "neon" | "classic"; accent: string; background: string; glow: number; atmosphere: boolean; effect: "stars" | "dust" | "sparks" | "off"; effectIntensity: number; density: number; motion: number; windowOpacity: number; blur: number };
  mouse: { leftEmpty: MouseAction; rightEmpty: MouseAction; subtreeModifier: SubtreeModifier; selectionModifier: SubtreeModifier; nestModifier: SubtreeModifier; backButton: ActionId; forwardButton: ActionId; shiftBackButton: ActionId; shiftForwardButton: ActionId };
  bindings: Record<ActionId, string>;
};
export const SETTINGS_KEY = "omnium.workspace.settings.v1";
export function defaultSettings(): WorkspaceSettings {
  return { spatial: { ...DEFAULT_SPATIAL_SETTINGS }, isolateFocus: false, appearance: { theme: "neon", accent: "#60ddec", background: "#030c15", glow: 0.22, atmosphere: true, effect: "stars", effectIntensity: 0.35, density: 0.5, motion: 0.25, windowOpacity: 0.9, blur: 10 }, mouse: { leftEmpty: "pan", rightEmpty: "rotate", subtreeModifier: "shift", selectionModifier: "ctrl", nestModifier: "shift", backButton: "undo", forwardButton: "redo", shiftBackButton: "ui:undo", shiftForwardButton: "ui:redo" },
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
  try { const raw = localStorage.getItem(SETTINGS_KEY); return normalizeSettings(raw ? JSON.parse(raw) : {}); } catch { return defaultSettings(); }
}
export function normalizeSettings(input: unknown): WorkspaceSettings {
  const defaults = defaultSettings();
  try {
    const value = input as Partial<WorkspaceSettings>;
    if (typeof value.isolateFocus === "boolean") defaults.isolateFocus = value.isolateFocus;
    if (["neon", "classic"].includes(value.appearance?.theme ?? "")) defaults.appearance.theme = value.appearance!.theme;
    if (typeof value.appearance?.glow === "number" && Number.isFinite(value.appearance.glow)) defaults.appearance.glow = Math.max(0, Math.min(1, value.appearance.glow));
    if (typeof value.appearance?.atmosphere === "boolean") defaults.appearance.atmosphere = value.appearance.atmosphere;
    for (const key of ["accent", "background"] as const) if (/^#[0-9a-f]{6}$/i.test(value.appearance?.[key] ?? "")) defaults.appearance[key] = value.appearance![key];
    if (["stars", "dust", "sparks", "off"].includes(value.appearance?.effect ?? "")) defaults.appearance.effect = value.appearance!.effect;
    for (const key of ["effectIntensity", "density", "motion", "windowOpacity", "blur"] as const) {
      const n = value.appearance?.[key];
      if (typeof n === "number" && Number.isFinite(n)) defaults.appearance[key] = Math.max(0, Math.min(key === "blur" ? 20 : 1, n));
    }
    const spacing = value.spatial?.spacing;
    const permitted: GridSpacing[] = [0, 0.25, 0.5, 1, 2, 5];
    if (spacing !== undefined && permitted.includes(spacing)) defaults.spatial.spacing = spacing;
    if (typeof value.spatial?.radius === "number" && value.spatial.radius >= 0.25 && value.spatial.radius <= 3) defaults.spatial.radius = value.spatial.radius;
    if (typeof value.spatial?.clearance === "number" && value.spatial.clearance >= 0 && value.spatial.clearance <= 2) defaults.spatial.clearance = value.spatial.clearance;
    if (["pan", "rotate", "none"].includes(value.mouse?.leftEmpty ?? "")) defaults.mouse.leftEmpty = value.mouse!.leftEmpty;
    if (["pan", "rotate", "none"].includes(value.mouse?.rightEmpty ?? "")) defaults.mouse.rightEmpty = value.mouse!.rightEmpty;
    if (["shift", "alt", "ctrl", "none"].includes(value.mouse?.subtreeModifier ?? "")) defaults.mouse.subtreeModifier = value.mouse!.subtreeModifier;
    for (const field of ["selectionModifier", "nestModifier"] as const) if (["shift", "alt", "ctrl", "none"].includes(value.mouse?.[field] ?? "")) defaults.mouse[field] = value.mouse![field];
    for (const field of ["backButton", "forwardButton", "shiftBackButton", "shiftForwardButton"] as const) if (ACTIONS.some((a) => a.id === value.mouse?.[field])) defaults.mouse[field] = value.mouse![field];
    for (const action of ACTIONS) if (typeof value.bindings?.[action.id] === "string" && value.bindings[action.id].length <= 32) defaults.bindings[action.id] = value.bindings[action.id];
    return defaults;
  } catch { return defaults; }
}
