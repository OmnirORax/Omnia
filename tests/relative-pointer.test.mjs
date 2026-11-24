import test from 'node:test';import assert from 'node:assert/strict';
import {createRelativePointer} from '../src/ui/relativePointer.ts';
function browser(promise=false){const doc=new EventTarget();doc.pointerLockElement=null;let requests=0,exits=0,resolve;doc.exitPointerLock=()=>{exits++;doc.pointerLockElement=null;doc.dispatchEvent(new Event('pointerlockchange'));};const element={ownerDocument:doc,requestPointerLock(){requests++;if(promise)return new Promise(done=>resolve=done);}};return {doc,element,get requests(){return requests;},get exits(){return exits;},lock(){doc.pointerLockElement=element;doc.dispatchEvent(new Event('pointerlockchange'));resolve?.();}};}
test('locked movement accumulates beyond screen coordinates while absolute fallback retains its starting point',()=>{const b=browser(),p=createRelativePointer();p.start(b.element,{x:1900,y:1000});assert.deepEqual(p.sample({clientX:1900,clientY:1000}),{x:1900,y:1000});b.lock();for(let i=0;i<20;i++)p.sample({clientX:1900,clientY:1000,movementX:100,movementY:-200});assert.deepEqual(p.sample({clientX:1900,clientY:1000,movementX:0,movementY:0}),{x:3900,y:-3000});p.stop();assert.equal(b.exits,1);assert.equal(p.active,false);});
test('native Escape/focus loss cancels the owner once, while intentional release does not',()=>{const b=browser();let lost=0;const p=createRelativePointer(()=>lost++);p.start(b.element,{x:1,y:2});b.lock();b.doc.exitPointerLock();assert.equal(lost,1);assert.equal(p.active,false);p.start(b.element,{x:1,y:2});b.lock();p.stop();assert.equal(lost,1);});
test('a cancelled asynchronous request cannot leave the browser locked after its owner ends',async()=>{for(const promise of [false,true]){const b=browser(promise),p=createRelativePointer();p.start(b.element,{x:0,y:0});p.stop();b.lock();await Promise.resolve();assert.equal(b.doc.pointerLockElement,null);assert.equal(p.active,false);}});
test('unsupported or refused pointer lock keeps regular pointer input usable',()=>{const p=createRelativePointer();assert.equal(p.start({}, {x:3,y:4}),false);assert.deepEqual(p.sample({clientX:10,clientY:20}),{x:10,y:20});const b=browser();p.start(b.element,{x:1,y:2});b.doc.dispatchEvent(new Event('pointerlockerror'));assert.equal(p.active,false);assert.deepEqual(p.sample({clientX:11,clientY:21}),{x:11,y:21});});
test('a refusal explains the failed continuous-input request while retaining normal coordinates',()=>{const b=browser(),messages=[],p=createRelativePointer(()=>{},message=>messages.push(message));p.start(b.element,{x:1,y:2});b.doc.dispatchEvent(new Event('pointerlockerror'));assert.match(messages[0],/refused by the browser/);assert.deepEqual(p.sample({clientX:30,clientY:40}),{x:30,y:40});});
test('required lock retains the press origin until the browser freezes the cursor and refuses invisible absolute fallback',()=>{
 const b=browser(),messages=[];let cancelled=0;const p=createRelativePointer(()=>cancelled++,message=>messages.push(message));
 p.start(b.element,{x:10,y:20},{requireLock:true});assert.deepEqual(p.sample({clientX:1800,clientY:900,movementX:100,movementY:100}),{x:10,y:20});
 b.lock();assert.deepEqual(p.sample({clientX:1800,clientY:900,movementX:6,movementY:0}),{x:16,y:20});p.stop();assert.equal(cancelled,0);
 p.start(b.element,{x:10,y:20},{requireLock:true});b.doc.dispatchEvent(new Event('pointerlockerror'));assert.equal(cancelled,1);assert.equal(p.active,false);assert.match(messages.at(-1),/refused/);
 assert.equal(p.start({}, {x:10,y:20},{requireLock:true}),false);assert.equal(cancelled,2);assert.match(messages.at(-1),/cannot hold/);
});

test('locked movement accepts pointer-only and mouse-only streams and removes only matching companions',()=>{
 const old=globalThis.window,handlers=new Map();globalThis.window={addEventListener(type,fn){handlers.set(type,fn);},removeEventListener(type){handlers.delete(type);}};
 const b=browser(),p=createRelativePointer(),samples=[];
 try{
  p.start(b.element,{x:100,y:100});b.lock();const stop=p.observeMove(event=>samples.push(p.sample(event)));
  const send=(type,dx,time=10)=>handlers.get(type)({type,clientX:100,clientY:100,movementX:dx,movementY:0,timeStamp:time});
  send('pointermove',5);assert.equal(samples.at(-1).x,105);
  send('mousemove',5);assert.equal(samples.length,1);
  send('mousemove',5);assert.equal(samples.at(-1).x,110,'coarse timestamps cannot drop later mouse-only input');
  send('mousemove',-2,11);assert.equal(samples.at(-1).x,108);
  send('pointermove',-2,11);assert.equal(samples.length,3);
  send('pointermove',4,12);assert.equal(samples.at(-1).x,112);
  send('mousemove',9,12);assert.equal(samples.at(-1).x,121,'different movement at the same timestamp remains input');
  stop();assert.equal(handlers.size,0);
 }finally{p.stop();if(old===undefined)delete globalThis.window;else globalThis.window=old;}
});

test('restarting the same active stream rebases without releasing or requesting again',()=>{
 const b=browser(),p=createRelativePointer();
 try{p.start(b.element,{x:1,y:2});p.start(b.element,{x:3,y:4});assert.equal(b.requests,1);b.lock();p.start(b.element,{x:10,y:20});assert.equal(b.requests,1);assert.equal(b.exits,0);assert.deepEqual(p.sample({clientX:0,clientY:0,movementX:6}),{x:16,y:20});}finally{p.stop();}
});
test('control handoffs reuse a stable page lock without an unlock/relock cycle',()=>{
 const b=browser();b.doc.documentElement=b.element;const control={ownerDocument:b.doc,requestPointerLock(){assert.fail('lock must belong to the page, not a replaceable control');}};let lost=0;
 const first=createRelativePointer(()=>lost++),second=createRelativePointer();
 try{first.start(control,{x:1,y:2});b.lock();second.start(control,{x:3,y:4},{requireLock:true});assert.equal(b.requests,1);assert.equal(b.exits,0);assert.equal(lost,1);assert.equal(second.locked,true);first.stop();assert.equal(second.locked,true);}finally{first.stop();second.stop();}
});
test('a document-wide error from an older request cannot cancel a promise-based current request',async()=>{
 const b=browser(true),messages=[];let lost=0;const p=createRelativePointer(()=>lost++,message=>messages.push(message));
 try{p.start(b.element,{x:1,y:2},{requireLock:true});b.doc.dispatchEvent(new Event('pointerlockerror'));assert.equal(p.active,true);b.lock();await Promise.resolve();assert.equal(p.locked,true);assert.equal(lost,0);assert.deepEqual(messages,[]);}finally{p.stop();}
});
test('promise rejection reports the browser reason once and cancels the required owner',async()=>{
 const b=browser(),messages=[];let reject,lost=0;b.element.requestPointerLock=()=>new Promise((_,no)=>reject=no);const p=createRelativePointer(()=>lost++,message=>messages.push(message));
 p.start(b.element,{x:1,y:2},{requireLock:true});reject(new DOMException('Too many pointer lock requests in a short window of time','NotAllowedError'));await Promise.resolve();await Promise.resolve();assert.equal(p.active,false);assert.equal(lost,1);assert.equal(messages.length,1);assert.match(messages[0],/NotAllowedError.*Too many pointer lock requests/);p.stop();
});

test('passive hover without browser activation does not submit a lock request',()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator'),b=browser(),messages=[],p=createRelativePointer(()=>{},message=>messages.push(message));
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{userActivation:{isActive:false}}});
 try{assert.equal(p.start(b.element,{x:1,y:2}),false);assert.equal(b.requests,0);assert.deepEqual(messages,[]);assert.deepEqual(p.sample({clientX:5,clientY:6}),{x:5,y:6});}finally{p.stop();if(descriptor)Object.defineProperty(globalThis,'navigator',descriptor);else delete globalThis.navigator;}
});
