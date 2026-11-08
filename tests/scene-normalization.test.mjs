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
  globalThis.onmessage({data:{pixels:input,preferences:{...defaultNormalizationPreferences(),luminanceMin:.4,luminanceMax:.6,contrastMin:0,saturationMin:0}}});
  assert.ok(message.report.changed);assert.deepEqual(message.report.before,before);assert.deepEqual(message.report.after,analyzeScenePixels(sampleScenePixels(message.pixels)));assert.equal(transfers[0],message.pixels.buffer);
  const preferences={...defaultNormalizationPreferences(),luminanceMin:.4,luminanceMax:.6,contrastMin:0,saturationMin:0},canonical=planSceneNormalization(gray,preferences);
  globalThis.onmessage({data:{pixels:pixels(16,()=>[80,80,80,255]),sample:gray,preferences}});assert.deepEqual(message.report.corrections,canonical.corrections,'thumbnail solving uses the same source sample as full output');
 }finally{if(previous.onmessage===undefined)delete globalThis.onmessage;else globalThis.onmessage=previous.onmessage;if(previous.postMessage===undefined)delete globalThis.postMessage;else globalThis.postMessage=previous.postMessage;}
});

test('shared settings previews validate through the real adapters without writing until commit',async()=>{
 const {defaultSettings}=await import('../src/workspaceActions.ts');const {settingsPropertyBindings}=await import('../src/properties/settingsAdapter.ts');
 let saved=defaultSettings(),draft=null,writes=0;const original=saved,property=normalizationProperty('luminanceMin'),change={consumer:NORMALIZATION_FUNCTION,property,value:.6};
 const bindings=settingsPropertyBindings(saved,update=>{saved=update(saved);writes++;},candidate=>{draft=candidate;});
 bindings.preview([change]);assert.equal(writes,0);assert.equal(saved,original);assert.equal(normalizationPreferences(draft.functionValues[NORMALIZATION_FUNCTION]).luminanceMin,0,'unordered interval interpretation still applies');
 bindings.preview([{...change,value:.1}]);assert.equal(draft,null,'restoring the stored value cancels transient state');
 bindings.preview([change]);bindings.commit([change]);assert.equal(draft,null);assert.equal(writes,1);assert.equal(saved.functionValues[NORMALIZATION_FUNCTION][property],.6);
});


test('active context bindings preserve preview ownership for settings and borrowed consumers',async()=>{
 const {contextPropertyBindings,installContextBindings}=await import('../src/properties/contextBindings.ts');const events=[];
 const base={values:{settings:{value:0}},commit:changes=>events.push(['base commit',changes]),preview:changes=>events.push(['base preview',changes])},borrowed={values:{object:{value:0}},commit:changes=>events.push(['object commit',changes]),preview:changes=>events.push(['object preview',changes])};
 const active=installContextBindings(borrowed);try{const binding=contextPropertyBindings(base),changes=[{consumer:'settings',property:'value',value:1},{consumer:'object',property:'value',value:2}];binding.preview(changes);binding.commit(changes);assert.deepEqual(events.map(e=>e[0]),['base preview','object preview','base commit','object commit']);assert.equal(events[0][1][0],changes[0]);assert.equal(events[1][1][0],changes[1]);}finally{active.dispose();}
});

test('allocation-free pixel processing retains frozen pre-optimization byte output',async()=>{
 const {createHash}=await import('node:crypto');
 const source=Uint8ClampedArray.from({length:4096},(_,i)=>i%4===3?(i%28===3?0:255):(i*37+13)%256);
 const fixtures=[
  [{exposure:.75,contrast:1.25,saturation:.75,balance:[1.06,.94,1]},'9af7e021fec5a518b042733edcae2582de9bdde1aca5a546c29acef7543be508'],
  [{exposure:-.75,contrast:.75,saturation:1.25,balance:[.94,1.06,1]},'79f5aedcead9ad8fe5d2d6352cf1d0424d4227d40ed0450578f64953e2e69798'],
  [{exposure:0,contrast:1,saturation:1,balance:[1,1,1]},'a3c5d7eec743503bb1ed923d0142c7bdac57d531c356038ba8490930ee58e6fd'],
 ];
 for(const [corrections,hash] of fixtures)assert.equal(createHash('sha256').update(transformScenePixels(source,corrections)).digest('hex'),hash);
});
test('canvas previews reach the existing wallpaper sampler synchronously without image encoding/loading',async()=>{
 const THREE=await import('three');const {createWallpaper}=await import('../src/scene/wallpaper.ts');const {createSphereBackground}=await import('../src/scene/sphereBlend.ts');
 const scene=new THREE.Scene(),background=createSphereBackground();let paints=0;const wallpaper=createWallpaper(scene,()=>paints++,background),canvas={width:384,height:216};
 const first=wallpaper.setSource(canvas);assert.ok(background.image.value instanceof THREE.CanvasTexture);assert.equal(background.image.value.image,canvas);assert.equal(background.image.value.colorSpace,THREE.SRGBColorSpace);assert.equal(background.hasImage.value,1);assert.ok(paints>0,'no async load barrier before repaint request');await first;
 const previous=background.image.value;let disposed=false;previous.addEventListener('dispose',()=>{disposed=true;});const replacement={width:384,height:216};await wallpaper.setSource(replacement,true);assert.equal(background.image.value.image,replacement);assert.equal(disposed,true);
 await wallpaper.setSource(null);assert.equal(background.image.value,null);assert.equal(background.hasImage.value,0);wallpaper.dispose();assert.equal(scene.children.length,0);
});

test('full-resolution correction changes shared uniforms without replacing the source texture',async()=>{
 const THREE=await import('three');const {createWallpaper}=await import('../src/scene/wallpaper.ts');const {createSphereBackground,sphereBackgroundUniforms,sphereBackgroundGLSL}=await import('../src/scene/sphereBlend.ts');
 const scene=new THREE.Scene(),background=createSphereBackground();let paints=0;const wallpaper=createWallpaper(scene,()=>paints++,background),source={width:2560,height:1440};await wallpaper.setSource(source);
 const texture=background.image.value,uniforms=sphereBackgroundUniforms(background);wallpaper.setCorrection({exposure:.5,contrast:1.2,saturation:.9,balance:[1.04,.97,1]});
 assert.equal(background.image.value,texture);assert.equal(texture.image,source);assert.equal(texture.image.width,2560);assert.equal(texture.image.height,1440);assert.equal(uniforms.sceneCorrectionEnabled.value,1);assert.equal(uniforms.sceneCorrectionExposure.value,.5*Math.LN2);assert.deepEqual(uniforms.sceneCorrectionBalance.value.toArray(),[1.04,.97,1]);assert.ok(paints>=2);
 assert.match(sphereBackgroundGLSL,/return correctSceneImage\(texture2D/,'wallpaper and adaptive spheres sample the same corrected full-size image');
 wallpaper.setCorrection(null);assert.equal(uniforms.sceneCorrectionEnabled.value,0);assert.equal(background.image.value,texture,'before/after changes uniforms, not image size');
 await wallpaper.setSource(null);assert.equal(background.image.value,null);assert.equal(uniforms.sceneCorrectionEnabled.value,0);wallpaper.dispose();
});


test('user-selected normalization defaults retain raw crossed fields and their effective intervals',()=>{
 const raw=Object.fromEntries(NORMALIZATION_FIELDS.map(field=>[field.key,field.initial]));assert.deepEqual(raw,{enabled:true,luminanceMin:.1,luminanceMax:0,contrastMin:.66,contrastMax:.02,saturationMin:1,saturationMax:1,balanceTolerance:.3,exposureLimit:1,contrastLimit:.75,saturationLimit:.75,balanceLimit:.2});
 const effective=defaultNormalizationPreferences();assert.equal(effective.luminanceMin,0);assert.equal(effective.luminanceMax,.1);assert.equal(effective.contrastMin,.02);assert.equal(effective.contrastMax,.66);assert.equal(effective.saturationMin,1);assert.equal(effective.saturationMax,1);
});
