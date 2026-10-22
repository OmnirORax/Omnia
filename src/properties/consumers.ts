import type { ConsumerDefinition } from "./registry.ts";
/** Declare a consumer's real input channels once. Lookup/coupling generates discovery. */
export const PROPERTY_CONSUMERS: readonly ConsumerDefinition[] = [
  { id: "ui.mouse.trail", label: "Mouse trail", owner: "appearance", locator: ".mouse-trail",
    group: [{ id: "ui", label: "Windows / frames / controls" }, { id: "ui.mouse", label: "Mouse" }],
    properties: [
      { property: "effect", initial: "off", choices: ["off", "lightning", "stars"] },
      { property: "speed", initial: .25 }, { property: "intensity", initial: .5 },
      { property: "density", initial: 1 }, { property: "size", initial: 1 }, { property: "length", initial: .35 },
      { property: "effectColor", initial: "#60ddec" }, { property: "effectBrightness", initial: 1 },
      { property: "effectOpacity", initial: 1 }, { property: "effectGlow", initial: .5 },
    ] },
  { id: "spatial.placement", label: "Placement clearance", owner: "settings", controls: ["ui:radius", "ui:clearance"],
    group: [{ id: "spatial", label: "Spatial" }], properties: [
      { property: { id: "placement.radius", label: "Minimum placement radius", kind: "number", min: .1, max: 3, step: .05, initial: .5,
        unit: "world-unit", category: { id: "spatial", label: "Spatial" } } },
      { property: { id: "placement.clearance", label: "Collision clearance", kind: "number", min: 0, max: 2, step: .05, initial: .35,
        unit: "world-unit", category: { id: "spatial", label: "Spatial" } } },
    ] },
];
