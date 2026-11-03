/** Portable mixed document. English and glyph references are independent siblings. */
export type TextPart = string | { glyph: string };
export type NodeText = { version: 1; content: TextPart[] };
export const TEXT_LIMIT = 200_000;
export const GLYPH_LIMIT = 4_000;
export function normalizeText(parts: readonly TextPart[]): NodeText {
  const content: TextPart[] = [];
  for (const part of parts) {
    if (typeof part !== 'string') content.push({ glyph: part.glyph });
    else if (part) {
      const previous = content[content.length - 1];
      if (typeof previous === 'string') content[content.length - 1] = previous + part;
      else content.push(part);
    }
  }
  return { version: 1, content };
}
export function validateNodeText(input: unknown, objects: ReadonlySet<string>): asserts input is NodeText {
  const value = input as NodeText | null;
  if (!value || value.version !== 1 || !Array.isArray(value.content) || value.content.length > TEXT_LIMIT)
    throw Error('Invalid node document.');
  let characters = 0, glyphs = 0;
  for (const part of value.content) {
    if (typeof part === 'string') characters += part.length;
    else if (!part || typeof part !== 'object' || Object.keys(part).length !== 1 || typeof part.glyph !== 'string' || !objects.has(part.glyph))
      throw Error('Node document references a missing Omnic object.');
    else glyphs++;
  }
  if (characters > TEXT_LIMIT || glyphs > GLYPH_LIMIT)
    throw Error('Node document limit: 200,000 text characters and 4,000 glyphs. Split this text across nodes.');
}

type LexiconObject = { id: string; omnic?: unknown; lexiconWords?: string[] };
type Trie = { children: Map<string, Trie>; glyph?: string | null };
const key = (word: string) => word.normalize('NFC').toLocaleLowerCase('en');
/** A prepared trie gives longest exact word/phrase matches, without regex-per-entry scans.
 * Conflicting explicit mappings remain English, rather than choosing an arbitrary meaning. */
export function compileLexicon(objects: readonly LexiconObject[]) {
  const root: Trie = { children: new Map() };
  for (const object of objects) if (object.omnic) for (const phrase of object.lexiconWords ?? []) {
    const tokens = phrase.trim().match(/[\p{L}\p{M}\p{N}]+(?:['’\-][\p{L}\p{M}\p{N}]+)*|[^\s]/gu) ?? [];
    if (!tokens.length || tokens.length > 32) continue;
    let node = root;
    for (const token of tokens) {
      const word = key(token);
      if (!node.children.has(word)) node.children.set(word, { children: new Map() });
      node = node.children.get(word)!;
    }
    node.glyph = node.glyph === undefined || node.glyph === object.id ? object.id : null;
  }
  return (text: string): NodeText => {
    if (text.length > TEXT_LIMIT) throw Error('Paste exceeds 200,000 characters. Split it across nodes.');
    const tokens = [...text.matchAll(/[\p{L}\p{M}\p{N}]+(?:['’\-][\p{L}\p{M}\p{N}]+)*|[^\s]/gu)];
    const parts: TextPart[] = [];
    let cursor = 0;
    for (let i = 0; i < tokens.length; i++) {
      let node = root, match: { end: number; glyph: string | null } | undefined;
      for (let j = i; j < Math.min(tokens.length, i + 32); j++) {
        // Phrases may span spaces/tabs, never paragraph/line boundaries.
        if (j > i && /[\r\n]/.test(text.slice(tokens[j - 1].index! + tokens[j - 1][0].length, tokens[j].index))) break;
        const child = node.children.get(key(tokens[j][0]));
        if (!child) break;
        node = child;
        if (node.glyph !== undefined) match = { end: j, glyph: node.glyph };
      }
      if (!match) continue;
      if (match.glyph) {
        parts.push(text.slice(cursor, tokens[i].index), { glyph: match.glyph });
        cursor = tokens[i].index!;
      }
      i = match.end;
    }
    parts.push(text.slice(cursor));
    return normalizeText(parts);
  };
}
