import { editorView, ensureVariantPlacements, validateDocument, type Document, type Placement, type XYZ } from "./structural.ts";
import { labelSize } from "./labels.ts";
import { DEFAULT_SPHERE_DIAMETER, visualFootprint } from "./assets.ts";
import { contractAlongRay, stopBeforeSphere, enclosingBox, translateBox, type Box3 } from "./packing.ts";
import { localPosition, worldPositions } from "./coordinates.ts";
import { chartedBinders, type DisplayBinder } from "./binders.ts";
import { binderGap, minimumBinderDistance, placementFootprint } from "./binderGeometry.ts";
export { localPosition, worldPositions } from "./coordinates.ts";

export type GridSpacing = 0 | 0.25 | 0.5 | 1 | 2 | 5;
export type Axis = "x" | "y" | "z" | null;
export type SpatialSettings = { spacing: GridSpacing; radius: number; clearance: number };
export const DEFAULT_SPATIAL_SETTINGS: SpatialSettings = { spacing: 2, radius: DEFAULT_SPHERE_DIAMETER / 2, clearance: 0.35 };
const origin = (): XYZ => ({ x: 0, y: 0, z: 0 });
const add = (a: XYZ, b: XYZ): XYZ => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const distance = (a: XYZ, b: XYZ) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const quantize = (value: number, step: number) => step ? Math.round(value / step) * step : value;
export const snapXYZ = (point: XYZ, spacing: GridSpacing): XYZ => ({
  x: quantize(point.x, spacing), y: quantize(point.y, spacing), z: quantize(point.z, spacing),
});
export function occupiedRadii(doc: Document, settings: SpatialSettings, worlds = worldPositions(doc)): Map<string, number> {
  const cache = new Map<string, number>();
  const resolve = (id: string): number => {
    const found = cache.get(id); if (found !== undefined) return found;
    const p = doc.placements.find((item) => item.id === id)!;
    const label = visualFootprint(labelSize(doc.entities.find((e) => e.id === p.entityId)?.label ?? ""), p.visual);
    let radius = label.sphere ? label.width / 2 : Math.max(settings.radius, Math.hypot(label.width, label.height, label.depth) / 2);
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
  if (aa.sphere && bb.sphere) return distance(ap, bp) < (aa.width + bb.width) / 2 + settings.clearance - 1e-6;
  const depth = (p: Placement) => { const size = footprint(p); return size.sphere ? size.depth : Math.max(settings.radius * 2, size.depth); };
  return Math.abs(ap.x - bp.x) < (aa.width + bb.width) / 2 + settings.clearance - 1e-6 && Math.abs(ap.y - bp.y) < Math.max(settings.radius * 2, (aa.height + bb.height) / 2) + settings.clearance - 1e-6 && Math.abs(ap.z - bp.z) < (depth(a) + depth(b)) / 2 + settings.clearance - 1e-6;
}
function preferred(doc: Document, entityId: string, parentId: string | null, settings: SpatialSettings) {
  const parent = doc.placements.find((p) => p.id === parentId);
  if(!parent)return origin();
  const parentSize=visualFootprint(labelSize(doc.entities.find(e=>e.id===parent.entityId)?.label??''),parent.visual);
  const childSize=visualFootprint(labelSize(doc.entities.find(e=>e.id===entityId)?.label??''));
  const composition = doc.compositions.find(c => c.parentId === parent.entityId && c.childId === entityId);
  const binder = composition ? { visual: composition.visual, label: composition.text ?? (composition.operators?.map(o => o.text).join(" · ") || "contains") } : { label: "" };
  const nearest=(parentSize.width+childSize.width)/2+Math.max(settings.clearance,binderGap(binder, { x: 1, y: 0, z: 0 }));
  return {x:settings.spacing?Math.ceil(nearest/settings.spacing)*settings.spacing:nearest,y:0,z:0};
}
function spacingBinders(doc: Document): DisplayBinder[] {
  return chartedBinders(doc, editorView({ ...doc, activeFrameId: null }, new Set(doc.placements.map(p => p.id))));
}
function subtreeIds(doc: Document, id: string) {
  const ids = new Set([id]);
  const pending = [id];
  while (pending.length) {
    const parent = pending.pop()!;
    for (const p of doc.placements.filter(p => p.parentId === parent)) if (!ids.has(p.id)) { ids.add(p.id); pending.push(p.id); }
  }
  return ids;
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
  const movingIds = subtreeIds(doc, placementId);
  const bindings = spacingBinders(doc).filter(b => movingIds.has(b.source) !== movingIds.has(b.target));
  const initial = worlds.get(placementId)!;

  const safe = (local: XYZ) => {
    const world = add(parentWorld, local);
    const delta = { x: world.x - initial.x, y: world.y - initial.y, z: world.z - initial.z };
    for (const b of bindings) {
      const from = movingIds.has(b.source) ? add(worlds.get(b.source)!, delta) : worlds.get(b.source)!;
      const to = movingIds.has(b.target) ? add(worlds.get(b.target)!, delta) : worlds.get(b.target)!;
      const length = distance(from, to);
      if (length < 1e-8) return false;
      const direction = { x: (to.x - from.x) / length, y: (to.y - from.y) / length, z: (to.z - from.z) / length };
      if (length + 1e-6 < minimumBinderDistance(doc, b, direction)) return false;
    }
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
    spatialPosition: desired ?? preferred(doc, entityId, parentId, settings),
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
  const bindings = spacingBinders(next);
  const children = new Map<string | null, Placement[]>();
  for (const p of next.placements) children.set(p.parentId, [...(children.get(p.parentId) ?? []), p]);
  const entities = new Map(next.entities.map(e => [e.id, e]));
  const ownBoxes = new Map<string, Box3>();
  for (const p of next.placements) {
    const size = visualFootprint(labelSize(entities.get(p.entityId)?.label ?? ""), p.visual);
    const floor = size.sphere ? 0 : settings.radius * 2;
    const x = Math.max(floor, size.width) / 2, y = Math.max(floor, size.height) / 2;
    const z = Math.max(floor, size.depth) / 2;
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
        const ids = subtreeIds(next, p.id), worlds = worldPositions(next);
        const parentWorld = parentId ? worlds.get(parentId)! : origin();
        const radial: { moving: XYZ; fixed: XYZ; radius: number }[] = [];
        for (const b of bindings) {
          if (ids.has(b.source) === ids.has(b.target)) continue;
          const otherId = ids.has(b.source) ? b.target : b.source;
          const other = byId.get(otherId)!;
          const size = placementFootprint(next, other), world = worlds.get(otherId)!;
          const movingId = ids.has(b.source) ? b.source : b.target;
          const movingSize = placementFootprint(next, byId.get(movingId)!);
          if (size.sphere && movingSize.sphere && (!b.label || b.visual?.showText === false)) {
            radial.push({ moving: worlds.get(movingId)!, fixed: world, radius: (size.width + movingSize.width) / 2 + binderGap(b) });
            continue;
          }
          const from = worlds.get(b.source)!, to = worlds.get(b.target)!, length = distance(from, to) || 1;
          const direction = { x: (to.x - from.x) / length, y: (to.y - from.y) / length, z: (to.z - from.z) / length };
          const pad = Math.max(0, binderGap(b, direction) - settings.clearance);
          obstacles.push({ min: { x: world.x - parentWorld.x - size.width / 2 - pad, y: world.y - parentWorld.y - size.height / 2 - pad, z: world.z - parentWorld.z - size.depth / 2 - pad }, max: { x: world.x - parentWorld.x + size.width / 2 + pad, y: world.y - parentWorld.y + size.height / 2 + pad, z: world.z - parentWorld.z + size.depth / 2 + pad } });
        }
        let result = contractAlongRay(contents(p), start, anchor, obstacles, settings.clearance);
        for (const constraint of radial) {
          const wanted = { x: constraint.moving.x + result.x - start.x, y: constraint.moving.y + result.y - start.y, z: constraint.moving.z + result.z - start.z };
          const stopped = stopBeforeSphere(constraint.moving, wanted, constraint.fixed, constraint.radius);
          result = { x: start.x + stopped.x - constraint.moving.x, y: start.y + stopped.y - constraint.moving.y, z: start.z + stopped.z - constraint.moving.z };
        }
        if (distance(start, result) > 1e-8) { p.spatialPosition = result; changed = true; }
      }
      if (!changed) break;
    }
  }
  return validateDocument(next);
}

/** An explicit presentation edit may need more room. Extend the affected branch,
 * preserve identities/relations, and keep the change in the caller's single undo step. */
export function ensureBinderSpacing(doc: Document, settings: SpatialSettings, binderId?: string): Document {
  let next = doc;
  for (const b of spacingBinders(doc).filter(b => !binderId || b.id === binderId)) {
    if (b.source === b.target) continue;
    const worlds = worldPositions(next), from = worlds.get(b.source)!, to = worlds.get(b.target)!;
    const length = distance(from, to);
    const direction = length > 1e-8 ? { x: (to.x - from.x) / length, y: (to.y - from.y) / length, z: (to.z - from.z) / length } : { x: 1, y: 0, z: 0 };
    const required = minimumBinderDistance(next, b, direction);
    if (length >= required - 1e-6) continue;
    // Moving a parent would move both endpoints; move the descendant instead.
    const targetContainsSource = subtreeIds(next, b.target).has(b.source);
    const movingId = targetContainsSource ? b.source : b.target;
    const fixed = targetContainsSource ? to : from, sign = targetContainsSource ? -1 : 1;
    const p = next.placements.find(p => p.id === movingId)!;
    const parent = p.parentId ? worlds.get(p.parentId)! : origin();
    const desired = { x: fixed.x + direction.x * required * sign - parent.x, y: fixed.y + direction.y * required * sign - parent.y, z: fixed.z + direction.z * required * sign - parent.z };
    next = movePlacement(next, movingId, desired, settings);
  }
  return next;
}
