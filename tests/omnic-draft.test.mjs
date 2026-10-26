import test from 'node:test';
import assert from 'node:assert/strict';
import {createActionHistory} from '../src/ui/actionHistory.ts';
import {createRecipe} from '../src/omnic/presets.ts';
import {preserveClosedComposerHistory,closedComposerDraft} from '../src/omnic/draftHistory.ts';
const normalized=recipe=>({...recipe,revision:0});
test('closing composer retains chronological undo and redo without mounted React state',()=>{
  const before=createRecipe(),after=structuredClone(before);after.components[0].params.count=12;
  const storage=new Map([['draft',JSON.stringify({recipe:after,baseRevision:7})]]);
  const adapter={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)};
  const history=createActionHistory();history.record('omnic.draft:closed',normalized(before),normalized(after),['omnium'],['window:omnic-composer']);
  const cleanup=preserveClosedComposerHistory(history,'omnic.draft:closed','draft',{recipe:after,baseRevision:7},adapter);
  assert.equal(history.travel('undo'),1);assert.deepEqual(closedComposerDraft('omnic.draft:closed').recipe,before);
  assert.equal(JSON.parse(storage.get('draft')).baseRevision,7);
  assert.equal(history.travel('redo'),1);assert.deepEqual(closedComposerDraft('omnic.draft:closed').recipe,after);cleanup();
});
test('failed local storage still permits closed-draft undo and reopening in memory',()=>{
  const before=createRecipe(),after=structuredClone(before);after.operations.push({id:'changed',operator:'rotate',targets:[],params:{angle:90},enabled:true});
  const history=createActionHistory();history.record('omnic.draft:memory',normalized(before),normalized(after),['omnium'],['window:omnic-composer']);
  const cleanup=preserveClosedComposerHistory(history,'omnic.draft:memory','draft',{recipe:after,baseRevision:3},{getItem:()=>{throw Error('blocked');},setItem:()=>{throw Error('blocked');}});
  assert.equal(history.travel('undo'),1);assert.deepEqual(closedComposerDraft('omnic.draft:memory').recipe,before);
  assert.equal(closedComposerDraft('omnic.draft:memory').baseRevision,3);assert.match(history.message,/in memory/);
  assert.equal(history.travel('redo'),1);assert.deepEqual(closedComposerDraft('omnic.draft:memory').recipe,after);cleanup();
});

test('closing before the last persistence effect flushes the current live draft',()=>{
  const before=createRecipe(),after=structuredClone(before);after.components[0].params.count=9;
  const values=new Map([['draft',JSON.stringify({recipe:before,baseRevision:1})]]);
  const history=createActionHistory();history.record('omnic.draft:latest',normalized(before),normalized(after),['omnium'],['window:omnic-composer']);
  const cleanup=preserveClosedComposerHistory(history,'omnic.draft:latest','draft',{recipe:after,baseRevision:1},{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)});
  assert.deepEqual(closedComposerDraft('omnic.draft:latest').recipe,after);assert.equal(history.travel('undo'),1);cleanup();
});
