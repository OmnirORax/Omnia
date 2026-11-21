import test from 'node:test';import assert from 'node:assert/strict';
import {originDirectionField} from '../src/ui/originDirectionField.ts';
import {DEFAULT_ORIGIN_DIRECTIONS,directionSlots} from '../src/core/originDirections.ts';
import {axisFieldCandidate} from '../src/properties/stateField.ts';

test('the composer direction picker resolves each of the six fixed axis arms',()=>{
 const {field,targets,state}=originDirectionField(DEFAULT_ORIGIN_DIRECTIONS,[0,2]);
 assert.equal(field.candidates.length,6);
 for(const candidate of field.candidates){
  assert.equal(axisFieldCandidate(field,candidate.point),candidate);
  const {axis}=targets.get(candidate.value);assert.equal(axis,candidate.index%3);
  assert.equal(state(candidate.value).selected,axis!==1);
  assert.ok(state(candidate.value).color);
 }
 assert.equal(axisFieldCandidate(field,{x:0,y:0}),undefined);
});
test('refinement retains every existing direction key through the maximum supported subdivision',()=>{
 for(const halves of [1,4,5,6]){
  const settings={...DEFAULT_ORIGIN_DIRECTIONS,halves,disabled:['0:1']},dial=originDirectionField(settings,[0,1,2]);
  assert.equal(new Set(dial.field.candidates.map(c=>c.id)).size,dial.field.candidates.length);
  const slots=directionSlots(settings),extra=dial.field.candidates.filter(c=>'key'in dial.targets.get(c.value));
  assert.equal(extra.length,slots.length-4);
  for(const candidate of extra){
   const target=dial.targets.get(candidate.value);assert.equal(target.key,slots[candidate.index].key);
   assert.equal(axisFieldCandidate(dial.field,candidate.point),candidate);
   assert.equal(dial.state(candidate.value).selected,target.key!=='0:1');
  }
 }
});
test('Unit mode keeps its own node slots and uses the same six axis arms',()=>{
 const dial=originDirectionField({...DEFAULT_ORIGIN_DIRECTIONS,mode:'unit',rings:3,halves:6},[1]);
 assert.equal(dial.field.candidates.length,6);assert.ok([...dial.targets.values()].every(target=>'axis'in target));
});
