import test from 'node:test';
import assert from 'node:assert/strict';
import {mathematicalSlotScrub} from '../src/properties/mathematicalDial.ts';

test('horizontal dial traversal starts at the current slot and follows legal slot order',()=>{
 const pick=mathematicalSlotScrub(['first','second','third','fourth'],100,1);
 assert.equal(pick(100),undefined);assert.equal(pick(102),undefined);
 assert.equal(pick(124),'third');assert.equal(pick(76),'first');assert.equal(pick(148),'fourth');
 assert.equal(pick(1000),'fourth');assert.equal(pick(-1000),'first');
});
test('prepared dial slots can omit illegal values without creating new values',()=>{
 const pick=mathematicalSlotScrub(['0:1','0:4'],40,0);assert.equal(pick(64),'0:4');assert.equal(pick(16),'0:1');assert.equal(pick(NaN),undefined);
 assert.equal(mathematicalSlotScrub([],0,0)(40),undefined);
});
