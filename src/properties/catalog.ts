import { EFFECT_KINDS } from "../graph/effects.ts";
import { FONT_OPTIONS, normalizeFont } from "../fonts.ts";
import { createPropertyRegistry, validateValue, type PropertyDefinition, type PropertyValue as Value } from "./registry.ts";
export type Property = PropertyDefinition;
/** Existing shared definitions. New feature inputs define unique properties at
 * their source; discovery adds them to this same pool automatically. */
const builtins: Property[] = [
  { id: "color", label: "Color", kind: "color", initial: "#60ddec" },
  {
    id: "brightness",
    label: "Brightness",
    kind: "number",
    min: 0,
    max: 3,
    step: 0.05,
    initial: 1,
    neutral: 1,
  },
  {
    id: "opacity",
    label: "Opacity",
    kind: "number",
    min: 0,
    max: 1,
    step: 0.05,
    initial: 1,
    neutral: 1,
  },
  { id: "glow", label: "Glow", kind: "number", min: 0, max: 2, step: 0.05, initial: 0, neutral: 0 },
  { id: "blur", label: "Blur", kind: "number", min: 0, max: 20, step: 1, initial: 10, neutral: 0 },
  {
    id: "effect",
    label: "Animation",
    kind: "select",
    initial: "stars",
    neutral: "off",
    options: EFFECT_KINDS.map((id) => ({
      id,
      label:
        id === "starfield"
          ? "🌌✧"
          : id === "electric-text"
            ? "Lightning text / icons"
            : id === "falling-stars"
              ? "Falling stars / snow"
              : id === "lightning"
                ? "Lightning outlines"
                : id[0].toUpperCase() + id.slice(1),
    })),
  },
  {
    id: "speed",
    label: "Animation speed",
    kind: "number",
    min: 0,
    max: 1,
    step: 0.05,
    initial: 0.25,
    neutral: 0,
  },
  {
    id: "intensity",
    label: "Effect intensity",
    kind: "number",
    min: 0,
    max: 1,
    step: 0.05,
    initial: 0.35,
    neutral: 0,
  },
  {
    id: "density",
    numericRange: { by: "effect", otherwise: { max: 1 }, cases: { starfield: { max: 4 } } },
    label: "Density",
    kind: "number",
    min: 0,
    max: 4,
    step: 0.05,
    initial: 0.5,
    neutral: 0,
  },
  {
    id: "size",
    label: "Star size",
    kind: "number",
    min: 0.1,
    max: 3,
    step: 0.05,
    initial: 1,
    neutral: 1,
  },
  {
    id: "length",
    label: "Lightning length",
    kind: "number",
    min: 0.05,
    max: 1,
    step: 0.05,
    initial: 0.35,
  },
  {
    id: "font",
    label: "Font",
    kind: "select",
    initial: "system",
    neutral: "system",
    options: FONT_OPTIONS,
  },
];
const numeric = (
  id: string,
  label: string,
  min: number,
  max: number,
  step: number,
  initial: number,
): Property => ({ id, label, kind: "number", min, max, step, initial, neutral: initial });
builtins.push(
  numeric("contourWidth", "Contour thickness", 0, 12, 0.5, 1),
  {
    id: "contourStyle",
    label: "Contour style",
    kind: "select",
    initial: "solid",
    neutral: "solid",
    options: ["solid", "dashed", "dotted"].map((id) => ({ id, label: id })),
  },
  numeric("rounding", "Corner rounding", 0, 48, 1, 6),
  numeric("textSize", "UI text size", 8, 48, 1, 12),
  numeric("textWeight", "UI text weight", 100, 900, 100, 400),
  numeric("textSpacing", "UI text spacing", -1, 6, 0.1, 0),
  { id: "gradient", label: "Gradient fill", kind: "toggle", initial: false, neutral: false },
  { id: "gradientColor", label: "Gradient second color", kind: "color", initial: "#7546cf", previewActivation: { property: "gradient", inactive: false, active: true } },
  { ...numeric("gradientAngle", "Gradient direction", 0, 360, 1, 135), previewActivation: { property: "gradient", inactive: false, active: true } },
  numeric("shadowStrength", "Shadow strength", 0, 1, 0.05, 0),
  numeric("shadowSpread", "Shadow spread", 0, 32, 1, 0),
  numeric("shadowX", "Shadow horizontal offset", -32, 32, 1, 0),
  numeric("shadowY", "Shadow vertical offset", -32, 32, 1, 4),
  numeric("saturation", "UI icon saturation", 0, 2, 0.05, 1),
);
// Effect controls describe a target's presentation, never another target branch.
export const EFFECT_PROPERTIES = [
  "effect",
  "speed",
  "intensity",
  "density",
  "size",
  "length",
  "effectColor",
  "effectBrightness",
  "effectOpacity",
  "effectGlow",
];
for (const [id, label, source] of [
  ["effectColor", "Animation color", "color"],
  ["effectBrightness", "Animation brightness", "brightness"],
  ["effectOpacity", "Animation opacity", "opacity"],
  ["effectGlow", "Animation glow", "glow"],
] as const) {
  const original = builtins.find((p) => p.id === source)!;
  builtins.push({ ...original, id, label, channelOf: source });
}
for (const property of builtins) if (property.id !== "effect" && EFFECT_PROPERTIES.includes(property.id))
  property.previewActivation = { property: "effect", inactive: "off", active: "lightning" };
export const PROPERTY_REGISTRY = createPropertyRegistry();
builtins.forEach(property => PROPERTY_REGISTRY.define({ ...property, category: { id: "visual", label: "Visuals" } }));
/** Compatibility view of the single shared pool; no separate appearance definitions. */
export const PROPERTIES = PROPERTY_REGISTRY.definitions;
export const propertyFor = PROPERTY_REGISTRY.property;
export function validateProperty(id: string, value: unknown): Value | undefined {
  const property = propertyFor(id);
  if (!property) return;
  if (id === "font") return typeof value === "string" ? normalizeFont(value) : undefined;
  return validateValue(property, value);
}
