import {definitionRecipe} from '../omnic/definition.ts';
import { cellAt, cellPoint, nearestCell, prepareLattice, latticeMove, type Cell } from '../graph/lattice.ts';
import type { Document, XYZ } from '../graph/geometryTypes.ts';
import type { Origin, Structure, Vec3, World } from './model.ts';

export const address = (origin: Origin) => JSON.stringify(origin);
export const point = (v: Vec3): XYZ => ({ x: v[0], y: v[1], z: v[2] });
export const vector = (v: XYZ): Vec3 => [v.x, v.y, v.z];
export const cellKey = (p: Cell) => `${p.x},${p.y},${p.z}`;
export function geometry(world: World): Document {
  const nodes = new Map(world.nodes.map(node => [address(node.origin), node]));
  return { placements: world.nodes.map(node => {
    const parent = node.parent && nodes.get(address(node.parent));
    return { id: address(node.origin), parentId: parent ? address(parent.origin) : null, position: { x: 0, y: 0 },
      spatialPosition: point(parent ? node.position.map((n, i) => n - parent.position[i]) as Vec3 : node.position),
      ...(node.variantOf ? { variantOwner: { placementId: address(node.variantOf) } } : {}),
    };
  }) };
}
const prepared = new WeakMap<World, ReturnType<typeof prepareLattice>>();
export function lattice(world: World) {
  let value = prepared.get(world); if (!value) { value = prepareLattice(geometry(world)); prepared.set(world, value); } return value;
}
export function creationCell(world: World, desired: Vec3): Vec3 {
  const occupied = new Set(world.nodes.map(node => cellKey(cellAt(point(node.position)))));
  return vector(nearestCell(point(desired), cell => !occupied.has(cellKey(cell))));
}
export function moveBranch(world: World, origin: Origin, desired: Vec3) {
  const next = latticeMove(geometry(world), address(origin), point(desired), 1, true);
  const index = prepareLattice(next);
  for (const node of world.nodes) node.position = vector(cellPoint(index.cells.get(address(node.origin))!));
}
export function prepareTranslation(world: World, origins: readonly Origin[]) {
  const index = lattice(world), moving = new Set(origins.map(address));
  for (const node of world.nodes) if (node.parent && moving.has(address(node.parent))) moving.add(address(node.origin));
  // Parent order need not match insertion order.
  let changed = true;
  while (changed) { changed = false; for (const node of world.nodes) if (node.parent && moving.has(address(node.parent)) && !moving.has(address(node.origin))) { moving.add(address(node.origin)); changed = true; } }
  return (delta: Vec3): Map<string, Vec3> | undefined => {
    const step = cellAt(point(delta)), result = new Map<string, Vec3>();
    for (const id of moving) {
      const from = index.cells.get(id); if (!from) continue;
      const to = { x: from.x + step.x, y: from.y + step.y, z: from.z + step.z }, occupant = index.occupied.get(cellKey(to));
      if (occupant && !moving.has(occupant) || !Object.values(to).every(Number.isSafeInteger)) return;
      result.set(id, vector(to));
    }
    return result;
  };
}
export function inherited(node: Structure, world: World): Structure {
  const visited = new Set<Structure>();
  const read = (current: Structure): Structure => {
    if (visited.has(current)) throw Error('Circular variant inheritance.'); visited.add(current);
    const parent = current.variantOf && world.nodes.find(n => address(n.origin) === address(current.variantOf!));
    if (!parent) return current;
    const base = read(parent), overrides = new Set(current.overrides ?? []);
    const next = { ...current, parts: [...base.parts, ...current.parts] };
    for (const key of ['color', 'label', 'text', 'visual', 'opacity', 'glow', 'translucency', 'translucencyRadius','scene','textAppearance'] as const) {
      if (!overrides.has(key)) Object.assign(next, { [key]: base[key] });
    }
    if(base.omnic||current.omnicEdits){next.omnic=definitionRecipe(current,world);if(current.omnicEdits!==undefined)next.visual={...next.visual,assetId:undefined,character:undefined,omnicEntityId:JSON.stringify(current.origin)};}
    return next;
  }; return read(node);
}
