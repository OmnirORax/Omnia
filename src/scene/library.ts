import {imageTrash} from './imageTrash.ts';
import { DEFAULT_BACKGROUND, DEFAULT_BACKGROUND_URL } from './defaultBackground.ts';
import {restoreImageDeletions} from '../cloud/imageDeletions.ts';
import {normalizeSceneBlob,forgetNormalizedScene} from './normalizationCache.ts';
import type {NormalizationPreferences} from './normalization.ts';
import type {SceneNode,SceneSource} from './contracts.ts';
import {prepareLocalScene} from './prepareImage.ts';
export {prepareLocalScene} from './prepareImage.ts';

export type ScenePromptSnapshot = { prompt: string; variable: string; source: SceneSource; node: SceneNode; resolved: string; copiedAt: string };
export type LocalScene = { id: string; name: string; type: string; size: number; width: number; height: number; createdAt: string; input: ScenePromptSnapshot | null };
export type StoredScene = LocalScene & { blob: Blob };
let cleanup:Promise<void>|undefined;
const MAX_LIBRARY_BYTES = 100 * 1024 * 1024, MAX_IMAGES = 100;

async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const open = indexedDB.open('omnium-scene-library', 1);
    open.onupgradeneeded = () => {
      open.result.createObjectStore('images', { keyPath: 'id' });
      open.result.createObjectStore('metadata', { keyPath: 'id' });
    };
    open.onsuccess = () => {const db=open.result;if(!cleanup){const ids=imageTrash().previous;cleanup=ids.length?new Promise<void>((done,fail)=>{const tx=db.transaction(['images','metadata'],'readwrite');for(const id of ids){tx.objectStore('images').delete(id);tx.objectStore('metadata').delete(id);}tx.oncomplete=()=>done();tx.onerror=tx.onabort=()=>fail(tx.error);}):Promise.resolve();}void cleanup.then(()=>resolve(db),reject);};
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
export const listLocalScenes = (includeDeleted=false) => store<LocalScene[]>('readonly', transaction => transaction.objectStore('metadata').getAll())
  .then(items=>items.filter(item=>includeDeleted||!imageTrash().has(item.id)))
  .then(items => (items.some(item=>item.id===DEFAULT_BACKGROUND.id)?items:[...items,DEFAULT_BACKGROUND]).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
export async function localSceneBlob(id: string): Promise<Blob> {
  if(id===DEFAULT_BACKGROUND.id){
    const response=await fetch(DEFAULT_BACKGROUND_URL);
    if(!response.ok)throw new Error('Default scene image could not be loaded.');
    return response.blob();
  }
  const item = await store<StoredScene | undefined>('readonly', transaction => transaction.objectStore('images').get(id));
  if (!item) throw new Error('This scene image is missing from this browser. Import it again.');
  return item.blob;
}
export const deleteLocalScene = async (id: string,shared=false,after?:()=>void) => {
  if(id===DEFAULT_BACKGROUND.id)return;
  if(shared){const image=await store<StoredScene|undefined>('readonly',tx=>tx.objectStore('images').get(id));if(!image)throw Error('Image no longer available.');imageTrash().remove(id,image.size,after);return;}

  await forgetNormalizedScene(await localSceneBlob(id));
  return await store('readwrite', transaction => {
  transaction.objectStore('metadata').delete(id);
  return transaction.objectStore('images').delete(id);
});
};

/** Inspect encoded dimensions before asking the browser/GPU to decode an image. */
export async function saveLocalScenes(incoming: readonly StoredScene[]): Promise<void> {
  if (!incoming.length) return;
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(['images', 'metadata'], 'readwrite');
      const request = transaction.objectStore('metadata').getAll();
      let full = false;
      request.onsuccess = () => {
        const items = (request.result as LocalScene[]).filter(item=>!imageTrash().has(item.id));
        const known = new Set([DEFAULT_BACKGROUND.id,...items.map(item => item.id)]), additions = incoming.filter(item => !known.has(item.id) && !!known.add(item.id));
        if (items.length + additions.length > MAX_IMAGES || [...items, ...additions].reduce((total, item) => total + item.size, 0) > MAX_LIBRARY_BYTES) { full = true; transaction.abort(); return; }
        for (const { blob, ...item } of additions) {
          transaction.objectStore('images').put({ ...item, blob });
          transaction.objectStore('metadata').put(item);
        }
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = transaction.onabort = () => reject(new Error(full ? 'Scene library is full (100 images / 100 MiB). Download and delete images you no longer need.' : 'Scene could not be saved. Browser storage may be full or unavailable.'));
    });
  } finally { db.close(); }
  imageTrash().restore(incoming.map(item=>item.id));
  restoreImageDeletions(incoming.map(item=>item.id));
}
export async function importLocalScene(file: File, input: ScenePromptSnapshot | null,normalization?:NormalizationPreferences): Promise<LocalScene> {
  const { blob, ...item } = await prepareLocalScene(file, input);
  await saveLocalScenes([{ ...item, blob }]);
  // Derived pixels are disposable; a failed correction never rolls back the saved original.
  if(normalization?.enabled)await normalizeSceneBlob(blob,normalization).catch(()=>{});
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
