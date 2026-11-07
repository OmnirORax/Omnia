import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_SCENE_VFX,normalizeSceneVfx,serializeSceneVfx,smoothAudio,audioScale,normalizeAudioLevel} from '../src/scene/vfx.ts';
import {defaultSettings,normalizeSettings} from '../src/workspaceActions.ts';
import {SETTINGS_PROPERTY_ADAPTERS} from '../src/properties/settingsAdapter.ts';
test('scene effects save exactly the pictured controls and screenshot defaults',()=>{
 const keys=['audioBounce','audioLight','distortion','glitching','waves'];
 assert.deepEqual(Object.keys(JSON.parse(serializeSceneVfx({audioLight:'#aa3300',audioBounce:1.12,waves:true,distortion:.4,glitching:.3,frequency:99,source:'private',particles:true}))).sort(),keys);
 assert.deepEqual(normalizeSceneVfx(undefined),{audioLight:'#aa3300',audioBounce:1.12,waves:true,distortion:.4,glitching:.3});
 assert.deepEqual(defaultSettings().sceneVfx,DEFAULT_SCENE_VFX);
 assert.deepEqual(normalizeSettings({}).sceneVfx,DEFAULT_SCENE_VFX);
 const explicit={audioLight:'#123456',audioBounce:1,waves:false,distortion:0,glitching:0};
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
test('shared audio releases rejected and late streams and does not echo captured sound',async()=>{
 const audio=await import('../src/scene/audio.ts');
 const previousContext=globalThis.AudioContext,previousNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 const contexts=[];let nextStream;
 class Node{links=[];disconnect(){}connect(value){this.links.push(value);return value;}}
 class Context{closed=false;state='running';sampleRate=48000;destination={};constructor(){contexts.push(this);}resume(){this.state='running';return Promise.resolve();}close(){this.closed=true;return Promise.resolve();}createAnalyser(){this.analyser=Object.assign(new Node(),{fftSize:2048,frequencyBinCount:1024,getByteFrequencyData:array=>array.fill(255),getByteTimeDomainData:array=>array.fill(255)});return this.analyser;}createMediaStreamSource(){this.source=new Node();return this.source;}}
 globalThis.AudioContext=Context;globalThis.MediaStream=class{constructor(tracks){this.tracks=tracks;}};
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getDisplayMedia:()=>nextStream}}});
 const track=()=>({stopped:false,stop(){this.stopped=true;},addEventListener(){}}),stream=hasAudio=>{const tracks=[track(),...(hasAudio?[track()]:[])];return {tracks,getTracks:()=>tracks,getAudioTracks:()=>hasAudio?[tracks[1]]:[]};};
 try{
 const noAudio=stream(false);nextStream=Promise.resolve(noAudio);await assert.rejects(audio.connectSharedSceneAudio(),/No audio/);assert.ok(noAudio.tracks.every(t=>t.stopped));assert.ok(contexts.at(-1).closed);
 let resolve;nextStream=new Promise(r=>resolve=r);const pending=audio.connectSharedSceneAudio();audio.disconnectSceneAudio();const late=stream(true);resolve(late);await pending;assert.ok(late.tracks.every(t=>t.stopped));assert.equal(audio.isSceneAudioConnected(),false);
 const valid=stream(true);nextStream=Promise.resolve(valid);await audio.connectSharedSceneAudio();assert.equal(audio.isSceneAudioConnected(),true);assert.deepEqual(contexts.at(-1).source.links,[contexts.at(-1).analyser]);assert.deepEqual(contexts.at(-1).analyser.links,[],"captured audio is never connected to speakers");assert.deepEqual(audio.sampleSceneAudio(),{active:true,bass:1,level:1});
 contexts.at(-1).analyser.getByteTimeDomainData=array=>array.fill(132);const quiet=audio.sampleSceneAudio();assert.ok(Math.pow(quiet.level,4)*1.2>.05);
 contexts.at(-1).state='suspended';nextStream=Promise.reject(Error('must not request a second stream'));nextStream.catch(()=>{});await audio.connectSharedSceneAudio();assert.equal(audio.isSceneAudioConnected(),true);assert.equal(contexts.at(-1).state,'running');
 audio.disconnectSceneAudio();assert.ok(valid.tracks.every(t=>t.stopped));
 }finally{audio.disconnectSceneAudio();globalThis.AudioContext=previousContext;delete globalThis.MediaStream;if(previousNavigator)Object.defineProperty(globalThis,'navigator',previousNavigator);else delete globalThis.navigator;}
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
 class Media{paused=true;controls=false;listeners=new Map();constructor(src){this.src=src;}pause(){this.paused=true;}addEventListener(name,fn){this.listeners.set(name,fn);}removeEventListener(name){this.listeners.delete(name);}}
 class Node{connect(){}disconnect(){}}
 class Context{state='running';closed=false;constructor(){contexts.push(this);}resume(){return Promise.resolve();}close(){this.closed=true;return Promise.resolve();}createMediaElementSource(){return new Node();}createAnalyser(){return Object.assign(new Node(),{frequencyBinCount:1024});}}
 globalThis.Audio=Media;globalThis.AudioContext=Context;
 try{
 audio.loadSceneAudioFile(new File(['disposable'],'tone.wav',{type:'audio/wav'}));const first=audio.sceneAudioSnapshot().player;
 await audio.connectSceneAudioElement(first);const releaseView=audio.subscribeSceneAudio(()=>{});releaseView();
 assert.equal(audio.isSceneAudioConnected(),true,'settings visibility must not own the audio session');assert.equal(audio.sceneAudioSnapshot().player,first);
 audio.stopSceneAudio();assert.equal(audio.isSceneAudioConnected(),false);assert.ok(contexts[0].closed);
 const second=audio.sceneAudioSnapshot().player;assert.notEqual(second,first);assert.equal(second.src,first.src);
 await audio.connectSceneAudioElement(second);assert.equal(audio.isSceneAudioConnected(),true);
 audio.disposeSceneAudio();assert.equal(audio.sceneAudioSnapshot().player,null);assert.ok(contexts.at(-1).closed);
 }finally{audio.disposeSceneAudio();globalThis.Audio=previousAudio;globalThis.AudioContext=previousContext;}
});
