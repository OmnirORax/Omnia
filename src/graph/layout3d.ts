import { ensureVariantPlacements, validateDocument, type Document, type Placement, type XYZ } from "./structural.ts";
import { labelSize } from "./labels.ts";
import { visualFootprint } from "./assets.ts";
import { contractAlongRay, enclosingBox, translateBox, type Box3 } from "./packing.ts";

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
    const label = visualFootprint(labelSize(doc.entities.find((e) => e.id === p.entityId)?.label ?? ""), p.visual);
    let radius = Math.max(settings.radius, Math.hypot(label.width, label.height) / 2);
    if (!p.collapsed) for (const child of doc.placements.filter((c) => c.parentId === id && !c.hidden && c.variantOwner?.placementId !== id))
      radius = Math.max(radius, distance(worlds.get(id)!, worlds.get(child.id)!) + resolve(child.id) + settings.clearance);
    cache.set(id, radius); return radius;
  };
  for (const p of doc.placements) resolve(p.id);
  return cache;
}
export function siblingCollisions(doc: Document, settings: SpatialSettings): [string, string][] {
  const worlds = worldPositions(doc);
  const groups = new Map<string | null, Placement[]>();
  for (const p of doc.placements.filter((p) => !p.hidden)) groups.set(p.parentId, [...(groups.get(p.parentId) ?? []), p]);
  const result: [string, string][] = [];
  for (const group of groups.values()) for (let i = 0; i < group.length; i++) for (let j = i + 1; j < group.length; j++) {
    const a = group[i], b = group[j];
    if (overlap(doc, a, worlds.get(a.id)!, b, worlds.get(b.id)!, settings)) result.push([a.id, b.id]);
  }
  return result;
}
function overlap(doc: Document, a: Placement, ap: XYZ, b: Placement, bp: XYZ, settings: SpatialSettings) {
  const footprint = (p: Placement) => visualFootprint(labelSize(doc.entities.find((e) => e.id === p.entityId)?.label ?? ""), p.visual);
  const aa = footprint(a), bb = footprint(b);
  const depth = (p: Placement) => p.visual?.assetId || p.visual?.character ? p.visual.size ?? 1.4 : settings.radius * 2;
  return Math.abs(ap.x - bp.x) < (aa.width + bb.width) / 2 + settings.clearance - 1e-6 && Math.abs(ap.y - bp.y) < Math.max(settings.radius * 2, (aa.height + bb.height) / 2) + settings.clearance - 1e-6 && Math.abs(ap.z - bp.z) < (depth(a) + depth(b)) / 2 + settings.clearance - 1e-6;
}
function preferred(doc: Document, entityId: string, parentId: string | null, settings: SpatialSettings) {
  const parent = doc.placements.find((p) => p.id === parentId);
  if(!parent)return origin();
  const parentSize=visualFootprint(labelSize(doc.entities.find(e=>e.id===parent.entityId)?.label??''),parent.visual);
  const childSize=labelSize(doc.entities.find(e=>e.id===entityId)?.label??'');
  const nearest=(parentSize.width+childSize.width)/2+settings.clearance;
  return {x:settings.spacing?Math.ceil(nearest/settings.spacing)*settings.spacing:nearest,y:0,z:0};
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
  const worlds = worldPositions(doc);
  const parentWorld = moving.parentId ? worlds.get(moving.parentId)! : origin();
  const parent = doc.placements.find(p=>p.id===moving.parentId);
  const siblings = doc.placements.filter((p) => p.id !== placementId && p.parentId === moving.parentId && !p.hidden);
  const before = new Set(siblingCollisions(doc, settings).map(([a, b]) => [a, b].sort().join("|")));
  const safe = (local: XYZ) => {
    const world = add(parentWorld, local);
    // The parent's enclosing subsystem may contain us; its visible label must stay clear.
    if(parent && overlap(doc,moving,world,parent,parentWorld,settings))return false;
    if (siblings.some((p) => overlap(doc, moving, world, p, worlds.get(p.id)!, settings))) return false;
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
    spatialPosition: desired ?? (parentId && settings.spacing ? origin() : preferred(doc, entityId, parentId, settings)),
    collapsed: true, hidden: false };
  const draft = { ...doc, placements: [...doc.placements, placement] };
  const local = nearestFree(draft, placementId, placement.spatialPosition!, settings);
  placement.spatialPosition = local;
  return { next: ensureVariantPlacements(validateDocument(draft), placementId), placementId };
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
  const desired = preferred(doc, moving.entityId, targetId, settings);
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
  target.spatialPosition = preferred(doc, moving.entityId, parentId, settings);
  if (parentId) next.placements.find((p) => p.id === parentId)!.collapsed = false;
  target.spatialPosition = nearestFree(next, id, target.spatialPosition, settings);
  return validateDocument(next);
}
export type ReflowScope = { kind: "all" } | { kind: "subsystem"; placementId: string } | { kind: "frame"; frameId: string } | { kind: "selection"; placementIds: string[] };
export function compactLayout(doc: Document, scope: ReflowScope, settings: SpatialSettings): Document {
  const next = structuredClone(doc);
  const included = new Set<string>();
  if (scope.kind === "all") for (const p of next.placements) included.add(p.id);
  else if (scope.kind === "selection") for (const id of scope.placementIds) included.add(id);
  else if (scope.kind === "frame") {
    const frame = next.frames.find((f) => f.id === scope.frameId); if (!frame) throw new Error("Frame missing.");
    for (const p of next.placements) if (frame.scope.entityIds.includes(p.entityId)) included.add(p.id);
  } else {
    if (!next.placements.some((p) => p.id === scope.placementId)) throw new Error("Subsystem missing.");
    const pending = [scope.placementId];
    while (pending.length) { const id = pending.pop()!; for (const child of next.placements.filter((p) => p.parentId === id)) { included.add(child.id); pending.push(child.id); } }
  }
  const byId = new Map(next.placements.map(p => [p.id, p]));
  const children = new Map<string | null, Placement[]>();
  for (const p of next.placements) children.set(p.parentId, [...(children.get(p.parentId) ?? []), p]);
  const entities = new Map(next.entities.map(e => [e.id, e]));
  const ownBoxes = new Map<string, Box3>();
  for (const p of next.placements) {
    const size = visualFootprint(labelSize(entities.get(p.entityId)?.label ?? ""), p.visual);
    const x = Math.max(settings.radius * 2, size.width) / 2, y = Math.max(settings.radius * 2, size.height) / 2;
    const z = Math.max(settings.radius * 2, p.visual?.assetId || p.visual?.character ? p.visual.size ?? 1.4 : 0) / 2;
    ownBoxes.set(p.id, { min: { x: -x, y: -y, z: -z }, max: { x, y, z } });
  }
  const contents = (p: Placement): Box3 => enclosingBox([ownBoxes.get(p.id)!, ...(!p.collapsed
    ? (children.get(p.id) ?? []).filter(c => !c.hidden && !c.variantOwner).map(c => translateBox(contents(c), localPosition(c))) : [])]);
  const depth = (p: Placement): number => p.parentId ? depth(byId.get(p.parentId)!) + 1 : 0;
  const parents = [...new Set(next.placements.filter(p => included.has(p.id)).sort((a, b) => depth(b) - depth(a) || a.id.localeCompare(b.id)).map(p => p.parentId))];
  for (const parentId of parents) {
    const siblings = children.get(parentId) ?? [], parent = parentId ? byId.get(parentId)! : null;
    let anchor = origin(), anchorId: string | undefined;
    if (!parent) {
      const roots = siblings.filter(p => !p.hidden);
      if (!roots.length) continue;
      const center = roots.reduce((sum, p) => add(sum, localPosition(p)), origin());
      center.x /= roots.length; center.y /= roots.length; center.z /= roots.length;
      const fixed = roots.filter(p => !included.has(p.id));
      const root = [...(fixed.length ? fixed : roots)].sort((a, b) => distance(localPosition(a), center) - distance(localPosition(b), center) || a.id.localeCompare(b.id))[0];
      anchor = localPosition(root); anchorId = root.id;
    }
    const moving = siblings.filter(p => included.has(p.id) && p.id !== anchorId)
      .sort((a, b) => distance(localPosition(a), anchor) - distance(localPosition(b), anchor) || a.id.localeCompare(b.id));
    // Bottom-up, near-to-far passes let newly freed space benefit other branches.
    // Each move keeps its own ray; it never rotates or scales the whole layout.
    for (let pass = 0; pass < Math.min(8, moving.length + 1); pass++) {
      let changed = false;
      for (const p of moving) {
        const start = localPosition(p);
        const obstacles = [
          ...(parent ? [ownBoxes.get(parent.id)!] : []),
          ...siblings.filter(other => other.id !== p.id && !other.hidden).map(other => translateBox(contents(other), localPosition(other))),
        ];
        const result = contractAlongRay(contents(p), start, anchor, obstacles, settings.clearance);
        if (distance(start, result) > 1e-8) { p.spatialPosition = result; changed = true; }
      }
      if (!changed) break;
    }
  }
  return validateDocument(next);
}
