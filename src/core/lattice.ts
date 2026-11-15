import {activeWorldAxes,axisPoint,operationSlot} from './axes.ts';
import {createOccupancy} from '../graph/occupancy.ts';
import {definitionRecipe} from '../omnic/definition.ts';
import { nearestCell, prepareLattice, type Cell } from '../graph/lattice.ts';
import type { Document, XYZ } from '../graph/geometryTypes.ts';
import type {Origin,Structure,Vec3,World} from './model.ts';

export const address = (origin: Origin) => JSON.stringify(origin);
export const point = (v: Vec3): XYZ => ({ x: v[0], y: v[1], z: v[2] });
export const vector = (v: XYZ): Vec3 => [v.x, v.y, v.z];
export const cellKey = (p: Cell) => `${p.x},${p.y},${p.z}`;
export function geometry(world: World): Document {
  const nodes = new Map(world.nodes.map(node => [address(node.origin), node]));
  return { freePositions:true, placements: world.nodes.map(node => {
    const parent = node.parent && nodes.get(address(node.parent));
    return { id: address(node.origin), parentId: parent ? address(parent.origin) : null, position: { x: 0, y: 0 },orientation:node.orientation,
      spatialPosition: point(parent ? node.position.map((n, i) => n - parent.position[i]) as Vec3 : node.position),
      ...(node.variantOf ? { variantOwner: { placementId: address(node.variantOf) } } : {}),
    };
  }) };
}
export function lattice(world: World) {
  // Operation candidates are mutable: translation can prepare this world and
  // then change its positions before the same object becomes the saved world.
  // Keep preparation on the gesture's immutable geometry, not on World identity.
  return prepareLattice(geometry(world));
}
export function creationCell(world: World, desired: Vec3, prepared?:ReturnType<typeof createOccupancy>): Vec3 {
  if(!Array.isArray(desired)||desired.length!==3||!desired.every(n=>Number.isFinite(n)&&Math.abs(n)<=1e7))throw Error('Invalid placement coordinate.');
  const occupied=prepared??createOccupancy(world.nodes.map(node=>[address(node.origin),point(node.position)] as const));
  const offset=vector(nearestCell({x:0,y:0,z:0},cell=>occupied.free({x:desired[0]+cell.x,y:desired[1]+cell.y,z:desired[2]+cell.z})));
  return desired.map((n,i)=>n+offset[i]) as Vec3;
}
export function moveBranch(world: World, origin: Origin, desired: Vec3) {
  const node=world.nodes.find(node=>address(node.origin)===address(origin));if(!node)return;
  const targets=prepareTranslation(world,[origin])(desired.map((n,i)=>n-node.position[i]) as Vec3);
  if(!targets)throw Error('That position is occupied or conflicts with an axis.');
  for(const node of world.nodes){const target=targets.get(address(node.origin));if(target)node.position=target;}
}
export function prepareTranslation(world: World, origins: readonly Origin[],constrainActive=true) {
  const index = lattice(world), moving = new Set(origins.map(address));
  const carried=new Set<string>();
  let changed=true;
  while(changed){const count=moving.size;
    for(const node of world.nodes)if(moving.has(address(node.origin))&&node.collapsed)carried.add(address(node.origin));
    for(const node of world.nodes)if(node.parent&&(carried.has(address(node.parent))||node.hidden&&moving.has(address(node.parent)))){carried.add(address(node.origin));moving.add(address(node.origin));}
    changed=count!==moving.size;
  }
  const occupied=createOccupancy(world.nodes.filter(node=>!moving.has(address(node.origin))).map(node=>[address(node.origin),point(node.position)] as const));
  return (delta: Vec3): Map<string, Vec3> | undefined => {
    const frame=constrainActive?world.axes?.find(frame=>frame.id===world.activeAxis):undefined,root=world.nodes.find(node=>address(node.origin)===address(origins[0]));
    if(frame&&root&&delta.some(n=>n!==0)){
      if(!activeWorldAxes(frame).length)return;
      const desired=root.position.map((n,i)=>n+delta[i]) as Vec3,target=axisPoint(world,frame,operationSlot(world,frame,desired));delta=target.map((n,i)=>n-root.position[i]) as Vec3;
    }
    const result = new Map<string, Vec3>();
    for (const id of moving) {
      const from = index.cells.get(id); if (!from) continue;
      const to = { x: from.x + delta[0], y: from.y + delta[1], z: from.z + delta[2] };
      if (!occupied.free(to) || !Object.values(to).every(n=>Number.isFinite(n)&&Math.abs(n)<=1e7)) return;
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
    for (const key of ['brightness','color', 'label', 'text', 'visual', 'opacity', 'glow', 'translucency', 'translucencyRadius','scene','textAppearance'] as const) {
      if (!overrides.has(key)) Object.assign(next, { [key]: base[key] });
    }
    if(!overrides.has('color'))next.colorOverride=base.colorOverride;
    if(base.omnic||current.omnicEdits){next.omnic=definitionRecipe(current,world);if(current.omnicEdits!==undefined)next.visual={...next.visual,assetId:undefined,character:undefined,omnicEntityId:JSON.stringify(current.origin)};}
    return next;
  }; return read(node);
}
