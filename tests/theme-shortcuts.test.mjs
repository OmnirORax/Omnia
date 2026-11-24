import test from 'node:test';import assert from 'node:assert/strict';
import {createReleaseShortcuts} from '../src/ui/releaseShortcuts.ts';
import {createThemeShortcutCommands} from '../src/scene/themeShortcuts.ts';
import {installHistoryBindings} from '../src/ui/historyBindings.ts';
const key=(key,mods={})=>({key,code:key.length===1?`Key${key}`:key,ctrlKey:false,metaKey:false,altKey:false,shiftKey:false,...mods});
const mouse=button=>Object.create({get button(){return button;},get ctrlKey(){return false;},get metaKey(){return false;},get shiftKey(){return false;},get altKey(){return false;}});
test('held theme side-button commands reuse release suppression and follow live key rebinding',()=>{
 const queue=createReleaseShortcuts(),calls=[];let binding='F6',opened=0;const commands=createThemeShortcutCommands(queue,()=>binding,kind=>calls.push(kind));queue.press(key('F6'),()=>opened++);assert.equal(commands.handle(mouse(3)),true);assert.equal(commands.handle(mouse(4)),true);queue.release(key('F6'));assert.deepEqual(calls,['macro','micro']);assert.equal(opened,0);assert.equal(commands.handle(mouse(3)),false);
 binding='Ctrl+K';queue.press(key('K',{ctrlKey:true}),()=>opened++);assert.equal(commands.handle(mouse(3)),true);queue.release(key('K'));assert.equal(opened,0);queue.press(key('F6'),()=>opened++);assert.equal(commands.handle(mouse(4)),false);queue.cancel();queue.press(key('K',{ctrlKey:true}),()=>opened++);queue.release(key('K'));assert.equal(opened,1);
});
test('the existing side-button gateway dispatches the held command once and preserves ordinary undo/redo',()=>{
 const old=globalThis.window,handlers=new Map(),queue=createReleaseShortcuts(),calls=[],commands=createThemeShortcutCommands(queue,()=> 'F6',kind=>calls.push(kind));globalThis.window={addEventListener(type,fn){handlers.set(type,[...(handlers.get(type)??[]),fn]);}};
 try{installHistoryBindings({undo:()=>calls.push('undo'),redo:()=>calls.push('redo'),configure:()=>calls.push('configure'),sideButton:event=>commands.handle(event)});const emit=(type,button)=>{const event=Object.assign(Object.create(mouse(button)),{preventDefault(){this.defaultPrevented=true;},stopImmediatePropagation(){this.stopped=true;}});for(const fn of handlers.get(type)??[]){fn(event);if(event.stopped)break;}return event;};
 queue.press(key('F6'),()=>calls.push('picker'));for(const button of [3,4]){emit('pointerdown',button);emit('mousedown',button);emit('pointerup',button);emit('mouseup',button);emit('auxclick',button);}queue.release(key('F6'));assert.deepEqual(calls,['macro','micro']);for(const button of [3,4]){emit('pointerdown',button);emit('mousedown',button);emit('pointerup',button);emit('mouseup',button);}assert.deepEqual(calls,['macro','micro','undo','redo']);
 }finally{globalThis.window=old;}
});
test('the free-key allocator reserves saved bindings belonging to unloaded shortcut catalogs',async()=>{const {createShortcutStore,assignAvailableDefault}=await import('../src/ui/shortcuts.ts'),{THEME_COLORS_SHORTCUT}=await import('../src/scene/themeShortcuts.ts'),store=createShortcutStore();store.initialize({getItem:()=>JSON.stringify({Omnic:{unloaded:'F6'}}),setItem(){}});assert.equal(assignAvailableDefault(store,THEME_COLORS_SHORTCUT,['F6','F7'],[THEME_COLORS_SHORTCUT]),'F7');assert.equal(store.getSnapshot().Omnic.unloaded,'F6');});
