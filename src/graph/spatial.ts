import type { Atlas, AtlasNode } from "./model";

export type XYZ = { x: number; y: number; z: number };
export type SpatialNode = AtlasNode & {
  world: XYZ;
  representative: string;
  depth: number;
  visible: boolean;
};

/** A renderer-independent XYZ projection. Missing XYZ data derives from the existing 2D layout. */
export function projectSpatial(atlas: Atlas) {
  const byId = new Map(atlas.nodes.map((node) => [node.id, node]));
  const projected = new Map<string, SpatialNode>();
  function resolve(node: AtlasNode): SpatialNode {
    const existing = projected.get(node.id);
    if (existing) return existing;
    const parent = node.parentId ? resolve(byId.get(node.parentId)!) : null;
    const local = node.spatialPosition ?? {
      x: node.position.x / 100,
      y: parent ? -2 : 0,
      z: node.position.y / 100,
    };
    const representative =
      parent?.representative !== parent?.id
        ? parent!.representative
        : parent?.collapsed && node.variantOwnerId !== parent.id
          ? parent.id
          : node.id;
    const result: SpatialNode = {
      ...node,
      world: {
        x: (parent?.world.x ?? 0) + local.x,
        y: (parent?.world.y ?? 0) + local.y,
        z: (parent?.world.z ?? 0) + local.z,
      },
      representative,
      depth: (parent?.depth ?? -1) + 1,
      visible: representative === node.id,
    };
    projected.set(node.id, result);
    return result;
  }
  for (const node of atlas.nodes) resolve(node);
  const nodes = atlas.nodes.map((node) => projected.get(node.id)!);
  const relationships = atlas.relationships.flatMap((relationship) => {
    const source = projected.get(relationship.source)!;
    const target = projected.get(relationship.target)!;
    if (source.representative === target.representative && (!source.visible || !target.visible))
      return [];
    return [
      {
        ...relationship,
        source: source.representative,
        target: target.representative,
        projected: !source.visible || !target.visible,
      },
    ];
  });
  return { nodes, relationships };
}
