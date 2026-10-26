import type { Document, XYZ } from "../graph/structural.ts";
import { worldPositions } from "../graph/coordinates.ts";
export type Rotation = XYZ & { w: number };
export const identityRotation = (): Rotation => ({ x: 0, y: 0, z: 0, w: 1 });
export function rotateVector(v: XYZ, q: Rotation): XYZ {
  const tx = 2 * (q.y * v.z - q.z * v.y), ty = 2 * (q.z * v.x - q.x * v.z), tz = 2 * (q.x * v.y - q.y * v.x);
  return { x: v.x + q.w * tx + q.y * tz - q.z * ty, y: v.y + q.w * ty + q.z * tx - q.x * tz, z: v.z + q.w * tz + q.x * ty - q.y * tx };
}
export function multiplyRotation(a: Rotation, b: Rotation): Rotation {
  return { x: a.w*b.x+a.x*b.w+a.y*b.z-a.z*b.y, y: a.w*b.y-a.x*b.z+a.y*b.w+a.z*b.x,
    z: a.w*b.z+a.x*b.y-a.y*b.x+a.z*b.w, w: a.w*b.w-a.x*b.x-a.y*b.y-a.z*b.z };
}
export function transformTargets(doc: Document, selected: readonly string[], descendants: boolean, limit = 256) {
  const known = new Set(doc.placements.map(p => p.id)), ids = new Set(selected.filter(id => known.has(id)));
  if (ids.size > limit) throw new Error(`Rotate up to ${limit} nodes at once.`);
  if (descendants) {
    const children = new Map<string, string[]>();
    for (const p of doc.placements) if (p.parentId) { const group = children.get(p.parentId) ?? []; group.push(p.id); children.set(p.parentId, group); }
    const queue = [...ids];
    for (let index = 0; index < queue.length; index++) for (const id of children.get(queue[index]) ?? []) if (!ids.has(id)) {
      ids.add(id); queue.push(id); if (ids.size > limit) throw new Error(`Rotate up to ${limit} nodes at once.`);
    }
  }
  if (ids.size > limit) throw new Error(`Rotate up to ${limit} nodes at once.`);
  return [...ids];
}
/** One canonical presentation transaction; previews never call this. Unselected
 * children retain world position when their parent is moved without descendants. */
export function transformPlacements(doc: Document, ids: readonly string[], rotation: Rotation, pivot: XYZ, layout: boolean): Document {
  if (!ids.length) return doc;
  const selected = new Set(ids), worlds = layout ? worldPositions(doc) : new Map<string, XYZ>(), changed = new Map<string, XYZ>();
  if (layout) for (const id of ids) {
    const p = worlds.get(id); if (!p) continue;
    const v = rotateVector({ x: p.x-pivot.x, y: p.y-pivot.y, z: p.z-pivot.z }, rotation);
    changed.set(id, { x: v.x+pivot.x, y: v.y+pivot.y, z: v.z+pivot.z });
  }
  return { ...doc, placements: doc.placements.map(p => {
    if (!layout) return selected.has(p.id) ? { ...p, orientation: multiplyRotation(rotation, p.orientation ?? identityRotation()) } : p;
    if (!changed.has(p.id) && !(p.parentId && changed.has(p.parentId))) return p;
    const world = changed.get(p.id) ?? worlds.get(p.id)!;
    const parent = p.parentId ? changed.get(p.parentId) ?? worlds.get(p.parentId)! : { x: 0, y: 0, z: 0 };
    return { ...p, spatialPosition: { x: world.x-parent.x, y: world.y-parent.y, z: world.z-parent.z } };
  }) };
}
