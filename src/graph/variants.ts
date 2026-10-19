import { ensureVariantPlacements, type Document, type Variant } from "./structural.ts";
import type { SpatialNode } from "./spatial.ts";

// Only developers define option categories. Variants use the ordinary node model.
export const NODE_OPTIONS = [{ id: "variants", label: "Variants" }] as const;
export function variantInstance(doc: Document, nodeId: string) {
  const link = doc.placements.find((p) => p.id === nodeId)?.variantOwner;
  const variant = doc.variants?.find((v) => v.id === link?.variantId);
  return link && variant ? { variant, ownerNodeId: link.placementId } : null;
}
export function nodeEntityId(doc: Document, nodeId: string): string | null {
  return doc.placements.find((p) => p.id === nodeId)?.entityId ?? null;
}
export function addVariant(doc: Document, ownerId: string, label = "New variant"): { next: Document; variant: Variant } {
  if (!doc.entities.some((e) => e.id === ownerId)) throw new Error("Variant owner does not exist.");
  const next = structuredClone(doc), entityId = crypto.randomUUID();
  next.entities.push({ id: entityId, label, aliases: [], notes: "" });
  const variant: Variant = { id: crypto.randomUUID(), ownerId, entityId };
  next.variants = [...(next.variants ?? []), variant];
  return { next: ensureVariantPlacements(next, undefined, variant.id), variant };
}
/** Ownership metadata for camera framing; geometry and interaction use normal nodes. */
export function projectVariants(doc: Document, nodes: SpatialNode[]) {
  const instances = new Map<string, { variant: Variant; ownerNodeId: string }>();
  for (const node of nodes.filter((n) => n.visible)) {
    const instance = variantInstance(doc, node.id);
    if (instance) instances.set(node.id, instance);
  }
  return { instances };
}
