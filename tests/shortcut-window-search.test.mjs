import test from 'node:test';
import assert from 'node:assert/strict';
import {shortcutWindow} from '../src/ui/shortcutWindow.ts';
test('shortcut subsection shares its parent search and renders gestures as selectable text',()=>{
 class Element{focusCount=0;children=[];attrs={};value='';textContent='';isConnected=true;classList={add(){}};constructor(tag='div'){this.tag=tag;}append(...items){this.children.push(...items);}replaceChildren(...items){this.children=items;}setAttribute(k,v){this.attrs[k]=v;}focus(){this.focusCount++;}querySelectorAll(){return [];}}
 class Button extends Element{constructor(){super('button');}}
 const before={document:globalThis.document,HTMLButtonElement:globalThis.HTMLButtonElement};Object.assign(globalThis,{document:{createElement:tag=>tag==='button'?new Button():new Element(tag)},HTMLButtonElement:Button});let view;
 try{const root=new Element(),search=new Element('input'),catalog=[{category:'Omnium',id:'gesture:test',label:'Select box',gesture:'Ctrl + drag',keywords:'multi selection',editable:false,defaultKey:''},{category:'Omnium',id:'test-key',label:'Origin',defaultKey:'X'}];view=shortcutWindow(root,()=>catalog,()=>true,search);
 assert.equal(search.focusCount,0,'opening a subsection must not focus its search');assert.equal(root.children.some(child=>child.tag==='input'),false);view.filter('multi selection');assert.equal(search.value,'multi selection');const rows=root.children.at(-1);assert.equal(rows.children.length,1);const gesture=rows.children[0].children[1];assert.equal(gesture.tag,'kbd');assert.equal(gesture.textContent,'Ctrl + drag');assert.equal(gesture.onclick,undefined);
 view.filter('Origin');assert.equal(rows.children[0].children[1].tag,'button');assert.equal(typeof rows.children[0].children[1].onclick,'function');
 }finally{view?.dispose();Object.assign(globalThis,before);}
});

test('shared shortcut editor captures, checks a conflict and atomically swaps the canonical bindings',async()=>{
 const {editShortcut}=await import('../src/ui/shortcutWindow.ts'),{installShortcutCapture,shortcuts}=await import('../src/ui/shortcuts.ts');
 class Node{children=[];dataset={};textContent='';append(...items){this.children.push(...items);}}
 const before={document:globalThis.document,window:globalThis.window};globalThis.document={createElement:()=>new Node()};globalThis.window=new EventTarget();installShortcutCapture();
 const a={category:'Omnium',id:'control-editor-a',label:'A',defaultKey:'J'},b={category:'Omnium',id:'control-editor-b',label:'B',defaultKey:'K'},row=new Node();let renders=0,stop;
 try{stop=editShortcut(row,a,()=>[a,b],()=>renders++);const editor=row.children.at(-1),key=new Event('keydown',{cancelable:true});Object.assign(key,{key:'k',ctrlKey:false,metaKey:false,altKey:false,shiftKey:false});window.dispatchEvent(key);assert.equal(editor.children[0].textContent,'K');assert.match(editor.children[1].textContent,/Used by/);assert.equal(editor.children[2].textContent,'Swap');editor.children[2].onclick();assert.equal(shortcuts.get(a),'K');assert.equal(shortcuts.get(b),'J');assert.equal(renders,1);}finally{stop?.();shortcuts.assign(a,'J',[a,b]);Object.assign(globalThis,before);}
});
