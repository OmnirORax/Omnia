import { validateDocument, type Document, type Placement, type XYZ } from "./structural.ts";

export type GridSpacing = 0 | 0.25 | 0.5 | 1 | 2 | 5;
export type Axis = "x" | "y" | "z" | null;
export type SpatialSettings = { spacing: GridSpacing; radius: number; clearance: number };
export const DEFAULT_SPATIAL_SETTINGS: SpatialSettings = { spacing: 2, radius: 0.75, clearance: 0.35 };
const origin = (): XYZ => ({ x: 0, y: 0, z: 0 });
const add = (a: XYZ, b: XYZ): XYZ => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const distance = (a: XYZ, b: XYZ) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const quantize = (value: number, step: number) => step ? Math.round(value / step) * step : value;
export const snapXYZ = (point: XYZ, spacing: GridSpacing): XYZ => ({
  x: quantize(point.x, spacing), y: quantize(point.y, spacing), z: quantize(point.z, spacing),
});
export function localPosition(p: Placement): XYZ {
  return p.spatialPosition ?? { x: p.position.x / 100, y: p.parentId ? -2 : 0, z: p.position.y / 100 };
}
export function worldPositions(doc: Document): Map<string, XYZ> {
  const byId = new Map(doc.placements.map((p) => [p.id, p]));
  const cache = new Map<string, XYZ>();
  const resolve = (id: string): XYZ => {
    const found = cache.get(id); if (found) return found;
    const p = byId.get(id); if (!p) throw new Error(`Missing placement: ${id}`);
    const result = add(p.parentId ? resolve(p.parentId) : origin(), localPosition(p));
    cache.set(id, result); return result;
  };
  for (const p of doc.placements) resolve(p.id);
  return cache;
}
export function occupiedRadii(doc: Document, settings: SpatialSettings, worlds = worldPositions(doc)): Map<string, number> {
  const cache = new Map<string, number>();
  const resolve = (id: string): number => {
    const found = cache.get(id); if (found !== undefined) return found;
    const p = doc.placements.find((item) => item.id === id)!;
    let radius = settings.radius;
    if (!p.collapsed) for (const child of doc.placements.filter((c) => c.parentId === id && !c.hidden))
      radius = Math.max(radius, distance(worlds.get(id)!, worlds.get(child.id)!) + resolve(child.id) + settings.clearance);
    cache.set(id, radius); return radius;
  };
  for (const p of doc.placements) resolve(p.id);
  return cache;
}
export function siblingCollisions(doc: Document, settings: SpatialSettings): [string, string][] {
  const worlds = worldPositions(doc), radii = occupiedRadii(doc, settings, worlds);
  const groups = new Map<string | null, Placement[]>();
  for (const p of doc.placements.filter((p) => !p.hidden)) groups.set(p.parentId, [...(groups.get(p.parentId) ?? []), p]);
  const result: [string, string][] = [];
  for (const group of groups.values()) for (let i = 0; i < group.length; i++) for (let j = i + 1; j < group.length; j++) {
    const a = group[i], b = group[j];
    if (distance(worlds.get(a.id)!, worlds.get(b.id)!) + 1e-6 < radii.get(a.id)! + radii.get(b.id)! + settings.clearance) result.push([a.id, b.id]);
  }
  return result;
}
const offsetCache = new Map<number, XYZ[]>();
function offsets(limit: number): XYZ[] {
  const cached = offsetCache.get(limit); if (cached) return cached;
  const result: XYZ[] = [];
  for (let x = -limit; x <= limit; x++) for (let y = -limit; y <= limit; y++) for (let z = -limit; z <= limit; z++)
    result.push({ x, y, z });
  result.sort((a, b) => (a.x*a.x+a.y*a.y+a.z*a.z) - (b.x*b.x+b.y*b.y+b.z*b.z) || b.x-a.x || a.y-b.y || a.z-b.z);
  offsetCache.set(limit, result); return result;
}
/** Search is deterministic, closest first, with positive X preferred for equal distances. */
export function nearestFree(doc: Document, placementId: string, desired: XYZ, settings: SpatialSettings): XYZ {
  const step = settings.spacing || Math.max(0.25, settings.radius * 2 + settings.clearance);
  const base = snapXYZ(desired, settings.spacing);
  const moving = doc.placements.find((p) => p.id === placementId);
  if (!moving) throw new Error(`Missing placement: ${placementId}`);
  const worlds = worldPositions(doc), radii = occupiedRadii(doc, settings, worlds);
  const parentWorld = moving.parentId ? worlds.get(moving.parentId)! : origin();
  const siblings = doc.placements.filter((p) => p.id !== placementId && p.parentId === moving.parentId && !p.hidden);
  const before = new Set(siblingCollisions(doc, settings).map(([a, b]) => [a, b].sort().join("|")));
  const safe = (local: XYZ) => {
    const world = add(parentWorld, local);
    if (siblings.some((p) => distance(world, worlds.get(p.id)!) + 1e-6 < radii.get(placementId)! + radii.get(p.id)! + settings.clearance)) return false;
    const candidate = { ...doc, placements: doc.placements.map((p) => p.id === placementId ? { ...p, spatialPosition: local } : p) };
    return siblingCollisions(candidate, settings).every(([a, b]) => before.has([a, b].sort().join("|")));
  };
  if (safe(base)) return base;
  for (let shell = 1; shell <= 18; shell++) {
    for (const o of offsets(shell)) {
      if (Math.max(Math.abs(o.x), Math.abs(o.y), Math.abs(o.z)) !== shell) continue;
      const candidate = { x: base.x + o.x * step, y: base.y + o.y * step, z: base.z + o.z * step };
      if (safe(candidate)) return candidate;
    }
  }
  throw new Error("No collision-free position found nearby. Compact the surrounding system first.");
}
export function movePlacement(doc: Document, id: string, desired: XYZ, settings: SpatialSettings): Document {
  if (!doc.placements.some((p) => p.id === id)) throw new Error(`Missing placement: ${id}`);
  const local = nearestFree(doc, id, desired, settings);
  return validateDocument({ ...doc, placements: doc.placements.map((p) => p.id === id ? { ...p, spatialPosition: local } : p) });
}
export function createPlacement(doc: Document, entityId: string, parentId: string | null, settings: SpatialSettings, desired?: XYZ): { next: Document; placementId: string } {
  if (!doc.entities.some((e) => e.id === entityId)) throw new Error(`Missing identity: ${entityId}`);
  if (parentId && !doc.placements.some((p) => p.id === parentId)) throw new Error(`Missing parent placement: ${parentId}`);
  const placementId = crypto.randomUUID();
  const index = doc.placements.filter((p) => p.parentId === parentId).length;
  const placement: Placement = { id: placementId, entityId, parentId,
    position: parentId ? { x: 28, y: 104 + index * 112 } : { x: 80, y: 80 },
    spatialPosition: desired ?? { x: settings.radius * 2 + settings.clearance, y: 0, z: 0 },
    collapsed: true, hidden: false };
  const draft = { ...doc, placements: [...doc.placements, placement] };
  const local = nearestFree(draft, placementId, placement.spatialPosition!, settings);
  placement.spatialPosition = local;
  return { next: validateDocument(draft), placementId };
}
export function reparentStructure(doc: Document, id: string, targetId: string, settings: SpatialSettings): Document {
  const moving = doc.placements.find((p) => p.id === id), target = doc.placements.find((p) => p.id === targetId);
  if (!moving || !target) throw new Error("Missing placement for nesting.");
  if (moving.entityId === target.entityId) throw new Error("An identity cannot contain itself.");
  let cursor: string | null = targetId;
  while (cursor) { if (cursor === id) throw new Error("Visual containment cycle."); cursor = doc.placements.find((p) => p.id === cursor)?.parentId ?? null; }
  const children = new Map<string, string[]>();
  for (const c of doc.compositions) children.set(c.parentId, [...(children.get(c.parentId) ?? []), c.childId]);
  const pending = [moving.entityId], seen = new Set<string>();
  while (pending.length) { const current = pending.pop()!; if (current === target.entityId) throw new Error("Structural containment cycle."); if (seen.has(current)) continue; seen.add(current); pending.push(...(children.get(current) ?? [])); }
  // Existing composition is canonical knowledge and may be used by another placement.
  const compositions = [...doc.compositions];
  if (!compositions.some((c) => c.parentId === target.entityId && c.childId === moving.entityId))
    compositions.push({ id: crypto.randomUUID(), parentId: target.entityId, childId: moving.entityId });
  const draft = { ...doc, compositions, placements: doc.placements.map((p) => p.id === id ? { ...p, parentId: targetId } : p.id === targetId ? { ...p, collapsed: false } : p) };
  const desired = { x: settings.radius * 2 + settings.clearance, y: 0, z: 0 };
  const local = nearestFree(draft, id, desired, settings);
  return validateDocument({ ...draft, placements: draft.placements.map((p) => p.id === id ? { ...p, spatialPosition: local, position: { x: 28, y: 104 } } : p) });
}
/** A placement-only parent change. Canonical composition stays untouched. */
export function reparentVisual(doc: Document, id: string, parentId: string | null, settings: SpatialSettings): Document {
  const moving = doc.placements.find((p) => p.id === id);
  if (!moving || (parentId && !doc.placements.some((p) => p.id === parentId))) throw new Error("Missing placement for visual nesting.");
  let cursor = parentId;
  while (cursor) {
    if (cursor === id) throw new Error("Visual containment cycle.");
    cursor = doc.placements.find((p) => p.id === cursor)?.parentId ?? null;
  }
  const next = structuredClone(doc);
  const target = next.placements.find((p) => p.id === id)!;
  target.parentId = parentId;
  target.spatialPosition = { x: settings.radius * 2 + settings.clearance, y: 0, z: 0 };
  if (parentId) next.placements.find((p) => p.id === parentId)!.collapsed = false;
  target.spatialPosition = nearestFree(next, id, target.spatialPosition, settings);
  return validateDocument(next);
}
export type ReflowScope = { kind: "all" } | { kind: "subsystem"; placementId: string } | { kind: "frame"; frameId: string };
export function compactLayout(doc: Document, scope: ReflowScope, settings: SpatialSettings): Document {
  const next = structuredClone(doc);
  const included = new Set<string>();
  if (scope.kind === "all") for (const p of next.placements) included.add(p.id);
  else if (scope.kind === "frame") {
    const frame = next.frames.find((f) => f.id === scope.frameId); if (!frame) throw new Error("Frame missing.");
    for (const p of next.placements) if (frame.scope.entityIds.includes(p.entityId)) included.add(p.id);
  } else {
    if (!next.placements.some((p) => p.id === scope.placementId)) throw new Error("Subsystem missing.");
    const pending = [scope.placementId];
    while (pending.length) { const id = pending.pop()!; for (const child of next.placements.filter((p) => p.parentId === id)) { included.add(child.id); pending.push(child.id); } }
  }
  const depth = (p: Placement): number => p.parentId ? 1 + depth(next.placements.find((x) => x.id === p.parentId)!) : 0;
  const ordered = next.placements.filter((p) => included.has(p.id)).sort((a, b) => depth(b) - depth(a) || a.id.localeCompare(b.id));
  for (const p of ordered) {
    // Place each sibling near its parent/origin; already placed siblings become obstacles.
    const desired = p.parentId ? { x: settings.radius * 2 + settings.clearance, y: 0, z: 0 } : origin();
    p.spatialPosition = nearestFree(next, p.id, desired, settings);
  }
  return validateDocument(next);
}
