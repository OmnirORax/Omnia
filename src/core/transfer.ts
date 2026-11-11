import { validateWorld, type World } from './model.ts';
import { imageSignatureMatches, isImageType, MAX_ASSET_BYTES } from '../scene/contracts.ts';

export const WORLD_BYTES = 4_000_000;
export const TRANSFER_BYTES = 145 * 1024 * 1024;
const LIBRARY_BYTES = 100 * 1024 * 1024;
export type SceneFile = { id: string; name: string; type: string; data: string };
export type WorkspaceFile = { format: 'omnium-v2-workspace'; version: 1; world: World; scenes: SceneFile[] };
export function sceneReferences(world: World): Set<string> {
  return new Set([world.scene?.image, ...world.nodes.map(node => node.scene)].filter((id): id is string => typeof id === 'string'));
}
export function checkedWorld(value: unknown): World {
  const text = JSON.stringify(value);
  if (new TextEncoder().encode(text).length > WORLD_BYTES) throw Error('Workspace structure exceeds 4 MB.');
  return validateWorld(value);
}
export function encodeBytes(bytes: Uint8Array): string {
  const chunks: string[] = [];
  for (let at = 0; at < bytes.length; at += 8192) chunks.push(String.fromCharCode(...bytes.subarray(at, at + 8192)));
  return btoa(chunks.join(''));
}
export function decodeScene(file: SceneFile): Uint8Array {
  if (!file || typeof file.id !== 'string' || !file.id.length || file.id.length > 200 || typeof file.name !== 'string' || file.name.length > 120 || !isImageType(file.type) || typeof file.data !== 'string' || !file.data.length || file.data.length > Math.ceil(MAX_ASSET_BYTES / 3) * 4 || file.data.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(file.data)) throw Error('Invalid workspace image.');
  const raw = atob(file.data), bytes = Uint8Array.from(raw, c => c.charCodeAt(0));
  if (!bytes.length || bytes.length > MAX_ASSET_BYTES || !imageSignatureMatches(bytes, file.type)) throw Error('Invalid workspace image bytes.');
  return bytes;
}
export function parseWorkspaceFile(text: string): WorkspaceFile {
  if (text.length > TRANSFER_BYTES || new TextEncoder().encode(text).length > TRANSFER_BYTES) throw Error('Workspace file exceeds 145 MiB.');
  const value = JSON.parse(text);
  if (!value || value.format !== 'omnium-v2-workspace' || value.version !== 1 || !Array.isArray(value.scenes) || value.scenes.length > 100) throw Error('Unsupported workspace file. V1 files require a separate migration.');
  const world = checkedWorld(value.world), required = sceneReferences(world), seen = new Set<string>();
  let total = 0;
  for (const image of value.scenes as SceneFile[]) {
    if (seen.has(image?.id) || !required.has(image?.id)) throw Error('Duplicate or unrelated workspace image.');
    total += decodeScene(image).length;
    if (total > LIBRARY_BYTES) throw Error('Workspace images exceed 100 MiB.');
    seen.add(image.id);
  }
  if (seen.size !== required.size) throw Error('Workspace file is missing scene images.');
  return { format: 'omnium-v2-workspace', version: 1, world, scenes: value.scenes };
}
export function rebindScenes(world: World, images: ReadonlyMap<string, string>): World {
  const next = structuredClone(world);
  function remap(id: string) { const mapped = images.get(id); if (!mapped) throw Error('Scene image was not restored.'); return mapped; }
  if (typeof next.scene?.image === 'string') next.scene.image = remap(next.scene.image);
  for (const node of next.nodes) if (typeof node.scene === 'string') node.scene = remap(node.scene);
  return checkedWorld(next);
}
