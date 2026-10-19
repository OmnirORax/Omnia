/** Discoverable defaults, including fields whose editing context is not currently open. */
export const UI_FIELD_CATALOG = [
  ["field:node-name", "Node name", "Nodes"],
  ["field:entity-aliases", "Entity aliases", "Nodes"],
  ["field:node-notes", "Node notes", "Nodes"],
  ["field:node-parent", "Visual parent", "Nodes"],
  ["field:structural-container", "Structural container", "Nodes"],
  ["field:hide-this-placement", "Hide placement", "Nodes"],
  ...["X", "Y", "Z"].map((axis) => [`field:3D ${axis} position`, `3D ${axis} position`, "Nodes"]),
  ["field:view-name", "View name", "View"],
  ["field:find-existing-identity", "Find existing identity", "Nodes"],
  ["field:frame-question", "Frame question", "Investigations"],
  ["field:reopen-frame", "Reopen frame", "Investigations"],
  ["field:lock-frame-scope", "Lock frame scope", "Investigations"],
  ["field:find-frame-identity", "Find frame identity", "Investigations"],
  ["field:exploration-depth", "Exploration depth", "Investigations"],
  ["field:relationship-type", "Relationship type", "Relationships"],
  ["field:relationship-label", "Relationship label", "Relationships"],
  ["field:relationship-source", "Relationship source", "Relationships"],
  ["field:relationship-target", "Relationship target", "Relationships"],
  ["field:new-relationship-source", "New relationship source", "Relationships"],
  ["field:new-relationship-target", "New relationship target", "Relationships"],
  ["binder:text", "Binder text", "Relationships"],
  ...["Node", "Binder"].flatMap((label) => [
    [`appearance:${label}:color`, `${label} color`, label === "Node" ? "Nodes" : "Relationships"],
    [
      `appearance:${label}:opacity`,
      `${label} opacity`,
      label === "Node" ? "Nodes" : "Relationships",
    ],
    ...[
      ["symbol", "symbol"],
      ["asset", "asset import"],
      ["saved", "saved asset"],
      ["text", "show text"],
      ["size", "visual size"],
    ].map(([id, name]) => [
      `visual:${label}:${id}`,
      `${label} ${name}`,
      label === "Node" ? "Nodes" : "Relationships",
    ]),
  ]),
].map(([id, label, category]) => ({ id, label, category }));
export const LIBRARY_CATEGORIES = [
  "File",
  "Edit",
  "View",
  "Create",
  "Nodes",
  "Relationships",
  "Investigations",
  "AI",
  "Settings",
  "Shortcuts",
  "Interface",
];
export function libraryCategory(fn: { id: string; category?: string }) {
  if (/^ui:(export|import|saveTemplate|loadTemplate)$/.test(fn.id)) return "File";
  if (["undo", "redo", "deleteSelected"].includes(fn.id) || fn.category === "Selection")
    return "Edit";
  if (fn.id.startsWith("shortcut:")) return "Shortcuts";
  if (/^ui:(view|newView|flow)/.test(fn.id)) return "View";
  if (fn.id === "ui:startInvestigation") return "Investigations";
  if (fn.id === "ui:defineType") return "Relationships";
  if (fn.id === "ui:reviewProposal") return "AI";
  if (fn.id.startsWith("panel:") || ["Navigation", "Expansion", "View"].includes(fn.category ?? ""))
    return "View";
  if (fn.category === "Structure creation") return "Create";
  if (
    fn.category === "Spatial editing" ||
    fn.category === "UI history" ||
    fn.category === "UI editing" ||
    fn.id.startsWith("ui:placement") ||
    ["ui:arrange", "ui:createFrame", "ui:undo", "ui:redo", "ui:reset"].includes(fn.id)
  )
    return "Interface";
  if (
    fn.id.startsWith("ui:gesture:") ||
    fn.id.startsWith("ui:mouse:") ||
    fn.id.startsWith("ui:camera:")
  )
    return "Settings";
  return LIBRARY_CATEGORIES.includes(fn.category ?? "") ? fn.category! : "Settings";
}
