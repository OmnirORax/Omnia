import { EditorSelection, StateEffect, StateField, MapMode, type EditorState, type ChangeDesc, type ChangeSpec } from '@codemirror/state';
import { invertedEffects, isolateHistory } from '@codemirror/commands';
import { normalizeText, type NodeText, type TextPart } from './model.ts';

export type Glyph = { at: number; part: Exclude<TextPart, string> };
export type Source = { text: string; glyphs: Glyph[] };
export const addGlyphs = StateEffect.define<readonly Glyph[]>({ map: (glyphs, changes) => glyphs.flatMap(g => {
  const at = changes.mapPos(g.at, 1, MapMode.TrackDel); return at === null ? [] : [{ ...g, at }];
}) });
function mapped(glyphs: readonly Glyph[], changes: ChangeDesc): Glyph[] {
  const result: Glyph[] = []; let i = 0;
  changes.iterGaps((from, to, length) => {
    while (i < glyphs.length && glyphs[i].at < from) i++;
    while (i < glyphs.length && glyphs[i].at < from + length) { const g = glyphs[i++]; result.push({ at: to + g.at - from, part: g.part }); }
  });
  return result;
}
export const glyphField = StateField.define<readonly Glyph[]>({
  create: () => [],
  update(value, tr) {
    const next = tr.docChanged ? mapped(value, tr.changes) : [...value];
    for (const effect of tr.effects) if (effect.is(addGlyphs)) next.push(...effect.value);
    return next.sort((a,b) => a.at-b.at);
  },
});
export const glyphHistory = invertedEffects.of(tr => {
  if (!tr.docChanged) return [];
  const before = tr.startState.field(glyphField), kept = new Set<number>(); let i = 0;
  tr.changes.iterGaps((from, _to, length) => {
    while (i < before.length && before[i].at < from) i++;
    while (i < before.length && before[i].at < from+length) kept.add(before[i++].at);
  });
  const deleted = before.filter(g => !kept.has(g.at));
  return deleted.length ? [addGlyphs.of(deleted)] : [];
});
export function toSource(text: NodeText): Source {
  let source = ''; const glyphs: Glyph[] = [];
  for (const part of text.content) if (typeof part === 'string') source += part; else { glyphs.push({ at: source.length, part }); source += '\ufffc'; }
  return { text: source, glyphs };
}
export function fromSource(source: Source): NodeText {
  const parts: TextPart[] = []; let start = 0;
  for (const glyph of source.glyphs) {
    if (glyph.at < start || source.text[glyph.at] !== '\ufffc') throw Error('Invalid glyph position.');
    parts.push(source.text.slice(start, glyph.at), glyph.part); start = glyph.at + 1;
  }
  parts.push(source.text.slice(start)); return normalizeText(parts);
}
export function sliceSource(state: EditorState, from = 0, to = state.doc.length): Source {
  return { text: state.sliceDoc(from, to), glyphs: state.field(glyphField).filter(g => g.at >= from && g.at < to).map(g => ({ ...g, at: g.at - from })) };
}
export function concatSource(...sources: Source[]): Source {
  const result: Source = { text: '', glyphs: [] };
  for (const source of sources) { const offset = result.text.length; result.glyphs.push(...source.glyphs.map(g => ({ ...g, at: g.at + offset }))); result.text += source.text; }
  return result;
}
export const literal = (text: string): Source => ({ text, glyphs: [] });
export type Edit = { from: number; to: number; insert: Source };
export function sourceTransactionSpec(state: EditorState, edits: readonly Edit[], ranges?: readonly { anchor: number; head: number }[]) {
  const specs: ChangeSpec[] = edits.map(e => ({ from: e.from, to: e.to, insert: e.insert.text })), changes = state.changes(specs);
  const glyphs: Glyph[] = [];
  for (const edit of edits) {
    const offset = changes.mapPos(edit.from, -1);
    glyphs.push(...edit.insert.glyphs.map(g => ({ ...g, at: offset + g.at })));
  }
  glyphs.sort((a, b) => a.at - b.at);
  return { changes, effects: addGlyphs.of(glyphs), annotations:isolateHistory.of('full'), ...(ranges ? { selection: EditorSelection.create(ranges.map(r => EditorSelection.range(r.anchor, r.head)), state.selection.mainIndex) } : {}), scrollIntoView: true, userEvent: 'input' };
}

export function sourceTransaction(...args:Parameters<typeof sourceTransactionSpec>){return args[0].update(sourceTransactionSpec(...args));}
