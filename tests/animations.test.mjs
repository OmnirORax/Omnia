import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorld,validateWorld} from '../src/core/model.ts';
import {createStore} from '../src/core/store.ts';
import {ANIMATION_TARGETS,animationProperties} from '../src/properties/animations.ts';
import {animationAppearance,animationValue} from '../src/world/animations.ts';
import {effectsFor} from '../src/composer/runtime/appearance/resolve.ts';
import {defaultSettings} from '../src/composer/runtime/workspaceActions.ts';

test('exposure preserves renderer defaults and edits independent live effect targets',()=>{
 const before=defaultSettings().appearance,defaults=animationAppearance();
 for(const target of ANIMATION_TARGETS)assert.deepEqual(effectsFor(defaults,target.id),effectsFor(before,target.id));
 const animations={'text.nodes':{effect:'electric-text',speed:.8,effectColor:'#aabbcc'},'omnium.nodes.body':{effect:'off'}};
 const theme=animationAppearance(animations);
 assert.equal(effectsFor(theme,'text.nodes').effect,'electric-text');
 assert.equal(effectsFor(theme,'text.nodes').motion,.8);
 assert.equal(effectsFor(theme,'text.nodes').color,'#aabbcc');
 assert.equal(effectsFor(theme,'omnium.nodes.body').effect,'off');
 assert.deepEqual(effectsFor(theme,'text.binders'),effectsFor(before,'text.binders'));
 assert.equal(animationValue(undefined,'text.nodes','speed'),before.motion);
});

test('animation edits survive saved world validation, reload, undo, reset and redo',()=>{
 const saved=new Map(),store=createStore({getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value)});
 store.change(world=>{world.appearance.animations={'text.nodes':{effect:'electric-text',density:.6}};});
 const restored=createStore({getItem:key=>saved.get(key)??null,setItem:()=>{}}).world;
 assert.deepEqual(validateWorld(JSON.parse(JSON.stringify(restored))).appearance.animations,store.world.appearance.animations);
 store.undo();assert.equal(store.world.appearance.animations,undefined);
 store.redo();assert.equal(store.world.appearance.animations['text.nodes'].effect,'electric-text');
 store.change(world=>{delete world.appearance.animations['text.nodes'];});
 assert.deepEqual(effectsFor(animationAppearance(store.world.appearance.animations),'text.nodes'),effectsFor(defaultSettings().appearance,'text.nodes'));
});

test('only existing renderer targets and valid existing effect parameters are accepted',()=>{
 for(const animations of [[],null,{'text.ui.body':{effect:'stars'}},{'text.nodes':null},{'text.nodes':{speed:Infinity}},{'text.nodes':{speed:2}},{'text.nodes':{effect:'invalid'}},{'text.nodes':{effectColor:'red'}},{'text.nodes':{unknown:1}},{'omnium.nodes.body':{effect:'electric-text'}}]){
  const world=emptyWorld();world.appearance.animations=animations;assert.throws(()=>validateWorld(world),/Invalid animation/);
 }
 assert.ok(animationProperties('text.nodes').find(p=>p.key==='effect').options.some(p=>p.id==='electric-text'));
 assert.ok(!animationProperties('omnium.nodes.body').find(p=>p.key==='effect').options.some(p=>p.id==='electric-text'));
 const allOff=Object.fromEntries(ANIMATION_TARGETS.map(target=>[target.id,{effect:'off'}]));
 for(const target of ANIMATION_TARGETS)assert.equal(effectsFor(animationAppearance(allOff),target.id).effect,'off');
});
