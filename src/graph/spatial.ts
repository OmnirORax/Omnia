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

/** Temporary visibility only: focus roots plus their current visual subtrees.
 * Existing frame, variant and collapse gates remain authoritative. */
export function isolateSpatialContext(graph: ReturnType<typeof projectSpatial>, roots: readonly string[] | null) {
  if (!roots?.length) return graph;
  const byId = new Map(graph.nodes.map(n => [n.id, n]));
  const included = new Set(roots.filter(id => byId.has(id)));
  if (!included.size) return graph; // A deleted/stale focus must not strand an empty workspace.
  const children = new Map<string, string[]>();
  for (const n of graph.nodes) if (n.parentId) children.set(n.parentId, [...(children.get(n.parentId) ?? []), n.id]);
  const pending = [...included];
  while (pending.length) for (const id of children.get(pending.pop()!) ?? []) {
    if (!included.has(id)) { included.add(id); pending.push(id); }
  }
  const nodes = graph.nodes.map(n => included.has(n.id) ? n : { ...n, visible: false });
  const visible = new Set(nodes.filter(n => n.visible).map(n => n.id));
  return { nodes, relationships: graph.relationships.filter(r => visible.has(r.source) && visible.has(r.target)) };
}
