import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSceneVfx,DEFAULT_SCENE_VFX,serializeSceneVfx,WAVE_PRESETS} from '../src/scene/vfx.ts';
import {emptyWorld,validateWorld} from '../src/core/model.ts';
import {parseWorkspaceFile} from '../src/core/transfer.ts';
import {defaultAudioResponse,validateAudioResponse,audioResponse} from '../src/scene/audioResponse.ts';
const oldCurves=()=>({version:1,light:{loudness:Array(16).fill(.75),recurrence:Array(16).fill(1)},bounce:{loudness:Array(16).fill(.4),recurrence:Array(16).fill(1)}});

test('legacy scalar scenes acquire maxima and cooldown without altering their original settings',()=>{
 assert.deepEqual(normalizeSceneVfx(undefined),DEFAULT_SCENE_VFX);
 const raw={pulseAmount:1,audioBounce:1.2,pulseSensitivity:4,pulseHzMax:500,bassAttack:50};
 const settings=normalizeSceneVfx(raw);assert.deepEqual(settings.audioResponse,defaultAudioResponse(1,1.2));
 assert.equal(raw.audioResponse,undefined);assert.equal(settings.pulseSensitivity,4);assert.equal(settings.pulseHzMax,500);
 assert.equal(settings.pulseTintHigh,'#3c3271');assert.equal(settings.imageTint,'#ff00ea');
 for(const key of ['waveAmplitudeX','waveAmplitudeY','waveFrequencyX','waveFrequencyY','waveSpeedX','waveSpeedY'])assert.equal(settings[key],WAVE_PRESETS[1][key]);
});
test('old graph preferences convert to maxima and remain recoverable as inactive data',()=>{
 const original=oldCurves(),converted=audioResponse(original);
 assert.equal(converted.version,2);assert.equal(converted.lightMax,1.5);assert.equal(converted.bounceMax,.2);assert.equal(converted.cooldownMs,1000);
 assert.deepEqual(converted.retiredCurves,original);assert.notEqual(converted.retiredCurves,original);assert.equal(original.version,1);
 const world=emptyWorld();world.scene.vfx.audioResponse=original;assert.doesNotThrow(()=>validateWorld(world));
});
test('maxima and cooldown remain independent of light shaping and retired scalar maxima',()=>{
 const response=defaultAudioResponse();const a=normalizeSceneVfx({audioResponse:response}),b=normalizeSceneVfx({audioResponse:response,pulseSensitivity:8,pulseAmount:0,audioBounce:1,pulseInterval:1500});
 assert.deepEqual(a.audioResponse,b.audioResponse);
});
test('settings and archived curve data survive copy and workspace round trips',()=>{
 const world=emptyWorld();world.scene.image=null;world.scene.vfx.audioResponse={...audioResponse(oldCurves()),cooldownMs:2500};
 assert.deepEqual(JSON.parse(serializeSceneVfx(world.scene.vfx)),world.scene.vfx);
 const restored=parseWorkspaceFile(JSON.stringify({format:'omnium-v2-workspace',version:1,world,scenes:[]}));assert.deepEqual(restored.world.scene.vfx.audioResponse,world.scene.vfx.audioResponse);
});
test('invalid settings and future formats are rejected before replacing saved data',()=>{
 for(const corrupt of [{...defaultAudioResponse(),version:3},{...defaultAudioResponse(),lightMax:NaN},{...defaultAudioResponse(),bounceMax:1},{...defaultAudioResponse(),cooldownMs:-1},{...defaultAudioResponse(),retiredCurves:{version:1}},{...oldCurves(),light:{loudness:[1],recurrence:Array(16).fill(1)}}]){
  assert.throws(()=>validateAudioResponse(corrupt),/audio response/);const world=emptyWorld();world.scene.vfx.audioResponse=corrupt;assert.throws(()=>validateWorld(world),/audio response/);
 }
});
test('restored light controls write saved tuning while retaining response maxima and cooldown',async()=>{
 const {default:bindings}=await import('../src/scene/vfx.function.ts');
 const state={sceneVfx:normalizeSceneVfx(undefined)},response=structuredClone(state.sceneVfx.audioResponse);
 let current=state;
 for(const [key,value] of Object.entries({pulseSensitivity:4,pulseDropContrast:2,audioNoiseFloor:.005,audioNoiseKnee:.01,pulseDuration:500,pulseAttackFraction:.3})){
  current=bindings.inputs[`scene.${key}`].write(current,value);assert.equal(current.sceneVfx[key],value);
 }
 const restored=JSON.parse(serializeSceneVfx(current.sceneVfx));assert.deepEqual(restored,current.sceneVfx);assert.deepEqual(restored.audioResponse,response);
});
