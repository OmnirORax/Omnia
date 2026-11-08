import {PULSE_CONTROLS,referencePulse,referencePulseRGB,pulsePalette,pulseColorWeight} from '../src/scene/pulse.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {RETIRED_LIGHT_CONTROLS,DEFAULT_SCENE_VFX,normalizeSceneVfx,serializeSceneVfx,smoothAudio,audioScale,normalizeAudioLevel,nextVfxDeadline,SCENE_VFX_FPS} from '../src/scene/vfx.ts';
import {defaultSettings,normalizeSettings} from '../src/workspaceActions.ts';
import {SETTINGS_PROPERTY_ADAPTERS} from '../src/properties/settingsAdapter.ts';
test('scene effects serialize base controls plus requested light tuning, excluding session internals',()=>{
 const keys=['audioBounce','audioLight','distortion','glitching','maxFps','waves','lightAllColors','lightModel','pulseTintLow','pulseTintHigh','pulseColorMode','pulseColors',...PULSE_CONTROLS.map(c=>c.key),...RETIRED_LIGHT_CONTROLS.map(c=>c.key)].sort();
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
 await audio.connectSceneAudioElement(media);assert.equal(audio.isSceneAudioConnected(),true);assert.deepEqual(contexts.at(-1).source.links,[contexts.at(-1).analyser]);assert.deepEqual(contexts.at(-1).analyser.links,[contexts.at(-1).destination],'the analysed signal is also the audible website playback');assert.deepEqual(audio.sampleSceneAudio(),{active:true,bass:1,level:1});
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
 assert.equal(audio.sampleScenePulse(DEFAULT_SCENE_VFX),2);
 ctx.nodes[1].value=0;const bands=new Float32Array(32);bands.fill(1,16);
 assert.equal(audio.sampleScenePulse(DEFAULT_SCENE_VFX),referencePulse(bands,14,15,.01,1,.1,2));
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


test('selected colours form a bounded union; all colours uses untinted source channels',()=>{
 assert.deepEqual(pulsePalette(' #0044FF, #ff8800;#0044ff bad '),['#0044ff','#ff8800']);
 assert.equal(pulsePalette(Array(20).fill('#ffffff').join(',')).length,1);
 assert.equal(pulsePalette('#111111,#222222,#333333,#444444,#555555,#666666,#777777,#888888,#999999').length,8);
 const blue={h:225/360,s:1},orange={h:32/360,s:1};
 assert.equal(pulseColorWeight(blue.h,1,[blue,orange],30),1);
 assert.equal(pulseColorWeight(orange.h,1,[blue,orange],30),1);
 assert.equal(pulseColorWeight(120/360,1,[blue,orange],30),0);
 assert.equal(pulseColorWeight(0,0,[blue,orange],30),0);
 assert.equal(pulseColorWeight(0,0,[{h:0,s:0}],30),1);
 assert.equal(pulseColorWeight(blue.h,1,[blue,blue],30),1,'overlap does not double response');
 assert.equal(pulseColorWeight(blue.h,1,[],30),0);
 assert.equal(pulseColorWeight(.99,1,[{h:.01,s:1}],30),1,'hue matching wraps');
 const w=pulseColorWeight((225+22)/360,1,[blue],30);assert.ok(w>0&&w<1);
 const orangeImage=[.5,.25,.05],lit=referencePulseRGB(orangeImage,[1,1,1],[1,1,1],.5);
 assert.ok(lit[0]>lit[1]&&lit[1]>lit[2],'all-colour white multiplier keeps the source orange rather than applying a global blue tint');
});

test('new screenshot defaults and palette controls use shared settings/history serialization',()=>{
 const v=normalizeSceneVfx(undefined);assert.equal(v.pulseFrequencyMin,14);assert.equal(v.pulseFrequencyMax,15);assert.equal(v.pulseAudioLow,.01);assert.equal(v.pulseAudioHigh,1);assert.equal(v.pulseExponent,.1);assert.equal(v.pulseAmount,2);assert.equal(v.audioBounce,1.3);
 const channels=SETTINGS_PROPERTY_ADAPTERS['scene.vfx'].channels;
 for(const [key,value]of [['pulseColorMode','selected'],['pulseColors','#0044ff,#ff8800'],['pulseColorWidth',45]]){
  const settings=defaultSettings(),changed=channels[`scene.${key}`].write(settings,value);
  assert.equal(changed.sceneVfx[key],value);assert.equal(changed.appearance,settings.appearance);
  assert.equal(normalizeSceneVfx(JSON.parse(serializeSceneVfx(changed.sceneVfx)))[key],value);
 }
 assert.equal(normalizeSceneVfx({...v,pulseColors:''}).pulseColors,'');
 assert.equal(normalizeSceneVfx({...v,pulseColorMode:'garbage'}).pulseColorMode,'tint');
 assert.equal(normalizeSceneVfx({...v,pulseColors:'#0044FF invalid #ff8800'}).pulseColors,'#0044ff,#ff8800');
});
