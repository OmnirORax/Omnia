import test from 'node:test';
import assert from 'node:assert/strict';
import {windowDrag} from '../src/ui/windowDrag.ts';

test('shared window drag moves from blank title space, clamps and restores on cancellation',()=>{
 const previous={Element:globalThis.Element,innerWidth:globalThis.innerWidth,innerHeight:globalThis.innerHeight};
 class Element {closest(){return null;}}
 Object.assign(globalThis,{Element,innerWidth:800,innerHeight:600});
 try{
  const root={style:{cssText:'original',left:'',top:'',right:'auto'},getBoundingClientRect:()=>({left:100,top:80})},heading={style:{},setPointerCapture:id=>{assert.equal(id,1);}};let committed;
  windowDrag(root,heading,before=>{committed=before;});
  const press={button:0,target:new Element(),pointerId:1,clientX:150,clientY:90,preventDefault(){}};
  heading.onpointerdown(press);heading.onpointermove({clientX:250,clientY:140});assert.equal(root.style.left,'200px');assert.equal(root.style.top,'130px');heading.onpointerup();assert.equal(committed,'original');assert.equal(heading.onpointermove,null);
  heading.onpointerdown(press);heading.onpointermove({clientX:9999,clientY:-999});assert.equal(root.style.left,'760px');assert.equal(root.style.top,'0px');heading.onpointercancel();assert.equal(root.style.cssText,'original');assert.equal(heading.onpointermove,null);
 }finally{Object.assign(globalThis,previous);}
});
