import { validateAppearance, validatePaint, type Appearance, type Paint } from '../properties/visual.ts';
import { creationCell } from './lattice.ts';
import { SPHERE_VISUAL_DEFAULTS } from '../properties/sphereVisualDefaults.ts';
import { validateNodeText, type NodeText } from '../text/model.ts';
import { validateAsset, validateVisual, type Visual, type VisualAsset } from '../graph/assets.ts';
import { defaultScene, type SceneSettings } from '../scene/state.ts';
export type Vec3 = [number, number, number];
export type Origin = { born: number; at: Vec3 };
export type Binding =
  | { mode: 'follow'; origin: Origin }
  | { mode: 'position'; at: Vec3 }
  | { mode: 'structure'; specification: string };
export type Structure = { origin: Origin; label: string; position: Vec3; color: string; invariant: boolean; parts: Binding[];
  parent?: Origin; variantOf?: Origin; overrides?: string[]; hidden?: boolean; collapsed?: boolean;
  text?: NodeText; textAppearance?: Paint; visual?: Visual; scene?: string | null;
  opacity?: number; glow?: number; translucency?: number; translucencyRadius?: number;
};
export type Relationship = { from: Binding; to: Binding; label: string; kind: string };
export type World = { format: 'omnium-world'; version: 1 | 2; nodes: Structure[]; assets?: VisualAsset[]; relationships?: Relationship[]; scene?: SceneSettings; appearance?: Appearance;
  settings?: { latticeScale: number; names: 'all' | 'expanded' | 'selection' } };
export const emptyWorld = (): World => ({ format: 'omnium-world', version: 2, nodes: [], assets: [], relationships: [], scene: defaultScene(), settings: { latticeScale: 1, names: 'expanded' } });
export const samePoint = (a: Vec3, b: Vec3) => a.every((n, i) => n === b[i]);
export const sameOrigin = (a: Origin, b: Origin) => a.born === b.born && samePoint(a.at, b.at);
export const locate = (world: World, origin: Origin) => world.nodes.find(node => sameOrigin(node.origin, origin));

// A follower's anchor records an actual birth event, not an invented semantic ID.
// Labels, paint and display coordinates do not define a position-independent invariant.
export function prepareWorld(world: World) {
  const anchors = new Map(world.nodes.map(node => [JSON.stringify(node.origin), node]));
  const positions = new Map(world.nodes.map(node => [JSON.stringify(node.position), node]));
  const cached = new Map<Structure, string>(), active = new Set<Structure>();
  const target = (binding: Exclude<Binding, { mode: 'structure' }>) => binding.mode === 'follow'
    ? anchors.get(JSON.stringify(binding.origin)) : positions.get(JSON.stringify(binding.at));
  function signature(node: Structure): string {
    if (active.has(node) || active.size > 32) throw new Error('Circular or excessively deep composition.');
    const known = cached.get(node); if (known) return known;
    active.add(node);
    const base = node.variantOf && anchors.get(JSON.stringify(node.variantOf));
    const value = base && !node.parts.length ? signature(base) : JSON.stringify(node.parts.length ? ['composition', ...(base ? [signature(base)] : []), ...node.parts.map(binding => {
      if (binding.mode === 'structure') return binding.specification;
      const child = target(binding);
      return child ? signature(child) : ['unresolved', binding];
    })] : ['unit']);
    active.delete(node);
    if (value.length > 16000) throw new Error('Composition exceeds the initial structural budget.');
    cached.set(node, value); return value;
  }
  const shared = new Map<string, Structure[]>();
  for (const node of world.nodes) if (node.invariant) {
    const value = signature(node); shared.set(value, [...(shared.get(value) ?? []), node]);
  }
  return { specification: signature, resolve: (binding: Binding): Structure[] => {
    if (binding.mode === 'structure') return shared.get(binding.specification) ?? [];
    const node = target(binding); return node ? [node] : [];
  } };
}

export function specification(node: Structure, world: World): string {
  return prepareWorld(world).specification(node);
}

export function resolve(binding: Binding, world: World): Structure[] {
  return prepareWorld(world).resolve(binding);
}

export function bind(node: Structure, mode: Binding['mode'], world: World): Binding {
  if (mode === 'follow') return { mode, origin: structuredClone(node.origin) };
  if (mode === 'position') return { mode, at: [...node.position] };
  if (!node.invariant) throw new Error('Activate the target as an invariant first.');
  return { mode, specification: specification(node, world) };
}

export function addStructure(world: World, position: Vec3, born = Date.now()): Structure {
  if (world.nodes.length >= 4000) throw new Error('This first workbench supports 4,000 structures.');
  const point = creationCell(world, position);
  const node: Structure = { origin: { born, at: [...point] }, label: '', position: point, color: SPHERE_VISUAL_DEFAULTS.color, invariant: false, parts: [] };
  world.nodes.push(node);
  return node;
}

export function setInvariant(world: World, node: Structure, enabled: boolean) {
  if (enabled) {
    const key = specification(node, world);
    if (world.nodes.some(other => other !== node && other.invariant && specification(other, world) === key)) {
      throw new Error('An equivalent invariant already exists.');
    }
  }
  node.invariant = enabled;
}

export function validateWorld(value: unknown): World {
  const w = value as World;
  if (!w || w.format !== 'omnium-world' || ![1, 2].includes(w.version) || !Array.isArray(w.nodes) || w.nodes.length > 4000) throw new Error('Unsupported world format.');
  const point = (p: unknown): p is Vec3 => Array.isArray(p) && p.length === 3 && p.every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 1e7);
  const origin = (o: Origin) => o && Number.isFinite(o.born) && point(o.at);
  validateAppearance(w.appearance);
  const assets = w.assets ?? [];
  if (!Array.isArray(assets) || assets.length > 100) throw Error('Invalid visual library.');
  const assetKeys = new Set<string>();
  for (const asset of assets) { validateAsset(asset); if (assetKeys.has(asset.id)) throw Error('Duplicate visual resource.'); assetKeys.add(asset.id); }
  const glyphs = new Set(w.nodes.map(node => JSON.stringify(node?.origin)));
  const anchors = new Set<string>(), positions = new Set<string>(), invariants = new Set<string>();
  let size = 0;
  for (const node of w.nodes) {
    if (!origin(node.origin) || !point(node.position) || typeof node.label !== 'string' || node.label.length > 160 ||
        !/^#[\da-f]{6}$/i.test(node.color) || typeof node.invariant !== 'boolean' || !Array.isArray(node.parts) || node.parts.length > 64) throw new Error('Invalid structure.');
    const a = JSON.stringify(node.origin), p = JSON.stringify(node.position);
    if (anchors.has(a) || positions.has(p)) throw new Error('Two structures cannot occupy the same address.');
    anchors.add(a); positions.add(p);
    if (node.parent !== undefined && !origin(node.parent) || node.variantOf !== undefined && !origin(node.variantOf)) throw Error('Invalid node parent or variant.');
    if (node.overrides !== undefined && (!Array.isArray(node.overrides) || node.overrides.some(key => !['color','label','text','visual','opacity','glow','translucency','translucencyRadius','scene','textAppearance'].includes(key)))) throw Error('Invalid variant override.');
    if (node.hidden !== undefined && typeof node.hidden !== 'boolean' || node.collapsed !== undefined && typeof node.collapsed !== 'boolean') throw Error('Invalid node visibility.');
    if (node.scene !== undefined && node.scene !== null && (typeof node.scene !== 'string' || node.scene.length > 200)) throw Error('Invalid node scene.');
    for (const key of ['opacity','glow','translucency','translucencyRadius'] as const) if (node[key] !== undefined && (!Number.isFinite(node[key]) || node[key]! < 0 || node[key]! > 1)) throw Error('Invalid carrier appearance.');
    validatePaint(node.textAppearance,true);
    if (node.text) validateNodeText(node.text, glyphs);
    validateVisual(node.visual, assets);
    for (const binding of node.parts) {
      if (!binding || !(binding.mode === 'follow' ? origin(binding.origin) : binding.mode === 'position' ? point(binding.at)
        : binding.mode === 'structure' && typeof binding.specification === 'string' && binding.specification.length <= 16000)) throw new Error('Invalid reference.');
      size += binding.mode === 'structure' ? binding.specification.length : 200;
      if (size > 2e6) throw new Error('World exceeds the initial storage budget.');
    }
  }
  const byOrigin = new Map(w.nodes.map(node => [JSON.stringify(node.origin), node]));
  for (const relation of ['parent', 'variantOf'] as const) for (const node of w.nodes) {
    const chain = new Set<Structure>(); let current: Structure | undefined = node;
    while (current?.[relation]) {
      if (chain.has(current)) throw Error('Circular node hierarchy.'); chain.add(current);
      current = byOrigin.get(JSON.stringify(current[relation]));
      if (!current) throw Error('Missing node parent or variant source.');
    }
  }
  if (w.settings && (!Number.isFinite(w.settings.latticeScale) || w.settings.latticeScale <= 0 || !['all','expanded','selection'].includes(w.settings.names))) throw Error('Invalid world settings.');
  if (w.scene && (!w.scene.vfx || !w.scene.normalization || typeof w.scene.prompt !== 'string' || w.scene.prompt.length > 4000 || !['label','notes','label-and-notes'].includes(w.scene.source))) throw Error('Invalid scene settings.');
  if (w.relationships && (!Array.isArray(w.relationships) || w.relationships.length > 2000)) throw Error('Too many relationships.');
  for (const relation of w.relationships ?? []) {
    if (typeof relation.label !== 'string' || relation.label.length > 500 || typeof relation.kind !== 'string' || relation.kind.length > 100) throw Error('Invalid relationship.');
    for (const binding of [relation.from, relation.to]) if (!binding || !(binding.mode === 'follow' ? origin(binding.origin) : binding.mode === 'position' ? point(binding.at) : binding.mode === 'structure' && typeof binding.specification === 'string' && binding.specification.length <= 16000)) throw Error('Invalid relationship binding.');
  }
  // Every reference, including structural selectors, participates in cycle checks.
  const prepared = prepareWorld(w), visiting = new Set<Structure>(), visited = new Set<Structure>();
  const visit = (node: Structure) => {
    if (visiting.has(node)) throw new Error('A composition cannot contain itself.');
    if (visited.has(node)) return;
    visiting.add(node);
    for (const binding of node.parts) for (const target of prepared.resolve(binding)) visit(target);
    visiting.delete(node); visited.add(node);
  };
  for (const node of w.nodes) {
    const key = prepared.specification(node);
    if (key.length > 16000) throw new Error('Composition exceeds the initial structural budget.');
    if (node.invariant && invariants.has(key)) throw new Error('An equivalent invariant already exists.');
    if (node.invariant) invariants.add(key);
    visit(node);
  }
  return w;
}
