import test from 'node:test';
import assert from 'node:assert/strict';
import {createUserReference} from '../src/world/userReference.ts';
test('dismount preserves User pose while the observer moves and mount restores it',()=>{
 const camera={position:[1,2,3],target:[4,5,6],up:[0,1,0]},user=createUserReference(()=>camera);
 assert.equal(user.read(),camera);const parked=structuredClone(camera);user.dismount();camera.position[0]=90;camera.target[1]=80;camera.up[2]=1;assert.deepEqual(user.read(),parked);user.dismount();assert.deepEqual(user.read(),parked);assert.equal(user.detached,true);assert.deepEqual(user.mount(),parked);assert.equal(user.detached,false);assert.equal(user.read(),camera);
});
