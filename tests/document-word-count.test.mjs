import test from 'node:test';
import assert from 'node:assert/strict';
import {EditorState,EditorSelection} from '@codemirror/state';
import {countWords,documentWordTotal,documentWordCount} from '../src/text/wordCount.ts';
function editor(doc){return EditorState.create({doc,extensions:[documentWordTotal,EditorState.allowMultipleSelections.of(true)]});}
test('shared word counting handles punctuation, Unicode, numbers and glyph boundaries',()=>{
 assert.equal(countWords(''),0);assert.equal(countWords(' # **Hello**, world! \ufffc '),2);
 assert.equal(countWords("don't re-enter café cafe\u0301 Ελληνικά русский 123"),7);
 assert.equal(countWords('before\ufffcafter'),2);
});
test('selection count replaces total, supports multiple ranges, and resets on deselection',()=>{
 let state=editor('one two\nthree four');assert.deepEqual(documentWordCount(state),{count:4,selected:false});
 state=state.update({selection:EditorSelection.create([EditorSelection.range(0,3),EditorSelection.range(8,18)])}).state;
 assert.deepEqual(documentWordCount(state),{count:3,selected:true});
 state=state.update({selection:{anchor:3}}).state;assert.deepEqual(documentWordCount(state),{count:4,selected:false});
 state=state.update({selection:{anchor:3,head:4}}).state;assert.deepEqual(documentWordCount(state),{count:0,selected:true});
});
test('incremental totals remain correct when joining, splitting and editing several positions on the same line',()=>{
 let state=editor('one two three\nfour five\nsix');
 for(const changes of [[{from:0,to:3,insert:'a b'},{from:8,to:13,insert:'c\nd'}],{from:1,to:18,insert:''},{from:0,insert:'\nnew words\n'},{from:0,to:0,insert:'prefix'}]){
  state=state.update({changes}).state;assert.equal(state.field(documentWordTotal),countWords(state.doc.toString()));
 }
});
test('incremental totals match full counts across repeated arbitrary edits',()=>{
 let state=editor('alpha beta\ngamma delta\nend'),seed=321;
 const random=max=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%max;};
 const inserts=['',' ','\n','word','a b','é\ufffc猫','--','\n\n'];
 for(let i=0;i<300;i++){
  const from=random(state.doc.length+1),to=from+random(state.doc.length-from+1);
  state=state.update({changes:{from,to,insert:inserts[random(inserts.length)]}}).state;
  assert.equal(state.field(documentWordTotal),countWords(state.doc.toString()),`edit ${i}`);
 }
});
