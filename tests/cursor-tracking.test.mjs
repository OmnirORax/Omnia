import test from 'node:test';
import assert from 'node:assert/strict';
import {installCursorTracking,cursorPosition} from '../src/composer/runtime/ui/cursorPosition.ts';

test('search can read the latest pointer without a prior menu; multiple hosts share one tracker',()=>{
 const previous=globalThis.window,handlers=new Map();let attached=0,removed=0;
 globalThis.window={addEventListener(type,handler){assert.equal(handlers.has(type),false);handlers.set(type,handler);attached++;},removeEventListener(type,handler){assert.equal(handlers.get(type),handler);handlers.delete(type);removed++;}};
 try{
  const stopApp=installCursorTracking(),stopComposer=installCursorTracking();assert.equal(attached,7);
  handlers.get('pointermove')({type:'pointermove',clientX:812,clientY:407,target:null});assert.deepEqual(cursorPosition(),{x:812,y:407});
  stopComposer();assert.equal(removed,0);
  handlers.get('pointermove')({type:'pointermove',clientX:19,clientY:32,target:null});assert.deepEqual(cursorPosition(),{x:19,y:32});
  stopApp();assert.equal(removed,7);assert.equal(handlers.size,0);
 }finally{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;}
});
