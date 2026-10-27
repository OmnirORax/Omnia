import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { parseBackendRequest, imageSignatureMatches, ASSET_BUCKET, resolveScenePrompt } from '../supabase/functions/_shared/contracts.ts';
import { generateSceneImage } from '../supabase/functions/backend/scene-provider.ts';
import { localBackendStatus } from '../scripts/backend-status.mjs';
import {createWorkspace} from '../src/omnic/workspace.ts';
import {emptyDocument} from '../src/graph/structural.ts';

test('backend operation contracts reject unsupported or ambiguous inputs', () => {
  assert.throws(() => parseBackendRequest({ operation: 'execute', sql: 'select 1' }));
  assert.throws(() => parseBackendRequest({ operation: 'workspace.create', name: '', requestId: randomUUID() }));
  assert.throws(() => parseBackendRequest({ operation: 'asset.delete', assetId: randomUUID(), userId: randomUUID() }));
  assert.throws(() => parseBackendRequest({ operation: 'asset.finalize', assetId: 'not-an-id' }));
  assert.equal(parseBackendRequest({ operation: 'workspace.create', name: ' Test ', requestId: randomUUID() }).name, 'Test');
  assert.equal(imageSignatureMatches(new TextEncoder().encode('<html>not a PNG</html>'), 'image/png'), false);
});

test('scene prompt binding substitutes literal node data and rejects unconnected or privileged inputs', () => {
  const node = { id: 'placement-1', label: 'Forest $& {{other}}', notes: 'Green canopy' };
  assert.equal(resolveScenePrompt('Paint {{subject}}', 'subject', 'label', node), 'Paint Forest $& {{other}}');
  assert.throws(() => resolveScenePrompt('Paint {{unknown}}', 'subject', 'label', node));
  assert.throws(() => resolveScenePrompt('No input', 'subject', 'label', node));
  const input = { operation: 'scene.generate', workspaceId: randomUUID(), requestId: randomUUID(),
    prompt: 'Paint {{subject}}', variable: 'subject', source: 'label', node };
  assert.deepEqual(parseBackendRequest(input), input);
  assert.throws(() => parseBackendRequest({ ...input, apiKey: 'not-allowed' }));
  assert.throws(() => parseBackendRequest({ ...input, node: { ...node, notes: 'x'.repeat(3001) } }));
});

test('image provider adapter makes one bounded submission and never accepts a remote download URL', async () => {
  let calls = 0;
  const webp = Buffer.from('RIFFtestWEBPtest');
  webp.writeUInt32LE(webp.length - 8, 4); // Signature fixture; this helper is not a codec decoder.
  const image = await generateSceneImage('Forest', 'test-key', 'chatgpt-image-latest', async (url, options) => {
    calls++;
    assert.equal(url, 'https://api.openai.com/v1/images/generations');
    assert.equal(options.redirect, 'error');
    assert.equal(JSON.parse(options.body).n, 1);
    return Response.json({ data: [{ b64_json: webp.toString('base64') }] });
  });
  assert.deepEqual(Buffer.from(image), webp); assert.equal(calls, 1);
  await assert.rejects(generateSceneImage('Forest', 'test-key', 'chatgpt-image-latest', async () => {
    calls++; return new Response('private provider detail', { status: 429 });
  }), /HTTP 429/);
  assert.equal(calls, 2, 'Rejected paid requests are never automatically retried.');
  await assert.rejects(generateSceneImage('Forest', 'test-key', 'chatgpt-image-latest', async () =>
    Response.json({ data: [{ url: 'https://untrusted.example/image' }] })), /invalid image/);
  await assert.rejects(generateSceneImage('Forest', 'test-key', 'chatgpt-image-latest', async () =>
    Response.json({ data: [{ b64_json: Buffer.from('<html>not an image</html>').toString('base64') }] })), /unsupported image/);
});

test('local backend enforces identity, workspace roles, file integrity, and object isolation', { timeout: 120000 }, async t => {
  // Never target a hosted project or echo the CLI credential output.
  const config = localBackendStatus();
  const url = config.API_URL;
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(url).hostname), 'Backend checks are local-only.');
  const publicKey = config.ANON_KEY ?? config.PUBLISHABLE_KEY;
  const service = createClient(url, config.SERVICE_ROLE_KEY ?? config.SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const users = [], workspaceIds = [], objects = [];
  const ok = result => { assert.ok(!result.error, result.error?.message); return result.data; };
  async function user() {
    const email = `backend-${randomUUID()}@omnia.local`, password = `Aa1!${randomUUID()}`;
    const created = ok(await service.auth.admin.createUser({ email, password, email_confirm: true }));
    users.push(created.user.id);
    const client = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const signed = ok(await client.auth.signInWithPassword({ email, password }));
    return { client, id: created.user.id, token: signed.session.access_token };
  }
  async function operation(actor, body, expected = 200, origin) {
    const headers = { 'Content-Type': 'application/json', apikey: publicKey };
    if (actor) headers.Authorization = `Bearer ${actor.token}`;
    if (origin) headers.Origin = origin;
    const response = await fetch(`${url}/functions/v1/backend`, { method: 'POST', headers, body: JSON.stringify(body) });
    const result = await response.json();
    assert.equal(response.status, expected, `Operation response: ${result.error?.code ?? 'success'} ${result.error?.message ?? ''}`);
    assert.ok(result.requestId || result.error?.requestId);
    return result;
  }
  try {
    const alice = await user(), bob = await user();
    const requestId = randomUUID();
    let workspace, asset;
    const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=', 'base64');
    await t.test('public signup remains disabled while invited accounts can sign in', async () => {
      const result = await alice.client.auth.signUp({ email: `blocked-${randomUUID()}@omnia.local`, password: `Aa1!${randomUUID()}` });
      assert.ok(result.error, 'Public signup must not create an account.');
    });
    await t.test('missing and invalid identities cannot invoke a server operation', async () => {
      assert.equal((await operation(null, { operation: 'workspace.create', name: 'Denied', requestId }, 401)).error.code, 'unauthenticated');
      assert.equal((await operation({ token: 'invalid' }, { operation: 'workspace.create', name: 'Denied', requestId }, 401)).error.code, 'unauthenticated');
    });
    await t.test('valid creation is atomic and repeated request identities are idempotent', async () => {
      workspace = (await operation(alice, { operation: 'workspace.create', name: 'Backend check', requestId })).data;
      workspaceIds.push(workspace.id);
      const repeated = (await operation(alice, { operation: 'workspace.create', name: 'Backend check', requestId })).data;
      assert.equal(workspace.id, repeated.id);
      const members = ok(await alice.client.from('workspace_members').select('*').eq('workspace_id', workspace.id));
      assert.equal(members.length, 1); assert.equal(members[0].role, 'owner'); assert.equal(members[0].user_id, alice.id);
      await operation(alice, { operation: 'workspace.create', name: 'Changed', requestId }, 409);
    });
    assert.ok(workspace, 'Workspace creation is required for the remaining permission checks.');
    await t.test('workspace snapshots enforce CAS, idempotent retry, roles, validation and revocation',async()=>{
      const snapshot=createWorkspace({...emptyDocument(),entities:[1,2,3].map(n=>({id:`text-${n}`,label:'Large notes',aliases:[],notes:'x'.repeat(9000)}))}),request={operation:'workspace.save',workspaceId:workspace.id,requestId:randomUUID(),expectedVersion:0,snapshot};
      assert.ok(JSON.stringify(snapshot).length>16384,'workspace requests exceed the old asset operation body limit');
      await operation(bob,request,403);
      const saved=(await operation(alice,request)).data;assert.equal(saved.version,1);
      assert.equal((await operation(alice,request)).data.version,1,'retry does not create another version');
      await operation(alice,{...request,snapshot:{...snapshot,name:'Changed retry'}},409);
      await operation(alice,{...request,requestId:randomUUID()},409);
      assert.deepEqual(ok(await bob.client.from('workspace_snapshots').select('*').eq('workspace_id',workspace.id)),[]);
      assert.ok((await alice.client.from('workspace_snapshots').update({version:10}).eq('workspace_id',workspace.id)).error);
      assert.ok((await alice.client.rpc('save_workspace_snapshot',{p_workspace:workspace.id,p_actor:alice.id,p_expected:1,p_request:randomUUID(),p_snapshot:snapshot})).error);
      await operation(alice,{...request,requestId:randomUUID(),expectedVersion:1,snapshot:{...snapshot,entities:[{id:'invalid'}]}},400);
      ok(await alice.client.rpc('set_workspace_member',{p_workspace_id:workspace.id,p_user_id:bob.id,p_role:'viewer'}));
      assert.equal(ok(await bob.client.from('workspace_snapshots').select('version').eq('workspace_id',workspace.id).single()).version,1);
      await operation(bob,{...request,requestId:randomUUID(),expectedVersion:1},403);
      ok(await alice.client.rpc('set_workspace_member',{p_workspace_id:workspace.id,p_user_id:bob.id,p_role:'editor'}));
      const updated=(await operation(bob,{...request,requestId:randomUUID(),expectedVersion:1,snapshot:{...snapshot,name:'Editor revision'}})).data;assert.equal(updated.version,2);
      const outcomes=await Promise.all([1,2].map(async n=>{
        const response=await fetch(`${url}/functions/v1/backend`,{method:'POST',headers:{'Content-Type':'application/json',apikey:publicKey,Authorization:`Bearer ${alice.token}`},body:JSON.stringify({...request,requestId:randomUUID(),expectedVersion:2,snapshot:{...snapshot,name:`Concurrent ${n}`}})});return response.status;
      }));assert.deepEqual(outcomes.sort(),[200,409]);
      ok(await alice.client.rpc('set_workspace_member',{p_workspace_id:workspace.id,p_user_id:bob.id,p_role:null}));
      assert.deepEqual(ok(await bob.client.from('workspace_snapshots').select('*').eq('workspace_id',workspace.id)),[]);
      await operation(bob,{...request,requestId:randomUUID(),expectedVersion:3},403);
    });
    await t.test('generation is gated, service-only claims are idempotent, and other workspaces cannot read attempts', async () => {
      const input = { operation: 'scene.generate', workspaceId: workspace.id, requestId: randomUUID(),
        prompt: 'Paint {{subject}}', variable: 'subject', source: 'label', node: { id: 'node-1', label: 'Forest', notes: '' } };
      await operation(bob, input, 403);
      await operation(bob, { operation: 'scene.capabilities', workspaceId: workspace.id }, 403);
      assert.equal((await operation(alice, { operation: 'scene.capabilities', workspaceId: workspace.id })).data.enabled, false);
      await operation(alice, input, 503); // CI has no provider key/enabling secret: no paid calls.
      const args = { p_id: input.requestId, p_workspace: workspace.id, p_actor: alice.id, p_input: input };
      assert.ok((await alice.client.rpc('claim_scene_generation', args)).error);
      const first = ok(await service.rpc('claim_scene_generation', args)); assert.equal(first.claimed, true);
      const repeated = ok(await service.rpc('claim_scene_generation', args)); assert.equal(repeated.claimed, false);
      assert.ok((await service.rpc('claim_scene_generation', { ...args, p_input: { ...input, prompt: 'Different {{subject}}' } })).error);
      assert.deepEqual(ok(await bob.client.from('scene_generations').select('*').eq('id', input.requestId)), []);
      assert.ok((await alice.client.from('scene_generations').update({ state: 'ready' }).eq('id', input.requestId)).error);
      ok(await alice.client.rpc('set_workspace_member', { p_workspace_id: workspace.id, p_user_id: bob.id, p_role: 'viewer' }));
      await operation(bob, input, 403);
      assert.ok((await service.rpc('claim_scene_generation', { ...args, p_id: randomUUID(), p_actor: bob.id })).error);
      ok(await alice.client.rpc('set_workspace_member', { p_workspace_id: workspace.id, p_user_id: bob.id, p_role: null }));
      const second = await service.rpc('claim_scene_generation', { ...args, p_id: randomUUID() });
      assert.ok(second.error, 'Only one running attempt per workspace may be submitted.');
      ok(await service.from('scene_generations').update({ state: 'failed' }).eq('id', input.requestId));
      for (let count = 1; count < 5; count++) {
        const id = randomUUID();
        assert.equal(ok(await service.rpc('claim_scene_generation', { ...args, p_id: id, p_input: { ...input, requestId: id } })).claimed, true);
        ok(await service.from('scene_generations').update({ state: 'failed' }).eq('id', id));
      }
      assert.ok((await service.rpc('claim_scene_generation', { ...args, p_id: randomUUID() })).error,
        'The per-actor daily submission limit is enforced before calling the provider.');
    });
    await t.test('unsupported inputs and untrusted browser origins are rejected', async () => {
      await operation(alice, { operation: 'anything' }, 400);
      await operation(alice, { operation: 'workspace.create', name: 'Other', requestId: randomUUID() }, 403, 'https://untrusted.example');
      const preflight = await fetch(`${url}/functions/v1/backend`, { method: 'OPTIONS', headers: {
        Origin: 'http://127.0.0.1:5173', 'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization,apikey,content-type',
      } });
      // The Supabase gateway may answer OPTIONS before the function does. Both
      // 200 and 204 are valid; verify usable browser headers rather than a specific layer.
      assert.ok([200, 204].includes(preflight.status));
      assert.ok(['*', 'http://127.0.0.1:5173'].includes(preflight.headers.get('access-control-allow-origin')));
      assert.ok(preflight.headers.get('access-control-allow-methods')?.includes('POST'));
      const allowedHeaders = preflight.headers.get('access-control-allow-headers')?.toLowerCase() ?? '';
      for (const header of ['authorization', 'apikey', 'content-type']) assert.ok(allowedHeaders.includes(header));
    });
    await t.test('a nonmember cannot see a workspace or add themselves', async () => {
      assert.deepEqual(ok(await bob.client.from('workspaces').select('*').eq('id', workspace.id)), []);
      assert.deepEqual(ok(await bob.client.from('workspace_members').select('*').eq('workspace_id', workspace.id)), []);
      assert.ok((await bob.client.from('workspace_members').insert({ workspace_id: workspace.id, user_id: bob.id, role: 'owner' })).error);
      assert.ok((await bob.client.rpc('set_workspace_member', { p_workspace_id: workspace.id, p_user_id: bob.id, p_role: 'editor' })).error);
    });
    await t.test('owner cannot remove themselves or create another owner through membership operations', async () => {
      assert.ok((await alice.client.rpc('set_workspace_member', { p_workspace_id: workspace.id, p_user_id: alice.id, p_role: null })).error);
      assert.ok((await alice.client.rpc('set_workspace_member', { p_workspace_id: workspace.id, p_user_id: bob.id, p_role: 'owner' })).error);
    });
    await t.test('asset reservation requires write access and enforces type and size limits', async () => {
      const reservation = { p_id: randomUUID(), p_workspace_id: workspace.id, p_name: 'pixel.png', p_media_type: 'image/png', p_byte_size: bytes.length };
      assert.ok((await bob.client.rpc('reserve_asset', reservation)).error);
      assert.ok((await alice.client.rpc('reserve_asset', { ...reservation, p_media_type: 'text/html' })).error);
      assert.ok((await alice.client.rpc('reserve_asset', { ...reservation, p_byte_size: 10485761 })).error);
      asset = ok(await alice.client.rpc('reserve_asset', reservation));
      assert.equal(asset.state, 'pending'); objects.push(asset.object_key);
      assert.equal(ok(await alice.client.rpc('reserve_asset', reservation)).id, asset.id);
    });
    assert.ok(asset, 'Asset reservation is required for the remaining storage checks.');
    await t.test('underdeclared object sizes cannot bypass workspace reservations', async () => {
      const pending = ok(await alice.client.rpc('reserve_asset', { p_id: randomUUID(), p_workspace_id: workspace.id,
        p_name: 'underdeclared.png', p_media_type: 'image/png', p_byte_size: 1 })); objects.push(pending.object_key);
      assert.ok((await alice.client.storage.from(ASSET_BUCKET).upload(pending.object_key, bytes, { contentType: 'image/png' })).error);
      await operation(alice, { operation: 'asset.delete', assetId: pending.id });
    });
    await t.test('unreserved paths and foreign uploads are denied; the owner can upload their reservation', async () => {
      assert.ok((await alice.client.storage.from(ASSET_BUCKET).upload(`${workspace.id}/${randomUUID()}`, bytes, { contentType: 'image/png' })).error);
      assert.ok((await bob.client.storage.from(ASSET_BUCKET).upload(asset.object_key, bytes, { contentType: 'image/png' })).error);
      // Blob upload exercises the browser SDK's multipart route without a browser suite.
      ok(await alice.client.storage.from(ASSET_BUCKET).upload(asset.object_key, new Blob([bytes], { type: 'image/png' }), { contentType: 'image/png' }));
    });
    await t.test('a client cannot mark files ready directly; the server verifies the uploaded image', async () => {
      assert.ok((await alice.client.rpc('complete_asset', { p_id: asset.id, p_actor: alice.id, p_byte_size: bytes.length, p_media_type: 'image/png' })).error);
      assert.ok((await alice.client.from('assets').update({ state: 'ready' }).eq('id', asset.id)).error);
      const finalized = (await operation(alice, { operation: 'asset.finalize', assetId: asset.id })).data;
      assert.equal(finalized.state, 'ready');
      assert.equal((await operation(alice, { operation: 'asset.finalize', assetId: asset.id })).data.id, asset.id);
    });
    await t.test('ready objects are immutable and cannot be accessed or signed by nonmembers', async () => {
      assert.deepEqual(ok(await bob.client.from('assets').select('*').eq('id', asset.id)), []);
      assert.ok((await bob.client.storage.from(ASSET_BUCKET).download(asset.object_key)).error);
      assert.ok((await bob.client.storage.from(ASSET_BUCKET).createSignedUrl(asset.object_key, 60)).error);
      assert.ok((await alice.client.storage.from(ASSET_BUCKET).upload(asset.object_key, bytes, { contentType: 'image/png', upsert: true })).error);
      await operation(bob, { operation: 'asset.delete', assetId: asset.id }, 404);
      const downloaded = ok(await alice.client.storage.from(ASSET_BUCKET).download(asset.object_key));
      assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), bytes);
    });
    await t.test('viewer can read shared files but cannot upload, delete, or escalate their role', async () => {
      ok(await alice.client.rpc('set_workspace_member', { p_workspace_id: workspace.id, p_user_id: bob.id, p_role: 'viewer' }));
      assert.equal(ok(await bob.client.from('assets').select('*').eq('id', asset.id)).length, 1);
      ok(await bob.client.storage.from(ASSET_BUCKET).download(asset.object_key));
      assert.ok((await bob.client.rpc('reserve_asset', { p_id: randomUUID(), p_workspace_id: workspace.id, p_name: 'No', p_media_type: 'image/png', p_byte_size: bytes.length })).error);
      await operation(bob, { operation: 'asset.delete', assetId: asset.id }, 403);
      assert.ok((await bob.client.rpc('set_workspace_member', { p_workspace_id: workspace.id, p_user_id: bob.id, p_role: 'editor' })).error);
    });
    await t.test('editor can manage files but cannot finalize another uploader or manage membership', async () => {
      ok(await alice.client.rpc('set_workspace_member', { p_workspace_id: workspace.id, p_user_id: bob.id, p_role: 'editor' }));
      const own = ok(await bob.client.rpc('reserve_asset', { p_id: randomUUID(), p_workspace_id: workspace.id,
        p_name: 'editor.png', p_media_type: 'image/png', p_byte_size: bytes.length })); objects.push(own.object_key);
      ok(await bob.client.storage.from(ASSET_BUCKET).upload(own.object_key, bytes, { contentType: 'image/png' }));
      assert.ok((await alice.client.storage.from(ASSET_BUCKET).download(own.object_key)).error, 'Pending bytes remain uploader-only.');
      assert.equal((await operation(bob, { operation: 'asset.finalize', assetId: own.id })).data.state, 'ready');
      await operation(bob, { operation: 'asset.finalize', assetId: asset.id }, 403);
      assert.ok((await bob.client.rpc('set_workspace_member', { p_workspace_id: workspace.id, p_user_id: alice.id, p_role: null })).error);
      await operation(bob, { operation: 'asset.delete', assetId: own.id });
    });
    await t.test('membership revocation takes effect without waiting for a new token', async () => {
      ok(await alice.client.rpc('set_workspace_member', { p_workspace_id: workspace.id, p_user_id: bob.id, p_role: null }));
      assert.deepEqual(ok(await bob.client.from('workspaces').select('*').eq('id', workspace.id)), []);
      assert.ok((await bob.client.storage.from(ASSET_BUCKET).download(asset.object_key)).error);
    });
    await t.test('incorrect image bytes cannot become ready even with an allowed upload MIME header', async () => {
      const bad = Buffer.from('this is not a real image');
      const pending = ok(await alice.client.rpc('reserve_asset', { p_id: randomUUID(), p_workspace_id: workspace.id,
        p_name: 'bad.png', p_media_type: 'image/png', p_byte_size: bad.length })); objects.push(pending.object_key);
      ok(await alice.client.storage.from(ASSET_BUCKET).upload(pending.object_key, bad, { contentType: 'image/png' }));
      await operation(alice, { operation: 'asset.finalize', assetId: pending.id }, 400);
      assert.equal(ok(await alice.client.from('assets').select('state').eq('id', pending.id).single()).state, 'pending');
      await operation(alice, { operation: 'asset.delete', assetId: pending.id });
    });
    await t.test('deletion removes the object and record; repeated deletion cannot leak it', async () => {
      await operation(alice, { operation: 'asset.delete', assetId: asset.id });
      assert.deepEqual(ok(await alice.client.from('assets').select('*').eq('id', asset.id)), []);
      assert.ok((await alice.client.storage.from(ASSET_BUCKET).download(asset.object_key)).error);
      await operation(alice, { operation: 'asset.delete', assetId: asset.id }, 404);
    });
  } finally {
    if (objects.length) ok(await service.storage.from(ASSET_BUCKET).remove(objects));
    for (const id of workspaceIds) {
      ok(await service.from('scene_generations').delete().eq('workspace_id', id));
      ok(await service.from('assets').delete().eq('workspace_id', id));
      ok(await service.from('workspace_members').delete().eq('workspace_id', id));
      ok(await service.from('workspaces').delete().eq('id', id));
    }
    for (const id of users) ok(await service.auth.admin.deleteUser(id));
  }
});
