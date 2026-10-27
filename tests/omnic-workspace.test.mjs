import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyDocument,validateDocument,parseDocument} from '../src/graph/structural.ts';
import {createWorkspace,activeDocument,withActiveDocument,addWorkspaceAtlas,validateWorkspace,parseWorkspace,organizeObject,importWorkspaceAtlas,workspaceHistory,restoreWorkspaceHistory,validateFilter} from '../src/omnic/workspace.ts';
import {saveOmnicDefinition,forkOmnicDefinition} from '../src/omnic/document.ts';
import {createRecipe} from '../src/omnic/presets.ts';
import {evaluateRecipe} from '../src/omnic/evaluate.ts';
import {objectResolver,pruneObjectHistory} from '../src/omnic/revisions.ts';
import {createLibraryIndex,matchesLibrary} from '../src/omnic/libraryIndex.ts';
import {omnicAsset} from '../src/omnic/presentation.ts';
import {createActionHistory} from '../src/ui/actionHistory.ts';
import {parseBackendRequest} from '../supabase/functions/_shared/contracts.ts';

const entity=(id,omnic)=>({id,label:id,aliases:[],notes:'',...(omnic?{omnic}:{})});
const placement=(id,entityId)=>({id,entityId,parentId:null,position:{x:0,y:0},collapsed:false,hidden:false});
const reference=(id,target,revision)=>({id,generator:'reference',params:{},reference:target,...(revision===undefined?{}:{referenceRevision:revision})});
const recipe=components=>({version:2,revision:1,components,operations:[],frames:[]});
function shared(){let doc={...emptyDocument(),entities:[entity('part'),entity('whole')]};doc=saveOmnicDefinition(doc,'part',createRecipe());return saveOmnicDefinition(doc,'whole',recipe([reference('use','part')]));}

test('migration keeps canonical IDs and exact atlas state, storing one canonical pool across atlases',()=>{
  const original={...shared(),placements:[placement('first','whole')]},before=JSON.stringify(original);
  const workspace=createWorkspace(original,'workspace','first-atlas');
  assert.equal(JSON.stringify(original),before);assert.equal(workspace.entities[1].id,'whole');
  assert.equal('entities' in workspace.atlases[0].document,false);assert.deepEqual(activeDocument(workspace).placements,original.placements);
  const second=addWorkspaceAtlas(workspace,'Second','second');
  assert.equal(activeDocument(second).entities,workspace.entities);assert.equal(second.atlases[0],workspace.atlases[0]);
  const changed=withActiveDocument(second,saveOmnicDefinition(activeDocument(second),'part',createRecipe('chain')));
  const first=activeDocument({...changed,activeAtlasId:'first-atlas'});
  assert.equal(evaluateRecipe(first.entities[1].omnic,objectResolver(first.entities)).properties.count,5);
  assert.equal(activeDocument({...changed,activeAtlasId:'first-atlas'}),first,'projection is cached by atlas and canonical pool');
});

test('workspace JSON round trips collections, families and canonical dependencies without duplicate definitions',()=>{
  let workspace=createWorkspace(shared(),'workspace','atlas');
  workspace.library.collections=[{id:'root',name:'Root',parentId:null},{id:'nested',name:'Nested',parentId:'root'}];
  workspace.library.families=[{id:'six',name:'Six units',filter:{countMin:6,countMax:6,motion:false}}];
  workspace=organizeObject(workspace,'whole',{collections:['root','nested'],tags:['reusable','example'],preset:true});
  const restored=parseWorkspace(JSON.stringify(workspace));assert.deepEqual(restored,workspace);
  assert.equal(restored.entities.filter(e=>e.id==='whole').length,1);
  const bad=structuredClone(workspace);bad.library.collections[0].parentId='nested';assert.throws(()=>validateWorkspace(bad),/cycle/);
  assert.throws(()=>organizeObject(workspace,'whole',{tags:['x'.repeat(101)]}),/organization/);
  assert.throws(()=>parseWorkspace(' '.repeat(8_000_001)),/8 MB/);
});

test('deleting an identity used by another atlas rejects the entire change',()=>{
  const workspace=createWorkspace({...shared(),placements:[placement('here','whole')]},'workspace','one');
  const second=addWorkspaceAtlas(workspace,'Second','two'),next={...activeDocument(second),entities:[]};
  assert.throws(()=>withActiveDocument(second,next),/Missing placement entity/);
  assert.equal(workspace.entities.length,2);
});

test('saved revisions freeze dependency versions while live references continue following shared edits',()=>{
  const initial=shared(),whole=initial.entities.find(e=>e.id==='whole');
  assert.equal(whole.omnic.components[0].referenceRevision,undefined);
  assert.equal(whole.omnicHistory[0].components[0].referenceRevision,1);
  const updated=saveOmnicDefinition(initial,'part',createRecipe('chain')),resolve=objectResolver(updated.entities);
  assert.equal(evaluateRecipe(whole.omnic,resolve).properties.count,5);
  assert.equal(evaluateRecipe(whole.omnicHistory[0],resolve).properties.count,6);
  const pinned=saveOmnicDefinition(updated,'whole',recipe([reference('use','part',1)]));
  assert.equal(evaluateRecipe(pinned.entities.find(e=>e.id==='whole').omnic,objectResolver(pinned.entities)).properties.count,6);
  assert.deepEqual(parseDocument(JSON.stringify(pinned)).entities,pinned.entities);
  assert.throws(()=>saveOmnicDefinition(pinned,'whole',recipe([reference('use','part',999)])),/Missing Omnic object or revision/);
});

test('a frozen prior revision can reference its own object without creating a live cycle',()=>{
  let doc=saveOmnicDefinition({...emptyDocument(),entities:[entity('self')]},'self',createRecipe());
  doc=saveOmnicDefinition(doc,'self',recipe([reference('previous','self',1)]));
  assert.equal(evaluateRecipe(doc.entities[0].omnic,objectResolver(doc.entities)).properties.count,6);
  assert.throws(()=>saveOmnicDefinition(doc,'self',recipe([reference('bad','self')])),/Circular/);
});

test('unreferenced history is bounded but pinned old revisions survive later saves',()=>{
  let doc=shared();doc=saveOmnicDefinition(doc,'whole',recipe([reference('use','part',1)]));
  for(let i=0;i<40;i++)doc=saveOmnicDefinition(doc,'part',createRecipe(i%2?'chain':'radial'));
  const part=doc.entities.find(e=>e.id==='part');assert.ok(part.omnicHistory.length<=32);
  assert.ok(part.omnicHistory.some(r=>r.revision===1));
  assert.equal(evaluateRecipe(doc.entities.find(e=>e.id==='whole').omnic,objectResolver(doc.entities)).properties.count,6);
});

test('restoring a revision creates a new revision; explicit copy creates a separate identity',()=>{
  const initial=shared(),changed=saveOmnicDefinition(initial,'part',createRecipe('chain'));
  const part=changed.entities.find(e=>e.id==='part'),restored=saveOmnicDefinition(changed,'part',part.omnicHistory[0]);
  assert.equal(restored.entities.find(e=>e.id==='part').omnic.revision,3);
  assert.equal(evaluateRecipe(restored.entities.find(e=>e.id==='part').omnic).properties.count,6);
  const copy=forkOmnicDefinition(restored,'part',part.omnicHistory[0],'Copy','copy');assert.equal(copy.entities.at(-1).omnic.revision,1);assert.equal(copy.entities.at(-1).id,'copy');
});

test('structural index reuses unchanged facts and invalidates live dependencies without evaluating during queries',()=>{
  const initial=shared(),index=createLibraryIndex(),whole=initial.entities.find(e=>e.id==='whole');
  const one=index.update(whole,initial.entities);assert.equal(one.facts.count,6);
  assert.equal(index.update({...whole,label:'Renamed'},initial.entities),one);
  const updated=saveOmnicDefinition(initial,'part',createRecipe('chain')),two=index.update(whole,updated.entities);
  assert.notEqual(two,one);assert.equal(two.facts.count,5);
  const item={entityId:'whole',collections:['c'],tags:['sample'],preset:false};
  assert.equal(matchesLibrary(whole,item,two,{tags:['sample'],collection:'c',generator:'chain',countMin:5,countMax:5}),true);
  assert.equal(matchesLibrary(whole,item,two,{countMin:6}),false);
  assert.equal(matchesLibrary(whole,item,undefined,{text:'whole'}),true);
  assert.equal(matchesLibrary(whole,item,undefined,{countMin:0}),false,'uncomputed is never treated as zero');
  assert.throws(()=>validateFilter({countMin:4,countMax:2}),/exceeds/);
});

test('numeric parameter filters use declared metadata and do not infer authored semantics from geometry',()=>{
  const doc=shared(),part=doc.entities.find(e=>e.id==='part'),entry=createLibraryIndex().update(part,doc.entities);
  assert.equal(matchesLibrary(part,undefined,entry,{parameter:{property:'omnic.radius',min:39,max:41}}),true);
  assert.equal(matchesLibrary(part,undefined,entry,{motion:true}),false);
  assert.equal(matchesLibrary(part,undefined,entry,{tags:['a meaning nobody authored']}),false);
});

test('independent atlas import remaps canonical identities, pinned dependencies and role targets',()=>{
  const doc=shared();doc.placements=[placement('p','whole')];
  const whole=doc.entities.find(e=>e.id==='whole');whole.omnic.operations=[{id:'pick',operator:'select',enabled:true,params:{},targets:['use:ref:part/radial:unit:0']}];
  let n=0;const workspace=createWorkspace(doc,'ws','atlas'),imported=importWorkspaceAtlas(workspace,doc,'Imported',()=>`import-${++n}`);
  const active=activeDocument(imported),copy=active.entities.find(e=>e.id==='import-2');
  assert.equal(imported.atlases.length,2);assert.equal(active.placements[0].entityId,'import-2');
  assert.equal(copy.omnic.components[0].reference,'import-1');assert.equal(copy.omnic.operations[0].targets[0],'use:ref:import-1/radial:unit:0');
  assert.equal(evaluateRecipe(copy.omnic,objectResolver(active.entities)).selection.length,1);
  assert.equal(workspace.entities.length,2);assert.equal(imported.entities.length,4);
});

test('workspace history safely undoes canonical changes after switching atlases',()=>{
  let state=addWorkspaceAtlas(createWorkspace(shared(),'ws','one'),'Second','two');
  const history=createActionHistory();history.register('omnium',{read:()=>workspaceHistory(state),write:value=>{state=restoreWorkspaceHistory(state,value);}});
  const next=withActiveDocument(state,saveOmnicDefinition(activeDocument(state),'part',createRecipe('chain')));
  history.record('omnium',workspaceHistory(state),workspaceHistory(next),['omnium'],['omnium']);state={...next,activeAtlasId:'one'};
  const beforeRevision=activeDocument(state).revision;
  assert.equal(history.travel('undo'),1);assert.equal(state.activeAtlasId,'one');assert.equal(evaluateRecipe(state.entities[0].omnic).properties.count,6);assert.ok(activeDocument(state).revision>beforeRevision,'AI change-set guards keep a monotone local document revision');
  assert.equal(history.travel('redo'),1);assert.equal(evaluateRecipe(state.entities[0].omnic).properties.count,5);
});

test('workspace cloud contract separates server concurrency from local document revisions',()=>{
  const input={operation:'workspace.save',workspaceId:crypto.randomUUID(),requestId:crypto.randomUUID(),expectedVersion:0,snapshot:createWorkspace()};
  assert.deepEqual(parseBackendRequest(input),input);assert.throws(()=>parseBackendRequest({...input,expectedVersion:-1}));
  assert.throws(()=>parseBackendRequest({...input,actor:'cannot choose another user'}));
});

test('presentation responds to a new dependency branch that reuses an undone revision number',()=>{
  const initial=shared(),old=saveOmnicDefinition(initial,'part',createRecipe('chain'));
  const asset=omnicAsset(old,'whole');
  const different=saveOmnicDefinition(initial,'part',createRecipe('boundary'));
  assert.equal(old.entities[0].omnic.revision,different.entities[0].omnic.revision);
  assert.notEqual(omnicAsset(different,'whole').dataUrl,asset.dataUrl);
});

test('explicit history pruning preserves incoming pins and frees unreferenced snapshots',()=>{
  let doc=shared();doc=saveOmnicDefinition(doc,'whole',recipe([reference('use','part',1)]));
  doc=saveOmnicDefinition(doc,'part',createRecipe('chain'));
  const preserved=pruneObjectHistory(doc.entities,'part');assert.deepEqual(preserved.find(e=>e.id==='part').omnicHistory.map(r=>r.revision),[1,2]);
  doc=saveOmnicDefinition({...doc,entities:preserved},'whole',createRecipe('chain'));
  doc={...doc,entities:pruneObjectHistory(doc.entities,'whole')};
  const pruned=validateDocument({...doc,entities:pruneObjectHistory(doc.entities,'part')});
  assert.deepEqual(pruned.entities.find(e=>e.id==='part').omnicHistory.map(r=>r.revision),[2]);
});

test('atlas role remapping follows actual references even when unrelated legacy IDs share prefixes',()=>{
  const leaf=recipe([{id:'b/shape',generator:'dot',params:{}}]);
  const root=recipe([reference('use','a')]);root.operations=[{id:'pick',operator:'select',enabled:true,params:{},targets:['use:ref:a/b/shape:shape']}];
  const doc={...emptyDocument(),entities:[entity('a',leaf),entity('a/b',createRecipe()),entity('root',root)]};
  let number=0;const copied=importWorkspaceAtlas(createWorkspace(),doc,'Imported',()=>`copy-${++number}`),copy=copied.entities.find(e=>e.label==='root');
  assert.equal(copy.omnic.operations[0].targets[0],'use:ref:copy-1/b/shape:shape');
  assert.deepEqual(evaluateRecipe(copy.omnic,objectResolver(copied.entities)).selection,['use:ref:copy-1/b/shape:shape']);
});

 test('versioned pin semantics retain legacy imports and prevent older readers from silently following a pin',async()=>{
  const {validateRecipe}=await import('../src/omnic/model.ts');
  assert.equal(validateRecipe(createRecipe()).version,1);
  const pinned=recipe([reference('reuse','part',1)]);assert.equal(validateRecipe(pinned).version,2);
  assert.throws(()=>validateRecipe({...pinned,version:1}),/version 2/);
  assert.equal(createWorkspace(shared()).entities[0].omnic.version,2);
});
