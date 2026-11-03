import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyDocument, parseDocument, validateDocument } from '../src/graph/structural.ts';
import { saveOmnicDefinition, forkOmnicDefinition } from '../src/omnic/document.ts';

const recipe = (components = [{id:'dot',generator:'dot',params:{}}]) => ({version:1,revision:0,components,operations:[],frames:[]});
const entity = (id,omnic) => ({id,label:id,aliases:[],notes:'',...(omnic ? {omnic} : {})});
const placement = (id,entityId) => ({id,entityId,parentId:null,position:{x:0,y:0},spatialPosition:{x:0,y:0,z:0},collapsed:false,hidden:false});
const reference = id => ({id:`ref-${id}`,generator:'reference',reference:id,params:{}});
const fixture = () => ({...emptyDocument(), entities:[entity('shared')], placements:[placement('first','shared'),placement('second','shared')]});

test('one canonical Omnic definition is shared by placements and saved without duplicating identity', () => {
  const before = fixture(), snapshot = JSON.stringify(before);
  const first = saveOmnicDefinition(before,'shared',recipe());
  assert.equal(first.entities.length,1);assert.equal(first.entities[0].omnic.revision,1);
  assert.equal(first.placements,before.placements);assert.equal(first.compositions,before.compositions);
  const changed = recipe([{id:'ring',generator:'ring',params:{}}]);
  const next = saveOmnicDefinition(first,'shared',changed);
  assert.equal(next.entities[0].id,'shared');assert.equal(next.entities[0].omnic.revision,2);
  assert.deepEqual(next.placements.map(p=>p.entityId),['shared','shared']);
  assert.equal(next.revision,before.revision,'the existing document owner increments its own revision');
  assert.equal(JSON.stringify(before),snapshot);assert.equal(changed.revision,0);
  changed.components[0].params.size=999;
  assert.notEqual(next.entities[0].omnic.components[0].params.size,999,'caller draft is not retained by reference');
});

test('explicit copy creates a new canonical identity, preserving existing shared definitions and references', () => {
  const base={...fixture(),entities:[entity('shared'),entity('part',recipe())]};
  const first=saveOmnicDefinition(base,'shared',recipe([reference('part')]));
  const next=forkOmnicDefinition(first,'shared',first.entities[0].omnic,'Derived','derived');
  assert.equal(next.entities.length,3);assert.equal(next.entities[0],first.entities[0]);
  assert.equal(next.entities[2].id,'derived');assert.equal(next.entities[2].label,'Derived');
  assert.equal(next.entities[2].omnic.revision,1);
  assert.notEqual(next.entities[2].omnic,next.entities[0].omnic);
  assert.equal(next.entities[2].omnic.components[0].reference,'part');
  const changed=saveOmnicDefinition(next,'derived',recipe());
  assert.equal(changed.entities[0],next.entities[0]);assert.equal(changed.entities[2].omnic.revision,2);
  assert.throws(()=>forkOmnicDefinition(next,'shared',recipe(),'Duplicate','shared'),/already exists/);
});

test('Omnic definitions round trip through atlas import while legacy objects remain compatible', () => {
  const old=fixture();assert.deepEqual(validateDocument(old),old);
  const plain=parseDocument(JSON.stringify(old));assert.equal(plain.entities[0].omnic,undefined);
  const withDefinition=saveOmnicDefinition(old,'shared',recipe());
  const parsed=parseDocument(JSON.stringify(withDefinition));
  assert.deepEqual(parsed.entities,withDefinition.entities);assert.deepEqual(parsed.placements,withDefinition.placements);
});

test('missing canonical recipe references and circular compositions reject the whole candidate document', () => {
  const missing={...fixture(),entities:[entity('shared',recipe([reference('missing')]))]};
  assert.throws(()=>validateDocument(missing),/Missing Omnic object/);
  const plainReference={...fixture(),entities:[entity('shared',recipe([reference('plain')])),entity('plain')]};
  assert.throws(()=>validateDocument(plainReference),/Missing Omnic object/);
  const cycle={...fixture(),entities:[entity('shared',recipe([reference('part')])),entity('part',recipe([reference('shared')]))]};
  assert.throws(()=>validateDocument(cycle),/Circular Omnic reference/);
  const valid={...fixture(),entities:[entity('shared',recipe([reference('part')])),entity('part',recipe())]};
  validateDocument(valid);
  assert.throws(()=>validateDocument({...valid,entities:valid.entities.filter(e=>e.id!=='part')}),/Missing Omnic object/);
  assert.throws(()=>saveOmnicDefinition(valid,'absent',recipe()),/Missing Omnium object/);
  assert.throws(()=>saveOmnicDefinition(valid,'part',recipe([reference('shared')])) ,/Circular Omnic reference/);
});

// User-authored lexical equivalence is independent of structural recipe identity.
import { compileLexicon, normalizeText, validateNodeText, TEXT_LIMIT, GLYPH_LIMIT } from '../src/text/model.ts';
import { createWorkspace, importWorkspaceAtlas, activeDocument, parseWorkspace } from '../src/omnic/workspace.ts';

test('paste annotation preserves spelling, punctuation, whitespace and independent glyphs', () => {
  const annotate=compileLexicon([{...entity('create',recipe()),lexiconWords:['create','make','produce']}]);
  const mixed=annotate('Make, create!\n  produce\t maker CREATE.');
  assert.deepEqual(mixed.content,[{glyph:'create'},'Make, ',{glyph:'create'},'create!\n  ',{glyph:'create'},'produce\t maker ',{glyph:'create'},'CREATE.']);
  assert.equal(mixed.content.filter(p=>typeof p==='string').join(''),'Make, create!\n  produce\t maker CREATE.');
  // Removing all English leaves real canonical references, not annotation markup.
  const final=normalizeText(mixed.content.filter(p=>typeof p!=='string'));
  validateNodeText(final,new Set(['create']));assert.equal(final.content.length,4);
});

test('lexicon uses longest explicit phrases, whole words, Unicode and skips conflicts', () => {
  const annotate=compileLexicon([
    {...entity('short',recipe()),lexiconWords:['make','can','café']},
    {...entity('long',recipe()),lexiconWords:['make up']},
    {...entity('conflict',recipe()),lexiconWords:['can']},
  ]);
  assert.deepEqual(annotate("MAKE up, maker can can't CAFÉ").content,[{glyph:'long'},"MAKE up, maker can can't ",{glyph:'short'},'CAFÉ']);
  assert.deepEqual(annotate('make\nup').content,[{glyph:'short'},'make\nup']);
  assert.deepEqual(compileLexicon([{...entity('same',recipe()),lexiconWords:['make','MAKE']}])('Make').content,[{glyph:'same'},'Make']);
});

test('mixed documents round trip with lexicon and share glyphs across atlas import', () => {
  const source={...fixture(),entities:[{...entity('shared'),text:{version:1,content:['English ',{glyph:'glyph'},'\n']}},{...entity('glyph',recipe()),lexiconWords:['make','create']}]};
  assert.deepEqual(parseDocument(JSON.stringify(source)),source);
  const workspace=createWorkspace(source);
  assert.deepEqual(parseWorkspace(JSON.stringify(workspace)).entities,workspace.entities);
  let counter=0;const imported=importWorkspaceAtlas(workspace,source,'Imported',()=>`new-${++counter}`);
  const doc=activeDocument(imported),body=doc.entities.find(e=>e.id==='new-1');
  assert.deepEqual(body.text.content,['English ',{glyph:'new-2'},'\n']);
  assert.deepEqual(doc.entities.find(e=>e.id==='new-2').lexiconWords,['make','create']);
  assert.deepEqual(workspace.entities.find(e=>e.id==='shared').text,source.entities[0].text,'original document is untouched');
  assert.throws(()=>validateDocument({...source,entities:[source.entities[0]]}),/missing Omnic object/);
});

test('untrusted documents reject missing objects, oversized text, glyph floods and invalid word mappings', () => {
  assert.throws(()=>validateNodeText({version:1,content:[{glyph:'missing'}]},new Set()),/missing Omnic/);
  assert.throws(()=>validateNodeText({version:1,content:[{glyph:'ok',html:'<script>'}]},new Set(['ok'])),/missing Omnic/);
  assert.throws(()=>validateNodeText({version:1,content:['x'.repeat(TEXT_LIMIT+1)]},new Set()),/limit/);
  assert.throws(()=>validateNodeText({version:1,content:Array.from({length:GLYPH_LIMIT+1},()=>({glyph:'ok'}))},new Set(['ok'])),/limit/);
  assert.throws(()=>validateDocument({...fixture(),entities:[{...entity('shared'),lexiconWords:['create']}]}),/lexicon/);
  assert.throws(()=>compileLexicon([])('x'.repeat(TEXT_LIMIT+1)),/Paste exceeds/);
});
