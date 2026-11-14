import test from 'node:test';
import assert from 'node:assert/strict';
import {planSceneNormalization,defaultNormalizationPreferences,transformScenePixels} from '../src/scene/normalization.ts';
const preferences=()=>({...defaultNormalizationPreferences(),luminanceMin:0,luminanceMax:1,contrastMin:0,contrastMax:1,saturationMin:0,saturationMax:1});
const sample=new Uint8ClampedArray(512*4);for(let i=0;i<512;i++){const value=30+i%140;sample.set([value,value,value,255],i*4);}

test('normalization follows gradual luminance targets instead of quarter-step jumps',()=>{
 const reports=Array.from({length:9},(_,i)=>{const target=.42+i*.005;return planSceneNormalization(sample,{...preferences(),luminanceMin:target,luminanceMax:target});});
 assert.ok(new Set(reports.map(r=>r.corrections.exposure.toFixed(4))).size>=8);
 for(let i=0;i<reports.length;i++){assert.ok(Math.abs(reports[i].after.luminance-(.42+i*.005))<.01);if(i)assert.ok(reports[i].corrections.exposure>=reports[i-1].corrections.exposure);}
});
test('normalization remains bounded, retains identity inside limits, and never mutates original pixels',()=>{
 const original=sample.slice(),neutral=planSceneNormalization(sample,preferences());assert.equal(neutral.changed,false);assert.deepEqual(transformScenePixels(sample,neutral.corrections),sample);
 const report=planSceneNormalization(sample,{...preferences(),luminanceMin:.9,luminanceMax:1,exposureLimit:.15});assert.ok(report.corrections.exposure<=.15);assert.deepEqual(sample,original);assert.ok(report.unmet.includes('luminance'));
});

test('normalization editing keeps bound labels stable when their values cross',async()=>{
 const {editNormalization}=await import('../src/scene/normalization.ts');
 const before={...preferences(),luminanceMin:.2,luminanceMax:.4};
 const raised=editNormalization(before,{luminanceMin:.7});assert.equal(raised.luminanceMin,.7);assert.equal(raised.luminanceMax,.7);
 const lowered=editNormalization(raised,{luminanceMax:.3});assert.equal(lowered.luminanceMin,.3);assert.equal(lowered.luminanceMax,.3);
 assert.equal(before.luminanceMax,.4);
});
