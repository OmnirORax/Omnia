/** Portable mixed document. English and glyph references are independent siblings. */
export type TextPart = string | { glyph: string; word?: string | null };
export type LexiconMatch = { start: number; end: number; glyph: string };
export type NodeText = { version: 1; content: TextPart[] };
export const TEXT_LIMIT = 200_000;
export const GLYPH_LIMIT = 4_000;
export function normalizeText(parts: readonly TextPart[]): NodeText {
  const content: TextPart[] = [];
  for (const part of parts) {
    if (typeof part !== 'string') content.push({ glyph: part.glyph, ...(part.word !== undefined ? { word: part.word } : {}) });
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
    else if (!part || typeof part !== 'object' || Object.keys(part).some(key => key !== 'glyph' && key !== 'word') || typeof part.glyph !== 'string' || !objects.has(part.glyph) || part.word !== undefined && part.word !== null && (typeof part.word !== 'string' || !part.word.length || part.word.length > TEXT_LIMIT))
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
  const matches = (text: string): LexiconMatch[] => {
    if (text.length > TEXT_LIMIT) throw Error('Paste exceeds 200,000 characters. Split it across nodes.');
    const tokens = [...text.matchAll(/[\p{L}\p{M}\p{N}]+(?:['’\-][\p{L}\p{M}\p{N}]+)*|[^\s]/gu)];
    const found: LexiconMatch[] = [];
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
        found.push({ start: tokens[i].index!, end: tokens[match.end].index! + tokens[match.end][0].length, glyph: match.glyph });
      }
      i = match.end;
    }
    return found;
  };
  return Object.assign((text: string): NodeText => applyLexiconMatches(text,matches(text),false), { matches });
}
/** One automatic occurrence remains linked while its English exists. Null is a
 * detached glyph: deleting English must never delete the translation. */
export function applyLexiconMatches(text:string,matches:readonly LexiconMatch[],linked=true):NodeText {
  const parts:TextPart[]=[];let cursor=0;
  for(const match of matches){parts.push(text.slice(cursor,match.start),{glyph:match.glyph,...(linked?{word:text.slice(match.start,match.end)}:{})});cursor=match.start;}
  parts.push(text.slice(cursor));return normalizeText(parts);
}
export function annotatedText(text:string,lexicon:ReturnType<typeof compileLexicon>):NodeText {
  return applyLexiconMatches(text,lexicon.matches(text));
}
/** Bound ordinary typing to a neighbourhood; never match a truncated word. */
export function lexiconWindow(text:string,offset:number,radius=256){
  let start=Math.max(0,offset-radius),end=Math.min(text.length,offset+radius);
  const word=(char:string)=>!!char&&/[\p{L}\p{M}\p{N}'’\-]/u.test(char);
  if(start>0&&word(text[start-1]))while(start<end&&word(text[start]))start++;
  if(end<text.length&&word(text[end]))while(end>start&&word(text[end-1]))end--;
  return {start,end};
}

export type AnnotationKind='insert'|'delete'|'refresh';
export function annotationPrefix(previous:Exclude<TextPart,string>,text:string,first:LexiconMatch|undefined,kind:AnnotationKind){
  const word=(char:string)=>!!char&&/[\p{L}\p{M}\p{N}'’\-]/u.test(char);
  const firstWord=first?text.slice(0,first.end):undefined,source=previous.word;
  if(source===null)return {remove:false,skip:false};
  if(source){
    const intact=text.startsWith(source)&&!word(text[source.length]);
    if(kind==='delete'&&!intact)return word(text[0])?{remove:false,skip:true}:{remove:false,skip:false,word:null};
    if(kind==='insert'&&!intact||intact&&(!first||firstWord!==source||first.glyph!==previous.glyph))return {remove:true,skip:false};
    return {remove:false,skip:!!first};
  }
  return first&&first.glyph===previous.glyph?{remove:false,skip:true,word:firstWord}:{remove:false,skip:false};
}
