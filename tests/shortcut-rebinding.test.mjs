import test from 'node:test';
import assert from 'node:assert/strict';
import {EditorState} from '@codemirror/state';
import {keymap,runScopeHandlers} from '@codemirror/view';
import {createShortcutStore,shortcuts,normalizeShortcut,matchesShortcut,worldBinding,worldShortcutId,SHORTCUT_CATEGORIES,installShortcutCapture,captureShortcut} from '../src/ui/shortcuts.ts';
import {documentBindings,remapDocumentBindings} from '../src/text/shortcutBindings.ts';
import {wrap} from '../src/text/commands.ts';
import {glyphField} from '../src/text/source.ts';
import {shortcutBinding as omnicBinding,preferredFeatureKey} from '../src/composer/runtime/workspaceActions.ts';
const definition=(category,id,key,scope)=>({category,id,label:id,defaultKey:key,scope});
const key=(key,extra={})=>({key,keyCode:key.length===1?key.toUpperCase().charCodeAt(0):0,ctrlKey:false,metaKey:false,altKey:false,shiftKey:false,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;},...extra});
test('keyboard notation handles modifiers, platforms and literal symbols without accepting gesture prose',()=>{
 assert.deepEqual(SHORTCUT_CATEGORIES,['Omnium','Document','Omnic']);assert.equal(normalizeShortcut('Mod-Shift-b',false),'Ctrl+Shift+B');assert.equal(normalizeShortcut('Mod-b',true),'Cmd+B');assert.equal(normalizeShortcut('Ctrl++'),'Ctrl++');assert.equal(normalizeShortcut('Alt--'),'Alt+-');assert.equal(normalizeShortcut('Escape'),'Esc');
 for(const invalid of ['Right drag','W / Click','Hold Alt','Shift','Click'])assert.equal(normalizeShortcut(invalid),undefined);
 assert.equal(matchesShortcut(key('k',{ctrlKey:true,shiftKey:true}),'Ctrl+Shift+K'),true);assert.equal(matchesShortcut(key('k',{ctrlKey:true}),'Ctrl+Shift+K'),false);
});
test('conflict plans are pure, swaps are atomic, categories and distinct Omnic scopes stay independent',()=>{
 const store=createShortcutStore(),a=definition('Omnium','move','W'),b=definition('Omnium','rotate','R'),doc=definition('Document','bold','Ctrl+B'),omnic=definition('Omnic','shape','R','shape'),other=definition('Omnic','selection','R','selection'),catalog=[a,b,doc,omnic,other];let publishes=0;store.subscribe(()=>publishes++);
 const plan=store.plan(a,'R',catalog);assert.deepEqual(plan.conflicts,[b]);assert.equal(store.get(a),'W');assert.equal(publishes,0);
 store.assign(a,'R',catalog);assert.equal(store.get(a),'R');assert.equal(store.get(b),'W');assert.equal(store.get(omnic),'R');assert.equal(publishes,1);
 assert.equal(store.plan(omnic,'R',catalog).conflicts.length,0);assert.equal(store.plan(doc,'R',catalog).conflicts.length,0);
 store.assign(a,'',catalog);assert.equal(store.get(a),'');store.assign(a,'W',catalog);assert.equal(store.get(a),'W');assert.equal(store.get(b),'');
});
test('application shortcuts warn across categories and refuse ambiguous multi-owner swaps',()=>{
 const store=createShortcutStore(),global=definition('Omnium','full','F11','application'),a=definition('Omnic','one','R','same'),b=definition('Omnic','two','R','same');
 assert.throws(()=>store.plan(global,'R',[global,a,b]),/Multiple conflicts/);assert.equal(store.get(global),'F11');assert.deepEqual(store.plan(global,'R',[global,a]).conflicts,[a]);
});
test('bindings survive reload, invalid stored data is ignored, and failed persistence leaves old bindings intact',()=>{
 let saved=null;const storage={getItem:()=>saved,setItem:(_key,value)=>saved=value},a=definition('Document','bold','Ctrl+B'),store=createShortcutStore();store.initialize(storage);store.assign(a,'Ctrl+K',[a]);const restored=createShortcutStore();restored.initialize(storage);assert.equal(restored.get(a),'Ctrl+K');
 const rejected=createShortcutStore();rejected.initialize({getItem:()=>null,setItem:()=>{throw Error('quota');}});assert.throws(()=>rejected.assign(a,'Ctrl+J',[a]),/quota/);assert.equal(rejected.get(a),'Ctrl+B');
 saved='{"Document":{"bad":"Right drag","bold":"Ctrl+K"}}';restored.initialize(storage);assert.equal(restored.get(a),'Ctrl+K');assert.equal(restored.get(definition('Document','bad','F1')),'F1');
});
test('actual CodeMirror commands execute on the remapped chord and the old chord stops executing them',()=>{
 shortcuts.initialize({getItem:()=>null,setItem(){}});const bold=definition('Document','Ctrl+B','Ctrl+B'),italic=definition('Document','Ctrl+I','Ctrl+I'),bindings=[{key:'Mod-b',run:wrap('**')},{key:'Mod-i',run:wrap('*')}];
 try{shortcuts.assign(bold,'Ctrl+I',[bold,italic]);let state=EditorState.create({doc:'abc',selection:{anchor:0,head:3},extensions:[glyphField.init(()=>[]),keymap.of(remapDocumentBindings(bindings))]});
 const view={get state(){return state;},dispatch:tr=>{state=state.update(tr).state;}};
 assert.equal(runScopeHandlers(view,key('i',{ctrlKey:true}),'editor'),true);assert.equal(state.doc.toString(),'**abc**');
 const mapping=remapDocumentBindings(bindings);assert.equal(mapping[0].key,'Ctrl-i');assert.equal(mapping[1].key,'Ctrl-b');
 shortcuts.assign(bold,'Ctrl+J',[bold,italic]);state=EditorState.create({doc:'abc',selection:{anchor:0,head:3},extensions:[glyphField.init(()=>[]),keymap.of(remapDocumentBindings(bindings))]});assert.equal(runScopeHandlers(view,key('i',{ctrlKey:true}),'editor'),false);assert.equal(state.doc.toString(),'abc');assert.equal(runScopeHandlers(view,key('j',{ctrlKey:true}),'editor'),true);assert.equal(state.doc.toString(),'**abc**');
 }finally{shortcuts.initialize({getItem:()=>null,setItem(){}});}
});
test('CodeMirror shift selections, Mac chords and fallback command chains retain their semantics',()=>{
 const select=()=>true,move=()=>false,bindings=[{key:'ArrowLeft',run:move,shift:select},{key:'ArrowLeft',run:select},{key:'Mod-b',run:select}];
 const entries=documentBindings(bindings,true);assert.deepEqual(entries.map(entry=>entry.definition.id),['ArrowLeft','Shift+ArrowLeft','ArrowLeft','Cmd+B']);assert.equal(entries[1].binding.run,select);assert.equal(entries[0].binding.run,move);
 assert.equal(remapDocumentBindings([{key:'Ctrl-+',run:move}])[0].key,'Ctrl-+');
});
test('Omnic rebindings feed the existing runtime dispatch rather than only changing display labels',()=>{
 const store=createShortcutStore(),a=definition('Omnic','context.resize','W','uiContext');store.assign(a,'Ctrl+J',[a]);const bindings=store.getSnapshot().Omnic;
 assert.equal(omnicBinding(a.id,bindings),'Ctrl+J');assert.equal(preferredFeatureKey(bindings,'Ctrl+J',id=>id===a.id),a.id);assert.equal(preferredFeatureKey(bindings,'W',id=>id===a.id),null);
});
test('native bindings share persistence and capture consumes keys before application handlers',()=>{
 shortcuts.initialize({getItem:()=>null,setItem(){}});const a=definition('Omnium',worldShortcutId('Q'),'Q');shortcuts.assign(a,'Shift+H',[a]);assert.equal(worldBinding('Q'),'Shift+H');assert.equal(matchesShortcut(key('h',{shiftKey:true}),worldBinding('Q')),true);
 const previous=globalThis.window,handlers=new Map(),captured=[];globalThis.window={addEventListener:(type,fn)=>handlers.set(type,fn)};
 try{installShortcutCapture();const stop=captureShortcut(value=>captured.push(value),()=>captured.push('cancel'));
 const event=key('F11');handlers.get('keydown')(event);assert.equal(event.prevented,true);assert.equal(event.stopped,true);assert.deepEqual(captured,['F11']);handlers.get('keydown')(key('Escape'));assert.equal(captured.at(-1),'cancel');stop();
 }finally{globalThis.window=previous;shortcuts.initialize({getItem:()=>null,setItem(){}});}
});
