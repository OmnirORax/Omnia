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
  | { operation: 'workspace.create'; name: string; requestId: string }
  | { operation: 'asset.finalize' | 'asset.delete'; assetId: string };
export type ErrorCode = 'unauthenticated' | 'forbidden' | 'invalid_input' | 'not_found' | 'conflict'
  | 'rate_limited' | 'dependency_unavailable' | 'internal_error';
export type BackendError = { error: { code: ErrorCode; message: string; requestId: string } };
export const isUuid = (value: unknown): value is string => typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export const isImageType = (value: string): value is ImageType => (IMAGE_TYPES as readonly string[]).includes(value);
export function parseBackendRequest(value: unknown): BackendRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_input');
  const input = value as Record<string, unknown>;
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
