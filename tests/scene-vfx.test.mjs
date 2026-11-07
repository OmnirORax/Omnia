import test from 'node:test';
import assert from 'node:assert/strict';
import {SCENE_LIGHT_CONTROLS,DEFAULT_SCENE_VFX,normalizeSceneVfx,serializeSceneVfx,smoothAudio,audioScale,normalizeAudioLevel,nextVfxDeadline,SCENE_VFX_FPS} from '../src/scene/vfx.ts';
import {defaultSettings,normalizeSettings} from '../src/workspaceActions.ts';
import {SETTINGS_PROPERTY_ADAPTERS} from '../src/properties/settingsAdapter.ts';
test('scene effects serialize base controls plus requested light tuning, excluding session internals',()=>{
 const keys=['audioBounce','audioLight','distortion','glitching','maxFps','waves','lightAllColors',...SCENE_LIGHT_CONTROLS.map(c=>c.key)].sort();
 assert.deepEqual(Object.keys(JSON.parse(serializeSceneVfx({audioLight:'#aa3300',audioBounce:1.12,waves:true,distortion:.4,glitching:.3,frequency:99,source:'private',particles:true}))).sort(),keys);
 assert.deepEqual(normalizeSceneVfx(undefined),{...DEFAULT_SCENE_VFX,audioLight:'#aa3300',audioBounce:1.12,waves:true,distortion:.4,glitching:.3,maxFps:120});
 assert.deepEqual(defaultSettings().sceneVfx,DEFAULT_SCENE_VFX);
 assert.deepEqual(normalizeSettings({}).sceneVfx,DEFAULT_SCENE_VFX);
 const explicit={...DEFAULT_SCENE_VFX,audioLight:'#123456',audioBounce:1,waves:false,distortion:0,glitching:0,maxFps:90};
 assert.deepEqual(normalizeSettings({sceneVfx:explicit}).sceneVfx,explicit);
 assert.deepEqual(normalizeSettings(JSON.parse(JSON.stringify(normalizeSettings({sceneVfx:explicit})))).sceneVfx,explicit);
 assert.equal(normalizeSceneVfx({audioLight:'url(x)',audioBounce:NaN,waves:'false',distortion:Infinity,glitching:-4}).glitching,0);
});
test('scene effects inherit registered property setters without changing other settings',()=>{
 const settings=defaultSettings(),channels=SETTINGS_PROPERTY_ADAPTERS['scene.vfx'].channels;
 const changed=channels['scene.audioBounce'].write(settings,1.3);
 assert.equal(changed.sceneVfx.audioBounce,1.3);assert.equal(settings.sceneVfx.audioBounce,1.12);
 assert.equal(changed.spatial,settings.spatial);assert.equal(changed.appearance,settings.appearance);
 assert.equal(channels.color.read(channels.color.write(settings,'#ffffff')),'#ffffff');
});
test('audio response preserves baseline, bounded bounce and stable smoothing after stalls',()=>{
 assert.equal(audioScale(0,1.12),1);assert.equal(audioScale(1,1.12),1.12);assert.equal(audioScale(99,1.12),1.12);
 assert.equal(smoothAudio(0,1,0),0);assert.equal(smoothAudio(0,1,1/100),.25);
 assert.equal(smoothAudio(0,1,100),1);assert.equal(smoothAudio(.8,0,-1),.8);
});
test('website playback supplies analysis without requesting browser capture and resumes without a second source',async()=>{
 const audio=await import('../src/scene/audio.ts');
 const {readFileSync}=await import('node:fs');assert.doesNotMatch(readFileSync(new URL('../src/scene/audio.ts',import.meta.url),'utf8'),/getDisplayMedia|getUserMedia|createMediaStreamSource/,'scene audio must have no capture implementation');
 const previousContext=globalThis.AudioContext,previousNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 const contexts=[];let captures=0;
 class Node{links=[];disconnect(){}connect(value){this.links.push(value);return value;}}
 class Context{closed=false;state='running';sampleRate=48000;destination={};constructor(){contexts.push(this);}resume(){this.state='running';return Promise.resolve();}close(){this.closed=true;return Promise.resolve();}createAnalyser(){this.analyser=Object.assign(new Node(),{fftSize:2048,frequencyBinCount:1024,getByteFrequencyData:array=>array.fill(255),getByteTimeDomainData:array=>array.fill(255)});return this.analyser;}createMediaElementSource(){this.source=new Node();return this.source;}}
 globalThis.AudioContext=Context;
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getDisplayMedia:()=>{captures++;throw Error('capture must never be requested');},getUserMedia:()=>{captures++;throw Error('microphone must never be requested');}}}});
 const media={paused:false,pause(){this.paused=true;},addEventListener(){},removeEventListener(){}};
 try{
 await audio.connectSceneAudioElement(media);assert.equal(audio.isSceneAudioConnected(),true);assert.deepEqual(contexts.at(-1).source.links,[contexts.at(-1).analyser]);assert.deepEqual(contexts.at(-1).analyser.links,[contexts.at(-1).destination],'the analysed signal is also the audible website playback');assert.deepEqual(audio.sampleSceneAudio(),{active:true,bass:1,level:1});
 contexts.at(-1).analyser.getByteTimeDomainData=array=>array.fill(132);assert.ok(Math.pow(audio.sampleSceneAudio().level,4)*1.2>.05);
 contexts.at(-1).state='suspended';await audio.connectSceneAudioElement(media);assert.equal(contexts.length,1,'resume reuses the media source/context');assert.equal(contexts[0].state,'running');assert.equal(captures,0);
 audio.disconnectSceneAudio();assert.equal(media.paused,true);assert.equal(audio.isSceneAudioConnected(),false);assert.ok(contexts[0].closed);
 }finally{audio.disconnectSceneAudio();globalThis.AudioContext=previousContext;if(previousNavigator)Object.defineProperty(globalThis,'navigator',previousNavigator);else delete globalThis.navigator;}
});

test('quiet audible input survives light shaping while digital silence stays still',()=>{
 assert.equal(normalizeAudioLevel(0),0);assert.equal(normalizeAudioLevel(.001),0);
 const quiet=normalizeAudioLevel(.03),light=Math.pow(quiet,4)*1.2;
 assert.ok(light>.05,'quiet music must produce a visible pulse, not the previous .00001555 strength');
 assert.ok(quiet<normalizeAudioLevel(.08));assert.equal(normalizeAudioLevel(1),1);
});


test('file playback session survives control subscriptions and reconnects with a fresh media element',async()=>{
 const audio=await import('../src/scene/audio.ts'),previousAudio=globalThis.Audio,previousContext=globalThis.AudioContext;
 const contexts=[];
 class Media{paused=true;controls=false;listeners=new Map();constructor(src){this.src=src;}play(){this.paused=false;return Promise.resolve();}pause(){this.paused=true;}remove(){}addEventListener(name,fn){this.listeners.set(name,fn);}removeEventListener(name){this.listeners.delete(name);}}
 class Node{connect(){}disconnect(){}}
 class Context{state='running';closed=false;constructor(){contexts.push(this);}resume(){return Promise.resolve();}close(){this.closed=true;return Promise.resolve();}createMediaElementSource(){return new Node();}createAnalyser(){return Object.assign(new Node(),{frequencyBinCount:1024});}}
 globalThis.Audio=Media;globalThis.AudioContext=Context;
 try{
 audio.loadSceneAudioFile(new File(['disposable'],'tone.wav',{type:'audio/wav'}));const first=audio.sceneAudioSnapshot().player;
 await audio.playSceneAudio();assert.equal(first.paused,false);const releaseView=audio.subscribeSceneAudio(()=>{});releaseView();
 assert.equal(audio.isSceneAudioConnected(),true,'settings visibility must not own the audio session');assert.equal(audio.sceneAudioSnapshot().player,first);
 audio.stopSceneAudio();assert.equal(audio.isSceneAudioConnected(),false);assert.ok(contexts[0].closed);
 const second=audio.sceneAudioSnapshot().player;assert.notEqual(second,first);assert.equal(second.src,first.src);
 await audio.playSceneAudio();assert.equal(second.paused,false);assert.equal(audio.isSceneAudioConnected(),true);
 audio.disposeSceneAudio();assert.equal(audio.sceneAudioSnapshot().player,null);assert.ok(contexts.at(-1).closed);
 }finally{audio.disposeSceneAudio();globalThis.Audio=previousAudio;globalThis.AudioContext=previousContext;}
});


test('wallpaper pacing targets 120 on faster displays and drops stalled-frame debt',()=>{
 assert.equal(SCENE_VFX_FPS,120);
 for(const refresh of [60,120,144,240]){
 let deadline=0,count=0;
 for(let frame=0;frame<refresh;frame++){const now=frame*1000/refresh;if(deadline&&now+.1<deadline)continue;count++;deadline=nextVfxDeadline(deadline,now);}
 assert.ok(Math.abs(count-Math.min(refresh,120))<=1,`${refresh} Hz display rendered ${count} frames`);
 }
 const delayed=nextVfxDeadline(100,5000);assert.ok(delayed>5000&&delayed<=5000+1000/120+.001);
});


test('Max FPS is saved, inherits shared editing, and controls scheduler pacing with a minimum of 60',()=>{
 assert.equal(normalizeSceneVfx({}).maxFps,120);
 assert.equal(normalizeSceneVfx({maxFps:30}).maxFps,60);
 assert.equal(normalizeSceneVfx({maxFps:NaN}).maxFps,120);
 const settings=SETTINGS_PROPERTY_ADAPTERS['scene.vfx'].channels['scene.maxFps'].write(defaultSettings(),144);
 assert.equal(normalizeSettings(JSON.parse(JSON.stringify(settings))).sceneVfx.maxFps,144);
 for(const fps of [60,90,120,144,240]){
 let deadline=0,count=0;for(let frame=0;frame<240;frame++){const now=frame*1000/240;if(deadline&&now+.1<deadline)continue;count++;deadline=nextVfxDeadline(deadline,now,fps);}
 assert.ok(Math.abs(count-fps)<=1,`${fps} cap produced ${count} frames on a 240 Hz clock`);
 }
});

test('wallpaper spatial light caches image/colour work, bounds GPU buffers and restores renderer state',async()=>{
 const T=await import('three'),{createWallpaperLight}=await import('../src/scene/wallpaperLight.ts');
 const originalTarget=new T.WebGLRenderTarget(64,32),viewport=new T.Vector4(3,4,50,20),scissor=new T.Vector4(6,7,8,9);
 const generated=new Set();
 let target=originalTarget,currentViewport=viewport.clone(),currentScissor=scissor.clone(),scissorTest=true,draws=0,fail=false;
 const renderer={xr:{enabled:true},getRenderTarget:()=>target,setRenderTarget:t=>{target=t;if(t&&t!==originalTarget)generated.add(t);},
 getViewport:v=>v.copy(currentViewport),setViewport:v=>currentViewport.copy(v),getScissor:v=>v.copy(currentScissor),setScissor:v=>currentScissor.copy(v),
 getScissorTest:()=>scissorTest,setScissorTest:v=>{scissorTest=v;},render:()=>{draws++;if(fail)throw Error('GPU failure');}};
 const light=createWallpaperLight(renderer),image=new T.Texture({width:4096,height:2048});
 const restored=()=>{assert.equal(target,originalTarget);assert.deepEqual(currentViewport,viewport);assert.deepEqual(currentScissor,scissor);assert.equal(scissorTest,true);assert.equal(renderer.xr.enabled,true);};
 try{
 const first=light.prepare(image,.1,1);assert.equal(draws,5);assert.equal(first.near.image.width,512);assert.equal(first.near.image.height,256);restored();
 const cached=light.prepare(image,.1,1);assert.equal(draws,5,'audio frames and unrelated settings must not regenerate blur');assert.equal(cached.near,first.near);assert.equal(cached.far,first.far);
 light.prepare(image,.6,1);assert.equal(draws,10,'new hue regenerates emission map');light.prepare(image,.6,0);assert.equal(draws,15,'neutral versus coloured targets regenerate map');restored();
 fail=true;assert.throws(()=>light.prepare(image,.2,1),/GPU failure/);restored();fail=false;light.prepare(image,.2,1);assert.equal(draws,21,'failed generation is retried, never cached');
 let disposed=0;[...generated].find(t=>t.texture===first.near).addEventListener('dispose',()=>disposed++);light.clear();assert.equal(disposed,1);const fresh=light.prepare(image,.2,1);assert.notEqual(fresh.near,first.near);assert.equal(draws,26);restored();
 light.prepare(image,.2,1,{...DEFAULT_SCENE_VFX,lightGain:4,lightMix:.5,lightAudioGain:2});assert.equal(draws,26,'intensity-only edits reuse masks');
 light.prepare(image,.2,1,{...DEFAULT_SCENE_VFX,lightNearRadius:2});assert.equal(draws,31,'radius edits regenerate spatial masks');
 light.prepare(image,.2,1,{...DEFAULT_SCENE_VFX,lightHueOuter:90});assert.equal(draws,36,'colour-range edits regenerate masks');
 light.prepare(image,.2,1,{...DEFAULT_SCENE_VFX,lightSourcePower:1});assert.equal(draws,41,'emitter weighting edits regenerate masks');restored();
 light.prepare(image,.2,1,{...DEFAULT_SCENE_VFX,lightAllColors:true});assert.equal(draws,46,'all-colour activation regenerates RGB emission masks');
 light.prepare(image,.2,1,{...DEFAULT_SCENE_VFX,lightAllColors:true});assert.equal(draws,46,'all-colour audio frames reuse masks');restored();
 }finally{light.dispose();image.dispose();originalTarget.dispose();}
});


test('historical scene settings acquire tunable light defaults without overwriting earlier choices',async()=>{
 const {readFileSync}=await import('node:fs');
 const old=JSON.parse(readFileSync(new URL('./fixtures/scene-vfx-six-fields.json',import.meta.url),'utf8'));
 const normalized=normalizeSceneVfx(old);
 for(const [key,value]of Object.entries(old))assert.equal(normalized[key],value);
 for(const {key,initial} of SCENE_LIGHT_CONTROLS)assert.equal(normalized[key],initial);
 assert.equal(normalized.lightCoreStrength,8);assert.equal(normalized.lightNearRadius,.2);assert.equal(normalized.lightMix,.12);
 const settings=defaultSettings(),channels=SETTINGS_PROPERTY_ADAPTERS['scene.vfx'].channels;
 for(const {key,initial,min,max}of SCENE_LIGHT_CONTROLS){
  const changed=channels[`scene.${key}`].write(settings,min);
  assert.equal(changed.sceneVfx[key],min);assert.equal(settings.sceneVfx[key],initial);
  assert.equal(changed.appearance,settings.appearance);assert.equal(changed.spatial,settings.spatial);
  const roundtrip=normalizeSettings(JSON.parse(JSON.stringify(changed)));assert.equal(roundtrip.sceneVfx[key],min);
  assert.equal(normalizeSceneVfx({...old,[key]:-Infinity})[key],initial);
  assert.equal(normalizeSceneVfx({...old,[key]:-999})[key],min);
  assert.equal(normalizeSceneVfx({...old,[key]:999})[key],max);
 }
 const zeros=Object.fromEntries(SCENE_LIGHT_CONTROLS.filter(c=>c.min===0).map(c=>[c.key,0]));
 const saved=JSON.parse(serializeSceneVfx({...old,...zeros,privateAudio:'excluded',privateUniform:44}));
 for(const key of Object.keys(zeros))assert.equal(saved[key],0);
 assert.equal('privateAudio'in saved,false);assert.equal('privateUniform'in saved,false);
 assert.deepEqual(normalizeSceneVfx(saved),saved);
});


test('requested screenshot defaults and saved all-colour activation preserve earlier explicit tuning',async()=>{
 const expected={lightCoreStrength:8,lightNearStrength:8,lightFarStrength:1,lightNearRadius:.2,lightFarRadius:0,lightGain:12,lightMix:.12,lightTintSaturation:2,lightHueInner:180,lightHueOuter:0,lightSourcePower:2.78,lightAudioGain:8,lightAudioPower:8};
 for(const [key,value]of Object.entries(expected))assert.equal(DEFAULT_SCENE_VFX[key],value,key);
 assert.equal(DEFAULT_SCENE_VFX.lightAllColors,false);assert.equal(normalizeSceneVfx({lightAllColors:'true'}).lightAllColors,false);
 const {readFileSync}=await import('node:fs'),old=JSON.parse(readFileSync(new URL('./fixtures/scene-vfx-tuning-v1.json',import.meta.url),'utf8'));
 const restored=normalizeSceneVfx(old);for(const [key,value]of Object.entries(old))assert.equal(restored[key],value,key);
 assert.equal(restored.lightAllColors,false);
 const settings=normalizeSettings({sceneVfx:old}),changed=SETTINGS_PROPERTY_ADAPTERS['scene.vfx'].channels['scene.lightAllColors'].write(settings,true);
 assert.equal(changed.sceneVfx.lightAllColors,true);assert.equal(settings.sceneVfx.lightAllColors,false);
 assert.equal(changed.sceneVfx.audioLight,old.audioLight);assert.equal(changed.appearance,settings.appearance);
 const saved=JSON.parse(serializeSceneVfx(changed.sceneVfx));assert.equal(Object.keys(saved).length,20);assert.equal(saved.lightAllColors,true);
 assert.deepEqual(normalizeSettings({sceneVfx:saved}).sceneVfx,saved);
 const off=SETTINGS_PROPERTY_ADAPTERS['scene.vfx'].channels['scene.lightAllColors'].write(changed,false);
 assert.deepEqual(off.sceneVfx,settings.sceneVfx,'turning off restores selective settings without changing the saved colour/tuning');
});
