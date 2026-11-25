import {syntaxTree} from '@codemirror/language';
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
    const changes=state.changes(edits.map(edit=>({from:edit.from,to:edit.to,insert:edit.insert.text})));
    const prefixes=new Map(edits.map(edit=>[edit.from,edit]));
    const ranges=state.selection.ranges.map(range=>{
      if(!range.empty)return range.map(changes);
      const prefix=prefixes.get(state.doc.lineAt(range.head).from);
      const at=prefix&&range.head<=prefix.to?changes.mapPos(prefix.from,-1)+prefix.insert.text.length:changes.mapPos(range.head,1);
      return EditorSelection.cursor(at);
    });
    dispatch(sourceTransaction(state, edits,ranges)); return true;
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
  const ranges = state.selection.ranges.map(range=>{
    if(range.empty&&(mark==='**'||mark==='*')){
      for(let node=syntaxTree(state).resolveInner(range.head,-1);node;node=node.parent!){
        if(node.name===(mark==='**'?'StrongEmphasis':'Emphasis')&&state.sliceDoc(node.from,node.from+mark.length)===mark&&range.head>=node.from+mark.length&&range.head<=node.to-end.length)
          return EditorSelection.range(node.from,node.to);
      }
    }
    if(mark!=='**'&&mark!=='*')return range;
    const word=state.wordAt(range.from);
    if(!word||range.to>word.to)return range;
    return EditorSelection.range(range.anchor<=range.head?word.from:word.to,range.anchor<=range.head?word.to:word.from);
  });
  for (const range of EditorSelection.create(ranges).ranges) {
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
/** Case edits retain carets inside words, including Unicode length changes. */
function caseSelection(state:EditorState,edits:readonly Edit[],prefix:(edit:Edit,text:string)=>string){
 const changes=state.changes(edits.map(edit=>({from:edit.from,to:edit.to,insert:edit.insert.text})));
 return state.selection.ranges.map(range=>{
  if(range.empty){const edit=edits.find(edit=>range.head>edit.from&&range.head<edit.to),at=edit?changes.mapPos(edit.from,-1)+prefix(edit,state.sliceDoc(edit.from,range.head)).length:changes.mapPos(range.head,1);return {anchor:at,head:at};}
  const from=changes.mapPos(range.from,-1),to=changes.mapPos(range.to,1);return range.anchor<=range.head?{anchor:from,head:to}:{anchor:to,head:from};
 });
}
/** Uppercase highlighted text or words at carets, preserving glyph references. */
export const uppercaseSelection: StateCommand = ({state,dispatch})=>{
  const edits:Edit[]=[];
  const targets=state.selection.ranges.flatMap(range=>{if(!range.empty)return [range];const word=state.wordAt(range.head);return word?[word]:[];});
  if(!targets.length)return true;
  for(const range of EditorSelection.create(targets).ranges){
    for(const match of state.sliceDoc(range.from,range.to).matchAll(/\p{L}+/gu)){
      const text=match[0].toLocaleUpperCase();if(text===match[0])continue;
      const from=range.from+match.index!;edits.push({from,to:from+match[0].length,insert:literal(text)});
    }
  }
  if(edits.length){
    dispatch(sourceTransaction(state,edits,caseSelection(state,edits,(_edit,text)=>text.toLocaleUpperCase())));
  }
  return true;
};
export const codeBlock = wrap('```\n', '\n```');
function sentenceWord(word:string,capital:boolean){
 const text=word.toLocaleLowerCase();if(!capital||!text)return text;
 const first=String.fromCodePoint(text.codePointAt(0)!);return first.toLocaleUpperCase()+text.slice(first.length);
}
/** Sentence case keeps punctuation, task markers and glyph references intact. */
export const capitalizeSentence: StateCommand = ({ state, dispatch }) => {
  const edits: Edit[] = [],capitalStarts=new Set<number>();
  const targets=EditorSelection.create(state.selection.ranges.map(range=>{const line=state.doc.lineAt(range.head);return range.empty?EditorSelection.range(line.from,line.to):range;})).ranges;
  for (const {from,to} of targets) {
    const source=state.sliceDoc(from,to),starts=/(^(?:\[[ xX]\]|[\p{P}\p{S}\p{N}\t ])*|[.!?:](?:\[[ xX]\]|[\p{P}\p{S}\t ])*)(\p{L})/gmu;
    const capitals=new Set<number>(),prefixes:{from:number;to:number}[]=[];
    for(const match of source.matchAll(starts)){const at=match.index!+match[1].length;capitals.add(at);capitalStarts.add(from+at);prefixes.push({from:match.index!,to:at});}
    let prefix=0;
    for(const match of source.matchAll(/\p{L}[\p{L}\p{M}]*/gu)){
      const at=match.index!,word=match[0];while(prefix<prefixes.length&&prefixes[prefix].to<=at)prefix++;
      if(prefix<prefixes.length&&at>=prefixes[prefix].from&&at<prefixes[prefix].to)continue;
      const text=sentenceWord(word,capitals.has(at));
      if(text!==word)edits.push({from:from+at,to:from+at+word.length,insert:literal(text)});
    }
  }
  if(edits.length)dispatch(sourceTransaction(state,edits,caseSelection(state,edits,(edit,text)=>sentenceWord(text,capitalStarts.has(edit.from)))));return true;
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
