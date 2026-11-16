import test from 'node:test';
import assert from 'node:assert/strict';
import {shortcutWindow} from '../src/ui/shortcutWindow.ts';
test('shortcut subsection shares its parent search and renders gestures as selectable text',()=>{
 class Element{children=[];attrs={};value='';textContent='';isConnected=true;classList={add(){}};constructor(tag='div'){this.tag=tag;}append(...items){this.children.push(...items);}replaceChildren(...items){this.children=items;}setAttribute(k,v){this.attrs[k]=v;}focus(){}querySelectorAll(){return [];}}
 class Button extends Element{constructor(){super('button');}}
 const before={document:globalThis.document,HTMLButtonElement:globalThis.HTMLButtonElement};Object.assign(globalThis,{document:{createElement:tag=>tag==='button'?new Button():new Element(tag)},HTMLButtonElement:Button});let view;
 try{const root=new Element(),search=new Element('input'),catalog=[{category:'Omnium',id:'gesture:test',label:'Select box',gesture:'Ctrl + drag',keywords:'multi selection',editable:false,defaultKey:''},{category:'Omnium',id:'test-key',label:'Origin',defaultKey:'X'}];view=shortcutWindow(root,()=>catalog,()=>true,search);
 assert.equal(root.children.some(child=>child.tag==='input'),false);view.filter('multi selection');assert.equal(search.value,'multi selection');const rows=root.children.at(-1);assert.equal(rows.children.length,1);const gesture=rows.children[0].children[1];assert.equal(gesture.tag,'kbd');assert.equal(gesture.textContent,'Ctrl + drag');assert.equal(gesture.onclick,undefined);
 view.filter('Origin');assert.equal(rows.children[0].children[1].tag,'button');assert.equal(typeof rows.children[0].children[1].onclick,'function');
 }finally{view?.dispose();Object.assign(globalThis,before);}
});
