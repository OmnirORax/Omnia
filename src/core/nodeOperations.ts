import { addStructure, bind, locate, sameOrigin, type Origin, type Structure, type Vec3, type World } from './model.ts';
import { inherited } from './lattice.ts';

export function branch(world: World, roots: readonly Origin[]) {
  const values = [...roots]; let added = true;
  while (added) { added = false; for (const node of world.nodes) if (node.parent && values.some(origin => sameOrigin(origin, node.parent!)) && !values.some(origin => sameOrigin(origin, node.origin))) { values.push(node.origin); added = true; } }
  return values;
}
export function copyNode(world: World, source: Structure, position: Vec3) {
  const actual = inherited(source, world), node = addStructure(world, position);
  for (const key of ['label','color','text','visual','opacity','glow','translucency','translucencyRadius','parts','scene'] as const) if (actual[key] !== undefined) Object.assign(node, { [key]: structuredClone(actual[key]) });
  return node;
}
export function childNode(world: World, owner: Origin, variant = false) {
  const parent = locate(world, owner); if (!parent) throw Error('The parent is no longer available.');
  const node = addStructure(world, [parent.position[0] + 1, parent.position[1] - 1, parent.position[2]]);
  node.parent = structuredClone(owner);
  if (variant) { node.variantOf = structuredClone(owner); node.overrides = []; }
  else parent.parts.push(bind(node, 'follow', world));
  return node;
}
export function detachNode(world: World, origin: Origin) {
  const node = locate(world, origin); if (!node) return;
  const parent = node.parent && locate(world, node.parent);
  if (node.variantOf) Object.assign(node, structuredClone(inherited(node, world)));
  delete node.parent; delete node.variantOf; delete node.overrides;
  if (parent) parent.parts = parent.parts.filter(binding => binding.mode !== 'follow' || !sameOrigin(binding.origin, origin));
}
export function removeNodes(world: World, selected: readonly Origin[]) {
  for (const node of world.nodes) if (!selected.some(origin => sameOrigin(origin, node.origin))) {
    if (node.parent && selected.some(origin => sameOrigin(origin, node.parent!)) || node.variantOf && selected.some(origin => sameOrigin(origin, node.variantOf!))) detachNode(world, node.origin);
  }
  world.nodes = world.nodes.filter(node => !selected.some(origin => sameOrigin(origin, node.origin)));
}
