/** Compatibility only: old movable control IDs now use the common adjuster. */
export const LEGACY_CONTROLS: Record<string, { label: string; property: string; target: string }> =
  {
    "ui:appearance:accent": { label: "All appearance color", property: "color", target: "all" },
    "ui:appearance:opacity": { label: "Appearance opacity", property: "opacity", target: "all" },
    "ui:glow": { label: "Appearance glow", property: "glow", target: "all" },
    "ui:appearance:textColor": { label: "All text color", property: "color", target: "text" },
    "ui:appearance:textGlow": { label: "All text glow", property: "glow", target: "text" },
    "ui:appearance:font": { label: "All text font", property: "font", target: "text" },
    "ui:appearance:controlGlow": {
      label: "Bars and sliders glow",
      property: "glow",
      target: "ui.sliders",
    },
    "ui:appearance:background": {
      label: "Background color",
      property: "color",
      target: "workspace.background",
    },
    "ui:appearance:blur": {
      label: "Window blur",
      property: "blur",
      target: "ui.windows.background",
    },
    "ui:appearance:windowOpacity": {
      label: "Window opacity",
      property: "opacity",
      target: "ui.windows.background",
    },
    "ui:appearance:effect": { label: "Animation", property: "effect", target: "all" },
    "ui:appearance:effectIntensity": {
      label: "Effect intensity",
      property: "intensity",
      target: "all",
    },
    "ui:appearance:density": { label: "Density", property: "density", target: "all" },
    "ui:appearance:motion": { label: "Animation speed", property: "speed", target: "all" },
    "ui:animation:color": { label: "Animation color", property: "effectColor", target: "all" },
    "ui:animation:starSize": { label: "Star size", property: "size", target: "all" },
    "ui:animation:boltLength": { label: "Lightning length", property: "length", target: "all" },
  };
for (const group of ["nodes", "binders"])
  for (const property of ["color", "opacity", "glow"])
    LEGACY_CONTROLS[`ui:appearance:${group}:${property}`] = {
      label: `${group} ${property}`,
      property,
      target: group === "nodes" ? "omnium.nodes.body" : "omnium.binders.path",
    };
