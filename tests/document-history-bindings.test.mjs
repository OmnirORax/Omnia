import test from 'node:test';import assert from 'node:assert/strict';
import {EditorState} from '@codemirror/state';import {keymap,runScopeHandlers} from '@codemirror/view';import {historyKeymap} from '@codemirror/commands';
import {documentHistoryBindings} from '../src/text/historyBindings.ts';
import {remapDocumentBindings} from '../src/text/shortcutBindings.ts';
import {shortcuts} from '../src/ui/shortcuts.ts';
const event=(key,shiftKey=false)=>({key,keyCode:key.toUpperCase().charCodeAt(0),ctrlKey:true,metaKey:false,altKey:false,shiftKey,preventDefault(){}});
test('every platform redo alias reaches the same universal history as document undo',()=>{
 shortcuts.initialize({getItem:()=>null,setItem(){}});const calls=[],bindings=remapDocumentBindings(documentHistoryBindings(historyKeymap,direction=>calls.push(direction)));
 const state=EditorState.create({extensions:[keymap.of(bindings)]}),view={state};
 assert.equal(runScopeHandlers(view,event('z'),'editor'),true);assert.deepEqual(calls,['undo']);
 assert.equal(runScopeHandlers(view,event('Z',true),'editor'),true);assert.deepEqual(calls,['undo','redo']);
});
test('rebinding redo to Ctrl+Shift+Z swaps its alias without leaving either chord on editor-local history',()=>{
 const redo={category:'Document',id:'Ctrl+Y',label:'Redo',defaultKey:'Ctrl+Y'},alternate={category:'Document',id:'Ctrl+Shift+Z',label:'Redo',defaultKey:'Ctrl+Shift+Z'};
 shortcuts.initialize({getItem:()=>null,setItem(){}});
 try{
  shortcuts.assign(redo,'Ctrl+Shift+Z',[redo,alternate]);const calls=[],bindings=documentHistoryBindings(historyKeymap,direction=>calls.push(direction)),state=EditorState.create({extensions:[keymap.of(remapDocumentBindings(bindings))]});
  assert.equal(runScopeHandlers({state},event('Z',true),'editor'),true);assert.deepEqual(calls,['redo']);
  assert.equal(runScopeHandlers({state},event('y'),'editor'),true);assert.deepEqual(calls,['redo','redo']);
  shortcuts.assign(redo,'Ctrl+J',[redo,alternate]);const rebound=EditorState.create({extensions:[keymap.of(remapDocumentBindings(bindings))]});
  assert.equal(runScopeHandlers({state:rebound},event('Z',true),'editor'),false);
  assert.equal(runScopeHandlers({state:rebound},event('j'),'editor'),true);assert.deepEqual(calls,['redo','redo','redo']);
 }finally{shortcuts.initialize({getItem:()=>null,setItem(){}});}
});
test('main-view history also reads live rebound redo bindings',async()=>{
 const {installHistoryBindings}=await import('../src/ui/historyBindings.ts'),{worldShortcutId}=await import('../src/ui/shortcuts.ts');
 const previous=globalThis.window,handlers=new Map(),calls=[];globalThis.window={addEventListener:(type,run)=>handlers.set(type,run)};
 shortcuts.initialize({getItem:()=>null,setItem(){}});
 const definition=key=>({category:'Omnium',id:worldShortcutId(key),label:key,defaultKey:key}),redo=definition('Ctrl+Y'),alternate=definition('Ctrl+Shift+Z'),catalog=[redo,alternate];
 try{
  installHistoryBindings({undo:()=>calls.push('undo'),redo:()=>calls.push('redo'),configure(){}});
  shortcuts.assign(redo,'Ctrl+Shift+Z',catalog);shortcuts.assign(alternate,'',catalog);
  const send=(key,shiftKey=false)=>{const e={...event(key,shiftKey),stopImmediatePropagation(){}};handlers.get('keydown')(e);};
  send('Z',true);send('z');send('y');assert.deepEqual(calls,['redo','undo']);
 }finally{globalThis.window=previous;shortcuts.initialize({getItem:()=>null,setItem(){}});}
});
