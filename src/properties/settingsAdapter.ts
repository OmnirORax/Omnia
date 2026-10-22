import type { WorkspaceSettings } from "../workspaceActions";
import { PROPERTY_REGISTRY } from "../appearance/registry.ts";
import { bindStateProperties, type StatePropertyAdapters } from "./registry.ts";
import { CONFIGURABLE_FUNCTIONS } from "./functions.generated.ts";
/** Adapter discovery follows the real function inputs; no second setter/channel list. */
export const SETTINGS_PROPERTY_ADAPTERS: StatePropertyAdapters<WorkspaceSettings> = Object.fromEntries(
  CONFIGURABLE_FUNCTIONS.filter(fn => fn.consumer.owner === "settings").map(fn => [fn.consumer.id, {
    channels: Object.fromEntries(Object.entries(fn.inputs).map(([id, input]) => [id, input])),
  }]),
) as StatePropertyAdapters<WorkspaceSettings>;
export function settingsPropertyBindings(settings: WorkspaceSettings, update: (change: (old: WorkspaceSettings) => WorkspaceSettings) => void) {
  return bindStateProperties(PROPERTY_REGISTRY, "settings", settings, SETTINGS_PROPERTY_ADAPTERS, update);
}
