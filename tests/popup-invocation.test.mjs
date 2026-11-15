import test from 'node:test';
import assert from 'node:assert/strict';
import {createPopupInvocation} from '../src/composer/runtime/ui/popupInvocation.ts';
test('hover preview renders cannot move an open construction dial to the live cursor',()=>{
 let cursor={x:100,y:150},reads=0;
 const popup=createPopupInvocation(()=>{reads++;return cursor;});
 const opened=popup.sample(true);assert.deepEqual(opened,{x:100,y:150});
 for(let i=0;i<100;i++){cursor={x:300+i,y:200+i};assert.equal(popup.sample(true),opened);}
 assert.equal(reads,1);assert.deepEqual(opened,{x:100,y:150});
 assert.equal(popup.sample(false),null);assert.deepEqual(popup.sample(true),cursor);assert.equal(reads,2);
});
test('the opening point is a snapshot even if the cursor sample is mutated',()=>{
 const cursor={x:10,y:20},popup=createPopupInvocation(()=>cursor),opened=popup.sample(true);
 cursor.x=200;assert.deepEqual(popup.sample(true),{x:10,y:20});assert.equal(popup.sample(true),opened);
});
