import test from 'node:test';import assert from 'node:assert/strict';
import {dialValueGrid,dialGridValue,nearestDialValue,createDialValueDraft} from '../src/properties/dialValueGrid.ts';
import {mathematicalScaleValue,mathematicalScaleRejection,mathematicalScaleMaximum} from '../src/properties/mathematicalDial.ts';
const domain={min:0,max:1};
test('equilibrium steps and halving depth are distinct numbers',()=>{
 const grid=dialValueGrid(domain);assert.equal(grid.equilibrium,.5);assert.equal(grid.snap,.125);
 assert.equal(dialGridValue(grid,2),.75);assert.equal(dialGridValue(grid,-2),.25);assert.equal(dialGridValue(grid,4),1);assert.equal(dialGridValue(grid,-4),0);
 assert.equal(mathematicalScaleValue(1,3,'halving'),.125);assert.equal(mathematicalScaleValue(.125,3,'doubling'),1);
});
test('reciprocal divides the frozen base and rejects zero and fractional divisors',()=>{
 assert.equal(mathematicalScaleValue(1,5,'division'),.2);assert.equal(mathematicalScaleValue(100,4,'division'),25);
 assert.ok(Number.isNaN(mathematicalScaleValue(1,0,'division')));assert.ok(Number.isNaN(mathematicalScaleValue(1,1.5,'division')));
 assert.match(mathematicalScaleRejection(1,0,'division',domain),/positive/);assert.match(mathematicalScaleRejection(100,3,'division',{min:1,max:100,integer:true}),/whole number/);
 assert.equal(mathematicalScaleMaximum(1,'division',{min:.01,max:1}),100);
});
test('legacy values propose the nearest legal step without authoring on open, hover or cancellation',()=>{
 const previews=[],commits=[];let restores=0;const draft=createDialValueDraft({domain,value:.22,preview:n=>previews.push(n),restore:()=>restores++,commit:n=>commits.push(n)});
 assert.equal(draft.candidate,.25);assert.equal(draft.frozen,.25);assert.deepEqual(commits,[]);draft.hover(.75);draft.restorePreview();assert.equal(restores,1);assert.deepEqual(commits,[]);
 draft.choose(.875);draft.hover(1);draft.restorePreview();assert.equal(previews.at(-1),.875);draft.cancel();assert.equal(restores,2);assert.deepEqual(commits,[]);
});
test('acceptance is one write and rejection retains the pending value',()=>{
 const commits=[];let reject=true;const draft=createDialValueDraft({domain,value:.22,preview(){},restore(){},commit:n=>{if(reject)return false;commits.push(n);}});
 assert.equal(draft.accept(),false);assert.equal(draft.finished,false);reject=false;assert.equal(draft.accept(),true);assert.deepEqual(commits,[.25]);assert.equal(draft.accept(),false);draft.cancel();assert.deepEqual(commits,[.25]);
});
test('Snap configuration changes the grid without authoring Value, and represented fractions survive reopening',()=>{
 const commits=[];const draft=createDialValueDraft({domain,value:.22,preview(){},restore(){},commit:n=>commits.push(n)});
 assert.equal(draft.setSnap(.1),true);assert.equal(draft.candidate,.2);assert.deepEqual(commits,[]);assert.equal(draft.setSnap(0),false);assert.equal(draft.setSnap(-1),false);draft.accept();assert.deepEqual(commits,[.2]);
 const represented=createDialValueDraft({domain,value:1/3,represented:true,preview(){},restore(){},commit(){}});assert.equal(represented.candidate,1/3);assert.equal(represented.frozen,1/3);
});
test('nearest values stay on the lattice and integer consumers refuse fractional snaps',()=>{
 const grid=dialValueGrid({min:.1,max:.9},.3);assert.equal(nearestDialValue(grid,1),.8);assert.equal(nearestDialValue(grid,-1),.2);
 const integer=createDialValueDraft({domain:{min:0,max:10,integer:true},value:3,preview(){},restore(){},commit(){}});assert.equal(integer.setSnap(.5),false);assert.equal(integer.choose(2.5),false);assert.equal(integer.choose(11),false);
});

test('a subnormal legacy lower bound cannot admit zero by rounding the index',()=>{
 const grid=dialValueGrid({min:Number.MIN_VALUE,max:4});assert.equal(nearestDialValue(grid,Number.MIN_VALUE),.5);
});
