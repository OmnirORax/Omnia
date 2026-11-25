import test from 'node:test';import assert from 'node:assert/strict';
import {createStore} from '../src/core/store.ts';
import {createAutoColors} from '../src/scene/autoColors.ts';
import {themeSettings} from '../src/scene/themeControls.ts';
test('the real picker accepts colors, cancels drafts, toggles motif membership, follows undo and ignores late events after close',async()=>{
 const saved=Object.fromEntries(['window','document','requestAnimationFrame'].map(k=>[k,globalThis[k]]));class Element extends EventTarget{children=[];style={};dataset={};attrs={};classList={add(){}};value='';parent;append(...nodes){for(const n of nodes){this.children.push(n);n.parent=this;}}replaceChildren(...nodes){this.children=[];this.append(...nodes);}setAttribute(k,v){this.attrs[k]=v;}get isConnected(){return this===body||!!this.parent?.isConnected;}remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);this.parent=undefined;}contains(n){return n===this||this.children.some(c=>c.contains?.(n));}focus(){document.activeElement=this;}showPicker(){this.opened=true;}}
 const body=new Element();globalThis.document={body,activeElement:null,addEventListener(){},createElement:()=>new Element(),createTextNode:data=>({data})};globalThis.window={addEventListener(){}};globalThis.requestAnimationFrame=fn=>{fn();return 1;};
 try{const {colorInclusionPanel}=await import('../src/scene/colorInclusions.ts'),store=createStore({getItem:()=>null,setItem(){}});let subscriptions=0;const auto=createAutoColors({read:()=>store.world,change:edit=>store.change(edit),sample:async()=>new Uint8ClampedArray([255,0,0,255,0,255,0,255]),error:error=>{throw error;}});store.subscribe(auto.update);const view=colorInclusionPanel({motifs:()=>auto.motifs(store.world),subscribeMotifs:auto.subscribe,read:()=>store.world,change:edit=>store.change(edit),subscribe:fn=>{subscriptions++;const stop=store.subscribe(fn);return()=>{subscriptions--;stop();};},feedback:message=>{throw Error(message);}}),[input,add,reset,grid]=view.body.children;
 view.openPicker();assert.equal(input.opened,true);input.value='#ff0000';input.dispatchEvent(new Event('input'));assert.equal(grid.children.length,0);input.dispatchEvent(new Event('change'));await auto.settle();assert.deepEqual(themeSettings(store.world).included,['#ff0000']);assert.equal(grid.children.length,1);add.onclick();assert.equal(grid.children.length,1);
 input.value='#00ff00';input.dispatchEvent(new Event('input'));const cancel=new Event('keydown');Object.defineProperty(cancel,'key',{value:'Escape'});input.dispatchEvent(cancel);assert.deepEqual(themeSettings(store.world).included,['#ff0000']);input.value='#00ff00';input.dispatchEvent(new Event('input'));input.dispatchEvent(new Event('change'));await auto.settle();assert.equal(grid.children.length,2);const red=grid.children.find(c=>c.attrs['aria-label']==='Motif #ff0000');red.onclick();await auto.settle();assert.deepEqual(themeSettings(store.world).included,['#ff0000','#00ff00']);assert.equal(themeSettings(store.world).motifOverrides['#ff0000'],false);assert.equal(grid.children.length,2);store.undo();store.undo();await auto.settle();assert.equal(grid.children.find(c=>c.attrs['aria-label']==='Motif #ff0000').attrs['aria-pressed'],'true');
 add.onclick();await auto.settle();
 const swatch=color=>grid.children.find(c=>c.attrs['aria-label']===`Motif ${color}`);
 const selected=()=>grid.children.filter(c=>c.attrs['aria-pressed']==='true').map(c=>c.style.backgroundColor).sort();
 const rightClick=async color=>{
  const event=new Event('contextmenu',{cancelable:true});
  swatch(color).oncontextmenu(event);
  assert.equal(event.defaultPrevented,true);
  await auto.settle();
 };
 assert.deepEqual(selected(),['#00ff00','#ff0000']);
 await rightClick('#ff0000');assert.deepEqual(selected(),['#ff0000']);
 await rightClick('#00ff00');assert.deepEqual(selected(),['#00ff00']);
 await rightClick('#00ff00');assert.deepEqual(selected(),['#00ff00','#ff0000']);
 // The store records resolved paint separately from the membership edit.
 store.undo();store.undo();await auto.settle();assert.deepEqual(selected(),['#00ff00']);
 store.undo();store.undo();await auto.settle();assert.deepEqual(selected(),['#ff0000']);
 store.undo();store.undo();await auto.settle();assert.deepEqual(selected(),['#00ff00','#ff0000']);
 view.close();assert.equal(subscriptions,0);const before=store.world;input.value='#0000ff';input.dispatchEvent(new Event('input'));input.dispatchEvent(new Event('change'));red.onclick();reset.onclick();assert.equal(store.world,before);auto.dispose();
 }finally{Object.assign(globalThis,saved);}
});
