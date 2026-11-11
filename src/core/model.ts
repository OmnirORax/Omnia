export type Vec3 = [number, number, number];
export type Origin = { born: number; at: Vec3 };
export type Binding =
  | { mode: 'follow'; origin: Origin }
  | { mode: 'position'; at: Vec3 }
  | { mode: 'structure'; specification: string };
export type Structure = { origin: Origin; label: string; position: Vec3; color: string; invariant: boolean; parts: Binding[] };
export type World = { format: 'omnium-world'; version: 1; nodes: Structure[] };
export const emptyWorld = (): World => ({ format: 'omnium-world', version: 1, nodes: [] });
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
    const value = JSON.stringify(node.parts.length ? ['composition', ...node.parts.map(binding => {
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
  if (world.nodes.length >= 500) throw new Error('This first workbench supports 500 structures.');
  const point = [...position] as Vec3;
  while (world.nodes.some(node => Math.hypot(...node.position.map((v, i) => v - point[i])) < 3)) point[0] += 4;
  const node: Structure = { origin: { born, at: [...point] }, label: '', position: point, color: '#c4cb9b', invariant: false, parts: [] };
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
  if (!w || w.format !== 'omnium-world' || w.version !== 1 || !Array.isArray(w.nodes) || w.nodes.length > 500) throw new Error('Unsupported world format.');
  const point = (p: unknown): p is Vec3 => Array.isArray(p) && p.length === 3 && p.every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 1e7);
  const origin = (o: Origin) => o && Number.isFinite(o.born) && point(o.at);
  const anchors = new Set<string>(), positions = new Set<string>(), invariants = new Set<string>();
  let size = 0;
  for (const node of w.nodes) {
    if (!origin(node.origin) || !point(node.position) || typeof node.label !== 'string' || node.label.length > 160 ||
        !/^#[\da-f]{6}$/i.test(node.color) || typeof node.invariant !== 'boolean' || !Array.isArray(node.parts) || node.parts.length > 64) throw new Error('Invalid structure.');
    const a = JSON.stringify(node.origin), p = JSON.stringify(node.position);
    if (anchors.has(a) || positions.has(p)) throw new Error('Two structures cannot occupy the same address.');
    anchors.add(a); positions.add(p);
    for (const binding of node.parts) {
      if (!binding || !(binding.mode === 'follow' ? origin(binding.origin) : binding.mode === 'position' ? point(binding.at)
        : binding.mode === 'structure' && typeof binding.specification === 'string' && binding.specification.length <= 16000)) throw new Error('Invalid reference.');
      size += binding.mode === 'structure' ? binding.specification.length : 200;
      if (size > 2e6) throw new Error('World exceeds the initial storage budget.');
    }
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
