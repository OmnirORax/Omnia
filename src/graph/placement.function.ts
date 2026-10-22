import { defineFunction } from "../properties/function.ts";
import type { WorkspaceSettings } from "../workspaceActions";
/** These input bindings drive placement settings, local controls and the master setter. */
export default defineFunction<WorkspaceSettings>({
  id: "spatial.placement", label: "Placement clearance", owner: "settings", controls: ["ui:radius", "ui:clearance"],
  group: [{ id: "spatial", label: "Spatial" }], inputs: {
    "placement.radius": {
      definition: { id: "placement.radius", label: "Minimum placement radius", kind: "number", min: .1, max: 3, step: .05,
        initial: .5, unit: "world-unit", category: { id: "spatial", label: "Spatial" } },
      read: settings => settings.spatial.radius,
      write: (settings, value) => ({ ...settings, spatial: { ...settings.spatial, radius: Number(value) } }),
    },
    "placement.clearance": {
      definition: { id: "placement.clearance", label: "Collision clearance", kind: "number", min: 0, max: 2, step: .05,
        initial: .35, unit: "world-unit", category: { id: "spatial", label: "Spatial" } },
      read: settings => settings.spatial.clearance,
      write: (settings, value) => ({ ...settings, spatial: { ...settings.spatial, clearance: Number(value) } }),
    },
  },
});
