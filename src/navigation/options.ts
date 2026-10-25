import type { WorkspaceSettings } from "../workspaceActions";
export const NAVIGATION_ID = "world.navigation";
export const MODES = [
  { id: "orbit", label: "Orbit pivot", description: "Camera moves around the chosen pivot; nodes stay fixed." },
  { id: "look", label: "Look around", description: "Camera turns at its own position; nodes stay fixed." },
  { id: "pan", label: "Pan view", description: "Camera translates; Free follows its view plane. Facing stays fixed." },
  { id: "walk", label: "Walk / strafe", description: "Camera translates; its viewing direction stays fixed." },
  { id: "orient", label: "Turn nodes", description: "Turn each target node at its own center; positions stay fixed." },
  { id: "layout", label: "Rotate layout", description: "Rotate target positions around the pivot; node facing stays fixed." },
] as const;
export type NavigationMode = typeof MODES[number]["id"];
export type NavigationOptions = { mode: NavigationMode; pivot: "focus" | "selection" | "pointed" | "origin"; target: "selection" | "pointed"; axis: "free" | "x" | "y" | "z"; upright: boolean; descendants: boolean; speed: number };
export const NAV_DEFAULTS: NavigationOptions = { mode: "orbit", pivot: "focus", target: "selection", axis: "free", upright: true, descendants: false, speed: 1 };
export const NAV_KEYS = { mode: "navigation.mode", pivot: "navigation.pivot", target: "navigation.target", axis: "navigation.axis", upright: "navigation.upright", descendants: "navigation.descendants", speed: "input.sensitivity" } as const;
export const MAX_TRANSFORM_TARGETS = 256;
export function navigationOptions(settings: WorkspaceSettings): NavigationOptions {
  const fields = settings.functionValues[NAVIGATION_ID] ?? {};
  return Object.fromEntries(Object.entries(NAV_DEFAULTS).map(([key, value]) => [key, fields[NAV_KEYS[key as keyof NavigationOptions]] ?? (key === "mode" && settings.mouse.rightEmpty === "pan" ? "pan" : value)])) as NavigationOptions;
}

export function navigationConstraint(options: NavigationOptions) {
  if (options.axis !== "free") return `world ${options.axis.toUpperCase()} axis`;
  if (options.mode === "pan") return "camera view plane";
  if (options.mode === "walk") return options.upright ? "ground plane · fixed height" : "camera plane";
  if ((options.mode === "orbit" || options.mode === "look") && options.upright) return "upright · pitch ±89.4°";
  return "free · camera up/right";
}
