export type SceneSource = "label" | "notes" | "label-and-notes";
export type SceneNode = {id:string;label:string;notes:string};
export const MAX_ASSET_BYTES=10*1024*1024;
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

export const SCENE_SOURCES: readonly SceneSource[] = ['label','notes','label-and-notes'];
export const IMAGE_TYPES = ['image/png','image/jpeg','image/webp'] as const;
export type ImageType = typeof IMAGE_TYPES[number];
export const isImageType = (value:string):value is ImageType => (IMAGE_TYPES as readonly string[]).includes(value);
export function imageSignatureMatches(bytes: Uint8Array, type: ImageType): boolean {
  if (bytes.length < 12 || bytes.length > MAX_ASSET_BYTES) return false;
  if (type === 'image/png') return [137,80,78,71,13,10,26,10].every((value, i) => bytes[i] === value);
  if (type === 'image/jpeg') return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 &&
    bytes[bytes.length - 2] === 255 && bytes[bytes.length - 1] === 217;
  return new TextDecoder().decode(bytes.subarray(0, 4)) === 'RIFF' &&
    new TextDecoder().decode(bytes.subarray(8, 12)) === 'WEBP' &&
    new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(4, true) + 8 === bytes.length;
}
