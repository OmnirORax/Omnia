import type { WorkspaceSettings } from "../workspaceActions";
import { PROPERTY_REGISTRY } from "../appearance/registry.ts";
import { bindStateProperties, type StatePropertyAdapters } from "./registry.ts";
/** Consumer-specific input mapping; validation, targeting and batching are shared. */
export const SETTINGS_PROPERTY_ADAPTERS: StatePropertyAdapters<WorkspaceSettings> = {
  "spatial.placement": { channels: {
    "placement.radius": {
      read: settings => settings.spatial.radius,
      write: (settings, value) => ({ ...settings, spatial: { ...settings.spatial, radius: Number(value) } }),
    },
    "placement.clearance": {
      read: settings => settings.spatial.clearance,
      write: (settings, value) => ({ ...settings, spatial: { ...settings.spatial, clearance: Number(value) } }),
    },
  } },
};
export function settingsPropertyBindings(settings: WorkspaceSettings, update: (change: (old: WorkspaceSettings) => WorkspaceSettings) => void) {
  return bindStateProperties(PROPERTY_REGISTRY, "settings", settings, SETTINGS_PROPERTY_ADAPTERS, update);
}
