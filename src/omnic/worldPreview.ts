import { createTransientStore, type TransientStore } from '../ui/transientStore';
import type { XYZ } from '../graph/structural';
import type { Recipe } from './model';

/** Session-owned renderer projection. Never enters the workspace or its history. */
export type OmnicWorldPreview = {
  owner: string;
  entityId: string;
  recipe: Recipe;
  temporary?: { placementId: string; parentId: string | null; position: XYZ };
};
export type OmnicPreviewStore = TransientStore<OmnicWorldPreview | null>;
export const createOmnicPreviewStore = () => createTransientStore<OmnicWorldPreview | null>(null);

const pendingDrafts = new Map<string, string>();
const pendingKey = (workspaceId: string, atlasId: string) => `omnium.omnic.unsaved.v1:${workspaceId}:${atlasId}`;
/** One recoverable unsaved draft per atlas, with its own history identity.
 * Completing it releases the slot; a later new composition gets a fresh owner. */
export function unsavedOmnicId(workspaceId: string, atlasId: string): string {
  const key = pendingKey(workspaceId, atlasId), cached = pendingDrafts.get(key);
  if (cached) return cached;
  let id: string | null = null;
  try { id = localStorage.getItem(key); } catch { /* Session recovery still works. */ }
  if (!id || !/^omnic-draft:[a-zA-Z0-9-]{1,80}$/.test(id)) id = `omnic-draft:${crypto.randomUUID()}`;
  pendingDrafts.set(key, id);
  try { localStorage.setItem(key, id); } catch { /* Draft storage reports actual recipe failures. */ }
  return id;
}
export function completeOmnicDraft(workspaceId: string, atlasId: string, id: string) {
  const key = pendingKey(workspaceId, atlasId);
  if (pendingDrafts.get(key) !== id) return;
  pendingDrafts.delete(key);
  try { localStorage.removeItem(key); } catch { /* No canonical write depends on this hint. */ }
}

/** A construction seed, with no concept interpretation or prebuilt operator. */
export const newOmnicDraft = (): Recipe => ({ version: 2, revision: 0,
  components: [{ id: 'unit', generator: 'dot', params: { size: 10 } }], operations: [], frames: [] });
