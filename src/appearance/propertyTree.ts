/** Presentation controls, not Omnium knowledge or an Omnic grammar. */
export const APPEARANCE_HIERARCHY_ID = "appearance:hierarchy";
export type PropertyNode = {
  id: string;
  label: string;
  property?: string;
  children?: PropertyNode[];
};
const leaf = (id: string, label: string): PropertyNode => ({ id, label, property: id });
export const PROPERTY_TREE: PropertyNode[] = [
  leaf("color", "Color"),
  {
    id: "lighting",
    label: "Lighting",
    children: [leaf("brightness", "Brightness"), leaf("glow", "Glow")],
  },
  leaf("opacity", "Opacity"),
  leaf("blur", "Blur"),
  {
    ...leaf("font", "Font"),
    children: [
      leaf("textSize", "Size"),
      leaf("textWeight", "Weight"),
      leaf("textSpacing", "Spacing"),
    ],
  },
  {
    ...leaf("effect", "Animation"),
    children: [
      leaf("speed", "Speed"),
      leaf("intensity", "Intensity"),
      leaf("density", "Density"),
      leaf("size", "Star size"),
      leaf("length", "Lightning length"),
      {
        id: "effectAppearance",
        label: "Appearance",
        children: [
          leaf("effectColor", "Color"),
          leaf("effectBrightness", "Brightness"),
          leaf("effectOpacity", "Opacity"),
          leaf("effectGlow", "Glow"),
        ],
      },
    ],
  },
  {
    id: "styling",
    label: "Styling",
    children: [
      {
        id: "contours",
        label: "Contours",
        children: [leaf("contourWidth", "Thickness"), leaf("contourStyle", "Style")],
      },
      leaf("rounding", "Corner rounding"),
      {
        ...leaf("gradient", "Gradient fill"),
        children: [leaf("gradientColor", "Second color"), leaf("gradientAngle", "Direction")],
      },
      {
        id: "shadow",
        label: "Shadow",
        children: [
          leaf("shadowStrength", "Strength"),
          leaf("shadowSpread", "Spread"),
          leaf("shadowX", "Horizontal offset"),
          leaf("shadowY", "Vertical offset"),
        ],
      },
      leaf("saturation", "Icon saturation"),
    ],
  },
];
export function propertyPath(id: string, nodes = PROPERTY_TREE): string[] {
  for (const node of nodes) {
    if (node.property === id) return [node.id];
    const path = propertyPath(id, node.children ?? []);
    if (path.length) return [node.id, ...path];
  }
  return [];
}
export const subtreeIds = (node: PropertyNode): string[] => [
  node.id,
  ...(node.children ?? []).flatMap(subtreeIds),
];
