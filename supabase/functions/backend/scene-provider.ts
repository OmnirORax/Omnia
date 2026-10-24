import { MAX_ASSET_BYTES, imageSignatureMatches } from '../_shared/contracts.ts';
export class SceneProviderFailure extends Error {
  readonly status: number;
  constructor(status: number) { super(`Image provider rejected the request (HTTP ${status}). Check server API access and billing.`); this.status = status; }
}

/** One bounded provider submission. Never automatically retry a paid request. */
export async function generateSceneImage(prompt: string, key: string, model: string, providerFetch: typeof fetch = fetch) {
  const response = await providerFetch('https://api.openai.com/v1/images/generations', {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, n: 1, size: '1536x1024', quality: 'low', output_format: 'webp' }),
    signal: AbortSignal.timeout(90000), redirect: 'error',
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new SceneProviderFailure(response.status);
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Image provider returned no image.');
  const parts: Uint8Array[] = []; let total = 0;
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      total += part.value.length;
      if (total > MAX_ASSET_BYTES * 1.4 + 65536) { await reader.cancel(); throw new Error('Provider image exceeds the storage limit.'); }
      parts.push(part.value);
    }
  } finally { reader.releaseLock(); }
  const json = new Uint8Array(total); let offset = 0;
  for (const part of parts) { json.set(part, offset); offset += part.length; }
  const result = JSON.parse(new TextDecoder().decode(json));
  const encoded = result.data?.length === 1 ? result.data[0]?.b64_json : undefined;
  if (typeof encoded !== 'string' || encoded.length > Math.ceil(MAX_ASSET_BYTES / 3) * 4)
    throw new Error('Image provider returned an invalid image.');
  const bytes = Uint8Array.from(atob(encoded), char => char.charCodeAt(0));
  if (!imageSignatureMatches(bytes, 'image/webp')) throw new Error('Image provider returned an unsupported image.');
  return bytes;
}
