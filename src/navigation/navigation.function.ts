import { defineFunction } from "../properties/function.ts";
import type { WorkspaceSettings } from "../workspaceActions";
import { NAVIGATION_ID, NAV_DEFAULTS, NAV_KEYS, MODES, navigationOptions, type NavigationOptions } from "./options.ts";
import type { PropertyDefinition } from "../properties/registry.ts";
const category = { id: "spatial", label: "Spatial" };
const select = (key: keyof NavigationOptions, label: string, options: readonly { id: string; label: string }[]): PropertyDefinition => ({ id: NAV_KEYS[key], label, kind: "select", initial: NAV_DEFAULTS[key], options, category });
const definitions: Record<string, PropertyDefinition | undefined> = {
  speed: { id: NAV_KEYS.speed, label: "Drag sensitivity", kind: "number", min: .1, max: 2, step: .05, initial: 1, unit: "multiplier", category },
  mode: select("mode", "Movement mode", MODES),
  pivot: select("pivot", "Pivot", [{ id: "focus", label: "Current focus point" }, { id: "selection", label: "Selection center" }, { id: "pointed", label: "Pointed node center" }, { id: "origin", label: "World origin" }]),
  target: select("target", "Node targets", [{ id: "selection", label: "Selected nodes" }, { id: "pointed", label: "Pointed node" }]),
  axis: select("axis", "World axis", [{ id: "free", label: "Free" }, ...["x", "y", "z"].map(id => ({ id, label: `${id.toUpperCase()} only` }))]),
  upright: { id: NAV_KEYS.upright, label: "Ground-plane walking", kind: "toggle", initial: true, category },
  descendants: { id: NAV_KEYS.descendants, label: "Include descendants", kind: "toggle", initial: false, category },
};
export default defineFunction<WorkspaceSettings>({ id: NAVIGATION_ID, label: "World navigation", owner: "settings", controls: ["world.navigate"],
  group: [{ id: "spatial", label: "Spatial" }], inputs: Object.fromEntries(Object.entries(NAV_DEFAULTS).map(([key, initial]) => {
    const property = NAV_KEYS[key as keyof NavigationOptions];
    return [property, { ...(definitions[key] ? { definition: definitions[key] } : {}), initial,
      read: (settings: WorkspaceSettings) => navigationOptions(settings)[key as keyof NavigationOptions],
      write: (settings: WorkspaceSettings, value: string | number | boolean) => ({ ...settings, functionValues: { ...settings.functionValues, [NAVIGATION_ID]: { ...settings.functionValues[NAVIGATION_ID], [property]: value } } }),
    }];
  })),
});
