import test from 'node:test';
import assert from 'node:assert/strict';
import {createValueScrub} from '../src/composer/runtime/ui/valueScrub.ts';
import {createFramePreview} from '../src/composer/runtime/ui/framePreview.ts';
import {selectionDegree} from '../src/composer/runtime/omnic/degreeCommands.ts';
import {selectedEditorDegrees,targetParameter} from '../src/omnic/targetDegrees.ts';

test('compact color controls advance one hue per pixel in either direction',()=>{
 for(const width of [48,72,100,160]){
  const scrub=createValueScrub({origin:{x:100,y:0},width,value:180,min:0,max:359,step:1,pixelsPerStep:1,axis:{x:1,y:0}});
  for(let delta=-20;delta<=20;delta++)assert.equal(scrub.sample({x:100+delta,y:0}),180+delta);
 }
 const vertical=createValueScrub({origin:{x:0,y:100},width:50,value:180,min:0,max:359,step:1,pixelsPerStep:1,axis:{x:0,y:1}});
 assert.equal(vertical.sample({x:0,y:101}),181);
});
test('pointer bursts perform one preview per frame and release flushes the newest value',()=>{
 const frames=new Map(),seen=[];let id=0;
 const preview=createFramePreview(value=>seen.push(value),run=>{frames.set(++id,run);return id;},key=>frames.delete(key));
 for(let i=1;i<=20;i++)preview.push(i);
 assert.equal(frames.size,1);assert.deepEqual(seen,[]);[...frames.values()][0]();assert.deepEqual(seen,[20]);
 preview.push(21);preview.push(22);preview.flush();assert.deepEqual(seen,[20,22]);assert.equal(frames.size,0);
 preview.push(23);preview.discard();assert.equal(frames.size,0);assert.deepEqual(seen,[20,22]);
});
test('selecting a shape does not reopen a remembered Fill or Color editor',()=>{
 const recipe={version:2,revision:0,components:[{id:'shape',generator:'dot',params:{size:10,fill:false,color:'#ff0000'}}],operations:[],frames:[]};
 const before=structuredClone(recipe),degrees=selectedEditorDegrees(recipe,['shape']);
 for(const property of ['omnic.fill','color']){
  assert.ok(degrees.some(degree=>degree.properties.includes(property)));
  const next=selectionDegree(recipe,['shape'],property);
  assert.ok(next.axes?.length);assert.ok(!next.properties.includes(property));
 }
 const size=degrees.find(degree=>targetParameter(degree).kind==='number'&&!degree.axes);
 assert.ok(size);assert.equal(selectionDegree(recipe,['shape'],size.id).id,size.id);
 assert.deepEqual(recipe,before);
});
