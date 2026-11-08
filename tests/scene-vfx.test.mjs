import {PULSE_CONTROLS,referencePulse,referencePulseRGB} from '../src/scene/pulse.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {SCENE_LIGHT_CONTROLS,DEFAULT_SCENE_VFX,normalizeSceneVfx,serializeSceneVfx,smoothAudio,audioScale,normalizeAudioLevel,nextVfxDeadline,SCENE_VFX_FPS} from '../src/scene/vfx.ts';
import {defaultSettings,normalizeSettings} from '../src/workspaceActions.ts';
import {SETTINGS_PROPERTY_ADAPTERS} from '../src/properties/settingsAdapter.ts';
test('scene effects serialize base controls plus requested light tuning, excluding session internals',()=>{
 const keys=['audioBounce','audioLight','distortion','glitching','maxFps','waves','lightAllColors','lightModel','pulseTintLow','pulseTintHigh',...PULSE_CONTROLS.map(c=>c.key),...SCENE_LIGHT_CONTROLS.map(c=>c.key)].sort();
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
 const saved=JSON.parse(serializeSceneVfx(changed.sceneVfx));assert.equal(Object.keys(saved).length,29);assert.equal(saved.lightAllColors,true);
 assert.deepEqual(normalizeSettings({sceneVfx:saved}).sceneVfx,saved);
 const off=SETTINGS_PROPERTY_ADAPTERS['scene.vfx'].channels['scene.lightAllColors'].write(changed,false);
 assert.deepEqual(off.sceneVfx,settings.sceneVfx,'turning off restores selective settings without changing the saved colour/tuning');
});


test('source pulse matches stereo band selection, smoothstep/exponent and amount without clamping 1.2',()=>{
 const bands=new Float32Array(32).fill(1);
 assert.equal(referencePulse(bands,0,15,.01,1,4,1.2),1.2);
 bands.fill(0);assert.equal(referencePulse(bands,0,15,.01,1,4,1.2),0);
 bands[2]=1;bands[18]=0;
 assert.equal(referencePulse(bands,2,2,0,1,1,1.2),.6,'left/right are averaged, not summed or replaced by RMS');
 assert.equal(referencePulse(bands,2,2,0,1,4,1.2),.075);
 assert.equal(referencePulse(bands,3,3,0,1,1,1.2),0);
 assert.equal(referencePulse(bands,2,2,.5,.5,1,1.2),0,'equal bounds are defined without NaN');
 const rgb=referencePulseRGB([.2,.6,.9],[.65882,.65882,.65882],[1,1,1],1.2);
 for(let i=0;i<3;i++){const v=[.2,.6,.9][i],a=v*.65882;assert.ok(Math.abs(rgb[i]-(a+(Math.min(a+v,1)-a)*1.2))<1e-12);}
 assert.ok(rgb[2]>1,'the supplied pulse blend can exceed one; no artificial output clamp');
 assert.deepEqual(referencePulseRGB([.2,.6,.9],[1,1,1],[0,0,0],1.2),[.2,.6,.9]);
});

test('pulse settings retain legacy tuning, use source defaults, and inherit shared setters/serialization',()=>{
 const old={...DEFAULT_SCENE_VFX,lightModel:undefined,pulseTintLow:undefined,pulseTintHigh:undefined};
 for(const {key}of PULSE_CONTROLS)delete old[key];
 const value=normalizeSceneVfx(old);assert.equal(value.lightModel,'pulse');assert.equal(value.pulseTintLow,'#a8a8a8');assert.equal(value.pulseTintHigh,'#ffffff');
 for(const {key,initial}of PULSE_CONTROLS)assert.equal(value[key],initial);
 const channels=SETTINGS_PROPERTY_ADAPTERS['scene.vfx'].channels;
 for(const [key,v]of [['lightModel','legacy'],['pulseTintLow','#112233'],['pulseTintHigh','#445566'],...PULSE_CONTROLS.map(c=>[c.key,c.min])]){
  const base=defaultSettings(),changed=channels[`scene.${key}`].write(base,v);
  assert.equal(changed.sceneVfx[key],v);assert.equal(changed.sceneVfx.lightCoreStrength,base.sceneVfx.lightCoreStrength);
  assert.equal(normalizeSceneVfx(JSON.parse(serializeSceneVfx(changed.sceneVfx)))[key],v);
 }
 assert.equal(normalizeSceneVfx({...value,pulseAmount:0,pulseExponent:0}).pulseAmount,0);
 assert.equal(normalizeSceneVfx({...value,pulseFrequencyMin:12.6}).pulseFrequencyMin,13);
});

test('pulse audio reads both real splitter channels without duplicating audible playback',async()=>{
 const audio=await import('../src/scene/audio.ts'),previous=globalThis.AudioContext;
 class Node{links=[];disconnect(){}connect(node,output){this.links.push({node,output});return node;}}
 let ctx;
 class Context{state='running';sampleRate=48000;destination={};nodes=[];constructor(){ctx=this;}resume(){return Promise.resolve();}close(){return Promise.resolve();}createMediaElementSource(){this.source=new Node();return this.source;}createChannelSplitter(){this.splitter=new Node();return this.splitter;}createAnalyser(){const node=Object.assign(new Node(),{frequencyBinCount:1024,value:255,getByteFrequencyData(buffer){buffer.fill(this.value);},getByteTimeDomainData(buffer){buffer.fill(128);}});this.nodes.push(node);return node;}}
 globalThis.AudioContext=Context;
 try{
 await audio.connectSceneAudioElement({pause(){},addEventListener(){},removeEventListener(){}});
 assert.equal(ctx.nodes.length,3);assert.deepEqual(ctx.splitter.links.map(l=>l.output),[0,1]);
 assert.equal(ctx.nodes[0].links[0].node,ctx.destination);assert.equal(ctx.nodes[1].links.length,0);assert.equal(ctx.nodes[2].links.length,0,'spectrum taps are never sent to speakers a second time');
 assert.equal(audio.sampleScenePulse(DEFAULT_SCENE_VFX),1.2);
 ctx.nodes[1].value=0;const bands=new Float32Array(32);bands.fill(1,16);
 assert.equal(audio.sampleScenePulse(DEFAULT_SCENE_VFX),referencePulse(bands,0,15,.01,1,4,1.2));
 ctx.nodes[2].value=0;assert.equal(audio.sampleScenePulse(DEFAULT_SCENE_VFX),0);
 audio.disconnectSceneAudio();assert.equal(audio.sampleScenePulse(DEFAULT_SCENE_VFX),0);
 }finally{audio.disposeSceneAudio();globalThis.AudioContext=previous;}
});


test('wallpaper output preserves 2560-native detail without raising the graph or bloom budgets',async()=>{
 const {sceneOutputPixelRatio,budgetPixelRatio,RENDER_BUDGET,bloomSize}=await import('../src/renderBudget.ts');
 for(const [w,h,dpr]of [[2560,1440,1],[2560,1600,1],[2560,1080,1],[1280,720,2],[3840,2160,1]]){
  const output=sceneOutputPixelRatio(w,h,dpr,true),graph=budgetPixelRatio(w,h,dpr,RENDER_BUDGET.scenePixels,RENDER_BUDGET.maxSceneDpr);
  assert.equal(output,dpr,`${w}×${h} at DPR ${dpr} must not upscale a low-resolution wallpaper`);
  assert.ok(w*h*graph*graph<=1_500_000+.001);assert.ok(bloomSize(w,h).width<=512);
  assert.equal(sceneOutputPixelRatio(w,h,dpr,false),graph,'removing wallpaper restores the existing output budget');
 }
 const capped=sceneOutputPixelRatio(5120,2880,2,true);assert.ok(5120*2880*capped*capped<=RENDER_BUDGET.wallpaperPixels+.001);
});

test('native wallpaper composition restores visibility and shader inputs after render failures',async()=>{
 const T=await import('three'),{createWallpaper}=await import('../src/scene/wallpaper.ts');
 const priorWindow=globalThis.window,priorDocument=globalThis.document,priorLoad=T.TextureLoader.prototype.loadAsync;
 globalThis.window={matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}})};
 globalThis.document=Object.assign(new EventTarget(),{hidden:true});
 const texture=new T.Texture({width:8,height:8}),world=new T.Texture();T.TextureLoader.prototype.loadAsync=async()=>texture;
 let scene=new T.Scene(),material;
 const renderer={setRenderTarget(){},render(mesh){material=mesh.material;assert.equal(material.uniforms.compositeWorld.value,1);assert.equal(material.uniforms.worldLayer.value,world);throw Error('draw failed');}};
 const paper=createWallpaper(scene,()=>{},renderer);
 try{
  await paper.setURL('disposable');assert.equal(paper.visible,true);
  assert.throws(()=>paper.without(()=>{assert.equal(paper.visible,false);throw Error('graph failed');}),/graph failed/);assert.equal(paper.visible,true);
  assert.throws(()=>paper.renderComposite(world),/draw failed/);assert.equal(material.uniforms.compositeWorld.value,0);assert.equal(material.uniforms.worldLayer.value,null);
  await paper.setURL(null);assert.equal(paper.visible,false);
 }finally{paper.dispose();world.dispose();T.TextureLoader.prototype.loadAsync=priorLoad;globalThis.window=priorWindow;globalThis.document=priorDocument;}
});
