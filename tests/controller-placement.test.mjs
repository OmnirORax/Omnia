import test from 'node:test';
import assert from 'node:assert/strict';
import {controllerCenter} from '../src/composer/runtime/ui/popupPlacement.ts';
test('clicking a construction keeps the replacement radial menu centered on the cursor',()=>{
 const cursor={x:72,y:87},parent={x:0,y:0,width:170,height:170},button={x:57,y:72,width:30,height:30},menu={width:160,height:160};
 assert.deepEqual(controllerCenter(cursor,menu,[parent],button,true,false),cursor);
 assert.deepEqual(controllerCenter(cursor,menu,[parent],button,true,true),cursor);
});
test('rectangular button editors retain their button-below placement',()=>{
 const button={x:20,y:30,width:30,height:20};
 assert.deepEqual(controllerCenter({x:25,y:35},{width:100,height:80},[],button,false,false),{x:35,y:94});
});
