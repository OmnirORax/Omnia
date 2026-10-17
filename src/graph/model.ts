/** Omnium's local document contract. No renderer types or global knowledge semantics. */
export interface AtlasNode {
  id: string;
  label: string;
  notes: string;
  parentId: string | null;
  position: { x: number; y: number }; // Local to parent; root positions are canvas coordinates.
  collapsed: boolean;
}

export interface Relationship {
  id: string;
  source: string;
  target: string;
  label: string;
}

export interface Atlas {
  format: "omnium-atlas";
  version: 1;
  nodes: AtlasNode[];
  relationships: Relationship[];
}

export const emptyAtlas = (): Atlas => ({
  format: "omnium-atlas",
  version: 1,
  nodes: [],
  relationships: [],
});
export const newId = () => crypto.randomUUID();

export function descendants(atlas: Atlas, id: string): Set<string> {
  const result = new Set<string>();
  const pending = [id];
  while (pending.length) {
    const parent = pending.pop();
    for (const n of atlas.nodes) {
      if (n.parentId === parent && !result.has(n.id)) {
        result.add(n.id);
        pending.push(n.id);
      }
    }
  }
  return result;
}

export function reparent(atlas: Atlas, id: string, parentId: string | null): Atlas {
  if (parentId === id || (parentId && descendants(atlas, id).has(parentId)))
    throw new Error("A node cannot contain itself or its ancestor.");
  if (parentId && !atlas.nodes.some((n) => n.id === parentId)) throw new Error("Parent not found.");
  const siblings = atlas.nodes.filter((n) => n.parentId === parentId && n.id !== id);
  return {
    ...atlas,
    nodes: atlas.nodes.map((n) =>
      n.id === id
        ? {
            ...n,
            parentId,
            position: parentId
              ? { x: 28, y: 104 + siblings.length * 112 }
              : { x: 60, y: 60 + siblings.length * 120 },
          }
        : n.id === parentId
          ? { ...n, collapsed: false }
          : n,
    ),
  };
}

export function removeNode(atlas: Atlas, id: string): Atlas {
  const removed = descendants(atlas, id);
  removed.add(id);
  return {
    ...atlas,
    nodes: atlas.nodes.filter((n) => !removed.has(n.id)),
    relationships: atlas.relationships.filter(
      (r) => !removed.has(r.source) && !removed.has(r.target),
    ),
  };
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
const text = (v: unknown, max = 10000): v is string => typeof v === "string" && v.length <= max;
const identifier = (v: unknown): v is string => text(v, 200) && v.length > 0;

/** Strict version gate and referential validation before imported/local data enters state. */
export function parseAtlas(input: string): Atlas {
  if (input.length > 5_000_000) throw new Error("Atlas exceeds the 5 MB import limit.");
  const value: unknown = JSON.parse(input);
  if (!record(value) || value.format !== "omnium-atlas" || value.version !== 1)
    throw new Error("Expected an Omnium atlas with format version 1.");
  if (
    !Array.isArray(value.nodes) ||
    !Array.isArray(value.relationships) ||
    value.nodes.length > 2000 ||
    value.relationships.length > 10000
  )
    throw new Error("Invalid atlas lists (maximum 2,000 nodes and 10,000 relationships).");
  const nodes: AtlasNode[] = value.nodes.map((n) => {
    if (
      !record(n) ||
      !identifier(n.id) ||
      !text(n.label, 500) ||
      !text(n.notes) ||
      !(n.parentId === null || identifier(n.parentId)) ||
      typeof n.collapsed !== "boolean" ||
      !record(n.position) ||
      typeof n.position.x !== "number" ||
      typeof n.position.y !== "number" ||
      !Number.isFinite(n.position.x) ||
      !Number.isFinite(n.position.y) ||
      Math.abs(n.position.x) > 1_000_000 ||
      Math.abs(n.position.y) > 1_000_000
    )
      throw new Error("Invalid node fields or position.");
    if (n.parentId && (n.position.x < 24 || n.position.y < 96))
      throw new Error("Child positions must leave room for the parent header (x ≥ 24, y ≥ 96).");
    return {
      id: n.id,
      label: n.label,
      notes: n.notes,
      parentId: n.parentId,
      collapsed: n.collapsed,
      position: { x: n.position.x, y: n.position.y },
    };
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  if (byId.size !== nodes.length) throw new Error("Duplicate node IDs.");
  for (const n of nodes) {
    const seen = new Set([n.id]);
    let parent = n.parentId;
    while (parent !== null) {
      if (seen.has(parent)) throw new Error("Containment cycle found.");
      seen.add(parent);
      const ancestor = byId.get(parent);
      if (!ancestor) throw new Error("A parent node is missing.");
      parent = ancestor.parentId;
    }
    if (seen.size > 50) throw new Error("Maximum nesting depth is 50.");
  }
  const ids = new Set<string>();
  const relationships: Relationship[] = value.relationships.map((r) => {
    if (
      !record(r) ||
      !identifier(r.id) ||
      !identifier(r.source) ||
      !identifier(r.target) ||
      !text(r.label, 500)
    )
      throw new Error("Invalid relationship fields.");
    if (ids.has(r.id) || byId.has(r.id)) throw new Error("Duplicate relationship ID.");
    ids.add(r.id);
    if (!byId.has(r.source) || !byId.has(r.target))
      throw new Error("A relationship endpoint is missing.");
    return { id: r.id, source: r.source, target: r.target, label: r.label };
  });
  return { format: "omnium-atlas", version: 1, nodes, relationships };
}
