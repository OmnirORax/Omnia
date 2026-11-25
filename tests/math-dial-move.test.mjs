import test from 'node:test';import assert from 'node:assert/strict';
import {bindMathDialMove} from '../src/composer/runtime/ui/mathDialMove.ts';
test('the mover targets the stable frame containing ring, tabs and readouts, independently of ring zoom',()=>{
 const previous={Element:globalThis.Element,innerWidth:globalThis.innerWidth,innerHeight:globalThis.innerHeight};class Element{closest(){return this;}}
 Object.assign(globalThis,{Element,innerWidth:800,innerHeight:600});
 try{for(const zoom of [.5,2]){
  const frame={style:{cssText:'frame',translate:''},getBoundingClientRect:()=>({left:100,top:80})},surface={style:{translate:''},closest:()=>frame},handle=new Element();Object.assign(handle,{style:{},setPointerCapture(){}});
  const dispose=bindMathDialMove(surface,handle,()=>zoom);
  handle.onpointerdown({button:0,target:handle,pointerId:1,clientX:100,clientY:100,preventDefault(){},stopPropagation(){}});handle.onpointermove({clientX:140,clientY:120});
  assert.equal(frame.style.translate,'40px 20px');assert.equal(surface.style.translate,'');handle.onpointerup();dispose();
  const replacement={closest:()=>frame};bindMathDialMove(replacement,handle,()=>zoom);assert.equal(frame.style.translate,'40px 20px','changing the child editor retains the frame position');
 }}finally{Object.assign(globalThis,previous);}
});
