import {PULSE_CONTROLS,referencePulse,referencePulseRGB,pulsePalette,sourcePulseTint,RETIRED_OMNI_BRIGHTNESS_CONTROLS,omniHighTintRGB,createAutomaticPulse} from '../src/scene/pulse.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {RETIRED_LIGHT_CONTROLS,DEFAULT_SCENE_VFX,normalizeSceneVfx,serializeSceneVfx,smoothAudio,followBass,createBassDynamics,audioScale,normalizeAudioLevel,nextVfxDeadline,SCENE_VFX_FPS} from '../src/scene/vfx.ts';
import {defaultSettings,normalizeSettings} from '../src/workspaceActions.ts';
import {SETTINGS_PROPERTY_ADAPTERS} from '../src/properties/settingsAdapter.ts';
test('scene effects serialize base controls plus requested light tuning, excluding session internals',()=>{
 const keys=['pulseRangeMode','pulseSensitivity','pulseDropContrast','audioBounce','audioLight','distortion','glitching','maxFps','waves','lightAllColors','lightModel','pulseTintLow','pulseTintHigh','pulseOmniTint','pulseOmniTintLow','pulseColorMode','pulseColors','pulseColorWidth','pulseAllBrightness','imageTintEnabled','imageTint',...PULSE_CONTROLS.map(c=>c.key),...RETIRED_OMNI_BRIGHTNESS_CONTROLS.map(c=>c.key),...RETIRED_LIGHT_CONTROLS.map(c=>c.key)].sort();
 assert.deepEqual(Object.keys(JSON.parse(serializeSceneVfx({audioLight:'#aa3300',audioBounce:1.12,waves:true,distortion:.4,glitching:.3,frequency:99,source:'private',particles:true}))).sort(),keys);
 assert.deepEqual(normalizeSceneVfx(undefined),{...DEFAULT_SCENE_VFX,audioLight:'#aa3300',audioBounce:1.3,waves:true,distortion:.4,glitching:.3,maxFps:120});
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
 assert.equal(changed.sceneVfx.audioBounce,1.3);assert.equal(settings.sceneVfx.audioBounce,1.3);
 assert.equal(changed.spatial,settings.spatial);assert.equal(changed.appearance,settings.appearance);
 assert.equal(channels['scene.pulseTintHigh'].read(channels['scene.pulseTintHigh'].write(settings,'#ffffff')),'#ffffff');
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
 await audio.connectSceneAudioElement(media);assert.equal(audio.isSceneAudioConnected(),true);assert.deepEqual(contexts.at(-1).source.links,[contexts.at(-1).analyser]);assert.deepEqual(contexts.at(-1).analyser.links,[contexts.at(-1).destination],'the analysed signal is also the audible website playback');assert.deepEqual(audio.sampleSceneAudio(),{active:true,bass:1,bassAmplitude:Math.pow(10,-30/20),level:1});
 contexts.at(-1).analyser.getByteTimeDomainData=array=>array.fill(132);assert.ok(Math.pow(audio.sampleSceneAudio().level,4)*1.2>.05);
 contexts.at(-1).state='suspended';await audio.connectSceneAudioElement(media);assert.equal(contexts.length,1,'resume reuses the media source/context');assert.equal(contexts[0].state,'running');assert.equal(captures,0);
 audio.disconnectSceneAudio();assert.equal(media.paused,true);assert.equal(audio.isSceneAudioConnected(),false);assert.ok(contexts[0].closed);
 }finally{audio.disconnectSceneAudio();globalThis.AudioContext=previousContext;if(previousNavigator)Object.defineProperty(globalThis,'navigator',previousNavigator);else delete globalThis.navigator;}
});

test('quiet meter input survives normalization while digital silence stays still',()=>{
 assert.equal(normalizeAudioLevel(0),0);assert.equal(normalizeAudioLevel(.001),0);
 const quiet=normalizeAudioLevel(.03);assert.ok(quiet>0&&quiet<1);
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

test('retired approximation preferences survive serialization without editable controls or a renderer',async()=>{
 const {readFileSync}=await import('node:fs'),old=JSON.parse(readFileSync(new URL('./fixtures/scene-vfx-tuning-v1.json',import.meta.url),'utf8'));
 const value=normalizeSceneVfx({...old,lightModel:'legacy'});
 for(const [key,v]of Object.entries(old))assert.equal(value[key],v);
 assert.equal(value.lightModel,'legacy','archived choice remains available for older clients, but current renderer ignores it');
 const channels=SETTINGS_PROPERTY_ADAPTERS['scene.vfx'].channels;
 for(const id of ['scene.lightModel','scene.lightAllColors',...RETIRED_LIGHT_CONTROLS.map(c=>`scene.${c.key}`)])assert.equal(channels[id],undefined);
 assert.deepEqual(normalizeSceneVfx(JSON.parse(serializeSceneVfx(value))),value);
 assert.doesNotMatch(readFileSync(new URL('../src/scene/wallpaper.ts',import.meta.url),'utf8'),/spatialLight|pulseModel|emissionColour|lightModel/);
});

test('source pulse matches stereo band selection, smoothstep/exponent and amount without clamping 1.2',()=>{
 const bands=new Float32Array(32).fill(1);
 assert.equal(referencePulse(bands,0,15,.01,1,4,1.2),1.2);
 bands.fill(0);assert.equal(referencePulse(bands,14,15,.01,1,.1,2),0);
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
 const value=normalizeSceneVfx(old);assert.equal(value.lightModel,'pulse');assert.equal(value.pulseTintLow,DEFAULT_SCENE_VFX.pulseTintLow);assert.equal(value.pulseTintHigh,DEFAULT_SCENE_VFX.pulseTintHigh);
 for(const {key,initial}of PULSE_CONTROLS)assert.equal(value[key],initial);
 const channels=SETTINGS_PROPERTY_ADAPTERS['scene.vfx'].channels;
 for(const [key,v]of [['pulseColorMode','all'],['pulseTintLow','#112233'],['pulseTintHigh','#445566'],...PULSE_CONTROLS.map(c=>[c.key,c.min])]){
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
 assert.equal(audio.sampleScenePulse({...DEFAULT_SCENE_VFX,pulseRangeMode:'manual',pulseAmount:2}),2);
 ctx.nodes[1].value=0;const bands=new Float32Array(32);bands.fill(1,16);
 assert.equal(audio.sampleScenePulse({...DEFAULT_SCENE_VFX,pulseRangeMode:'manual',pulseAmount:2}),referencePulse(bands,14,15,.01,1,.1,2));
 ctx.nodes[2].value=0;assert.equal(audio.sampleScenePulse({...DEFAULT_SCENE_VFX,pulseRangeMode:'manual',pulseAmount:2}),0);
 audio.disconnectSceneAudio();assert.equal(audio.sampleScenePulse({...DEFAULT_SCENE_VFX,pulseRangeMode:'manual',pulseAmount:2}),0);
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


test('screenshot defaults and remaining Single/All controls use shared settings/history serialization',()=>{
 const v=normalizeSceneVfx(undefined);assert.equal(v.pulseFrequencyMin,14);assert.equal(v.pulseFrequencyMax,15);assert.equal(v.pulseAudioLow,.01);assert.equal(v.pulseAudioHigh,1);assert.equal(v.pulseExponent,.1);assert.equal(v.pulseAmount,1.7);assert.equal(v.audioBounce,1.3);assert.equal(v.pulseTintLow,'#faf0f0');assert.equal(v.pulseTintHigh,'#3d0000');assert.equal(v.pulseOmniTintLow,'#faf0f0');assert.equal(v.pulseOmniTint,'#3d0000');assert.equal(v.pulseSensitivity,8);assert.equal(v.pulseDropContrast,1);
 const channels=SETTINGS_PROPERTY_ADAPTERS['scene.vfx'].channels;
 for(const [key,value]of [['pulseColorMode','all'],['pulseOmniTint','#330f00']]){
  const settings=defaultSettings(),changed=channels[`scene.${key}`].write(settings,value);
  assert.equal(changed.sceneVfx[key],value);assert.equal(changed.appearance,settings.appearance);
  assert.equal(normalizeSceneVfx(JSON.parse(serializeSceneVfx(changed.sceneVfx)))[key],value);
 }
 assert.equal(normalizeSceneVfx({...v,pulseColors:''}).pulseColors,'');
 assert.equal(normalizeSceneVfx({...v,pulseColorMode:'garbage'}).pulseColorMode,'tint');
 assert.equal(normalizeSceneVfx({...v,pulseColors:'#0044FF invalid #ff8800'}).pulseColors,'#0044ff,#ff8800');
});


test('Retired palette and separate Omni sliders stay archived without active controls',()=>{
 const v=normalizeSceneVfx({pulseColorMode:'selected',pulseColors:'#0044ff,#ff8800',pulseColorWidth:45,pulseAllBrightness:.4});
 assert.equal(v.pulseColorMode,'tint');assert.equal(v.pulseColors,'#0044ff,#ff8800');assert.equal(v.pulseColorWidth,45);
 assert.equal(JSON.parse(serializeSceneVfx(v)).pulseAllBrightness,.4);
 const channels=SETTINGS_PROPERTY_ADAPTERS['scene.vfx'].channels;
 for(const key of ['pulseColors','pulseColorWidth','pulseAllBrightness','pulseOmniLowBrightness','pulseOmniHighBrightness'])assert.equal(channels[`scene.${key}`],undefined);
 assert.equal(v.pulseOmniTint,'#660000');assert.equal(v.pulseOmniLowBrightness,.5);assert.equal(v.pulseOmniHighBrightness,1.5);
});


test('Single tint ticks remain live at exponent 0.1 while bounce works; colour variants do not edit timing',async()=>{
 const T=await import('three'),audio=await import('../src/scene/audio.ts'),{createWallpaper}=await import('../src/scene/wallpaper.ts');
 const prior={window:globalThis.window,document:globalThis.document,AudioContext:globalThis.AudioContext,raf:globalThis.requestAnimationFrame,cancel:globalThis.cancelAnimationFrame,load:T.TextureLoader.prototype.loadAsync};
 const pending=new Map();let id=0,ctx;
 globalThis.window={matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}})};globalThis.document=Object.assign(new EventTarget(),{hidden:false});
 globalThis.requestAnimationFrame=fn=>{pending.set(++id,fn);return id;};globalThis.cancelAnimationFrame=i=>pending.delete(i);
 class Node{connect(n){return n;}disconnect(){}}
 class Context{state='running';sampleRate=48000;destination={};nodes=[];constructor(){ctx=this;}resume(){return Promise.resolve();}close(){return Promise.resolve();}createMediaElementSource(){return new Node();}createChannelSplitter(){return new Node();}createAnalyser(){const node=Object.assign(new Node(),{frequencyBinCount:1024,value:255,getByteFrequencyData(b){b.fill(this.value);},getByteTimeDomainData(b){b.fill(140);}});this.nodes.push(node);return node;}}
 globalThis.AudioContext=Context;T.TextureLoader.prototype.loadAsync=async()=>new T.Texture({width:8,height:8});
 const scene=new T.Scene(),paper=createWallpaper(scene,()=>{},{setRenderTarget(){},render(){}}),settings={...DEFAULT_SCENE_VFX,waves:false,distortion:0,glitching:0,pulseExponent:.1,pulseRangeMode:'manual',pulseColorMode:'tint'};
 try{
  await audio.connectSceneAudioElement({pause(){},addEventListener(){},removeEventListener(){}});paper.configure(settings);await paper.setURL('disposable');
  const material=scene.children.find(o=>o.material?.uniforms?.light).material,u=material.uniforms,values=[];let now=0;
  for(const value of [20,80,160,240,255,0]){
   ctx.nodes[1].value=value;ctx.nodes[2].value=value;const [key,fn]=pending.entries().next().value;pending.delete(key);fn(now+=20);values.push(u.light.value);
  }
  for(let i=1;i<5;i++)assert.ok(values[i]>values[i-1],'light must follow changing signal at 0.1 without retuning');assert.equal(values[5],0);assert.ok(u.bounce.value>1,'bounce can remain active while light returns to zero');
  u.light.value=.6;
  assert.equal(material.defines.PULSE_ALL_COLORS,0);assert.equal(material.defines.IMAGE_TINT,0);
  paper.configure({...settings,pulseColorMode:'all',pulseOmniTint:'#330f00',pulseOmniTintLow:'#003300'});assert.ok(Math.abs(u.pulseOmniTintLow.value.y-.2)<1e-5);assert.equal(u.pulseOmniTintLow.value.x,0);assert.equal(u.light.value,.6,'editing a colour must not reset the live pulse');assert.ok(Math.abs(u.pulseOmniTint.value.x-.2)<1e-5);assert.ok(Math.abs(u.pulseOmniTint.value.y-15/255)<1e-5);assert.equal(material.defines.PULSE_ALL_COLORS,1);assert.equal(material.defines.IMAGE_TINT,0);
  paper.configure({...settings,imageTintEnabled:true,imageTint:'#c20000'});assert.equal(material.defines.PULSE_ALL_COLORS,0);assert.equal(material.defines.IMAGE_TINT,1);
  paper.configure({...settings,pulseRangeMode:'auto',pulseAmount:0});ctx.nodes[1].value=ctx.nodes[2].value=255;
  {const [key,fn]=pending.entries().next().value;pending.delete(key);fn(now+=20);}assert.ok(u.bounce.value>1);assert.equal(u.light.value,0);
  const expanded=u.bounce.value;ctx.nodes[0].value=120;ctx.nodes[1].value=ctx.nodes[2].value=0;
  {const [key,fn]=pending.entries().next().value;pending.delete(key);fn(now+=20);}assert.ok(u.bounce.value>1&&u.bounce.value<expanded,'bass motion should breathe out gently even with nonzero residual noise');
  for(let i=0;i<20;i++){const [key,fn]=pending.entries().next().value;pending.delete(key);fn(now+=20);}assert.ok(u.bounce.value<1.001);
  assert.equal(settings.pulseExponent,.1);assert.equal(settings.maxFps,DEFAULT_SCENE_VFX.maxFps);
 }finally{paper.dispose();T.TextureLoader.prototype.loadAsync=prior.load;globalThis.window=prior.window;globalThis.document=prior.document;globalThis.AudioContext=prior.AudioContext;globalThis.requestAnimationFrame=prior.raf;globalThis.cancelAnimationFrame=prior.cancel;}
});

test('optional Image tint is saved independently of audio colours and disabled by default',()=>{
 assert.equal(DEFAULT_SCENE_VFX.imageTintEnabled,false);const channels=SETTINGS_PROPERTY_ADAPTERS['scene.vfx'].channels,base=defaultSettings();
 const color=channels['scene.imageTint'].write(base,'#c20000'),enabled=channels['scene.imageTintEnabled'].write(color,true);
 assert.equal(enabled.sceneVfx.pulseTintLow,base.sceneVfx.pulseTintLow);assert.equal(enabled.sceneVfx.pulseExponent,base.sceneVfx.pulseExponent);
 assert.equal(normalizeSceneVfx(JSON.parse(serializeSceneVfx(enabled.sceneVfx))).imageTintEnabled,true);assert.equal(normalizeSceneVfx(JSON.parse(serializeSceneVfx(enabled.sceneVfx))).imageTint,'#c20000');assert.equal(normalizeSceneVfx({}).imageTintEnabled,false);
});


test('Omni high tint takes normal picker saturation/value with source hues and the same Low/High blend',()=>{
 const control=[.2,.06,0],blue=[.08,.15,.8],orange=[.8,.3,.08];
 for(const image of [blue,orange,[.4,.4,.4]]){
  const tint=omniHighTintRGB(image,control);
  assert.ok(Math.abs(Math.max(...tint)-.2)<1e-12);
  assert.deepEqual(omniHighTintRGB(image,[0,.06,.2]),tint,'picker hue must never select one image hue');
  assert.deepEqual(omniHighTintRGB(image,[.3,.3,.3]),[.3,.3,.3]);
  assert.deepEqual(omniHighTintRGB(image,[0,0,0]),[0,0,0]);
  const low=[.3,.3,.3];assert.deepEqual(referencePulseRGB(image,low,tint,0),image.map(v=>v*.3));
  const rest=referencePulseRGB(image,low,tint,0),peak=referencePulseRGB(image,low,tint,1);
  assert.ok(peak.some((v,i)=>v>rest[i]));
 }
 const faint=omniHighTintRGB(blue,[.1,0,0]),bright=omniHighTintRGB(blue,[.8,0,0]);assert.ok(bright[2]>faint[2]);
 const pale=omniHighTintRGB(blue,[.8,.6,.6]);assert.ok(pale[0]>bright[0]);assert.equal(pale[2],bright[2]);
 assert.deepEqual(omniHighTintRGB([0,0,1],[.2,.06,0]),[0,0,.2]);
});

test('Omni picker persists independently, inherits old strength once, and leaves Single/audio settings intact',()=>{
 const old={pulseColorMode:'all',pulseAllBrightness:.4,pulseOmniLowBrightness:.2,pulseOmniHighBrightness:1.8,pulseTintLow:'#333333',pulseTintHigh:'#330f00'};
 const converted=normalizeSceneVfx(old);assert.equal(converted.pulseOmniTint,'#660000');
 assert.deepEqual(normalizeSceneVfx(converted),converted);assert.equal(normalizeSceneVfx({...old,pulseAllBrightness:0}).pulseOmniTint,'#000000');
 assert.equal(normalizeSceneVfx({...old,pulseOmniTint:'#112244'}).pulseOmniTint,'#112244');
 const channels=SETTINGS_PROPERTY_ADAPTERS['scene.vfx'].channels,base=defaultSettings();
 const changed=channels['scene.pulseOmniTint'].write(base,'#330f00');
 assert.equal(channels['scene.pulseOmniTint'].read(changed),'#330f00');
 for(const key of ['pulseTintLow','pulseTintHigh','audioBounce','maxFps',...PULSE_CONTROLS.map(c=>c.key)])assert.equal(changed.sceneVfx[key],base.sceneVfx[key]);
 const saved=normalizeSceneVfx(JSON.parse(serializeSceneVfx({...converted,pulseOmniTint:'#000000'})));
 assert.equal(saved.pulseOmniTint,'#000000');assert.equal(saved.pulseOmniHighBrightness,1.8);assert.equal(saved.pulseAllBrightness,.4);
});


test('pale source hues receive the same fully saturated High tint as normal mode without a white bias',()=>{
 const cases=[{image:[.95,.92,.88],hue:[1,4/7,0]},{image:[.88,.92,.95],hue:[0,4/7,1]},{image:[.501,.5,.499],hue:[1,.5,0]}];
 for(const {image,hue} of cases){
  for(const control of [[.2,0,0],[.7,0,0],[1,.5,.5]]){
   const value=Math.max(...control),sat=1-Math.min(...control)/value,normal=hue.map(c=>(1-sat+sat*c)*value),omni=omniHighTintRGB(image,control);
   for(let c=0;c<3;c++)assert.ok(Math.abs(normal[c]-omni[c])<1e-12);
   for(const pulse of [0,.25,1,2]){
    const low=[.6,.65,.7],expected=referencePulseRGB(image,low,normal,pulse),actual=referencePulseRGB(image,low,omni,pulse);
    for(let c=0;c<3;c++)assert.ok(Math.abs(actual[c]-expected[c])<1e-12);
   }
  }
  const saturated=omniHighTintRGB(image,[.7,0,0]);assert.equal(Math.min(...saturated),0);assert.equal(Math.max(...saturated),.7);
 }
 assert.deepEqual(sourcePulseTint([.4,.4,.4]),[1,1,1]);
});


test('Automatic flares rise through mid levels then finish at zero within 100 ms',()=>{
 for(const fps of [60,120,240]){
  const p=createAutomaticPulse(),out=[];for(let i=0;i<Math.ceil(fps*.13);i++)out.push(p.sample(i===0?.4:0,1/fps,8,1,i===0?.4:0,1));
  assert.equal(out[0],0,'an admitted attack must not jump instantly to full emission');
  assert.ok(out.some(v=>v>.1&&v<.9));assert.ok(Math.max(...out)>.7);
  for(let i=Math.ceil(fps*.1);i<out.length;i++)assert.equal(out[i],0);
 }
});


test('automatic mode and sensitivity persist without rewriting legacy manual tuning',()=>{
 const old={pulseAudioLow:.07,pulseAudioHigh:.3,pulseExponent:.1,pulseAmount:1.8,pulseFrequencyMin:7,pulseFrequencyMax:10};
 const legacy=normalizeSceneVfx(old);assert.equal(legacy.pulseRangeMode,'manual');
 for(const key of Object.keys(old))assert.equal(legacy[key],old[key]);
 assert.equal(normalizeSceneVfx(undefined).pulseRangeMode,'auto');assert.equal(normalizeSceneVfx({pulseSensitivity:0}).pulseSensitivity,.25);assert.equal(normalizeSceneVfx({pulseSensitivity:99}).pulseSensitivity,8);
 const channels=SETTINGS_PROPERTY_ADAPTERS['scene.vfx'].channels,base={...defaultSettings(),sceneVfx:legacy};
 const auto=channels['scene.pulseRangeMode'].write(channels['scene.pulseSensitivity'].write(base,3),'auto');
 const saved=normalizeSceneVfx(JSON.parse(serializeSceneVfx(auto.sceneVfx)));assert.equal(saved.pulseRangeMode,'auto');assert.equal(saved.pulseSensitivity,3);
 for(const key of Object.keys(old))assert.equal(saved[key],old[key]);
 const back=channels['scene.pulseRangeMode'].write(auto,'manual');assert.deepEqual(back.sceneVfx,{...legacy,pulseSensitivity:3});
});

test('live Automatic sampler shapes graded flares, returns to base, restores Manual and clears paused pulses',async()=>{
 const audio=await import('../src/scene/audio.ts'),prior=globalThis.AudioContext;let ctx;
 class Node{connect(n){return n;}disconnect(){}}
 class Context{state='running';sampleRate=48000;destination={};nodes=[];constructor(){ctx=this;}resume(){return Promise.resolve();}close(){return Promise.resolve();}createMediaElementSource(){return new Node();}createChannelSplitter(){return new Node();}createAnalyser(){const node=Object.assign(new Node(),{frequencyBinCount:1024,value:0,getByteFrequencyData(b){b.fill(0);if(this.data)b.set(this.data);else{b[2]=this.value;b[30]=this.bed||0;}},getByteTimeDomainData(b){b.fill(128);}});this.nodes.push(node);return node;}}
 globalThis.AudioContext=Context;
 const media={paused:false,pause(){this.paused=true;},addEventListener(){},removeEventListener(){}};
 try{
  await audio.connectSceneAudioElement(media);const settings={...DEFAULT_SCENE_VFX,pulseRangeMode:'auto',pulseSensitivity:8,pulseDropContrast:1,pulseAmount:1};
  const hit=(v)=>{const out=[];for(let i=0;i<24;i++){ctx.nodes[1].value=i<2?v:0;out.push(audio.sampleScenePulse(settings,1/120));}assert.equal(out[0],0);assert.ok(out.slice(14).every(v=>v===0));return Math.max(...out);};
  const peaks=[150,180,220,245].map(hit);for(let i=1;i<peaks.length;i++)assert.ok(peaks[i]>peaks[i-1]);assert.ok(peaks[1]>.05&&peaks[1]<.5);
  assert.equal(ctx.nodes[0].smoothingTimeConstant,.15);assert.equal(ctx.nodes[0].maxDecibels,0);assert.equal(ctx.nodes[1].fftSize,1024);assert.equal(ctx.nodes[1].smoothingTimeConstant,0);
  ctx.nodes[1].bed=230;for(let i=0;i<120;i++)audio.sampleScenePulse(settings,1/120);assert.equal(audio.scenePulseResponse(),0);
  assert.ok(hit(190)>0,'new quieter-frequency hits must still be represented over a steady bed');
  ctx.nodes[1].value=200;assert.equal(audio.sampleScenePulse({...settings,pulseRangeMode:'manual'}),0);assert.equal(ctx.nodes[1].fftSize,2048);assert.equal(ctx.nodes[1].smoothingTimeConstant,.7);assert.equal(ctx.nodes[0].maxDecibels,-30);
  ctx.nodes[1].bed=0;ctx.currentTime=0;audio.sampleScenePulse(settings,0);ctx.currentTime=1/120;assert.ok(audio.sampleScenePulse(settings,0)>0,'audio time must advance even when a setting edit resets render dt');ctx.currentTime=.1;ctx.nodes[1].value=0;assert.equal(audio.sampleScenePulse(settings,0),0,'a stale flare must expire by audio time');delete ctx.currentTime;ctx.nodes[1].value=200;audio.sampleScenePulse(settings,1/120);media.paused=true;assert.equal(audio.sampleScenePulse(settings,1/120),0);
  media.paused=false;ctx.nodes[1].value=0;for(let i=0;i<20;i++)assert.equal(audio.sampleScenePulse(settings,1/120),0,'resume must not restore an old flare tail');
  const dense=new Uint8Array(512);ctx.nodes[1].data=dense;let seed=123,total=0,count=0;
  for(let t=0;t<360;t++){for(let i=4;i<100;i++){seed=(1664525*seed+1013904223)>>>0;dense[i]=150+Math.floor(seed/4294967296*65);}const v=audio.sampleScenePulse(settings,1/120);if(t>120){total+=v;count++;}}
  assert.ok(total/count<.1,'actual sampler must not restore the old high hover under dense changing frequencies');
  audio.disconnectSceneAudio();assert.equal(audio.scenePulseResponse(),0);
 }finally{audio.disconnectSceneAudio();globalThis.AudioContext=prior;}
});


function spectralFrame(p,b,sensitivity=8,contrast=1){const dt=1/120,m=p.spectrum(b,0,1,b.length,dt);return p.sample(m.level,dt,sensitivity,1,m.change,contrast);}
test('dense changing frequencies cannot hold the light high or keep firing micro-flares',()=>{
 const p=createAutomaticPulse(),b=new Uint8Array(512),out=[];let seed=123;
 for(let t=0;t<600;t++){
  for(let i=4;i<100;i++){seed=(1664525*seed+1013904223)>>>0;b[i]=150+Math.floor(seed/4294967296*65);}
  const v=spectralFrame(p,b);if(t>120)out.push(v);
 }
 assert.ok(out.filter(v=>v===0).length/out.length>.8,'dense nonzero background must not hover at emission');
 assert.ok(out.reduce((a,b)=>a+b,0)/out.length<.1,'the old model averaged about 0.69 on this fixture');
});


function isolatedFlare(level,sensitivity=8,contrast=1){const p=createAutomaticPulse(),out=[];for(let i=0;i<24;i++)out.push(p.sample(i===0?level:0,1/120,sensitivity,1,i===0?level:0,contrast));return Math.max(...out);}
test('Sensitivity changes event admission without turning admitted heights into binary peaks',()=>{
 const levels=[.002,.004,.008,.016,.032,.064],counts=[.25,.5,1,2,4,8].map(s=>levels.filter(a=>isolatedFlare(a,s)>0).length);
 assert.deepEqual(counts,[1,2,3,4,5,6]);
 const peaks=[.01,.05,.1,.2,.4].map(v=>isolatedFlare(v));
 for(let i=1;i<peaks.length;i++)assert.ok(peaks[i]>peaks[i-1]);
 assert.ok(peaks[1]>.1&&peaks[1]<.4);assert.ok(peaks[2]>.3&&peaks[2]<.6);
});


test('maximum sensitivity still gives a finite return instead of a hovering tail',()=>{
 const p=createAutomaticPulse(),out=[];
 for(let i=0;i<80;i++)out.push(p.sample(.4,1/120,8,1,.4,1));
 assert.ok(out.some(v=>v>.7));assert.ok(out.slice(14).every(v=>v===0),'an unreleased continuous trigger cannot hold a pulse open');
});


test('Drop contrast widens small/drop strength while preserving the shaped peak',()=>{
 const small=isolatedFlare(.01),big=isolatedFlare(.4);assert.ok(small>0&&big>small*10);
 const smallHighContrast=isolatedFlare(.01,8,4),bigHighContrast=isolatedFlare(.4,8,4);
 assert.ok(bigHighContrast/smallHighContrast>big/small);assert.ok(bigHighContrast>.8);
});


test('Drop contrast inherits shared settings, bounds and persistence without editing other audio or colour parameters',()=>{
 const base=defaultSettings(),channels=SETTINGS_PROPERTY_ADAPTERS['scene.vfx'].channels;
 const changed=channels['scene.pulseDropContrast'].write(base,3.2);
 assert.deepEqual(changed.sceneVfx,{...base.sceneVfx,pulseDropContrast:3.2});assert.equal(changed.appearance,base.appearance);
 const saved=normalizeSceneVfx(JSON.parse(serializeSceneVfx(changed.sceneVfx)));assert.equal(saved.pulseDropContrast,3.2);
 assert.equal(normalizeSceneVfx({}).pulseDropContrast,1);assert.equal(normalizeSceneVfx({pulseDropContrast:0}).pulseDropContrast,1);assert.equal(normalizeSceneVfx({pulseDropContrast:9}).pulseDropContrast,4);
});


test('graded musical attacks over a nonzero background have distinct peaks and complete valleys',()=>{
 const p=createAutomaticPulse(),b=new Uint8Array(512),peaks=[],tails=[];let seed=987;
 for(let t=0;t<240;t++){
  for(let i=2;i<90;i++){seed=(1664525*seed+1013904223)>>>0;b[i]=100+Math.floor(seed/4294967296*12);}
  const hit=Math.floor((t-120)/12),phase=(t-120)%12;
  if(t>=120&&hit<5&&phase<2)for(let i=10;i<26;i++)b[i]=[140,150,170,190,220][hit];
  const v=spectralFrame(p,b);if(t>=120&&hit<5){peaks[hit]=Math.max(peaks[hit]||0,v);if(phase>=10)tails[hit]=Math.max(tails[hit]||0,v);}
 }
 assert.ok(peaks[0]>0&&peaks[0]<.1);assert.ok(peaks[2]>.2&&peaks[2]<.5);assert.ok(peaks[4]>.8);
 for(let i=1;i<peaks.length;i++)assert.ok(peaks[i]>peaks[i-1]*1.2);
 assert.ok(tails.every(v=>v===0),'nonzero residual frequencies must not fill the valleys');
});


test('both Omni endpoints use source hue and independent picker saturation/value; Single base survives',()=>{
 for(const image of [[.8,.3,.1],[.1,.3,.8],[.5,.5,.5]]){
  const base=omniHighTintRGB(image,[.2,.1,0]),high=omniHighTintRGB(image,[.8,.4,0]);
  const rest=referencePulseRGB(image,base,high,0),peak=referencePulseRGB(image,base,high,1);
  assert.deepEqual(rest,image.map((v,i)=>v*base[i]));assert.ok(peak.some((v,i)=>v>rest[i]));
  assert.deepEqual(base,omniHighTintRGB(image,[0,.1,.2]),'Omni base picker hue must also be ignored');
 }
 const old={pulseTintLow:'#003355'},converted=normalizeSceneVfx(old);assert.equal(converted.pulseOmniTintLow,'#003355');assert.deepEqual(normalizeSceneVfx(converted),converted);
 const channels=SETTINGS_PROPERTY_ADAPTERS['scene.vfx'].channels,base=defaultSettings(),changed=channels['scene.pulseOmniTintLow'].write(base,'#000000');
 assert.equal(changed.sceneVfx.pulseTintLow,base.sceneVfx.pulseTintLow);assert.equal(changed.sceneVfx.pulseOmniTint,base.sceneVfx.pulseOmniTint);
 const saved=normalizeSceneVfx(JSON.parse(serializeSceneVfx(changed.sceneVfx)));assert.equal(saved.pulseOmniTintLow,'#000000');assert.equal(saved.pulseTintLow,base.sceneVfx.pulseTintLow);
});


test('restored continuous bass bounce attacks promptly and returns gently without following every light onset',()=>{
 const attack=followBass(0,1,1/120);assert.ok(attack>.45,'attack must not retain the old long lag');
 const release=followBass(1,0,1/120);assert.ok(release>.8&&release<1,'one quiet frame must not snap all the way back');
 assert.equal(followBass(.5,.5,1/120),.5,'sustained bass should retain a steady expansion');
 let settled=1;for(let i=0;i<60;i++)settled=followBass(settled,0,1/120);assert.ok(settled<.0001);
 assert.equal(followBass(.4,1,0),.4);assert.ok(followBass(0,99,.1)<=1);
});


test('residual bass after a drop cannot hold zoom while small details remain proportionally small',()=>{
 const dynamics=createBassDynamics();assert.equal(dynamics.sample(.2,1/120),1,'a strong drop reaches maximum displacement');
 let zoom=1;for(let i=0;i<36;i++)zoom=followBass(zoom,dynamics.sample(.002,1/120),1/120);
 assert.ok(zoom<.002,'residual noise must breathe out after a drop instead of retaining a large target');
 const small=dynamics.sample(.01,0),medium=dynamics.sample(.08,0),drop=dynamics.sample(.2,0);
 assert.ok(small>0&&small<.05);assert.ok(medium>small&&medium<.5);assert.equal(drop,1);
 assert.equal(dynamics.sample(0,.1),0);dynamics.reset();assert.ok(dynamics.sample(.01,0)>small*5,'reset must release the previous track peak reference');assert.equal(dynamics.sample(.0005,.1),0);
});


test('nearby spectral changes coalesce into one flare without extending its deadline',()=>{
 const p=createAutomaticPulse(),out=[];
 for(let i=0;i<24;i++){const flux=i===0?.02:i===2?.03:i===4?.025:i===6?.03:0;out.push(p.sample(.1,1/120,8,1,flux,1));}
 let runs=0;for(let i=0;i<out.length;i++)if(out[i]>0&&!(out[i-1]>0))runs++;
 assert.equal(runs,1);assert.ok(out.slice(12).every(v=>v===0));
});
