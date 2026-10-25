import { imageSignatureMatches, isImageType, MAX_ASSET_BYTES, type SceneNode, type SceneSource } from '../../supabase/functions/_shared/contracts.ts';

export type ScenePromptSnapshot = { prompt: string; variable: string; source: SceneSource; node: SceneNode; resolved: string; copiedAt: string };
export type LocalScene = { id: string; name: string; type: string; size: number; width: number; height: number; createdAt: string; input: ScenePromptSnapshot | null };
type StoredScene = LocalScene & { blob: Blob };
const MAX_LIBRARY_BYTES = 100 * 1024 * 1024, MAX_IMAGES = 100;

async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const open = indexedDB.open('omnium-scene-library', 1);
    open.onupgradeneeded = () => {
      open.result.createObjectStore('images', { keyPath: 'id' });
      open.result.createObjectStore('metadata', { keyPath: 'id' });
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(new Error('Scene storage is unavailable in this browser.'));
  });
}
async function store<T>(mode: IDBTransactionMode, run: (transaction: IDBTransaction) => IDBRequest<T>): Promise<T> {
  const db = await database();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(['images', 'metadata'], mode);
      const request = run(transaction);
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = transaction.onabort = () => reject(new Error('Scene could not be saved. Browser storage may be full or unavailable.'));
    });
  } finally { db.close(); }
}
export const listLocalScenes = () => store<LocalScene[]>('readonly', transaction => transaction.objectStore('metadata').getAll())
  .then(items => items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
export async function localSceneBlob(id: string): Promise<Blob> {
  const item = await store<StoredScene | undefined>('readonly', transaction => transaction.objectStore('images').get(id));
  if (!item) throw new Error('This scene image is missing from this browser. Import it again.');
  return item.blob;
}
export const deleteLocalScene = (id: string) => store('readwrite', transaction => {
  transaction.objectStore('metadata').delete(id);
  return transaction.objectStore('images').delete(id);
});

/** Inspect encoded dimensions before asking the browser/GPU to decode an image. */
function dimensions(bytes: Uint8Array, type: string): [number, number] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (at: number) => String.fromCharCode(...bytes.subarray(at, at + 4));
  if (type === 'image/png' && bytes.length >= 33 && tag(12) === 'IHDR') return [view.getUint32(16), view.getUint32(20)];
  if (type === 'image/jpeg') {
    let offset = 2;
    while (offset + 4 < bytes.length) {
      if (bytes[offset++] !== 255) break;
      while (bytes[offset] === 255) offset++;
      const marker = bytes[offset++];
      if (marker === 217 || marker === 218) break;
      if (marker === 1 || marker >= 208 && marker <= 215) continue;
      if (offset + 2 > bytes.length) break;
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > bytes.length) break;
      if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker) && length >= 8)
        return [view.getUint16(offset + 5), view.getUint16(offset + 3)];
      offset += length;
    }
  }
  if (type === 'image/webp') {
    for (let offset = 12; offset + 8 <= bytes.length;) {
      const size = view.getUint32(offset + 4, true), start = offset + 8, end = start + size;
      if (end > bytes.length) break;
      if (tag(offset) === 'ANIM' || tag(offset) === 'ANMF' || tag(offset) === 'VP8X' && size >= 10 && (bytes[start] & 2))
        throw new Error('Choose a static image, not an animated WebP.');
      if (tag(offset) === 'VP8X' && size >= 10) return [1 + bytes[start + 4] + (bytes[start + 5] << 8) + (bytes[start + 6] << 16), 1 + bytes[start + 7] + (bytes[start + 8] << 8) + (bytes[start + 9] << 16)];
      if (tag(offset) === 'VP8 ' && size >= 10 && bytes[start + 3] === 157 && bytes[start + 4] === 1 && bytes[start + 5] === 42)
        return [view.getUint16(start + 6, true) & 16383, view.getUint16(start + 8, true) & 16383];
      if (tag(offset) === 'VP8L' && size >= 5 && bytes[start] === 47) {
        const bits = view.getUint32(start + 1, true); return [(bits & 16383) + 1, ((bits >>> 14) & 16383) + 1];
      }
      offset = end + (size % 2);
    }
  }
  throw new Error('Image dimensions could not be read. Export a standard PNG, JPEG or WebP.');
}
export async function importLocalScene(file: File, input: ScenePromptSnapshot | null): Promise<LocalScene> {
  if (!file.size || file.size > MAX_ASSET_BYTES) throw new Error('Choose a PNG, JPEG or WebP up to 10 MiB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = ['image/png', 'image/jpeg', 'image/webp'].find(type => isImageType(type) && imageSignatureMatches(bytes, type));
  if (!type) throw new Error('Choose a PNG, JPEG or WebP image. SVG, HTML and other files are not supported.');
  const [width, height] = dimensions(bytes, type);
  if (!width || !height || width > 4096 || height > 4096 || width * height > 12_000_000)
    throw new Error('Use an image no larger than 4096 px per side and 12 megapixels to keep the workspace responsive.');
  const blob = new Blob([bytes], { type });
  const decoded = await createImageBitmap(blob).catch(() => { throw new Error('The browser could not decode this image. Try exporting it as PNG.'); });
  const valid = decoded.width > 0 && decoded.height > 0 && decoded.width <= 4096 && decoded.height <= 4096 && decoded.width * decoded.height <= 12_000_000;
  decoded.close();
  if (!valid) throw new Error('The decoded image exceeds the scene resolution limit.');
  const item: LocalScene = { id: crypto.randomUUID(), name: file.name.slice(0, 120) || 'Pasted scene', type, size: blob.size, width, height, createdAt: new Date().toISOString(), input };
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(['images', 'metadata'], 'readwrite');
      const request = transaction.objectStore('metadata').getAll();
      let full = false;
      request.onsuccess = () => {
        const items = request.result as LocalScene[];
        if (items.length >= MAX_IMAGES || items.reduce((total, item) => total + item.size, 0) + blob.size > MAX_LIBRARY_BYTES) { full = true; transaction.abort(); return; }
        transaction.objectStore('images').add({ ...item, blob });
        transaction.objectStore('metadata').add(item);
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = transaction.onabort = () => reject(new Error(full ? 'Scene library is full (100 images / 100 MiB). Download and delete images you no longer need.' : 'Scene could not be saved. Browser storage may be full or unavailable.'));
    });
  } finally { db.close(); }
  return item;
}
const promptKey = 'omnia.scene.copied-prompt.v1';
export function loadCopiedPrompt(): ScenePromptSnapshot | null {
  try {
    const item = JSON.parse(localStorage.getItem(promptKey) ?? 'null');
    return item && typeof item.prompt === 'string' && typeof item.resolved === 'string' && typeof item.variable === 'string' &&
      ['label', 'notes', 'label-and-notes'].includes(item.source) && typeof item.node?.id === 'string' && typeof item.node.label === 'string' &&
      typeof item.node.notes === 'string' && typeof item.copiedAt === 'string' ? item : null;
  } catch { return null; }
}
export function saveCopiedPrompt(input: ScenePromptSnapshot) { localStorage.setItem(promptKey, JSON.stringify(input)); }
export function downloadScene(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), anchor = document.createElement('a');
  anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
