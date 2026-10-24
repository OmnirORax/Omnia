import { defineFunction } from "../properties/function.ts";
import type { WorkspaceSettings } from "../workspaceActions";
export default defineFunction<WorkspaceSettings>({
  id: "ui.search", label: "Search", owner: "settings", controls: ["context.search"],
  group: [{ id: "interface", label: "Interface" }], inputs: {
    "operation.level": {
      read: settings => Math.max(1, Math.min(10, Math.round(Number(settings.functionValues["ui.search"]?.["operation.level"]) || 1))),
      write: (settings, value) => ({ ...settings, functionValues: { ...settings.functionValues,
        "ui.search": { ...settings.functionValues["ui.search"], "operation.level": Number(value) } } }),
    },
  },
});
