import { editorView, type Document } from "./structural.ts";
import type { Visual } from "./assets.ts";

export type DisplayBinder = {
  key: string;
  id: string;
  kind: "relationship" | "composition" | "visual" | "variant";
  source: string;
  target: string;
  label: string;
  color?: string;
  opacity?: number;
  glow?: number;
  textAppearance?: import("./structural.ts").Appearance;
  visual?: Visual;
};
export function chartedBinders(doc: Document, atlas = editorView(doc)): DisplayBinder[] {
  const placements = new Map(doc.placements.map((p) => [p.id, p]));
  const binders: DisplayBinder[] = atlas.relationships.map((r) => {
    const canonical = doc.relationships.find((item) => item.id === r.id)!;
    return {
      ...r,
      key: r.id,
      kind: "relationship",
      label: canonical.text ?? [...(canonical.operators ?? []).map((o) => o.text), r.label]
        .filter(Boolean)
        .join(" · "),
      color: canonical.appearance?.color,
      opacity: canonical.appearance?.opacity,
      glow: canonical.appearance?.glow,
      textAppearance: canonical.textAppearance,
      visual: canonical.visual,
    };
  });
  const represented = new Set<string>();
  for (const node of atlas.nodes) {
    const link = placements.get(node.id)?.variantOwner;
    if (link && atlas.nodes.some((n) => n.id === link.placementId)) {
      const v = doc.variants!.find((v) => v.id === link.variantId)!;
      binders.push({ key: `variant:${node.id}`, id: link.variantId, kind: "variant", source: link.placementId, target: node.id, label: v.text ?? "variant", color: v.appearance?.color, opacity: v.appearance?.opacity, glow: v.appearance?.glow, textAppearance: v.textAppearance, visual: v.visual });
    }
    if (!node.parentId) continue;
    if (node.parentId === link?.placementId) continue;
    const parent = placements.get(node.parentId)!,
      child = placements.get(node.id)!;
    const comp = doc.compositions.find(
      (c) => c.parentId === parent.entityId && c.childId === child.entityId,
    );
    if (comp) represented.add(comp.id);
    const style = comp ?? child.nestingBinder;
    binders.push({
      key: `nest:${node.id}`,
      id: comp?.id ?? node.id,
      kind: comp ? "composition" : "visual",
      source: node.parentId,
      target: node.id,
      label: style?.text ?? (comp ? comp.operators?.map((o) => o.text).join(" · ") || "contains" : "visual nesting"),
      color: style?.appearance?.color,
      opacity: style?.appearance?.opacity,
      glow: style?.appearance?.glow,
      textAppearance: style?.textAppearance,
      visual: style?.visual,
    });
  }
  for (const comp of doc.compositions.filter((c) => !represented.has(c.id))) {
    const first = (entityId: string) =>
      atlas.nodes
        .filter((n) => placements.get(n.id)?.entityId === entityId)
        .sort((a, b) => a.id.localeCompare(b.id))[0]?.id;
    const source = first(comp.parentId),
      target = first(comp.childId);
    if (source && target)
      binders.push({
        key: comp.id,
        id: comp.id,
        kind: "composition",
        source,
        target,
        label: comp.text ?? (comp.operators?.map((o) => o.text).join(" · ") || "contains"),
        color: comp.appearance?.color,
        opacity: comp.appearance?.opacity,
        glow: comp.appearance?.glow,
        textAppearance: comp.textAppearance,
        visual: comp.visual,
      });
  }
  return binders;
}
