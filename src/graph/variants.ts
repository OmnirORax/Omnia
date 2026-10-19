import { validateDocument, type Document, type XYZ, type Variant } from "./structural.ts";
import { labelSize } from "./labels.ts";
import type { SpatialNode } from "./spatial.ts";
import type { DisplayBinder } from "./presentation.ts";
import { snapXYZ, type GridSpacing } from "./layout3d.ts";

// Only developers define option categories. User-authored variants are data, not plugins.
export const NODE_OPTIONS = [{ id: "variants", label: "Variants" }] as const;
function renderId(doc: Document, path: string[]) {
  let id = `variant:${JSON.stringify(path)}`;
  while (doc.placements.some((p) => p.id === id)) id = `variant:${id}`;
  return id;
}
function instancePath(nodeId: string): string[] {
  let raw = nodeId;
  while (raw.startsWith("variant:")) raw = raw.slice(8);
  const path: unknown = JSON.parse(raw);
  if (
    !Array.isArray(path) ||
    path.length < 2 ||
    path.length > 51 ||
    !path.every((part) => typeof part === "string")
  )
    throw new Error("Invalid variant instance.");
  return path;
}
export function variantInstance(
  doc: Document,
  nodeId: string,
): { variant: Variant; ownerNodeId: string } | null {
  if (doc.placements.some((p) => p.id === nodeId) || !nodeId.startsWith("variant:")) return null;
  try {
    const path = instancePath(nodeId),
      id = path.at(-1);
    const ownerNodeId = path.length === 2 ? path[0] : renderId(doc, path.slice(0, -1));
    const variant = doc.variants?.find((v) => v.id === id);
    return variant && typeof ownerNodeId === "string" ? { variant, ownerNodeId } : null;
  } catch {
    return null;
  }
}
export function nodeEntityId(doc: Document, nodeId: string): string | null {
  return (
    doc.placements.find((p) => p.id === nodeId)?.entityId ??
    variantInstance(doc, nodeId)?.variant.entityId ??
    null
  );
}
export function addVariant(
  doc: Document,
  ownerId: string,
  label = "New variant",
): { next: Document; variant: Variant } {
  if (!doc.entities.some((e) => e.id === ownerId)) throw new Error("Variant owner does not exist.");
  const next = structuredClone(doc),
    entityId = crypto.randomUUID();
  next.entities.push({ id: entityId, label, aliases: [], notes: "" });
  const variant: Variant = { id: crypto.randomUUID(), ownerId, entityId };
  next.variants = [...(next.variants ?? []), variant];
  return { next: validateDocument(next), variant };
}
export type VariantDisplay =
  | { kind: "variant"; variant: Variant; ownerNodeId: string }
  | { kind: "add"; ownerNodeId: string; ownerEntityId: string };
/** Session-only projections; never creates structural placements or composition facts. */
export function projectVariants(
  doc: Document,
  structural: SpatialNode[],
  expanded: ReadonlySet<string>,
) {
  const nodes: SpatialNode[] = [],
    binders: DisplayBinder[] = [],
    instances = new Map<string, VariantDisplay>();
  const pending = structural
    .filter((n) => n.visible)
    .map((node) => ({ node, entityId: nodeEntityId(doc, node.id)!, depth: 0 }));
  for (let cursor = 0; cursor < pending.length; cursor++) {
    const { node: owner, entityId, depth } = pending[cursor];
    if (!expanded.has(owner.id) || depth >= 50) continue;
    const variants = (doc.variants ?? []).filter((v) => v.ownerId === entityId);
    let y = 0;
    for (const variant of variants) {
      const entity = doc.entities.find((e) => e.id === variant.entityId)!;
      const size = labelSize(entity.label);
      const offset = variant.position ?? {
        x: labelSize(owner.label).width / 2 + size.width / 2 + 2,
        y,
        z: 0,
      };
      const path = variantInstance(doc, owner.id) ? instancePath(owner.id) : [owner.id];
      const id = renderId(doc, [...path, variant.id]);
      const world = {
        x: owner.world.x + offset.x,
        y: owner.world.y + offset.y,
        z: owner.world.z + offset.z,
      };
      const node: SpatialNode = {
        id,
        label: entity.label,
        notes: entity.notes,
        parentId: null,
        position: { x: 0, y: 0 },
        spatialPosition: world,
        collapsed: true,
        visible: true,
        world,
        representative: id,
        depth: owner.depth,
      };
      nodes.push(node);
      instances.set(id, { kind: "variant", variant, ownerNodeId: owner.id });
      binders.push({
        id: variant.id,
        key: id,
        kind: "variant",
        source: owner.id,
        target: id,
        label: "variant",
        color: "#bda1ec",
      });
      pending.push({ node, entityId: variant.entityId, depth: depth + 1 });
      y -= Math.max(2, size.height + 1);
    }
    let id = `variant-add:${JSON.stringify(owner.id)}`;
    while (doc.placements.some((p) => p.id === id)) id = `variant-add:${id}`;
    const world = {
      x: owner.world.x + labelSize(owner.label).width / 2 + 3,
      y: owner.world.y + y,
      z: owner.world.z,
    };
    nodes.push({
      id,
      label: "+",
      notes: "Add variant",
      parentId: null,
      position: { x: 0, y: 0 },
      spatialPosition: world,
      collapsed: true,
      visible: true,
      world,
      representative: id,
      depth: owner.depth,
    });
    instances.set(id, { kind: "add", ownerNodeId: owner.id, ownerEntityId: entityId });
  }
  return { nodes, binders, instances };
}
export function moveVariant(
  doc: Document,
  nodeId: string,
  desiredWorld: XYZ,
  displayNodes: SpatialNode[],
  spacing: GridSpacing,
): Document {
  const instance = variantInstance(doc, nodeId);
  if (!instance) throw new Error("Variant reference is missing.");
  const owner = displayNodes.find((n) => n.id === instance.ownerNodeId);
  if (!owner) throw new Error("Variant owner is hidden.");
  const position = snapXYZ(
    {
      x: desiredWorld.x - owner.world.x,
      y: desiredWorld.y - owner.world.y,
      z: desiredWorld.z - owner.world.z,
    },
    spacing,
  );
  return validateDocument({
    ...doc,
    variants: doc.variants?.map((v) => (v.id === instance.variant.id ? { ...v, position } : v)),
  });
}
