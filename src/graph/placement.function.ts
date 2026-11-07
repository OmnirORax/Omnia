import { DEFAULT_NODE_CELL_SIZE } from "./assets.ts";
import { defineFunction } from "../properties/function.ts";
import type { WorkspaceSettings } from "../workspaceActions";
/** These input bindings drive placement settings, local controls and the master setter. */
export default defineFunction<WorkspaceSettings>({
  id: "spatial.placement", label: "Placement clearance", owner: "settings", controls: ["ui:nodeNames", "ui:nodeCellSize", "ui:vacantCells", "ui:radius", "ui:clearance"],
  group: [{ id: "spatial", label: "Spatial" }], inputs: {
    "placement.names": {
      definition: { id: "placement.names", label: "Node names", kind: "select", options: [{id:"expanded",label:"Expanded"},{id:"all",label:"All"},{id:"selection",label:"Selection"}], initial: "expanded", category: { id: "spatial", label: "Spatial" } },
      read: settings => settings.spatial.nodeNames ?? "expanded",
      write: (settings, value) => ({ ...settings, spatial: { ...settings.spatial, nodeNames: value as "expanded" | "all" | "selection" } }),
    },
    "placement.latticeScale": {
      definition: { id: "placement.latticeScale", label: "Lattice scale", kind: "number", min: Number.MIN_VALUE, max: Number.MAX_VALUE, step: .01,
        initial: 1, category: { id: "spatial", label: "Spatial" } },
      read: settings => settings.spatial.latticeScale ?? 1,
      write: (settings, value) => ({ ...settings, spatial: { ...settings.spatial, latticeScale: Number(value) } }),
    },
    "placement.vacantCells": {
      definition: { id: "placement.vacantCells", label: "Empty lattice cells", kind: "toggle", initial: false, category: { id: "spatial", label: "Spatial" } },
      read: settings => settings.spatial.showVacantCells ?? false,
      write: (settings,value) => ({...settings,spatial:{...settings.spatial,showVacantCells:!!value}}),
    },
    "placement.cellSize": {
      definition: { id: "placement.cellSize", label: "Node cell size", kind: "number", min: .1, max: 5, step: .05,
        initial: DEFAULT_NODE_CELL_SIZE, unit: "world-unit", category: { id: "spatial", label: "Spatial" } },
      read: settings => settings.spatial.nodeCellSize ?? DEFAULT_NODE_CELL_SIZE,
      write: (settings, value) => ({ ...settings, spatial: { ...settings.spatial, nodeCellSize: Number(value) } }),
    },
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
