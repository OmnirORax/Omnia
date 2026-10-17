import type { Atlas, AtlasNode } from "./model";

/** Layout projection only. Canonical relationship endpoints never change on collapse. */
export function projectAtlas(atlas: Atlas) {
  const byId = new Map(atlas.nodes.map((n) => [n.id, n]));
  const children = new Map<string | null, AtlasNode[]>();
  for (const n of atlas.nodes) children.set(n.parentId, [...(children.get(n.parentId) ?? []), n]);
  const visible = new Map<string, string>();
  function representative(n: AtlasNode): string {
    const cached = visible.get(n.id);
    if (cached) return cached;
    const p = n.parentId ? byId.get(n.parentId) : undefined;
    const result = p
      ? representative(p) !== p.id
        ? representative(p)
        : p.collapsed
          ? p.id
          : n.id
      : n.id;
    visible.set(n.id, result);
    return result;
  }
  const sizes = new Map<string, { width: number; height: number }>();
  function size(n: AtlasNode): { width: number; height: number } {
    const cached = sizes.get(n.id);
    if (cached) return cached;
    const nested = n.collapsed ? [] : (children.get(n.id) ?? []);
    const result = {
      width: Math.max(232, ...nested.map((c) => c.position.x + size(c).width + 28)),
      height: Math.max(84, ...nested.map((c) => c.position.y + size(c).height + 28)),
    };
    sizes.set(n.id, result);
    return result;
  }
  // React Flow requires parents before children regardless of document ordering.
  const ordered: AtlasNode[] = [];
  function visit(parentId: string | null) {
    for (const n of children.get(parentId) ?? []) {
      ordered.push(n);
      visit(n.id);
    }
  }
  visit(null);
  return {
    nodes: ordered
      .filter((n) => representative(n) === n.id)
      .map((n) => ({ ...n, ...size(n), childCount: children.get(n.id)?.length ?? 0 })),
    relationships: atlas.relationships.flatMap((r) => {
      const source = representative(byId.get(r.source)!);
      const target = representative(byId.get(r.target)!);
      if (source === target && (r.source !== source || r.target !== target)) return [];
      return [{ ...r, source, target, projected: source !== r.source || target !== r.target }];
    }),
  };
}
