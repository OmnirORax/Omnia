import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorld,validateWorld} from '../src/core/model.ts';
import {createStore} from '../src/core/store.ts';

test('retired VFX configuration is discarded while normal appearance survives loading',()=>{
 const world=emptyWorld();
 world.appearance.text={color:'#abcdef',glow:.6,font:'serif'};
 world.appearance.animations={'text.nodes':{effect:'electric-text',speed:.8},'workspace.background':{effect:'stars'}};
 const checked=validateWorld(JSON.parse(JSON.stringify(world)));
 assert.equal('animations' in checked.appearance,false);
 assert.deepEqual(checked.appearance.text,world.appearance.text);
});
test('old VFX saves load normally and subsequent color edits retain undo/redo',()=>{
 const saved=emptyWorld();saved.appearance.animations={'text.nodes':{effect:'electric-text'}};
 const storage=new Map([['omnium.v2.world.2',JSON.stringify(saved)]]);
 const store=createStore({getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)});
 assert.equal(store.message,'');assert.equal('animations' in store.world.appearance,false);
 const before=structuredClone(store.world.appearance.text);
 store.change(world=>{world.appearance.text={...world.appearance.text,color:'#123456'};});
 assert.equal(store.world.appearance.text.color,'#123456');
 store.undo();assert.deepEqual(store.world.appearance.text,before);
 store.redo();assert.equal(store.world.appearance.text.color,'#123456');
});

test('appearance consumers expose normal glow and paint without any VFX properties',async()=>{
 const {TARGETS,PROPERTIES,loadController,RETIRED_VFX_PROPERTIES}=await import('../src/composer/runtime/appearance/registry.ts');
 const targets=TARGETS.filter(target=>target.properties?.length);
 assert.ok(targets.some(target=>target.properties.includes('glow')));
 assert.ok(targets.every(target=>target.properties.every(property=>!RETIRED_VFX_PROPERTIES.includes(property))));
 assert.ok(PROPERTIES.every(property=>!RETIRED_VFX_PROPERTIES.includes(property.id)));
 const state=loadController({version:1,values:{'text.nodes':{color:'#abcdef',glow:.5,effect:'electric-text',effectGlow:1}}});
 assert.deepEqual(state.values['text.nodes'],{color:'#abcdef',glow:.5});
});
