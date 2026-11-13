import { defineFunction } from "../properties/function.ts";
import type { WorkspaceSettings } from "../workspaceActions";
export default defineFunction<WorkspaceSettings>({
  id: "ui.frame.resize", label: "Frame resize", owner: "settings", controls: ["context.resize"],
  group: [{ id: "interface", label: "Interface" }], inputs: {
    "operation.level": {
      definition: { id: "operation.level", label: "Level", kind: "number", min: 1, max: 10, step: 1,
        initial: 1, unit: "ordinal", category: { id: "interface", label: "Interface" } },
      read: settings => Math.max(1, Math.min(10, Math.round(Number(settings.functionValues["ui.frame.resize"]?.["operation.level"]) || 1))),
      write: (settings, value) => ({ ...settings, functionValues: { ...settings.functionValues,
        "ui.frame.resize": { ...settings.functionValues["ui.frame.resize"], "operation.level": Math.max(1, Math.min(10, Math.round(Number(value)))) } } }),
    },
  },
});
