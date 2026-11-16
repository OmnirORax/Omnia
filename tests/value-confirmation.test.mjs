import test from 'node:test';
import assert from 'node:assert/strict';
import {confirmValue} from '../src/composer/runtime/ui/valueConfirmation.ts';
import {confirmContextStage} from '../src/composer/runtime/ui/contextNavigation.ts';
import {createHoverPreview} from '../src/composer/runtime/ui/hoverPreview.ts';

test('free-pointer acceptance commits the current value before completing its editor exactly once',()=>{
 const events=[],session=createHoverPreview();let value=0;
 session.enter({}, {start:()=>{},move:x=>value=x,commit:()=>confirmContextStage(()=>confirmValue({candidate:()=>value,onCommit:n=>{events.push(['commit',n]);}}),()=>events.push(['close'])),cancel:()=>events.push(['restore'])},0);
 session.move(12);assert.deepEqual(events,[]);assert.equal(session.commit(),true);
 assert.deepEqual(events,[['commit',12],['close']]);assert.equal(session.commit(),false);assert.equal(events.length,2);
});
test('rejected values and cancellation do not complete an editor',()=>{
 let closed=0;
 for(const options of [{candidate:()=>undefined,onCommit:()=>assert.fail('missing value')},{candidate:()=>0,onCommit:()=>false},{candidate:()=>1,onCommit:()=>assert.fail('disabled'),disabled:true}])assert.equal(confirmContextStage(()=>confirmValue(options),()=>closed++),false);
 const session=createHoverPreview();let restored=0;
 session.enter({}, {start:()=>{},move:()=>{},commit:()=>closed++,cancel:()=>restored++},0);session.cancel();
 assert.equal(restored,1);assert.equal(closed,0);
});
