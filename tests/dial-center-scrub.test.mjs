import test from 'node:test';
import assert from 'node:assert/strict';
import {dialCenterScrub} from '../src/composer/runtime/ui/dialCenterScrub.ts';
import {dialValueGrid} from '../src/properties/dialValueGrid.ts';
import {horizontalValue,valueDragDistance} from '../src/ui/valueDrag.ts';
const domain={min:0,max:1,integer:false};
test('center uses signed snap counts from equilibrium rather than arbitrary fractions',()=>{
 const grid=dialValueGrid(domain,.125),scrub=dialCenterScrub({value:.5,domain,grid,mode:'value',anchor:.5,count:0});
 assert.deepEqual([scrub.value,scrub.min,scrub.max],[0,-4,4]);
 const gesture={...scrub,pixelsPerStep:6,axis:{x:0,y:-1}};
 assert.equal(scrub.toValue(horizontalValue(gesture,valueDragDistance(gesture,100,-12))),.75);
 assert.equal(scrub.toValue(horizontalValue(gesture,valueDragDistance(gesture,0,999))),0);
});
test('center adjusts halving, doubling and division counts on their frozen starting values',()=>{
 for(const [mode,anchor,count,maximum,expected] of [['halving',360,2,20,45],['doubling',1,2,8,8],['division',100,2,100,100/3]]){
  const scrub=dialCenterScrub({value:0,domain:{min:0,max:1000},mode,anchor,count,maximum});
  assert.equal(scrub.value,count);assert.equal(scrub.max,maximum);assert.equal(scrub.toValue(count+1),expected);
 }
});
test('ungridded center respects numeric bounds and changes in whole steps',()=>{
 const scrub=dialCenterScrub({value:12,domain:{min:6,max:72,integer:true},mode:'value',anchor:12,count:0});
 assert.equal(scrub.toValue(horizontalValue({...scrub,pixelsPerStep:6},12)),14);
 assert.equal(horizontalValue({...scrub,pixelsPerStep:6},9999),72);
});
