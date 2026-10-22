import { PROPERTIES } from "./registry.ts";
/** Shared controls, independent of canonical knowledge and Omnic grammar. */
export const APPEARANCE_HIERARCHY_ID = "appearance:hierarchy";
export type PropertyNode = {
  id: string;
  label: string;
  tooltip?: string;
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
// Preserve established node IDs/ownership. New properties/categories are discovered
// from the shared pool instead of requiring a second hand-written tree entry.
const represented = (nodes: PropertyNode[]): string[] => nodes.flatMap(node => [...(node.property ? [node.property] : []), ...represented(node.children ?? [])]);
const known = new Set(represented(PROPERTY_TREE));
for (const property of PROPERTIES.filter(property => !known.has(property.id))) {
  const category = property.category!;
  const id = `category:${category.id}`;
  let node = PROPERTY_TREE.find(node => node.id === id);
  if (!node) { node = { id, label: category.label, children: [] }; PROPERTY_TREE.push(node); }
  node.children!.push(leaf(property.id, property.label));
}
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
