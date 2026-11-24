import test from 'node:test';import assert from 'node:assert/strict';
import {emptyWorld} from '../src/core/model.ts';

// Exercise the actual form/window disposer and lazy-mount race without a browser renderer.
test('closing appearance disposes its body-mounted dial and a late import cannot reopen it',async()=>{
 const names=['document','window','HTMLInputElement','HTMLSelectElement','cancelAnimationFrame'],saved=Object.fromEntries(names.map(n=>[n,globalThis[n]]));
 class Node{children=[];style={};dataset={};attributes={};isConnected=true;listeners=new Map();type='';value='';
  constructor(tag){this.tag=tag;}append(...nodes){for(const node of nodes){this.children.push(node);node.parent=this;}}remove(){this.isConnected=false;if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}setAttribute(k,v){this.attributes[k]=v;}addEventListener(k,fn){this.listeners.set(k,fn);}focus(){}closest(){return null;}getBoundingClientRect(){return {left:100,top:100,width:60,height:20};}checkValidity(){return true;}}
 class Input extends Node{}class Select extends Node{get options(){return this.children;}}
 const body=new Node('body'),document={body,createElement:tag=>tag==='input'?new Input(tag):tag==='select'?new Select(tag):new Node(tag),addEventListener(){}};
 Object.assign(globalThis,{document,window:{addEventListener(){}},HTMLInputElement:Input,HTMLSelectElement:Select,cancelAnimationFrame(){}});
 try{
  const {paintForm}=await import('../src/ui/visualControls.ts');const world=emptyWorld(),previews=[],writes=[],errors=[];let resolveLoad,mounted=0,unmounted=0,parameter;
  const mountOperationMathDial=(_host,number)=>{mounted++;parameter=number;return()=>{unmounted++;number.restore();};};
  const make=load=>paintForm('text',[],()=>world,edit=>{writes.push(1);edit(world);},e=>errors.push(e),p=>previews.push(p),load);
  const click=form=>{const input=form.root.children.flatMap(n=>n.children).find(n=>n.attributes['aria-label']==='Font size');return input.onclick({detail:1,clientX:120,clientY:110});};
  const pending=make(()=>new Promise(resolve=>resolveLoad=resolve)),opening=click(pending);assert.equal(body.children.length,1);pending.dispose();pending.dispose();assert.equal(body.children.length,0);resolveLoad({mountOperationMathDial});await opening;assert.equal(mounted,0);
  const active=make(async()=>({mountOperationMathDial}));await click(active);assert.equal(mounted,1);parameter.preview(24);assert.deepEqual(previews.at(-1),{fontSize:24});active.dispose();assert.equal(unmounted,1);assert.equal(body.children.length,0);assert.equal(previews.at(-1),undefined);
  parameter.commit(30);assert.deepEqual(writes,[],'callbacks from a disposed dial cannot change the hidden form');
  const again=make(async()=>({mountOperationMathDial}));await click(again);assert.equal(mounted,2);parameter.commit(18);assert.equal(world.appearance.text.fontSize,18);await Promise.resolve();assert.equal(body.children.length,0);again.dispose();
  const first=make(async()=>({mountOperationMathDial})),second=make(async()=>({mountOperationMathDial}));await click(first);await click(second);first.dispose();assert.equal(body.children.length,1,'disposing the previous owner cannot close the new owner’s dial');second.dispose();assert.equal(body.children.length,0);assert.deepEqual(errors,[]);
 }finally{for(const [key,value]of Object.entries(saved))if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
});
