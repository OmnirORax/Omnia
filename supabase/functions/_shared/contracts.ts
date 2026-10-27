/** Portable wire contracts. No SDK, environment variables, browser or Deno APIs. */
export const ASSET_BUCKET = 'workspace-assets';
export const MAX_ASSET_BYTES = 10 * 1024 * 1024;
export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export type ImageType = typeof IMAGE_TYPES[number];
export type Workspace = { id: string; name: string; created_by: string; creation_request_id: string; created_at: string };
export type WorkspaceMember = { workspace_id: string; user_id: string; role: 'owner' | 'editor' | 'viewer'; created_at: string };
export type Asset = {
  id: string; workspace_id: string; created_by: string; name: string; media_type: ImageType;
  byte_size: number; object_key: string; state: 'pending' | 'ready' | 'deleting'; created_at: string;
};
export type BackendRequest =
  | WorkspaceSaveInput
  | { operation: 'workspace.create'; name: string; requestId: string }
  | { operation: 'scene.capabilities'; workspaceId: string }
  | SceneGenerateInput
  | { operation: 'asset.finalize' | 'asset.delete'; assetId: string };
export type WorkspaceSaveInput={operation:'workspace.save';workspaceId:string;expectedVersion:number;requestId:string;snapshot:unknown};
export type WorkspaceSnapshot={workspace_id:string;version:number;snapshot:unknown;request_id:string;updated_by:string;updated_at:string};
export const SCENE_SOURCES = ['label', 'notes', 'label-and-notes'] as const;
export type SceneSource = typeof SCENE_SOURCES[number];
export type SceneNode = { id: string; label: string; notes: string };
export type SceneGenerateInput = { operation: 'scene.generate'; workspaceId: string; requestId: string;
  prompt: string; variable: string; source: SceneSource; node: SceneNode };
export type SceneGeneration = { id: string; workspace_id: string; created_by: string;
  state: 'running' | 'ready' | 'failed' | 'uncertain'; asset_id: string | null;
  input: SceneGenerateInput; created_at: string; updated_at: string };
export const DEFAULT_SCENE_PROMPT = 'Create a detailed landscape scene inspired by {{subject}}. Atmospheric, coherent lighting, suitable as a workspace wallpaper. No labels or interface elements.';
/** Literal, single-pass substitution. Node content is data, never executable template code. */
export function resolveScenePrompt(prompt: string, variable: string, source: SceneSource, node: SceneNode): string {
  if (!/^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(variable) || !SCENE_SOURCES.includes(source) ||
      !prompt.trim() || prompt.length > 4000 || !node.id || node.id.length > 200 ||
      node.label.length > 500) throw new Error('Invalid prompt, variable name or node label.');
  if (source !== 'label' && node.notes.length > 3000) throw new Error('Node notes exceed 3,000 characters. Choose Label or shorten the notes.');
  const value = source === 'label' ? node.label : source === 'notes' ? node.notes : [node.label, node.notes].filter(Boolean).join('\n');
  if (!value.trim()) throw new Error('The active node has no text for this input.');
  let found = false;
  const result = prompt.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_match, name: string) => {
    if (name !== variable) throw new Error(`Unconnected prompt variable: ${name}`);
    found = true; return value;
  });
  if (!found) throw new Error(`Add {{${variable}}} to the prompt.`);
  if (result.length > 12000) throw new Error('Resolved prompt is too long.');
  return result;
}
export type ErrorCode = 'unauthenticated' | 'forbidden' | 'invalid_input' | 'not_found' | 'conflict'
  | 'rate_limited' | 'dependency_unavailable' | 'internal_error';
export type BackendError = { error: { code: ErrorCode; message: string; requestId: string } };
export const isUuid = (value: unknown): value is string => typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export const isImageType = (value: string): value is ImageType => (IMAGE_TYPES as readonly string[]).includes(value);
export function parseBackendRequest(value: unknown): BackendRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_input');
  const input = value as Record<string, unknown>;
  if(input.operation==='workspace.save'&&isUuid(input.workspaceId)&&isUuid(input.requestId)&&Number.isSafeInteger(input.expectedVersion)&&Number(input.expectedVersion)>=0&&
    input.snapshot&&typeof input.snapshot==='object'&&!Array.isArray(input.snapshot)&&Object.keys(input).every(key=>['operation','workspaceId','expectedVersion','requestId','snapshot'].includes(key)))
    return {operation:input.operation,workspaceId:input.workspaceId,requestId:input.requestId,expectedVersion:Number(input.expectedVersion),snapshot:input.snapshot};
  if (input.operation === 'scene.capabilities' && isUuid(input.workspaceId) &&
      Object.keys(input).every(key => ['operation', 'workspaceId'].includes(key)))
    return { operation: input.operation, workspaceId: input.workspaceId };
  if (input.operation === 'scene.generate' && isUuid(input.workspaceId) && isUuid(input.requestId) &&
      typeof input.prompt === 'string' && typeof input.variable === 'string' &&
      typeof input.source === 'string' && SCENE_SOURCES.includes(input.source as SceneSource) &&
      input.node && typeof input.node === 'object' && !Array.isArray(input.node) &&
      Object.keys(input).every(key => ['operation', 'workspaceId', 'requestId', 'prompt', 'variable', 'source', 'node'].includes(key))) {
    const node = input.node as Record<string, unknown>;
    if (typeof node.id === 'string' && typeof node.label === 'string' && typeof node.notes === 'string' && node.notes.length <= 3000 &&
        Object.keys(node).every(key => ['id', 'label', 'notes'].includes(key))) {
      const result = input as SceneGenerateInput;
      resolveScenePrompt(result.prompt, result.variable, result.source, result.node);
      return result;
    }
  }
  if (input.operation === 'workspace.create' && typeof input.name === 'string' &&
    input.name.trim().length > 0 && input.name.trim().length <= 100 && isUuid(input.requestId) &&
    Object.keys(input).every(key => ['operation', 'name', 'requestId'].includes(key)))
    return { operation: input.operation, name: input.name.trim(), requestId: input.requestId };
  if ((input.operation === 'asset.finalize' || input.operation === 'asset.delete') && isUuid(input.assetId) &&
    Object.keys(input).every(key => ['operation', 'assetId'].includes(key)))
    return { operation: input.operation, assetId: input.assetId };
  throw new Error('invalid_input');
}
/** Signature checks, not a full codec decoder. Never accept executable SVG/HTML here. */
export function imageSignatureMatches(bytes: Uint8Array, type: ImageType): boolean {
  if (bytes.length < 12 || bytes.length > MAX_ASSET_BYTES) return false;
  if (type === 'image/png') return [137,80,78,71,13,10,26,10].every((value, i) => bytes[i] === value);
  if (type === 'image/jpeg') return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 &&
    bytes[bytes.length - 2] === 255 && bytes[bytes.length - 1] === 217;
  return new TextDecoder().decode(bytes.subarray(0, 4)) === 'RIFF' &&
    new TextDecoder().decode(bytes.subarray(8, 12)) === 'WEBP' &&
    new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(4, true) + 8 === bytes.length;
}
