import test from 'node:test';
import assert from 'node:assert/strict';
import {EditorState} from '@codemirror/state';
import {markdown} from '@codemirror/lang-markdown';
import {codeFolding,foldedRanges,ensureSyntaxTree} from '@codemirror/language';
import {documentFoldBindings} from '../src/text/folding.ts';
import {documentBindings,remapDocumentBindings} from '../src/text/shortcutBindings.ts';
import {shortcuts} from '../src/ui/shortcuts.ts';
import {glyphField,toSource,fromSource,sliceSource} from '../src/text/source.ts';
function editor(content){const source=toSource({version:1,content});let state=EditorState.create({doc:source.text,extensions:[markdown(),codeFolding(),glyphField.init(()=>source.glyphs)]});return {get state(){return state;},dispatch(spec){state=state.update(spec).state;},lineBlockAt(pos){return state.doc.lineAt(pos);},select(pos){this.dispatch({selection:{anchor:pos}});},run(key){ensureSyntaxTree(state,state.doc.length,1000);return documentFoldBindings.find(b=>b.key===key).run(this);},folds(){const ranges=[];foldedRanges(state).between(0,state.doc.length,(from,to)=>ranges.push({from,to}));return ranges;}};}
test('Alt+1 folds every top-level section regardless of cursor; Alt+2 unfolds the entire document',()=>{
 const text='# First\nbody\n## Child\nchild body\n# Next\nnext body',view=editor([text]);
 view.select(text.length);assert.equal(view.run('Alt-1'),true);assert.deepEqual(view.folds(),[{from:'# First'.length,to:text.indexOf('\n# Next')},{from:text.indexOf('\nnext body'),to:text.length}]);assert.equal(view.state.doc.toString(),text);
 view.select(text.indexOf('child body'));assert.equal(view.run('Alt-2'),true);assert.deepEqual(view.folds(),[]);assert.equal(view.run('Alt-2'),false);
});
test('Setext headings fold throughout the document; empty headings do not hide a sibling',()=>{
 const text='Title\n=====\n\nbody\n\nNext\n====\n\nnext body',view=editor([text]);assert.equal(view.run('Alt-1'),true);assert.deepEqual(view.folds(),[{from:text.indexOf('\n'),to:text.indexOf('\n\nNext')},{from:text.indexOf('\n====\n'),to:text.length}]);view.run('Alt-2');assert.deepEqual(view.folds(),[]);
 const empty=editor(['# Empty\n# Next\ntext']);assert.equal(empty.run('Alt-1'),true);assert.deepEqual(empty.folds(),[{from:14,to:19}]);
});
test('fold state maps through edits without changing authored glyph references or content',()=>{
 const glyph={glyph:'{"born":1,"at":[0,0,0]}',word:'shape'},view=editor(['# Header\nbody ',glyph,'\n# Next\ntext']),before=fromSource(sliceSource(view.state));
 view.run('Alt-1');assert.deepEqual(fromSource(sliceSource(view.state)),before);const old=view.folds();view.dispatch({changes:{from:0,insert:'prefix\n'}});assert.deepEqual(view.folds(),old.map(({from,to})=>({from:from+7,to:to+7})));view.select(7);view.run('Alt-2');assert.deepEqual(view.folds(),[]);assert.deepEqual(fromSource(sliceSource(view.state)).content,['prefix\n# Header\nbody ',glyph,'\n# Next\ntext']);
});
test('fold shortcuts use the existing Document binding store and can be reassigned independently',()=>{
 const before=shortcuts.getSnapshot();try{shortcuts.restore({});const definitions=documentBindings(documentFoldBindings,false).map(row=>row.definition);assert.deepEqual(definitions.map(d=>d.id),['Alt+1','Alt+2']);shortcuts.assign(definitions[0],'Alt+9',definitions);assert.equal(remapDocumentBindings(documentFoldBindings)[0].key,'Alt-9');assert.equal(remapDocumentBindings(documentFoldBindings)[1].key,'Alt-2');}finally{shortcuts.restore(before);}
});
