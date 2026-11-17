import test from 'node:test';import assert from 'node:assert/strict';
import {rotationDefaultSnap} from '../src/world/rotationSnap.ts';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-10);
test('Axis chooses a quarter-turn default without a later multiplier',()=>{close(rotationDefaultSnap('axis'),.25);});
test('Unit chooses the actual angle fitting adjacent units around the radius',()=>{
 close(rotationDefaultSnap('unit',1),1/6);close(rotationDefaultSnap('unit',.5),1/2);
 const step=rotationDefaultSnap('unit',3);close(2*3*Math.sin(Math.PI*step),1);assert.ok(step<1/6);
 assert.throws(()=>rotationDefaultSnap('unit',0));assert.throws(()=>rotationDefaultSnap('axis',NaN));
});
