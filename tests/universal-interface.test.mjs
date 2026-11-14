import test from 'node:test';
import assert from 'node:assert/strict';
import {universalHistory as history,travelGlobalHistory} from '../src/core/universalHistory.ts';
import {nativeLayout,nativeAppearance,updateNativeLayout,updateNativeAppearance} from '../src/composer/runtime/historyBridge.ts';
import {emptyController} from '../src/composer/runtime/appearance/model.ts';
import {contextEditTargets} from '../src/omnic/componentTargets.ts';

test('V1 interface boundary records non-window UI changes and appearance in one global timeline',()=>{
 updateNativeLayout(layout=>({...layout,panels:{...layout.panels,'@mode':true}}));
 updateNativeLayout(layout=>({...layout,labels:{...layout.labels,scene:'Sky'}}));
 const controller=emptyController();updateNativeAppearance(controller);
 let camera={distance:10};history.register('test.camera',{read:()=>camera,write:value=>camera=value});
 const before=camera;camera={distance:4};history.record('test.camera',before,camera,['camera'],['omnium']);
 history.configure({mode:'context',categories:['settings']});history.activeContext='unrelated';
 assert.equal(history.candidates('undo').length,0);
 assert.equal(travelGlobalHistory('undo'),1);assert.equal(camera.distance,10);
 travelGlobalHistory('undo');assert.equal(nativeAppearance.getSnapshot(),undefined);
 travelGlobalHistory('undo');assert.equal(nativeLayout.getSnapshot().labels?.scene,undefined);
 travelGlobalHistory('undo');assert.equal(nativeLayout.getSnapshot().panels['@mode'],undefined);
 for(let i=0;i<4;i++)assert.equal(travelGlobalHistory('redo'),1);
 assert.equal(nativeLayout.getSnapshot().labels.scene,'Sky');assert.equal(nativeLayout.getSnapshot().panels['@mode'],true);assert.deepEqual(nativeAppearance.getSnapshot(),controller);assert.equal(camera.distance,4);
});

test('context menus require a hit; active components cannot claim empty space or another component',()=>{
 const recipe={components:[{id:'a'},{id:'group',generator:'group',children:[{id:'child'}]},{id:'b'}]};
 assert.deepEqual(contextEditTargets(recipe,['a'],[]),[]);
 assert.deepEqual(contextEditTargets(recipe,['a'],['missing']),[]);
 assert.deepEqual(contextEditTargets(recipe,['a'],['b']),['b']);
 assert.deepEqual(contextEditTargets(recipe,['a','b'],['a']),['a','b']);
 assert.deepEqual(contextEditTargets(recipe,['group'],['child']),['group']);
});
