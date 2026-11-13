import test from 'node:test';
import assert from 'node:assert/strict';
import {EditorState,EditorSelection} from '@codemirror/state';
import {history,undo,redo} from '@codemirror/commands';
import {emptyWorld,locate} from '../src/core/model.ts';
import {saveDefinition} from '../src/omnic/atlas.ts';
import {createRecipe} from '../src/omnic/presets.ts';
import {glyphField,glyphHistory,sliceSource,fromSource,sourceTransactionSpec} from '../src/text/source.ts';
import {lexiconAnnotations,workspaceLexicon,lexiconEdits} from '../src/text/lexicon.ts';
function world(){const world=emptyWorld(),origin=saveDefinition(world,undefined,createRecipe('line'),'line');locate(world,origin).lexiconWords=['hello','hi there'];return world;}
test('document typing inserts the actual shared glyph while retaining its English, and undo/redo preserve both',()=>{
 const w=world();let state=EditorState.create({doc:'hell',extensions:[glyphField,glyphHistory,history(),lexiconAnnotations(()=>w)]});
 const update=state.update({changes:{from:4,insert:'o'},selection:{anchor:5},userEvent:'input.type'});state=update.state;
 assert.equal(state.doc.toString(),'\ufffchello');assert.equal(state.selection.main.head,6);assert.equal(state.field(glyphField).length,1);assert.equal(fromSource(sliceSource(state)).content[1],'hello');
 const target={get state(){return state;},dispatch:tr=>{state=tr.state;}};assert.ok(undo(target));assert.equal(state.doc.toString(),'hell');assert.ok(redo(target));assert.equal(state.doc.toString(),'\ufffchello');assert.equal(state.field(glyphField).length,1);
});
test('overlapping multi-cursor annotation windows coalesce and preserve all selection ranges',()=>{
 const w=world();let state=EditorState.create({doc:'hell hell',selection:EditorSelection.create([EditorSelection.cursor(4),EditorSelection.cursor(9)]),extensions:[EditorState.allowMultipleSelections.of(true),glyphField,glyphHistory,history(),lexiconAnnotations(()=>w)]});state=state.update({changes:[{from:4,insert:'o'},{from:9,insert:'o'}],selection:EditorSelection.create([EditorSelection.cursor(5),EditorSelection.cursor(11)]),userEvent:'input.type'}).state;assert.equal(state.doc.toString(),'\ufffchello \ufffchello');assert.equal(state.field(glyphField).length,2);assert.equal(state.selection.ranges.length,2);
});
test('manual glyphs survive annotation refresh and repeated refresh does not duplicate automatic glyphs',()=>{
 const w=world(),id=JSON.stringify(w.nodes[0].origin);let state=EditorState.create({doc:'hello',extensions:[glyphField,glyphHistory,lexiconAnnotations(()=>w)]});let edits=lexiconEdits(state,workspaceLexicon(w),[{from:0,to:5}]);state=state.update({...sourceTransactionSpec(state,edits),filter:false}).state;assert.equal(lexiconEdits(state,workspaceLexicon(w),[{from:0,to:state.doc.length}]).length,0);
 state=state.update({...sourceTransactionSpec(state,[{from:state.doc.length,to:state.doc.length,insert:{text:'\ufffc',glyphs:[{at:0,part:{glyph:id,word:null}}]}}]),filter:false}).state;edits=lexiconEdits(state,workspaceLexicon(w),[{from:0,to:state.doc.length}]);assert.equal(edits.length,0);assert.equal(state.field(glyphField).length,2);
});
