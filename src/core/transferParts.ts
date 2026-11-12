import { emptyWorld, prepareWorld, type World, type Origin, type Binding, type Vec3 } from './model.ts';
import { checkedWorld, parseWorkspaceFile, sceneReferences, type WorkspaceFile } from './transfer.ts';

const key = (origin: Origin) => JSON.stringify(origin);
export type TransferChoice = { nodes: string[]; settings: boolean; scene: boolean; appearance: boolean };
export type PartsFile = WorkspaceFile & { parts?: TransferChoice & { complete: boolean } };
export const fullChoice = (world: World): TransferChoice => ({ nodes: world.nodes.map(node => key(node.origin)), settings: true, scene: true, appearance: true });
export const hasChoice = (choice: TransferChoice) => !!(choice.nodes.length || choice.settings || choice.scene || choice.appearance);
export const availableChoice = (file: PartsFile): TransferChoice => file.parts ?? fullChoice(file.world);
function checkChoice(world: World, choice: TransferChoice) {
  const ids = new Set(world.nodes.map(node => key(node.origin)));
  if (!choice || !Array.isArray(choice.nodes) || choice.nodes.some(id => typeof id !== 'string' || !ids.has(id)) || new Set(choice.nodes).size !== choice.nodes.length || ['settings','scene','appearance'].some(k => typeof choice[k as keyof TransferChoice] !== 'boolean') || !hasChoice(choice)) throw Error('Choose parts present in this file.');
}
/** Include actual dependencies, never arbitrary strings that happen to resemble IDs. */
export function subsetWorld(world: World, choice: TransferChoice): World {
  checkChoice(world, choice);
  const byId = new Map(world.nodes.map(node => [key(node.origin), node])), included = new Set(choice.nodes), pending = [...included];
  const children = new Map<string, string[]>();
  for (const node of world.nodes) if (node.parent) { const id = key(node.parent); const group = children.get(id) ?? []; group.push(key(node.origin)); children.set(id, group); }
  const prepared = prepareWorld(world);
  const include = (id: string) => { if (byId.has(id) && !included.has(id)) { included.add(id); pending.push(id); } };
  const binding = (value: Binding) => prepared.resolve(value).forEach(node => include(key(node.origin)));
  for (let at = 0; at < pending.length; at++) {
    const node = byId.get(pending[at])!;
    if (node.parent) include(key(node.parent));
    if (node.variantOf) include(key(node.variantOf));
    node.parts.forEach(binding);
    if (node.visual?.omnicEntityId) include(node.visual.omnicEntityId);
    node.text?.content.forEach(part => { if (typeof part !== 'string') include(part.glyph); });
    // A selected parent carries its children.
    for (const child of children.get(pending[at]) ?? []) include(child);
  }
  const nodes = world.nodes.filter(node => included.has(key(node.origin)));
  const assets = new Set(nodes.map(node => node.visual?.assetId).filter(Boolean));
  const inside = (value: Binding) => { const resolved = prepared.resolve(value); return resolved.length > 0 && resolved.every(node => included.has(key(node.origin))); };
  return structuredClone(checkedWorld({ ...emptyWorld(), nodes, assets: world.assets?.filter(asset => assets.has(asset.id)), relationships: world.relationships?.filter(relation => inside(relation.from) && inside(relation.to)),
    settings: choice.settings ? world.settings : undefined, scene: choice.scene ? world.scene : undefined, appearance: choice.appearance ? world.appearance : undefined }));
}
export function createPartsFile(world: World, choice: TransferChoice): PartsFile {
  const subset = subsetWorld(world, choice);
  return { format: 'omnium-v2-workspace', version: 1, world: subset, scenes: [], parts: { ...structuredClone(choice), complete: choice.nodes.length === world.nodes.length } };
}
export function parsePartsFile(text: string): PartsFile {
  const file = parseWorkspaceFile(text) as PartsFile, raw = file;
  if (raw.parts !== undefined) {
    checkChoice(file.world, raw.parts);
    if (typeof raw.parts.complete !== 'boolean') throw Error('Invalid complete-workspace marker.');
    file.parts = { nodes: raw.parts.nodes, settings: raw.parts.settings, scene: raw.parts.scene, appearance: raw.parts.appearance, complete: raw.parts.complete };
    const subset = subsetWorld(file.world, file.parts);
    if (subset.nodes.length !== file.world.nodes.length) throw Error('Transfer contains unrelated nodes.');
  }
  return file;
}
export function preparePartsImport(current: World, file: PartsFile, choice: TransferChoice, replace: boolean): World {
  const available = availableChoice(file);
  checkChoice(file.world, choice);
  if (choice.nodes.some(id => !available.nodes.includes(id)) || choice.settings && !available.settings || choice.scene && !available.scene || choice.appearance && !available.appearance) throw Error('Choose parts present in this file.');
  const incoming = subsetWorld(file.world, choice), next = structuredClone(current);
  if (replace) {
    if (file.parts?.complete === false || choice.nodes.length !== available.nodes.length) throw Error('Only complete selected content can replace the workspace.');
    next.nodes = incoming.nodes; next.assets = incoming.assets; next.relationships = incoming.relationships;
  } else if (incoming.nodes.length) {
    // Keep a batch rigid and independent; preserve all internal references.
    const ids = new Map<string, Origin>(); let born = Math.max(Date.now(), ...current.nodes.map(node => node.origin.born)) + 1;
    for (const node of incoming.nodes) ids.set(key(node.origin), { born: born++, at: [...node.origin.at] });
    const offset = current.nodes.length ? Math.max(...current.nodes.map(node => node.position[0])) - Math.min(...incoming.nodes.map(node => node.position[0])) + 2 : 0;
    const position = (at: Vec3): Vec3 => [at[0] + offset, at[1], at[2]];
    const origin = (value: Origin) => { const mapped = ids.get(key(value)); if (!mapped) throw Error('Cannot add content with unresolved references.'); return structuredClone(mapped); };
    const binding = (value: Binding): Binding => value.mode === 'follow' ? { ...value, origin: origin(value.origin) } : value.mode === 'position' ? { ...value, at: position(value.at) } : value;
    const prepared = prepareWorld(incoming);
    for (const node of incoming.nodes) for (const value of node.parts) if (!prepared.resolve(value).length) throw Error('Cannot add content with unresolved references.');
    for (const node of incoming.nodes) {
      node.origin = origin(node.origin); node.position = position(node.position);
      if (node.parent) node.parent = origin(node.parent);
      if (node.variantOf) node.variantOf = origin(node.variantOf);
      node.parts = node.parts.map(binding);
      if (node.visual?.omnicEntityId && ids.has(node.visual.omnicEntityId)) node.visual.omnicEntityId = key(ids.get(node.visual.omnicEntityId)!);
      node.text?.content.forEach(part => { if (typeof part !== 'string') part.glyph = key(origin(JSON.parse(part.glyph))); });
    }
    incoming.relationships?.forEach(relation => { relation.from = binding(relation.from); relation.to = binding(relation.to); });
    // Equivalent invariants have one canonical activation; imported instances remain copies.
    const existing = prepareWorld(current), invariantKeys = new Set(current.nodes.filter(node => node.invariant).map(existing.specification));
    const imported = prepareWorld(incoming);
    for (const node of incoming.nodes) if (node.invariant && invariantKeys.has(imported.specification(node))) node.invariant = false;
    next.nodes.push(...incoming.nodes); next.relationships = [...(next.relationships ?? []), ...(incoming.relationships ?? [])];
    const assets = new Map((next.assets ?? []).map(asset => [asset.id, asset]));
    for (const asset of incoming.assets ?? []) { if (assets.has(asset.id) && JSON.stringify(assets.get(asset.id)) !== JSON.stringify(asset)) throw Error('Conflicting visual asset.'); assets.set(asset.id, asset); }
    next.assets = [...assets.values()];
  }
  for (const part of ['settings','scene','appearance'] as const) if (choice[part]) Object.assign(next, { [part]: incoming[part] });
  return checkedWorld(next);
}
export function scenesForChoice(file: PartsFile, choice: TransferChoice) { return sceneReferences(subsetWorld(file.world, choice)); }
