import type { WorkspaceSettings } from "../workspaceActions";
export const NAVIGATION_ID = "world.navigation";
export const MODES = [
  { id: "auto", label: "Context rotation", description: "Drag a node to turn it; empty space orbits the selected branch, or looks around with no selection." },
  { id: "orbit", label: "Orbit pivot", description: "Camera moves around the chosen pivot; nodes stay fixed." },
  { id: "look", label: "Look around", description: "Camera turns at its own position; nodes stay fixed." },
  { id: "pan", label: "Pan view", description: "Camera translates; Free follows its view plane. Facing stays fixed." },
  { id: "walk", label: "Walk / strafe", description: "Camera translates; its viewing direction stays fixed." },
  { id: "orient", label: "Turn nodes", description: "Turn each target node at its own center; positions stay fixed." },
  { id: "layout", label: "Rotate layout", description: "Rotate target positions around the pivot; node facing stays fixed." },
] as const;
export type NavigationMode = typeof MODES[number]["id"];
export type NavigationOptions = { mode: NavigationMode; actor: "auto" | "camera" | "object"; pivot: "focus" | "selection" | "pointed" | "origin"; target: "selection" | "pointed"; axis: "free" | "x" | "y" | "z"; upright: boolean; descendants: boolean; speed: number };
export const NAV_DEFAULTS: NavigationOptions = { mode: "auto", actor: "auto", pivot: "focus", target: "selection", axis: "free", upright: true, descendants: false, speed: 1 };
export const NAV_KEYS = { mode: "navigation.mode", actor: "navigation.actor", pivot: "navigation.pivot", target: "navigation.target", axis: "navigation.axis", upright: "navigation.upright", descendants: "navigation.descendants", speed: "input.sensitivity" } as const;
export const MAX_TRANSFORM_TARGETS = 256;
export function navigationOptions(settings: WorkspaceSettings): NavigationOptions {
  const fields = settings.functionValues[NAVIGATION_ID] ?? {};
  return Object.fromEntries(Object.entries(NAV_DEFAULTS).map(([key, value]) => [key, fields[NAV_KEYS[key as keyof NavigationOptions]] ?? (key === "mode" && settings.mouse.rightEmpty === "pan" ? "pan" : value)])) as NavigationOptions;
}

export function navigationConstraint(options: NavigationOptions) {
  if (options.axis !== "free") return `world ${options.axis.toUpperCase()} axis`;
  if (options.mode === "pan") return "camera view plane";
  if (options.mode === "walk") return options.upright ? "ground plane · fixed height" : "camera plane";
  return "free · camera up/right · full turns";
}
