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
test('Alt+1 folds a heading including descendants but stops before its next sibling; Alt+2 opens it',()=>{
 const text='# First\nbody\n## Child\nchild body\n# Next\nnext body',view=editor([text]);
 assert.equal(view.run('Alt-1'),true);assert.deepEqual(view.folds(),[{from:'# First'.length,to:text.indexOf('\n# Next')}]);assert.equal(view.state.doc.toString(),text);
 assert.equal(view.run('Alt-2'),true);assert.deepEqual(view.folds(),[]);assert.equal(view.run('Alt-2'),false);
 view.select(text.indexOf('## Child'));assert.equal(view.run('Alt-1'),true);assert.deepEqual(view.folds(),[{from:text.indexOf('\nchild body'),to:text.indexOf('\n# Next')}]);
});
test('Setext headings fold with the same native service; empty headings do not hide a sibling',()=>{
 const text='Title\n=====\n\nbody\n\nNext\n====\n\nnext body',view=editor([text]);assert.equal(view.run('Alt-1'),true);assert.deepEqual(view.folds(),[{from:text.indexOf('\n'),to:text.indexOf('\n\nNext')}]);view.run('Alt-2');
 const empty=editor(['# Empty\n# Next\ntext']);assert.equal(empty.run('Alt-1'),false);assert.deepEqual(empty.folds(),[]);
});
test('fold state maps through edits without changing authored glyph references or content',()=>{
 const glyph={glyph:'{"born":1,"at":[0,0,0]}',word:'shape'},view=editor(['# Header\nbody ',glyph,'\n# Next\ntext']),before=fromSource(sliceSource(view.state));
 view.run('Alt-1');assert.deepEqual(fromSource(sliceSource(view.state)),before);const old=view.folds()[0];view.dispatch({changes:{from:0,insert:'prefix\n'}});assert.deepEqual(view.folds(),[{from:old.from+7,to:old.to+7}]);view.select(7);view.run('Alt-2');assert.deepEqual(view.folds(),[]);assert.deepEqual(fromSource(sliceSource(view.state)).content,['prefix\n# Header\nbody ',glyph,'\n# Next\ntext']);
});
test('fold shortcuts use the existing Document binding store and can be reassigned independently',()=>{
 const before=shortcuts.getSnapshot();try{shortcuts.restore({});const definitions=documentBindings(documentFoldBindings,false).map(row=>row.definition);assert.deepEqual(definitions.map(d=>d.id),['Alt+1','Alt+2']);shortcuts.assign(definitions[0],'Alt+9',definitions);assert.equal(remapDocumentBindings(documentFoldBindings)[0].key,'Alt-9');assert.equal(remapDocumentBindings(documentFoldBindings)[1].key,'Alt-2');}finally{shortcuts.restore(before);}
});
