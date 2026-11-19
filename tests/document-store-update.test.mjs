import test from 'node:test';
import assert from 'node:assert/strict';
import {createStore} from '../src/core/store.ts';
import {addStructure,validateWorld} from '../src/core/model.ts';
import {createActionHistory} from '../src/composer/runtime/ui/actionHistory.ts';

test('scoped document edits preserve unrelated object identities, publish their scope, save and undo',()=>{
 const journal=createActionHistory({mode:'recent',categories:['omnium']}),saved=new Map();
 const store=createStore({getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value)},journal);
 let origin;store.change(world=>{origin=addStructure(world,[0,0,0],1).origin;addStructure(world,[4,0,0],2);});
 const before=store.world,events=[];store.subscribe(reason=>events.push(reason));
 const text={version:1,content:['one two three']};store.changeDocument(origin,text,'document:test');
 assert.equal(events.at(-1),'document');assert.notEqual(store.world.nodes[0],before.nodes[0]);assert.equal(store.world.nodes[1],before.nodes[1]);assert.equal(store.world.appearance,before.appearance);assert.equal(store.world.scene,before.scene);
 assert.equal(before.nodes[0].text,undefined);text.content[0]='external mutation';assert.equal(store.world.nodes[0].text.content[0],'one two three');
 validateWorld(JSON.parse([...saved.values()].at(-1)));store.undo();assert.equal(store.world.nodes[0].text,undefined);assert.equal(events.at(-1),undefined);store.redo();assert.equal(store.world.nodes[0].text.content[0],'one two three');
});
test('scoped document edits validate references atomically and preserve variant text overrides',()=>{
 const store=createStore({getItem:()=>null,setItem(){}});let origin;store.change(world=>{const base=addStructure(world,[0,0,0],1),variant=addStructure(world,[3,0,0],2);variant.variantOf=base.origin;origin=variant.origin;});
 const before=store.world;assert.throws(()=>store.changeDocument(origin,{version:2,content:[]}),/Invalid/);assert.equal(store.world,before);
 store.changeDocument(origin,{version:1,content:['variant']});assert.ok(store.world.nodes[1].overrides.includes('text'));validateWorld(store.world);
});
