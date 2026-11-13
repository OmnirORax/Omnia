import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {DEFAULT_BACKGROUND,DEFAULT_BACKGROUND_URL} from '../src/scene/defaultBackground.ts';
import {defaultScene} from '../src/scene/state.ts';
import {normalizeSceneVfx} from '../src/scene/vfx.ts';
import {emptyWorld} from '../src/core/model.ts';
import {createStore} from '../src/core/store.ts';
import {encodeBytes,parseWorkspaceFile,rebindScenes} from '../src/core/transfer.ts';
import {SYSTEM_AUDIO_PREFERENCE_KEY,shouldStartSystemAudio,pauseRememberedSystemAudio,forgetSystemAudioPreference,saveSystemAudioPreference} from '../src/scene/systemAudioPreference.ts';

test('fresh scenes use the uploaded settings, modes and original portable background',async()=>{
 const scene=defaultScene(),bytes=await readFile(new URL(`../public${DEFAULT_BACKGROUND_URL}`,import.meta.url));
 assert.equal(scene.image,DEFAULT_BACKGROUND.id);assert.equal(`sha256:${createHash('sha256').update(bytes).digest('hex')}`,scene.image);
 assert.equal(bytes.length,DEFAULT_BACKGROUND.size);assert.equal(bytes.readUInt32BE(16),DEFAULT_BACKGROUND.width);assert.equal(bytes.readUInt32BE(20),DEFAULT_BACKGROUND.height);
 assert.deepEqual(scene.vfx.audioResponse,{version:2,lightMax:1.5,bounceMax:.15,cooldownMs:300});
 assert.equal(scene.vfx.pulseRangeMode,'auto');assert.equal(scene.vfx.lightModel,'pulse');assert.equal(scene.vfx.imageTintEnabled,false);
 assert.equal(scene.vfx.pulseTintLow,'#e1fefb');assert.equal(scene.vfx.pulseTintHigh,'#3c3271');assert.equal(scene.vfx.imageTint,'#ff00ea');
 const normalization=scene.normalization;assert.equal(normalization.enabled,true);assert.equal(normalization.luminanceMin,0);assert.equal(normalization.luminanceMax,.1);assert.equal(normalization.contrastMin,.02);assert.equal(normalization.contrastMax,.66);
 const world=emptyWorld(),image={id:scene.image,name:DEFAULT_BACKGROUND.name,type:DEFAULT_BACKGROUND.type,data:encodeBytes(bytes)};
 const restored=parseWorkspaceFile(JSON.stringify({format:'omnium-v2-workspace',version:1,world,scenes:[image]}));
 assert.deepEqual(rebindScenes(restored.world,new Map([[image.id,image.id]])),world);
 const second=defaultScene();scene.vfx.audioResponse.lightMax=0;assert.equal(second.vfx.audioResponse.lightMax,1.5);
});
test('saved scene choices stay intact and retired Omni settings cannot activate a colorizer',()=>{
 const world=emptyWorld();world.scene.image=null;world.scene.vfx.pulseTintHigh='#123456';world.scene.vfx.pulseRangeMode='manual';world.scene.vfx.audioResponse={version:2,lightMax:.5,bounceMax:.02,cooldownMs:4000};
 const saved=JSON.stringify(world),store=createStore({getItem:()=>saved,setItem:()=>{}});assert.deepEqual(store.world,world);
 const normalized=normalizeSceneVfx({...world.scene.vfx,pulseColorMode:'all',pulseOmniTint:'#ff0000',pulseOmniTintLow:'#000000',pulseOmniHighBrightness:4,pulseAllBrightness:1,lightAllColors:true});
 assert.equal(normalized.pulseTintHigh,'#123456');assert.deepEqual(normalized.audioResponse,world.scene.vfx.audioResponse);
 assert.ok(!Object.keys(normalized).some(key=>/omni|pulseColor|pulseAll|lightAllColors/i.test(key)));
});
test('audio defaults connect trusted origins, preserve explicit stops and require preview pairing',()=>{
 const old=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),values=new Map();
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)}});
 try{
  const prod='https://omnium.nexus',preview='https://pr-71.omnia-web-bae.pages.dev';
  assert.equal(shouldStartSystemAudio(prod),true);assert.equal(shouldStartSystemAudio('http://localhost:5173'),true);assert.equal(shouldStartSystemAudio(preview),false);assert.equal(shouldStartSystemAudio('https://example.com'),false);
  pauseRememberedSystemAudio();assert.equal(shouldStartSystemAudio(prod),false);forgetSystemAudioPreference();assert.equal(shouldStartSystemAudio(prod),true);
  saveSystemAudioPreference('a'.repeat(32),true);assert.equal(shouldStartSystemAudio(preview),true);pauseRememberedSystemAudio();assert.equal(shouldStartSystemAudio(preview),false);
  for(const raw of ['broken','{"version":2,"code":"","enabled":true}']){values.set(SYSTEM_AUDIO_PREFERENCE_KEY,raw);assert.equal(shouldStartSystemAudio(prod),false);pauseRememberedSystemAudio();assert.equal(values.get(SYSTEM_AUDIO_PREFERENCE_KEY),raw);}
 }finally{if(old)Object.defineProperty(globalThis,'localStorage',old);else delete globalThis.localStorage;}
});
