import test from 'node:test';
import assert from 'node:assert/strict';
import {EditorState} from '@codemirror/state';
import {addStructure,emptyWorld} from '../src/core/model.ts';
import {documentSearchPattern,firstDocumentMatch,searchNodeDocuments} from '../src/text/worldSearch.ts';
import {toSource} from '../src/text/source.ts';

function addDocument(world,label,content){
 const node=addStructure(world,[world.nodes.length*2,0,0],world.nodes.length+1);
 node.label=label;
 node.text={version:1,content};
 return node;
}

test('world search finds document text across hidden nodes and variant overrides',()=>{
 const world=emptyWorld(),owner=addDocument(world,'Owner',['The first [needle].']);
 owner.hidden=true;owner.collapsed=true;
 const variant=addDocument(world,'Variant',['Different text']);
 variant.variantOf=owner.origin;variant.overrides=['label'];
 addDocument(world,'[Needle]',['Only the name matches']);
 const other=addDocument(world,'Other',['A second [NEEDLE] here.']);
 const origins=()=>searchNodeDocuments(world,' [needle] ').matches.map(match=>match.origin);
 assert.deepEqual(origins(),[owner.origin,variant.origin,other.origin]);
 variant.overrides.push('text');
 assert.deepEqual(origins(),[owner.origin,other.origin]);
 assert.deepEqual(searchNodeDocuments(world,'  ').matches,[]);
});

test('a world result and its editor select the same literal phrase in mixed text',()=>{
 const world=emptyWorld(),glyph=addDocument(world,'Glyph',[]);
 const node=addDocument(world,'Notes',['Before ',{glyph:JSON.stringify(glyph.origin)},'\r\nfind this. find this.']);
 const results=searchNodeDocuments(world,'FIND THIS.');
 assert.equal(results.matches.length,1);
 assert.equal(results.matches[0].snippet,'Before • find this. find this.');
 const editor=EditorState.create({doc:toSource(node.text).text});
 const hit=firstDocumentMatch(documentSearchPattern('FIND THIS.'),editor.doc.toString());
 assert.deepEqual([hit.from,hit.to],[9,19]);
 assert.equal(editor.sliceDoc(hit.from,hit.to),'find this.');
});

test('a broad search bounds the number of rows and reports overflow',()=>{
 const world=emptyWorld();
 for(let i=0;i<50;i++)addDocument(world,`Note ${i}`,['common']);
 assert.equal(searchNodeDocuments(world,'common').truncated,false);
 addDocument(world,'Another note',['common']);
 const hits=searchNodeDocuments(world,'common');
 assert.equal(hits.matches.length,50);
 assert.equal(hits.truncated,true);
});
