import {imageSignatureMatches,isImageType,MAX_ASSET_BYTES} from './contracts.ts';
import type {StoredScene,LocalScene,ScenePromptSnapshot} from './library.ts';
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
export async function prepareLocalScene(file: File, input: ScenePromptSnapshot | null): Promise<StoredScene> {
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
  const item: LocalScene = { id: `sha256:${Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), n => n.toString(16).padStart(2, '0')).join('')}`, name: file.name.slice(0, 120) || 'Pasted scene', type, size: blob.size, width, height, createdAt: new Date().toISOString(), input };
  return { ...item, blob };
}
