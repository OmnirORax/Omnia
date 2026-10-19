import { DEFAULT_SPATIAL_SETTINGS, type GridSpacing, type SpatialSettings } from "./graph/layout3d.ts";
import { ANIMATION_TARGETS, EFFECT_KINDS, normalizeSparkleOverrides, type AnimationTarget, type SurfaceTarget, type SparkleStyle, type EffectKind } from "./graph/effects.ts";
import type { StyleDefaults } from "./graph/appearance.ts";
import { normalizeFont, type FontId } from "./fonts.ts";

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
  { id: "nudgeLeft", category: "Spatial editing", label: "Move selected node left", defaultKey: "ArrowLeft" },
  { id: "nudgeRight", category: "Spatial editing", label: "Move selected node right", defaultKey: "ArrowRight" },
  { id: "nudgeUp", category: "Spatial editing", label: "Move selected node up", defaultKey: "ArrowUp" },
  { id: "nudgeDown", category: "Spatial editing", label: "Move selected node down", defaultKey: "ArrowDown" },
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
export const NUDGE_ACTIONS = ["nudgeLeft", "nudgeRight", "nudgeUp", "nudgeDown"] as const;
export type NudgeActionId = (typeof NUDGE_ACTIONS)[number];
export const isNudgeAction = (id: string): id is NudgeActionId => NUDGE_ACTIONS.some(action => action === id);
export type ActionId = (typeof ACTIONS)[number]["id"];
export type MouseAction = "pan" | "rotate" | "none";
export type SubtreeModifier = "shift" | "alt" | "ctrl" | "none";
export type WorkspaceSettings = {
  spatial: SpatialSettings;
  isolateFocus: boolean;
  appearance: { font: FontId; textGlow: number; theme: "neon" | "classic"; accent: string; background: string; opacity: number; glow: number; glowSpread: number; nodes: StyleDefaults; binders: StyleDefaults; atmosphere: boolean; effectColor?: string; effect: EffectKind; effectTargets: Record<AnimationTarget, boolean>; surfaceEffects: Partial<Record<SurfaceTarget, Partial<SparkleStyle>>>; effectIntensity: number; lightningLength: number; density: number; motion: number; windowOpacity: number; blur: number };
  mouse: { leftEmpty: MouseAction; rightEmpty: MouseAction; subtreeModifier: SubtreeModifier; selectionModifier: SubtreeModifier; nestModifier: SubtreeModifier; backButton: ActionId; forwardButton: ActionId; shiftBackButton: ActionId; shiftForwardButton: ActionId };
  bindings: Record<string, string>;
  buttonLabels: Record<string, string>;
};
export const SETTINGS_KEY = "omnium.workspace.settings.v1";
export function defaultSettings(): WorkspaceSettings {
  return { spatial: { ...DEFAULT_SPATIAL_SETTINGS }, isolateFocus: false, appearance: { font: "system", textGlow: 0, theme: "neon", accent: "#60ddec", background: "#030c15", opacity: 1, glow: 0.22, glowSpread: 0.15, nodes: { opacity: 1, glow: 1 }, binders: { opacity: 0.85, glow: 0.7 }, atmosphere: true, effect: "stars", effectTargets: { windows: true, buttons: false, fields: false, nodes: true, binders: true, background: false }, surfaceEffects: {}, effectIntensity: 0.35, lightningLength: 0.35, density: 0.5, motion: 0.25, windowOpacity: 0.9, blur: 10 }, mouse: { leftEmpty: "pan", rightEmpty: "rotate", subtreeModifier: "shift", selectionModifier: "ctrl", nestModifier: "shift", backButton: "undo", forwardButton: "redo", shiftBackButton: "ui:undo", shiftForwardButton: "ui:redo" },
    buttonLabels: {}, bindings: Object.fromEntries(ACTIONS.map((action) => [action.id, action.defaultKey])) };
}
export function normalizeKey(event: KeyboardEvent): string {
  const key = event.key === "Escape" ? "Esc" : event.key.length === 1 ? event.key.toUpperCase() : event.key;
  return [event.ctrlKey || event.metaKey ? "Ctrl" : "", event.altKey ? "Alt" : "", event.shiftKey ? "Shift" : "", key].filter(Boolean).join("+");
}
export function actionForKey(bindings: WorkspaceSettings["bindings"], key: string): ActionId | null {
  return ACTIONS.find((action) => bindings[action.id] === key)?.id ?? null;
}
export function keyConflict(bindings: WorkspaceSettings["bindings"], actionId: string, key: string): string | null {
  if (!key) return null;
  return Object.entries(bindings).find(([id, binding]) => id !== actionId && binding === key)?.[0] ?? null;
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
    defaults.appearance.font = normalizeFont(value.appearance?.font);
    if (typeof value.isolateFocus === "boolean") defaults.isolateFocus = value.isolateFocus;
    if (["neon", "classic"].includes(value.appearance?.theme ?? "")) defaults.appearance.theme = value.appearance!.theme;
    if (typeof value.appearance?.glow === "number" && Number.isFinite(value.appearance.glow)) defaults.appearance.glow = Math.max(0, Math.min(1, value.appearance.glow));
    if (typeof value.appearance?.atmosphere === "boolean") defaults.appearance.atmosphere = value.appearance.atmosphere;
    if (typeof value.appearance?.glowSpread === "number" && Number.isFinite(value.appearance.glowSpread)) defaults.appearance.glowSpread = Math.max(0, Math.min(1, value.appearance.glowSpread));
    for (const group of ["nodes", "binders"] as const) {
      const style = value.appearance?.[group];
      if (/^#[0-9a-f]{6}$/i.test(style?.color ?? "")) defaults.appearance[group].color = style!.color;
      for (const key of ["opacity", "glow"] as const) if (typeof style?.[key] === "number" && Number.isFinite(style[key])) defaults.appearance[group][key] = Math.max(0, Math.min(key === "glow" ? 2 : 1, style[key]));
      if (style?.effects) defaults.appearance[group].effects = normalizeSparkleOverrides(style.effects);
    }
    for (const key of ["accent", "background", "effectColor"] as const) if (/^#[0-9a-f]{6}$/i.test(value.appearance?.[key] ?? "")) defaults.appearance[key] = value.appearance![key]!;
    if (EFFECT_KINDS.includes(value.appearance?.effect as EffectKind)) defaults.appearance.effect = value.appearance!.effect;
    for (const key of ["opacity", "textGlow", "effectIntensity", "lightningLength", "density", "motion", "windowOpacity", "blur"] as const) {
      const n = value.appearance?.[key];
      if (typeof n === "number" && Number.isFinite(n)) defaults.appearance[key] = Math.max(0, Math.min(key === "blur" ? 20 : 1, n));
    }
    for (const target of ANIMATION_TARGETS) {
      if (typeof value.appearance?.effectTargets?.[target] === "boolean") defaults.appearance.effectTargets[target] = value.appearance.effectTargets[target];
      if (target !== "nodes" && target !== "binders" && value.appearance?.surfaceEffects?.[target]) defaults.appearance.surfaceEffects[target] = normalizeSparkleOverrides(value.appearance.surfaceEffects[target]);
    }
    const spacing = value.spatial?.spacing;
    const permitted: GridSpacing[] = [0, 0.25, 0.5, 1, 2, 5];
    if (spacing !== undefined && permitted.includes(spacing)) defaults.spatial.spacing = spacing;
    if (typeof value.spatial?.radius === "number" && value.spatial.radius >= 0.1 && value.spatial.radius <= 3) defaults.spatial.radius = value.spatial.radius;
    if (typeof value.spatial?.clearance === "number" && value.spatial.clearance >= 0 && value.spatial.clearance <= 2) defaults.spatial.clearance = value.spatial.clearance;
    if (["pan", "rotate", "none"].includes(value.mouse?.leftEmpty ?? "")) defaults.mouse.leftEmpty = value.mouse!.leftEmpty;
    if (["pan", "rotate", "none"].includes(value.mouse?.rightEmpty ?? "")) defaults.mouse.rightEmpty = value.mouse!.rightEmpty;
    if (["shift", "alt", "ctrl", "none"].includes(value.mouse?.subtreeModifier ?? "")) defaults.mouse.subtreeModifier = value.mouse!.subtreeModifier;
    for (const field of ["selectionModifier", "nestModifier"] as const) if (["shift", "alt", "ctrl", "none"].includes(value.mouse?.[field] ?? "")) defaults.mouse[field] = value.mouse![field];
    for (const field of ["backButton", "forwardButton", "shiftBackButton", "shiftForwardButton"] as const) if (ACTIONS.some((a) => a.id === value.mouse?.[field])) defaults.mouse[field] = value.mouse![field];
    for (const action of ACTIONS) if (typeof value.bindings?.[action.id] === "string" && value.bindings[action.id].length <= 32) defaults.bindings[action.id] = value.bindings[action.id];
    for (const [id, key] of Object.entries(value.bindings ?? {})) {
      if (!id.startsWith("button:") || id.length > 300 || typeof key !== "string" || key.length > 32) continue;
      defaults.bindings[id] = key;
      const label = value.buttonLabels?.[id];
      defaults.buttonLabels[id] = typeof label === "string" ? label.slice(0, 200) : id.slice(7);
    }
    // New defaults must not take keys already assigned in an existing saved configuration.
    for (const action of NUDGE_ACTIONS) {
      const key = defaults.bindings[action];
      if (value.bindings && !Object.hasOwn(value.bindings, action) && Object.entries(value.bindings).some(([id, binding]) => id !== action && binding === key && defaults.bindings[id] === key)) defaults.bindings[action] = "";
    }
    return defaults;
  } catch { return defaults; }
}

/** Shared IDs keep ordinary actions and their customized buttons on one binding. */
export const buttonShortcutId = (id: string) => ACTIONS.some(action => action.id === id) ? id : `button:${id}`;
export type ButtonShortcuts = {
  bindings: Record<string, string>;
  capturing: string | null;
  blocked: boolean;
  onCapture: (id: string, label: string) => void;
  onClear: (id: string) => void;
  onInvoke?: (id: string) => boolean;
};
