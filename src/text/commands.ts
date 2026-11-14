import { EditorSelection, type EditorState } from '@codemirror/state';
import type { StateCommand } from '@codemirror/state';
import { concatSource, literal, sliceSource, sourceTransaction, type Edit, type Source } from './source.ts';

function lines(state: EditorState) {
  const selected = new Set<number>();
  for (const range of state.selection.ranges) {
    const last = state.doc.lineAt(range.to && range.to > range.from && state.doc.lineAt(range.to).from === range.to ? range.to - 1 : range.to).number;
    for (let n = state.doc.lineAt(range.from).number; n <= last; n++) selected.add(n);
  }
  return [...selected].sort((a,b) => a-b);
}
export function linePrefix(transform: (line: string, index: number) => { remove: number; prefix: string }): StateCommand {
  return ({ state, dispatch }) => {
    const edits = lines(state).map((n, i) => {
      const line = state.doc.line(n), { remove, prefix } = transform(line.text, i);
      return { from: line.from, to: line.from + remove, insert: literal(prefix) };
    });
    dispatch(sourceTransaction(state, edits)); return true;
  };
}
export const heading = (level: number) => linePrefix(line => ({ remove: /^#{1,6}\s+/.exec(line)?.[0].length ?? 0, prefix: level ? '#'.repeat(level) + ' ' : '' }));
export function list(kind: 'bullet' | 'numbered' | 'cycle'): StateCommand {
  return target => {
    const selected = lines(target.state).map(n => target.state.doc.line(n).text);
    const wanted = kind === 'cycle' ? selected.every(s => /^\s*[-+*] \[[ xX]\] /.test(s)) ? 'none' : selected.every(s => /^\s*\d+\. /.test(s)) ? 'task' : selected.every(s => /^\s*[-+*] /.test(s)) ? 'numbered' : 'bullet' : selected.every(s => kind === 'bullet' ? /^\s*[-+*] (?!\[)/.test(s) : /^\s*\d+\. /.test(s)) ? 'none' : kind;
    return linePrefix((line, index) => {
      const indent = /^\s*/.exec(line)![0], marker = /^(?:[-+*]|\d+\.)\s+(?:\[[ xX]\]\s+)?/.exec(line.slice(indent.length));
      return { remove: indent.length + (marker?.[0].length ?? 0), prefix: indent + (wanted === 'bullet' ? '- ' : wanted === 'numbered' ? `${index+1}. ` : wanted === 'task' ? '- [ ] ' : '') };
    })(target);
  };
}
export const wrap = (mark: string, end = mark): StateCommand => ({ state, dispatch }) => {
  const edits: Edit[] = [], destinations: { anchor: number; head: number }[] = []; let offset = 0;
  for (const range of state.selection.ranges) {
    const source = sliceSource(state, range.from, range.to);
    const inside = source.text.startsWith(mark) && source.text.endsWith(end) && source.text.length >= mark.length + end.length;
    const outside = !inside && range.from >= mark.length && state.sliceDoc(range.from-mark.length,range.from) === mark && state.sliceDoc(range.to,range.to+end.length) === end;
    const editFrom = outside ? range.from-mark.length : range.from, editTo = outside ? range.to+end.length : range.to;
    const insert = inside ? sliceSource(state,range.from+mark.length,range.to-end.length) : outside ? source : concatSource(literal(mark),source,literal(end));
    edits.push({from:editFrom,to:editTo,insert});
    const from = editFrom+offset+(inside||outside?0:mark.length), to = from+(inside?insert.text.length:source.text.length);
    destinations.push({anchor:range.anchor <= range.head?from:to,head:range.anchor <= range.head?to:from}); offset += insert.text.length-(editTo-editFrom);
  }
  dispatch(sourceTransaction(state, edits, destinations)); return true;
};
export const codeBlock = wrap('```\n', '\n```');
export const capitalizeSentence: StateCommand = ({ state, dispatch }) => {
  const edits: Edit[] = []; const seen = new Set<string>();
  for (const range of state.selection.ranges) {
    const line = state.doc.lineAt(range.head), from = range.empty ? line.from : range.from, to = range.empty ? line.to : range.to;
    const source = state.sliceDoc(from, to), starts = /(^|[.!?]\s+)([\p{L}])/gu;
    for (const match of source.matchAll(starts)) {
      const at = from + match.index! + match[1].length, text = match[2], key = `${at}:${at+text.length}`;
      if (!seen.has(key)) { seen.add(key); edits.push({ from: at, to: at + text.length, insert: literal(text.toLocaleUpperCase()) }); }
    }
  }
  edits.sort((a,b) => a.from-b.from); dispatch(sourceTransaction(state, edits)); return true;
};
/** Remove selected document lines without expanding to surrounding paragraphs. */
export const deleteLines: StateCommand = ({state,dispatch})=>{
  if(state.readOnly)return false;
  const spans:{from:number;to:number}[]=[];
  for(const number of lines(state)){
    const line=state.doc.line(number),from=number===state.doc.lines&&number>1?line.from-1:line.from,to=number<state.doc.lines?line.to+1:line.to;
    const previous=spans.at(-1);if(previous&&from<=previous.to)previous.to=Math.max(previous.to,to);else spans.push({from,to});
  }
  dispatch(sourceTransaction(state,spans.map(span=>({...span,insert:literal('')}))));return true;
};
export const deleteParagraph: StateCommand = ({ state, dispatch }) => {
  const blocks: { from: number; to: number }[] = [];
  for (const range of state.selection.ranges) {
    let first = state.doc.lineAt(range.from).number, last = state.doc.lineAt(range.to).number;
    const blank = first === last && !state.doc.line(first).text.trim();
    while (!blank && first > 1 && state.doc.line(first-1).text.trim()) first--;
    while (!blank && last < state.doc.lines && state.doc.line(last+1).text.trim()) last++;
    const from = state.doc.line(first).from, to = last < state.doc.lines ? state.doc.line(last+1).from : state.doc.line(last).to;
    const previous = blocks.at(-1); if (previous && from <= previous.to) previous.to = Math.max(previous.to, to); else blocks.push({ from, to });
  }
  dispatch(sourceTransaction(state, blocks.map(b => ({ ...b, insert: literal('') })))); return true;
};
export function moveLines(direction: -1 | 1): StateCommand {
  return ({ state, dispatch }) => {
    const groups: { first: number; last: number }[] = [];
    for (const n of lines(state)) { const previous = groups.at(-1); if (previous && n === previous.last+1) previous.last = n; else groups.push({ first: n, last: n }); }
    const edits: Edit[] = [], moves: { from: number; to: number; delta: number }[] = [];
    for (const group of groups) {
      if (direction < 0 && group.first === 1 || direction > 0 && group.last === state.doc.lines) continue;
      const first = state.doc.line(group.first), last = state.doc.line(group.last), neighbor = state.doc.line(direction < 0 ? group.first-1 : group.last+1);
      const block = sliceSource(state, first.from, last.to), other = sliceSource(state, neighbor.from, neighbor.to);
      const insert: Source = direction < 0 ? concatSource(block, literal('\n'), other) : concatSource(other, literal('\n'), block);
      edits.push({ from: Math.min(first.from,neighbor.from), to: Math.max(last.to,neighbor.to), insert });
      moves.push({ from: first.from, to: Math.min(state.doc.length,last.to+1), delta: direction * (neighbor.length+1) });
    }
    if (edits.some((e,i) => i > 0 && e.from < edits[i-1].to)) return true;
    const ranges = state.selection.ranges.map(range => { const move = moves.find(m => range.from >= m.from && range.to <= m.to); return { anchor: Math.min(state.doc.length,range.anchor + (move?.delta ?? 0)), head: Math.min(state.doc.length,range.head + (move?.delta ?? 0)) }; });
    if (edits.length) dispatch(sourceTransaction(state, edits, ranges)); return true;
  };
}
// Keep selection simplification in the editor keymap ahead of panel dismissal.
export const singleCursor: StateCommand = ({ state, dispatch }) => {
  if (state.selection.ranges.length < 2) return false;
  dispatch(state.update({ selection: EditorSelection.create([state.selection.main]) })); return true;
};
