import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EditorState, EditorSelection } from '@codemirror/state';
import { history, undo, redo } from '@codemirror/commands';
import { markdown, markdownKeymap } from '@codemirror/lang-markdown';
import { Strikethrough, TaskList } from '@lezer/markdown';
import { fromSource, toSource, glyphField, glyphHistory, sliceSource, sourceTransaction } from '../src/text/source.ts';
import { wrap, heading, list, moveLines, deleteLines, deleteParagraph, capitalizeSentence, codeBlock, singleCursor } from '../src/text/commands.ts';

const glyph={glyph:'{"born":1,"at":[0,0,0]}',word:'shape'};
function editor(content, ranges=[[0,0]]) {
 const source=toSource({version:1,content});
 let state=EditorState.create({doc:source.text,selection:EditorSelection.create(ranges.map(([a,h])=>EditorSelection.range(a,h))),extensions:[EditorState.allowMultipleSelections.of(true),glyphField.init(()=>source.glyphs),glyphHistory,history(),markdown({extensions:[Strikethrough,TaskList]})]});
 return {get state(){return state},dispatch(tr){state=tr.state},run(command){return command(this)},select(ranges){state=state.update({selection:EditorSelection.create(ranges.map(([a,h])=>EditorSelection.range(a,h)))}).state},text(){return fromSource(sliceSource(state))}};
}
test('existing mixed documents and literal object-replacement characters round-trip unchanged',()=>{
 const text={version:1,content:['# Heading\n**bold** \ufffc ',glyph,'\n- [ ] item']};
 assert.deepEqual(fromSource(toSource(text)),text);
});
test('multiple cursors insert together and undo/redo preserve each cursor and glyph',()=>{
 const e=editor(['abc ',glyph,' def'],[[0,0],[6,6]]);
 e.dispatch(e.state.update(e.state.replaceSelection('!')));
 assert.equal(e.state.doc.toString(),'!abc \ufffc !def');
 assert.deepEqual(e.text().content,['!abc ',glyph,' !def']);
 e.run(undo);assert.deepEqual(e.text().content,['abc ',glyph,' def']);assert.equal(e.state.selection.ranges.length,2);
 e.run(redo);assert.deepEqual(e.text().content,['!abc ',glyph,' !def']);
});
test('deleting a glyph and undoing restores its exact reference metadata',()=>{
 const e=editor(['a',glyph,'b'],[[1,2]]);e.dispatch(e.state.update(e.state.replaceSelection('')));
 assert.deepEqual(e.text().content,['ab']);e.run(undo);assert.deepEqual(e.text().content,['a',glyph,'b']);
});
test('formatting each selection is one undo step, toggles off, and preserves glyphs',()=>{
 const e=editor(['one ',glyph,' two'],[[0,3],[4,5]]);e.run(wrap('**'));
 assert.deepEqual(e.text().content,['**one** **',glyph,'** two']);
 e.run(wrap('**'));assert.deepEqual(e.text().content,['one ',glyph,' two']);
 e.run(undo);assert.deepEqual(e.text().content,['**one** **',glyph,'** two']);
 e.run(undo);assert.deepEqual(e.text().content,['one ',glyph,' two']);
});
test('moving selected lines carries glyphs and undo preserves their references',()=>{
 const e=editor(['top\n',glyph,' middle\nbottom'],[[4,4]]);e.run(moveLines(-1));
 assert.deepEqual(e.text().content,[glyph,' middle\ntop\nbottom']);assert.equal(e.state.selection.main.head,0);
 e.run(undo);assert.deepEqual(e.text().content,['top\n',glyph,' middle\nbottom']);
 e.run(moveLines(1));assert.deepEqual(e.text().content,['top\nbottom\n',glyph,' middle']);
});
test('separate selected lines move together without losing either cursor',()=>{
 const e=editor(['a\nb\nc\nd'],[[0,0],[4,4]]);e.run(moveLines(1));assert.equal(e.state.doc.toString(),'b\na\nd\nc');assert.deepEqual(e.state.selection.ranges.map(r=>r.head),[2,6]);
});
test('headings apply once per selected line and remove to paragraph',()=>{
 const e=editor(['one\ntwo'],[[0,1],[2,2],[4,7]]);e.run(heading(6));assert.equal(e.state.doc.toString(),'###### one\n###### two');
 e.run(heading(0));assert.equal(e.state.doc.toString(),'one\ntwo');
});
test('list commands toggle and cycle bullets, numbers and checklists',()=>{
 const e=editor(['one\ntwo'],[[0,7]]);
 for(const expected of ['- one\n- two','1. one\n2. two','- [ ] one\n- [ ] two','one\ntwo']){e.run(list('cycle'));assert.equal(e.state.doc.toString(),expected);}
 e.run(list('bullet'));e.run(list('bullet'));assert.equal(e.state.doc.toString(),'one\ntwo');
});
test('paragraph deletion merges overlapping cursor scopes and leaves other paragraphs',()=>{
 const e=editor(['first\nline\n\nsecond\n\nthird'],[[1,1],[8,8]]);e.run(deleteParagraph);assert.equal(e.state.doc.toString(),'\nsecond\n\nthird');
 e.run(undo);assert.equal(e.state.doc.toString(),'first\nline\n\nsecond\n\nthird');
 const blank=editor(['a\n\nb'],[[2,2]]);blank.run(deleteParagraph);assert.equal(blank.state.doc.toString(),'a\nb');
});
test('sentence capitalization and fenced code preserve glyphs',()=>{
 const e=editor(['hello. world ',glyph],[[0,14]]);e.run(capitalizeSentence);assert.deepEqual(e.text().content,['Hello. World ',glyph]);
 e.run(codeBlock);assert.deepEqual(e.text().content,['```\nHello. World ',glyph,'\n```']);
});
test('rich clipboard insertion at multiple cursors gives independent glyph occurrences and undo',()=>{
 const e=editor(['a\nb'],[[0,0],[2,2]]),insert=toSource({version:1,content:[glyph]});
 e.dispatch(sourceTransaction(e.state,e.state.selection.ranges.map(r=>({from:r.from,to:r.to,insert}))));
 assert.deepEqual(e.text().content,[glyph,'a\n',glyph,'b']);e.run(undo);assert.deepEqual(e.text().content,['a\nb']);e.run(redo);assert.deepEqual(e.text().content,[glyph,'a\n',glyph,'b']);
});
test('Markdown Enter continues list entries for all cursors',()=>{
 const e=editor(['- one\n- two'],[[5,5],[11,11]]);const enter=markdownKeymap.find(k=>k.key==='Enter');e.run(enter.run);
 assert.equal(e.state.doc.toString(),'- one\n- \n- two\n- ');assert.equal(e.state.selection.ranges.length,2);
});
test('Escape simplifies multiple cursors before asking to close the document',()=>{
 const e=editor(['abcd'],[[0,0],[3,3]]);assert.equal(e.run(singleCursor),true);assert.equal(e.state.selection.ranges.length,1);assert.equal(e.run(singleCursor),false);
});
test('moving a full-line selection to the document end keeps selection in bounds',()=>{
 const e=editor(['a\nb\nc'],[[2,4]]);e.run(moveLines(1));assert.equal(e.state.doc.toString(),'a\nc\nb');assert.deepEqual([e.state.selection.main.from,e.state.selection.main.to],[4,5]);
});
test('grouped native typing undo/redo maps references across all constituent changes',()=>{
 const e=editor(['a',glyph,'b']);
 for(let i=0;i<3;i++)e.dispatch(e.state.update({changes:{from:0,insert:'!'},userEvent:'input.type'}));
 assert.deepEqual(e.text().content,['!!!a',glyph,'b']);e.run(undo);assert.deepEqual(e.text().content,['a',glyph,'b']);e.run(redo);assert.deepEqual(e.text().content,['!!!a',glyph,'b']);
});
test('grouped deletion and a preceding edit restore the removed glyph exactly',()=>{
 const e=editor(['a',glyph,'b']);
 e.dispatch(e.state.update({changes:{from:1,to:2},userEvent:'delete.backward'}));
 e.dispatch(e.state.update({changes:{from:0,to:1},userEvent:'delete.backward'}));
 assert.deepEqual(e.text().content,['b']);e.run(undo);assert.deepEqual(e.text().content,['a',glyph,'b']);e.run(redo);assert.deepEqual(e.text().content,['b']);
});
test('Alt-double-click adds whole words without discarding earlier ranges',async()=>{
 const {addWordSelection}=await import('../src/text/mouse.ts');
 const e=editor(['one two three'],[[0,3]]), baseline=e.state.selection;
 const selected=addWordSelection(e.state,baseline,5);
 assert.deepEqual(selected.ranges.map(r=>[r.from,r.to]),[[0,3],[4,7]]);
 assert.deepEqual(addWordSelection(e.state,baseline,5,10).ranges.map(r=>[r.from,r.to]),[[0,3],[4,13]]);
 const full=editor(['one two three'],[[0,3],[4,7]]),before=full.state.selection;
 full.select([[0,3]]);
 assert.deepEqual(addWordSelection(full.state,before,5).ranges.map(r=>[r.from,r.to]),[[0,3],[4,7]]);
});

test('line deletion preserves adjoining lines in the same paragraph and supports multiple cursors',()=>{
 const e=editor(['first\nsecond\nthird\nfourth'],[[7,7],[14,14]]);e.run(deleteLines);assert.equal(e.state.doc.toString(),'first\nfourth');e.run(undo);assert.equal(e.state.doc.toString(),'first\nsecond\nthird\nfourth');
 const last=editor(['first\nlast'],[[7,7]]);last.run(deleteLines);assert.equal(last.state.doc.toString(),'first');
 const boundary=editor(['one\ntwo\nthree'],[[0,4]]);boundary.run(deleteLines);assert.equal(boundary.state.doc.toString(),'two\nthree');
});

test('bold and italic expand cursors and partial word selections, merging duplicate word targets',()=>{
 for(const mark of ['**','*']){
  for(const selection of [[[3,3]],[[2,5]],[[5,2]],[[1,1],[4,4]]]){
   const e=editor(['example'],selection);e.run(wrap(mark));assert.equal(e.state.doc.toString(),mark+'example'+mark);
   e.run(wrap(mark));assert.equal(e.state.doc.toString(),'example');
   e.run(undo);assert.equal(e.state.doc.toString(),mark+'example'+mark);
  }
 }
 const multiple=editor(['one two'],[[1,1],[5,5]]);multiple.run(wrap('**'));assert.equal(multiple.state.doc.toString(),'**one** **two**');
 const phrase=editor(['one two'],[[1,5]]);phrase.run(wrap('*'));assert.equal(phrase.state.doc.toString(),'o*ne t*wo');
 const blank=editor(['one  two'],[[4,4]]);blank.run(wrap('**'));assert.equal(blank.state.doc.toString(),'one **** two');
 const code=editor(['example'],[[3,3]]);code.run(wrap('`'));assert.equal(code.state.doc.toString(),'exa``mple');
});
