import {accountRequest} from './request.ts';
import type {SupabaseClient} from '@supabase/supabase-js';
import {ASSET_BUCKET,MAX_ASSET_BYTES,isImageType,type Asset,type BackendRequest,type Workspace,type SceneGenerateInput,type SceneGeneration} from '../composer/supabase/functions/_shared/contracts.ts';
export type {Asset,Workspace,WorkspaceMember} from '../composer/supabase/functions/_shared/contracts.ts';
const operation=<T>(client:SupabaseClient,body:BackendRequest,current?:()=>boolean)=>accountRequest<T>(client,'account-cloud',body,current);
export const cloud = {
  async setMember(client:SupabaseClient,workspace:string,account:string,role:'viewer'|'editor'|null){const {error}=await client.rpc('set_workspace_member',{p_workspace_id:workspace,p_user_id:account,p_role:role});if(error)throw Error('Member access could not be changed.');},
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
  async assets(client: SupabaseClient, workspace: string,ids?:readonly string[]): Promise<Asset[]> {
    let query=client.from('assets').select('*').eq('workspace_id',workspace).order('created_at',{ascending:false}).limit(200);if(ids)query=query.in('id',[...ids]);const result=await query;
    if (result.error) throw new Error('Files could not be loaded.');
    return result.data;
  },
  async upload(client: SupabaseClient, workspace: string, file: File, id: string,current:()=>boolean=()=>true): Promise<Asset> {
    if (!isImageType(file.type) || !file.size || file.size > MAX_ASSET_BYTES) throw new Error('Choose a PNG, JPEG, or WebP image up to 10 MiB.');
    if(!current())throw Error('Account changed.');
    const reserved = await client.rpc('reserve_asset', { p_id: id, p_workspace_id: workspace,
      p_name: file.name, p_media_type: file.type, p_byte_size: file.size });
    if (reserved.error) throw new Error('Upload could not be reserved. Check workspace permissions and limits.');
    if(!current())throw Error('Account changed.');const asset = reserved.data as Asset;
    const uploaded = await client.storage.from(ASSET_BUCKET).upload(asset.object_key, file, { contentType: file.type, upsert: false });
    if (uploaded.error) throw new Error('Upload did not complete. Refresh files; the pending reservation can be deleted.');
    if(!current())throw Error('Account changed.');return operation<Asset>(client, { operation: 'asset.finalize', assetId: asset.id },current);
  },
  finalize: (client: SupabaseClient, assetId: string) => operation<Asset>(client, { operation: 'asset.finalize', assetId }),
  remove: (client: SupabaseClient, assetId: string) => operation<{ id: string; deleted: true }>(client, { operation: 'asset.delete', assetId }),
  async download(client: SupabaseClient, asset: Asset): Promise<Blob> {
    const result = await client.storage.from(ASSET_BUCKET).download(asset.object_key);
    if (result.error || !result.data) throw new Error('The file could not be downloaded.');
    return result.data;
  },
};
