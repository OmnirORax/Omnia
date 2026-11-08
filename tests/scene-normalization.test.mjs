import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultNormalizationPreferences,normalizationPreferences,normalizationProperty,normalizationKey,analyzeScenePixels,planSceneNormalization,transformScenePixels,sampleScenePixels,NORMALIZATION_FIELDS,NORMALIZATION_FUNCTION} from '../src/scene/normalization.ts';
const pixels=(size,make)=>Uint8ClampedArray.from({length:size*4},(_,i)=>make(Math.floor(i/4))[i%4]);
const gray=pixels(1024,i=>{const v=40+i%90;return [v,v,v,255];});

test('normalization preserves originals, alpha, identity and already-acceptable images exactly',()=>{
 const p={...defaultNormalizationPreferences(),luminanceMin:0,luminanceMax:1,contrastMin:0,contrastMax:1,saturationMin:0,saturationMax:1,balanceTolerance:1};
 const source=pixels(1024,i=>[i%256,(i*19)%256,(i*31)%256,i%256]),copy=source.slice(),report=planSceneNormalization(source,p);
 assert.equal(report.changed,false);assert.deepEqual(transformScenePixels(source,report.corrections),copy);assert.deepEqual(source,copy);
 const transparent=new Uint8ClampedArray([250,0,0,0]);assert.equal(analyzeScenePixels(transparent).samples,0);assert.equal(planSceneNormalization(transparent,defaultNormalizationPreferences()).changed,false);
});
test('bounded corrections improve a violated range and disabled/zero limits leave bytes untouched',()=>{
 const p={...defaultNormalizationPreferences(),luminanceMin:.4,luminanceMax:.6,contrastMin:0,contrastMax:1,saturationMin:0,saturationMax:1};
 const copy=gray.slice(),report=planSceneNormalization(gray,p),output=transformScenePixels(gray,report.corrections);
 assert.ok(report.changed);assert.ok(report.after.luminance>report.before.luminance);assert.ok(Math.abs(report.corrections.exposure)<=p.exposureLimit);assert.deepEqual(analyzeScenePixels(output),report.after);assert.deepEqual(gray,copy);
 for(const preferences of [{...p,enabled:false},{...p,exposureLimit:0,contrastLimit:0,saturationLimit:0,balanceLimit:0}])assert.equal(planSceneNormalization(gray,preferences).changed,false);
 const black=planSceneNormalization(pixels(256,()=>[0,0,0,255]),p);assert.ok(black.unmet.includes('luminance'));assert.equal(black.changed,false,'unrecoverable black is reported, not invented');
});
test('corrections protect per-channel endpoints and keep transparent pixels/alpha unchanged',()=>{
 const source=pixels(4096,i=>[(i*13)%256,(i*71)%256,(i*3)%256,i%17?255:0]),copy=source.slice();
 const output=transformScenePixels(source,{exposure:2,contrast:1.75,saturation:1.75,balance:[1.2,.8,1.1]});
 for(let i=0;i<source.length;i+=4){assert.equal(output[i+3],source[i+3]);for(let c=0;c<3;c++){if(source[i+3]===0)assert.equal(output[i+c],source[i+c]);if(source[i+c]>0)assert.ok(output[i+c]>0);if(source[i+c]<255)assert.ok(output[i+c]<255);}}
 assert.deepEqual(source,copy);
});
test('dominant artistic palettes are not treated as neutral casts without evidence',()=>{
 const blue=pixels(1024,i=>[12,25,80+i%150,255]);const p={...defaultNormalizationPreferences(),luminanceMin:0,luminanceMax:1,contrastMin:0,contrastMax:1,saturationMin:0,saturationMax:1,balanceTolerance:0};
 const report=planSceneNormalization(blue,p);assert.equal(report.balanceAvailable,false);assert.equal(report.changed,false);assert.deepEqual(report.corrections.balance,[1,1,1]);
 const neutral=pixels(1024,i=>[100+i%20,110+i%20,100+i%20,255]);const correction=planSceneNormalization(neutral,{...p,balanceLimit:.2});assert.equal(correction.balanceAvailable,true);assert.ok(correction.after.balance<correction.before.balance);
});
test('preference keys include ranges, limits and algorithm version, with deterministic reversed intervals',()=>{
 const p=defaultNormalizationPreferences(),values=Object.fromEntries(NORMALIZATION_FIELDS.map(f=>[normalizationProperty(f.key),f.initial]));
 values[normalizationProperty('luminanceMin')]=.7;values[normalizationProperty('luminanceMax')]=.2;const read=normalizationPreferences(values);assert.equal(read.luminanceMin,.2);assert.equal(read.luminanceMax,.7);
 assert.notEqual(normalizationKey(p),normalizationKey({...p,saturationMax:.5}));assert.equal(normalizationKey(p),normalizationKey({...p,enabled:false}));assert.equal(normalizationPreferences({[normalizationProperty('exposureLimit')]:0}).exposureLimit,0);
 assert.ok(sampleScenePixels(new Uint8ClampedArray(1_000_000)).length<=16384*4);
});
test('normalization preferences use existing portable settings adapters and survive settings round trips',async()=>{
 const {defaultSettings,normalizeSettings}=await import('../src/workspaceActions.ts');const fn=(await import('../src/scene/normalization.function.ts')).default;
 let settings=defaultSettings();for(const [id,input] of Object.entries(fn.inputs)){const value=id.endsWith('enabled')?false:0;settings=input.write(settings,value);assert.equal(input.read(settings),value);}
 const restored=normalizeSettings(JSON.parse(JSON.stringify(settings)));for(const input of Object.values(fn.inputs))assert.equal(input.read(restored),input.read(settings));
 assert.equal(normalizationPreferences(restored.functionValues[NORMALIZATION_FUNCTION]).enabled,false);assert.equal(normalizationPreferences(restored.functionValues[NORMALIZATION_FUNCTION]).exposureLimit,0);
});


test('worker bridge remeasures actual output pixels and returns its transferred buffer',async()=>{
 const previous={onmessage:globalThis.onmessage,postMessage:globalThis.postMessage};let message,transfers;
 try{
  globalThis.postMessage=(value,buffers)=>{message=value;transfers=buffers;};await import('../src/scene/normalization.worker.ts');
  const input=gray.slice(),before=analyzeScenePixels(sampleScenePixels(input));
  globalThis.onmessage({data:{pixels:input,preferences:{...defaultNormalizationPreferences(),luminanceMin:.4,contrastMin:0,saturationMin:0}}});
  assert.ok(message.report.changed);assert.deepEqual(message.report.before,before);assert.deepEqual(message.report.after,analyzeScenePixels(sampleScenePixels(message.pixels)));assert.equal(transfers[0],message.pixels.buffer);
 }finally{if(previous.onmessage===undefined)delete globalThis.onmessage;else globalThis.onmessage=previous.onmessage;if(previous.postMessage===undefined)delete globalThis.postMessage;else globalThis.postMessage=previous.postMessage;}
});
