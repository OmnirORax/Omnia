import {indexHierarchy} from './hierarchy.ts';
import {createRelationNode} from './relationNode.ts';
import {createOccupancy} from '../graph/occupancy.ts';
import { addStructure, bind, locate, sameOrigin, type Origin, type Structure, type Vec3, type World } from './model.ts';
import { address, inherited, prepareTranslation, vector } from './lattice.ts';
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
  const offset = nearestCell({x:0,y:0,z:0}, cell => !!resolve(delta.map((n,i)=>n+vector(cell)[i]) as Vec3));
  const targets = resolve(delta.map((n,i)=>n+vector(offset)[i]) as Vec3)!;
  for (const node of world.nodes) { const target = targets.get(address(node.origin)); if (target) node.position = target; }
  for (const node of roots) {
    detachNode(world, node.origin);
    node.parent = structuredClone(owner);
    if (!parent.parts.some(binding => binding.mode === 'follow' && sameOrigin(binding.origin, node.origin))) parent.parts.push(bind(node, 'follow', world));
  }
  parent.collapsed = false;
}

export function branch(world: World, roots: readonly Origin[]) {
  const {children}=indexHierarchy(world,true),values=[...roots],seen=new Set(roots.map(address));
  for(let i=0;i<values.length;i++)for(const node of children.get(address(values[i]))??[]){const id=address(node.origin);if(!seen.has(id)){seen.add(id);values.push(node.origin);}}
  return values;
}
export function copyNode(world: World, source: Structure, position: Vec3, occupied?:ReturnType<typeof createOccupancy>) {
  const actual = inherited(source, world), node = addStructure(world, position,Date.now(),occupied);
  for (const key of ['brightness','orientation','label','colorOverride','color','text','visual','opacity','glow','glowColor','translucency','translucencyRadius','parts','scene','textAppearance','catalog'] as const) if (actual[key] !== undefined) Object.assign(node, { [key]: structuredClone(actual[key]) });
  if(actual.variantOf&&actual.overrides?.includes('color'))node.colorOverride=true;
  if(actual.omnic)node.visual={size:actual.visual?.size,showText:actual.visual?.showText,omnicEntityId:JSON.stringify(source.origin)};
  return node;
}
export function childNode(world: World, owner: Origin, variant = false, position?:Vec3) {
  const parent = locate(world, owner); if (!parent) throw Error('The parent is no longer available.');
  const node = addStructure(world, position??[parent.position[0] + 1, parent.position[1] - 1, parent.position[2]]);
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
  if(world.axes){const removed=new Set(selected.map(address));world.axes=world.axes.filter(frame=>!frame.ends.some(end=>removed.has(address(end))));for(const frame of world.axes)frame.members=frame.members.filter(member=>!removed.has(address(member)));if(!world.axes.some(frame=>frame.id===world.activeAxis))delete world.activeAxis;}
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

/** Connector release commits once: existing targets get a relationship; empty
 * space gets a child with the standard parent/part binding. */
export function connectNodes(world:World,source:Origin,target:Origin|undefined,position?:Vec3){
 const owner=locate(world,source);if(!owner)throw Error('The source node no longer exists.');
 if(target)return createRelationNode(world,source,target);
 if(!position)throw Error('Choose a creation position.');
 const child=childNode(world,source,false,position);owner.collapsed=false;return child.origin;
}

export function paintNodes(world:World,positions:Vec3[],source?:Origin,axis?:string,parent?:Origin){
 const owner=parent&&locate(world,parent);if(parent&&!owner)throw Error('The parent is no longer available.');
 if(positions.length+world.nodes.length>4000)throw Error('This workbench supports 4,000 nodes.');
 const occupied=createOccupancy(world.nodes.map(node=>[address(node.origin),{x:node.position[0],y:node.position[1],z:node.position[2]}] as const));
 const check=createOccupancy(world.nodes.map(node=>[address(node.origin),{x:node.position[0],y:node.position[1],z:node.position[2]}] as const));
 for(const [i,p]of positions.entries()){const point={x:p[0],y:p[1],z:p[2]};if(!check.free(point))throw Error('The brush overlaps an occupied position.');check.add(String(i),point);}
 const node=source&&locate(world,source),frame=world.axes?.find(frame=>frame.id===axis);
 for(const position of positions){const created=node?copyNode(world,node,position,occupied):addStructure(world,position,Date.now(),occupied);created.parts=[];if(owner){created.parent=structuredClone(owner.origin);owner.parts.push(bind(created,'follow',world));owner.collapsed=false;}if(frame)frame.members.push(structuredClone(created.origin));}
}

export function toggleChildLevel(world:World,origin:Origin){
 const root=locate(world,origin);if(!root)return;
 const children=world.nodes.filter(node=>node.parent&&sameOrigin(node.parent,origin)&&!node.hidden&&!node.variantOf);
 if(!children.length)return;
 if(!root.collapsed){root.collapsed=true;return;}
 root.collapsed=false;for(const child of children)child.collapsed=true;
}

export {hierarchyScope,toggleHierarchies,hierarchyAction} from './hierarchy.ts';
