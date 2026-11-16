import test from 'node:test';
import assert from 'node:assert/strict';
import {rotationStep,snappedRotation} from '../src/world/rotationSnap.ts';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-10);
test('Axis snapping bisects a line orientation using fractions of a turn',()=>{
 close(rotationStep('axis',1),1/4);close(rotationStep('axis',2),1/8);close(rotationStep('axis',3),1/16);close(rotationStep('axis',0),1/2);
 close(snappedRotation(24,'axis',1),1/4);close(snappedRotation(-48,'axis',2),-1/4);close(snappedRotation(3,'axis',1),0);
});
test('Unit snapping fits adjacent units around a radius and shares halving/doubling',()=>{
 close(rotationStep('unit',1,1),1/6);close(rotationStep('unit',2,1),1/12);close(rotationStep('unit',0,1),1/3);close(rotationStep('unit',-1,1),2/3);
 const step=rotationStep('unit',1,3);close(2*3*Math.sin(Math.PI*step),1);assert.ok(step<1/6);
 assert.throws(()=>rotationStep('axis',1.2));assert.throws(()=>rotationStep('unit',1,0));
});
