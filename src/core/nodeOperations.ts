import { addStructure, bind, locate, sameOrigin, type Origin, type Structure, type Vec3, type World } from './model.ts';
import { address, inherited, point, prepareTranslation, vector } from './lattice.ts';
import { nearestCell } from '../graph/lattice.ts';

export function adoptNodes(world: World, origins: readonly Origin[], owner: Origin, delta: Vec3) {
  const parent = locate(world, owner); if (!parent) throw Error('The parent is no longer available.');
  const moving = new Set(branch(world, origins).map(address));
  if (moving.has(address(owner))) throw Error('A node cannot become a child of its own branch.');
  // Only selection roots change parent; selected descendants retain their hierarchy.
  const roots = world.nodes.filter(node => origins.some(origin => sameOrigin(origin, node.origin)) &&
    (!node.parent || !moving.has(address(node.parent))));
  if (!roots.length) return;
  const resolve = prepareTranslation(world, origins);
  const landing = nearestCell(point(delta), cell => !!resolve(vector(cell)));
  const targets = resolve(vector(landing))!;
  for (const node of world.nodes) { const target = targets.get(address(node.origin)); if (target) node.position = target; }
  for (const node of roots) {
    detachNode(world, node.origin);
    node.parent = structuredClone(owner);
    if (!parent.parts.some(binding => binding.mode === 'follow' && sameOrigin(binding.origin, node.origin))) parent.parts.push(bind(node, 'follow', world));
  }
  parent.collapsed = false;
}

export function branch(world: World, roots: readonly Origin[]) {
  const values = [...roots]; let added = true;
  while (added) { added = false; for (const node of world.nodes) if (node.parent && values.some(origin => sameOrigin(origin, node.parent!)) && !values.some(origin => sameOrigin(origin, node.origin))) { values.push(node.origin); added = true; } }
  return values;
}
export function copyNode(world: World, source: Structure, position: Vec3) {
  const actual = inherited(source, world), node = addStructure(world, position);
  for (const key of ['orientation','label','color','text','visual','opacity','glow','translucency','translucencyRadius','parts','scene','textAppearance','catalog'] as const) if (actual[key] !== undefined) Object.assign(node, { [key]: structuredClone(actual[key]) });
  if(actual.omnic)node.visual={size:actual.visual?.size,showText:actual.visual?.showText,omnicEntityId:JSON.stringify(source.origin)};
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
  delete node.parent; delete node.variantOf; delete node.overrides; delete node.omnicEdits;delete node.omnicRevision;
  if (parent) parent.parts = parent.parts.filter(binding => binding.mode !== 'follow' || !sameOrigin(binding.origin, origin));
}
export function removeNodes(world: World, selected: readonly Origin[]) {
  for (const node of world.nodes) if (!selected.some(origin => sameOrigin(origin, node.origin))) {
    if (node.parent && selected.some(origin => sameOrigin(origin, node.parent!)) || node.variantOf && selected.some(origin => sameOrigin(origin, node.variantOf!))) detachNode(world, node.origin);
  }
  world.nodes = world.nodes.filter(node => !selected.some(origin => sameOrigin(origin, node.origin)));
}

/** Toggle every authored level of the visible subtree, as V1 Shift-click does. */
export function toggleSubtree(world: World, origin: Origin) {
  const root = locate(world, origin); if (!root) throw Error('The subtree is no longer available.');
  const children = new Map<string, Structure[]>();
  for (const node of world.nodes) if (node.parent && !node.hidden && !node.variantOf) {
    const id = address(node.parent), list = children.get(id) ?? []; list.push(node); children.set(id, list);
  }
  const pending = [root], seen = new Set<string>(); let fullyExpanded = true, expandable = false;
  for (let i = 0; i < pending.length; i++) {
    const node = pending[i], id = address(node.origin); if (seen.has(id)) continue; seen.add(id);
    const next = children.get(id) ?? []; pending.push(...next);
    if (next.length) { expandable = true; if (node.collapsed) fullyExpanded = false; }
  }
  if (expandable) for (const node of pending) node.collapsed = fullyExpanded;
}
