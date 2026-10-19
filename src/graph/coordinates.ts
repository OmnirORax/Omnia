import type { Document, Placement, XYZ } from "./structural.ts";

export function localPosition(p: Placement): XYZ {
  return p.spatialPosition ?? { x: p.position.x / 100, y: p.parentId ? -2 : 0, z: p.position.y / 100 };
}
/** Shared coordinate resolution; rendering filters must not rebase stored placements. */
export function worldPositions(doc: Document): Map<string, XYZ> {
  const byId = new Map(doc.placements.map(p => [p.id, p])), cache = new Map<string, XYZ>();
  const resolve = (id: string): XYZ => {
    const cached = cache.get(id); if (cached) return cached;
    const p = byId.get(id); if (!p) throw new Error(`Missing placement: ${id}`);
    const parent = p.parentId ? resolve(p.parentId) : { x: 0, y: 0, z: 0 }, local = localPosition(p);
    const result = { x: parent.x + local.x, y: parent.y + local.y, z: parent.z + local.z };
    cache.set(id, result); return result;
  };
  for (const p of doc.placements) resolve(p.id);
  return cache;
}
