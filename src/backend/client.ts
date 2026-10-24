import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ASSET_BUCKET, MAX_ASSET_BYTES, isImageType, type Asset, type BackendRequest, type Workspace, type SceneGenerateInput, type SceneGeneration } from '../../supabase/functions/_shared/contracts.ts';
export type { Asset, Workspace, WorkspaceMember } from '../../supabase/functions/_shared/contracts.ts';

type Configuration = { kind: 'local' } | { kind: 'invalid'; message: string } | { kind: 'cloud'; client: SupabaseClient };
let configuration: Configuration | undefined;
export function backendConfiguration(): Configuration {
  if (configuration) return configuration;
  const url = String(import.meta.env.VITE_SUPABASE_URL ?? '').trim();
  const key = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim();
  if (!url && !key) return configuration = { kind: 'local' };
  try {
    if (!url || !key || key.startsWith('sb_secret_')) throw new Error();
    const parsed = new URL(url);
    if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/' ||
      parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname))) throw new Error();
    if (!key.startsWith('sb_publishable_')) {
      const payload = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (payload.role !== 'anon') throw new Error();
    }
    return configuration = { kind: 'cloud', client: createClient(url, key, {
      auth: { storageKey: `omnia.backend.auth.${parsed.host}`, detectSessionInUrl: false },
    }) };
  } catch {
    return configuration = { kind: 'invalid', message: 'Cloud configuration is incomplete or invalid. Configure a project URL and public publishable key.' };
  }
}

async function operation<T>(client: SupabaseClient, body: BackendRequest): Promise<T> {
  const { data, error } = await client.functions.invoke('backend', { body });
  if (error) {
    if (error.context instanceof Response) {
      const response = await error.context.json().catch(() => null);
      if (response?.error?.message) throw new Error(`${response.error.message} (request ${response.error.requestId})`);
    }
    throw new Error('Cloud operation failed. Check the connection and sign-in state.');
  }
  if (!data || data.error || !('data' in data)) throw new Error('Cloud operation returned an invalid response.');
  return data.data as T;
}
export const cloud = {
  sceneCapabilities: (client: SupabaseClient, workspaceId: string) => operation<{ enabled: boolean }>(client, { operation: 'scene.capabilities', workspaceId }),
  generateScene: (client: SupabaseClient, input: SceneGenerateInput) => operation<SceneGeneration>(client, input),
  async sceneGenerations(client: SupabaseClient, workspace: string): Promise<SceneGeneration[]> {
    const result = await client.from('scene_generations').select('*').eq('workspace_id', workspace).order('created_at', { ascending: false }).limit(20);
    if (result.error) throw new Error('Scene history is unavailable. The scene backend migration may not be installed.');
    return result.data;
  },
  async workspaces(client: SupabaseClient): Promise<Workspace[]> {
    const result = await client.from('workspaces').select('*').order('created_at').limit(200);
    if (result.error) throw new Error('Workspaces could not be loaded.');
    return result.data;
  },
  createWorkspace: (client: SupabaseClient, name: string, requestId: string) => operation<Workspace>(client, { operation: 'workspace.create', name, requestId }),
  async assets(client: SupabaseClient, workspace: string): Promise<Asset[]> {
    const result = await client.from('assets').select('*').eq('workspace_id', workspace).order('created_at', { ascending: false }).limit(200);
    if (result.error) throw new Error('Files could not be loaded.');
    return result.data;
  },
  async upload(client: SupabaseClient, workspace: string, file: File, id: string): Promise<Asset> {
    if (!isImageType(file.type) || !file.size || file.size > MAX_ASSET_BYTES) throw new Error('Choose a PNG, JPEG, or WebP image up to 10 MiB.');
    const reserved = await client.rpc('reserve_asset', { p_id: id, p_workspace_id: workspace,
      p_name: file.name, p_media_type: file.type, p_byte_size: file.size });
    if (reserved.error) throw new Error('Upload could not be reserved. Check workspace permissions and limits.');
    const asset = reserved.data as Asset;
    const uploaded = await client.storage.from(ASSET_BUCKET).upload(asset.object_key, file, { contentType: file.type, upsert: false });
    if (uploaded.error) throw new Error('Upload did not complete. Refresh files; the pending reservation can be deleted.');
    return operation<Asset>(client, { operation: 'asset.finalize', assetId: asset.id });
  },
  finalize: (client: SupabaseClient, assetId: string) => operation<Asset>(client, { operation: 'asset.finalize', assetId }),
  remove: (client: SupabaseClient, assetId: string) => operation<{ id: string; deleted: true }>(client, { operation: 'asset.delete', assetId }),
  async download(client: SupabaseClient, asset: Asset): Promise<Blob> {
    const result = await client.storage.from(ASSET_BUCKET).download(asset.object_key);
    if (result.error || !result.data) throw new Error('The file could not be downloaded.');
    return result.data;
  },
};
