import test from 'node:test';
import assert from 'node:assert/strict';
import {createHoverPreview} from '../src/composer/runtime/ui/hoverPreview.ts';
import {createValueScrub} from '../src/composer/runtime/ui/valueScrub.ts';
function field(value=5){let saved=value,shown=value,scrub;return {read:()=>({saved,shown}),api:{start:x=>{scrub=createValueScrub({origin:{x,y:0},width:100,value:saved,min:0,max:10,step:1,axis:{x:1,y:0}});},move:x=>{shown=scrub.sample({x,y:0})??shown;},commit:()=>{saved=shown;},cancel:()=>{shown=saved;}}};}
test('hover motion previews without committing, and a click applies exactly once',()=>{
 const session=createHoverPreview(),f=field(),owner={};session.enter(owner,f.api,100);session.move(130);assert.deepEqual(f.read(),{saved:5,shown:8});session.enter(owner,f.api,130);session.move(140);assert.equal(f.read().shown,9);assert.equal(session.commit(),true);assert.equal(session.commit(),false);assert.deepEqual(f.read(),{saved:9,shown:9});
});
test('switching, Escape-style cancellation and removing the active control restore uncommitted values',()=>{
 const s=createHoverPreview(),a=field(),b=field(2),oa={},ob={};s.enter(oa,a.api,0);s.move(30);s.enter(ob,b.api,30);assert.deepEqual(a.read(),{saved:5,shown:5});s.move(60);assert.equal(b.read().shown,5);s.release(oa);assert.equal(s.active(),true);s.cancel();assert.deepEqual(b.read(),{saved:2,shown:2});s.enter(oa,a.api,0);s.move(30);s.release(oa);assert.equal(s.active(),false);assert.equal(a.read().shown,5);
});
test('horizontal preview can move left first and return to its original value',()=>{
 const s=createHoverPreview(),f=field();s.enter({},f.api,100);s.move(70);assert.equal(f.read().shown,2);
 s.move(100);assert.equal(f.read().shown,5);s.cancel();
});

test('another preview owner can cancel scene manipulation before a DOF takes control',()=>{
 const session=createHoverPreview();let scenePreview=true,notifications=0;
 const stop=session.subscribe(()=>{notifications++;if(session.active())scenePreview=false;});
 session.enter({},field().api,0);assert.equal(scenePreview,false);assert.equal(session.active(),true);
 session.cancel();assert.equal(session.active(),false);const count=notifications;stop();session.enter({},field().api,0);assert.equal(notifications,count);
});
