import { createClient } from '@supabase/supabase-js';
import { ASSET_BUCKET, MAX_ASSET_BYTES, imageSignatureMatches, parseBackendRequest, resolveScenePrompt, type Asset, type ErrorCode } from '../_shared/contracts.ts';
import { generateSceneImage, SceneProviderFailure } from './scene-provider.ts';

class Failure extends Error {
  constructor(readonly code: ErrorCode, readonly status: number, message: string) { super(message); }
}
function databaseError(error: { code?: string; message: string } | null) {
  if (!error) return;
  const code = error.code;
  if (code === '42501') throw new Failure('forbidden', 403, 'This operation is not permitted.');
  if (code === '22023' || code === '23514' || code === '22P02') throw new Failure('invalid_input', 400, 'Invalid operation input.');
  if (code === '23505') throw new Failure('conflict', 409, 'The resource changed or this request identity was already used.');
  if (code === 'P0002') throw new Failure('not_found', 404, 'Resource unavailable.');
  if (error.message === 'quota_exceeded') throw new Failure('rate_limited', 429, 'Workspace resource limit reached.');
  throw new Failure('dependency_unavailable', 503, 'The database operation could not complete.');
}
async function readBody(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new Failure('invalid_input', 400, 'Expected a JSON operation.');
  const parts: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const result = await reader.read(); if (result.done) break;
      size += result.value.length;
      if (size > 16384) { await reader.cancel(); throw new Failure('invalid_input', 413, 'Operation exceeds 16 KiB.'); }
      parts.push(result.value);
    }
  } finally { reader.releaseLock(); }
  const all = new Uint8Array(size); let offset = 0;
  for (const part of parts) { all.set(part, offset); offset += part.length; }
  try { return JSON.parse(new TextDecoder().decode(all)); }
  catch { throw new Failure('invalid_input', 400, 'Expected valid JSON.'); }
}

Deno.serve(async request => {
  const requestId = crypto.randomUUID();
  const origin = request.headers.get('origin');
  const allowed = (Deno.env.get('OMNIA_ALLOWED_ORIGINS') ?? 'http://127.0.0.1:5173,http://localhost:5173')
    .split(',').map(value => value.trim()).filter(Boolean);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin', 'X-Request-Id': requestId,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
  if (origin && allowed.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
  const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
  try {
    if (origin && !allowed.includes(origin)) throw new Failure('forbidden', 403, 'Origin is not enabled.');
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return respond({ error: { code: 'invalid_input', message: 'Use POST.', requestId } }, 405);
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))
      throw new Failure('invalid_input', 415, 'Use application/json.');
    const authorization = request.headers.get('authorization') ?? '';
    if (!/^Bearer \S+$/i.test(authorization)) throw new Failure('unauthenticated', 401, 'Sign in to continue.');
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_ANON_KEY');
    if (!url || !key) throw new Failure('dependency_unavailable', 503, 'Backend configuration is unavailable.');
    const options = { auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authorization }, fetch: async (input: string | URL | Request, init?: RequestInit) => {
        const response = await fetch(input, { ...init, signal: AbortSignal.timeout(30000) });
        if (!response.ok) console.error(JSON.stringify({ requestId, backendStatus: response.status }));
        return response;
      } } };
    const user = createClient(url, key, options);
    // Validate with the Auth service; never trust a decoded token or request-supplied user ID.
    const identity = await user.auth.getUser(authorization.slice(7));
    if (identity.error) {
      console.error(JSON.stringify({ requestId, authStatus: identity.error.status, authErrorName: identity.error.name }));
      if (!identity.error.status || identity.error.status >= 500)
        throw new Failure('dependency_unavailable', 503, 'Authentication service is unavailable.');
      throw new Failure('unauthenticated', 401, 'Session is missing or expired.');
    }
    if (!identity.data.user) throw new Failure('unauthenticated', 401, 'Session is missing or expired.');
    let input;
    try { input = parseBackendRequest(await readBody(request)); }
    catch (error) { if (error instanceof Failure) throw error; throw new Failure('invalid_input', 400, 'Invalid operation input.'); }
    if (input.operation === 'workspace.create') {
      const result = await user.rpc('create_workspace', { p_name: input.name, p_request_id: input.requestId });
      databaseError(result.error);
      return respond({ data: result.data, requestId });
    }
    if (input.operation === 'scene.capabilities') {
      const membership = await user.from('workspace_members').select('role').eq('workspace_id', input.workspaceId).eq('user_id', identity.data.user.id).maybeSingle();
      databaseError(membership.error);
      if (!membership.data) throw new Failure('forbidden', 403, 'Workspace access is required.');
      return respond({ data: { enabled: ['owner', 'editor'].includes(membership.data.role) &&
        Deno.env.get('OMNIA_SCENE_GENERATION_ENABLED') === 'true' && !!Deno.env.get('OPENAI_API_KEY') && !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') }, requestId });
    }
    if (input.operation === 'scene.generate') {
      const membership = await user.from('workspace_members').select('role').eq('workspace_id', input.workspaceId).eq('user_id', identity.data.user.id).maybeSingle();
      databaseError(membership.error);
      if (!['owner', 'editor'].includes(membership.data?.role ?? '')) throw new Failure('forbidden', 403, 'Workspace editing access is required to generate scenes.');
      const providerKey = Deno.env.get('OPENAI_API_KEY');
      const elevatedKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (Deno.env.get('OMNIA_SCENE_GENERATION_ENABLED') !== 'true' || !providerKey || !elevatedKey)
        throw new Failure('dependency_unavailable', 503, 'Scene generation is not enabled on the server.');
      const service = createClient(url, elevatedKey, { ...options, global: { ...options.global, headers: {} } });
      const claim = await service.rpc('claim_scene_generation', { p_id: input.requestId, p_workspace: input.workspaceId,
        p_actor: identity.data.user.id, p_input: input });
      databaseError(claim.error);
      // Repeating this identity returns the existing attempt, never a second paid submission.
      if (!claim.data.claimed) return respond({ data: claim.data.generation, requestId });
      try {
        const prompt = resolveScenePrompt(input.prompt, input.variable, input.source, input.node);
        const bytes = await generateSceneImage(prompt, providerKey, Deno.env.get('OMNIA_SCENE_MODEL') ?? 'chatgpt-image-latest');
        // reserve_asset revalidates the user's current role before accepting output.
        const reserved = await user.rpc('reserve_asset', { p_id: input.requestId, p_workspace_id: input.workspaceId,
          p_name: `${input.node.label.slice(0, 160) || 'Scene'}.webp`, p_media_type: 'image/webp', p_byte_size: bytes.length });
        databaseError(reserved.error);
        const asset = reserved.data as Asset;
        const linked = await service.from('scene_generations').update({ asset_id: asset.id }).eq('id', input.requestId);
        databaseError(linked.error);
        const uploaded = await service.storage.from(ASSET_BUCKET).upload(asset.object_key, bytes, { contentType: 'image/webp', upsert: false });
        if (uploaded.error) throw new Failure('dependency_unavailable', 503, 'Generated image could not be stored.');
        const finalized = await service.rpc('complete_asset', { p_id: asset.id, p_actor: identity.data.user.id,
          p_byte_size: bytes.length, p_media_type: 'image/webp' });
        databaseError(finalized.error);
        const saved = await service.from('scene_generations').update({ state: 'ready', updated_at: new Date().toISOString() })
          .eq('id', input.requestId).select('*').single();
        databaseError(saved.error);
        return respond({ data: saved.data, requestId });
      } catch (error) {
        // A timeout/process disconnect can leave provider billing ambiguous. No automatic resubmission.
        const definiteFailure = error instanceof SceneProviderFailure && error.status < 500;
        const saved = await service.from('scene_generations').update({ state: definiteFailure ? 'failed' : 'uncertain', updated_at: new Date().toISOString() }).eq('id', input.requestId);
        databaseError(saved.error);
        throw new Failure('dependency_unavailable', 503, definiteFailure ? error.message : 'Generation did not finish safely. Check its saved status before starting another paid request.');
      }
    }
    // Membership is enforced by RLS before any service-credential operation.
    const selected = await user.from('assets').select('*').eq('id', input.assetId).maybeSingle();
    databaseError(selected.error);
    if (!selected.data) throw new Failure('not_found', 404, 'Resource unavailable.');
    const asset = selected.data as Asset;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!serviceKey) throw new Failure('dependency_unavailable', 503, 'Asset processing is unavailable.');
    const service = createClient(url, serviceKey, { ...options, global: { ...options.global, headers: {} } });
    if (input.operation === 'asset.delete') {
      const begun = await user.rpc('begin_asset_delete', { p_id: asset.id }); databaseError(begun.error);
      const removed = await service.storage.from(ASSET_BUCKET).remove([asset.object_key]);
      if (removed.error) throw new Failure('dependency_unavailable', 503, 'Deletion is pending. Retry this operation.');
      const completed = await service.rpc('complete_asset_delete', { p_id: asset.id }); databaseError(completed.error);
      return respond({ data: { id: asset.id, deleted: true }, requestId });
    }
    if (asset.created_by !== identity.data.user.id) throw new Failure('forbidden', 403, 'Only the uploader can finalize an asset.');
    if (asset.state === 'ready') return respond({ data: asset, requestId });
    if (asset.state !== 'pending') throw new Failure('conflict', 409, 'The asset is being deleted.');
    const download = await user.storage.from(ASSET_BUCKET).download(asset.object_key);
    if (download.error || !download.data) throw new Failure('conflict', 409, 'Upload the reserved file before finalizing.');
    const blob = download.data;
    if (blob.size !== asset.byte_size || blob.size > MAX_ASSET_BYTES || blob.type.split(';')[0] !== asset.media_type ||
      !imageSignatureMatches(new Uint8Array(await blob.arrayBuffer()), asset.media_type))
      throw new Failure('invalid_input', 400, 'File size, type, or image signature does not match the reservation.');
    const completed = await service.rpc('complete_asset', {
      p_id: asset.id, p_actor: identity.data.user.id, p_byte_size: blob.size, p_media_type: asset.media_type,
    });
    databaseError(completed.error);
    return respond({ data: completed.data, requestId });
  } catch (error) {
    const failure = error instanceof Failure ? error : new Failure('internal_error', 500, 'The operation could not complete.');
    // Deliberately omit bearer tokens, raw SDK errors, and request payloads.
    console.error(JSON.stringify({ requestId, code: failure.code, status: failure.status }));
    return respond({ error: { code: failure.code, message: failure.message, requestId } }, failure.status);
  }
});
