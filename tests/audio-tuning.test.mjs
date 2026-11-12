import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSceneVfx,DEFAULT_SCENE_VFX,serializeSceneVfx,WAVE_PRESETS} from '../src/scene/vfx.ts';
import {emptyWorld,validateWorld} from '../src/core/model.ts';
import {parseWorkspaceFile} from '../src/core/transfer.ts';
import {defaultAudioResponse,validateAudioResponse} from '../src/scene/audioResponse.ts';
import {makeCurve} from '../src/properties/curve.ts';
import sceneFunction from '../src/scene/vfx.function.ts';

test('old scenes gain editable curves without overwriting their saved tuning or visual defaults',()=>{
 assert.deepEqual(normalizeSceneVfx(undefined),DEFAULT_SCENE_VFX);
 const raw={pulseAmount:1,audioBounce:1.2,pulseSensitivity:4,pulseHzMax:500,bassAttack:50};
 const settings=normalizeSceneVfx(raw);assert.deepEqual(settings.audioResponse,defaultAudioResponse(1,1.2));
 assert.equal(settings.pulseSensitivity,4);assert.equal(settings.pulseHzMax,500);assert.equal(settings.bassAttack,50);assert.equal(raw.audioResponse,undefined);
 assert.equal(settings.pulseTintHigh,'#0062ff');assert.equal(settings.imageTint,'#00eeff');
 for(const key of ['waveAmplitudeX','waveAmplitudeY','waveFrequencyX','waveFrequencyY','waveSpeedX','waveSpeedY'])assert.equal(settings[key],WAVE_PRESETS[1][key]);
});
test('explicit response curves own behavior independently of retired knobs and return independent arrays',()=>{
 const response=defaultAudioResponse();response.light.loudness=makeCurve(()=>.5);
 const a=normalizeSceneVfx({audioResponse:response}),b=normalizeSceneVfx({audioResponse:response,pulseSensitivity:8,pulseInterval:1500,pulseAmount:0,audioBounce:1,pulseHzMax:1});
 assert.deepEqual(a.audioResponse,b.audioResponse);assert.notEqual(a.audioResponse.light.loudness,response.light.loudness);
 assert.ok(!('scene.pulseSensitivity' in sceneFunction.inputs));assert.ok(!('scene.audioBounce' in sceneFunction.inputs));assert.ok(!('scene.pulseInterval' in sceneFunction.inputs));assert.ok(!('scene.bassAttack' in sceneFunction.inputs));
});
test('curve settings survive copy, save validation and workspace round trips',()=>{
 const world=emptyWorld();world.scene.vfx.audioResponse.bounce.recurrence=makeCurve(()=>.3);
 const text=serializeSceneVfx(world.scene.vfx);assert.deepEqual(JSON.parse(text),world.scene.vfx);
 const restored=parseWorkspaceFile(JSON.stringify({format:'omnium-v2-workspace',version:1,world,scenes:[]}));assert.deepEqual(restored.world.scene.vfx.audioResponse,world.scene.vfx.audioResponse);
});
test('malformed or future curve data is rejected before replacing a saved world',()=>{
 for(const corrupt of [{...defaultAudioResponse(),version:2},{...defaultAudioResponse(),light:{loudness:[1],recurrence:makeCurve(()=>1)}},{...defaultAudioResponse(),bounce:{loudness:makeCurve(()=>1),recurrence:Array(16).fill(NaN)}}]){
  assert.throws(()=>validateAudioResponse(corrupt),/audio response/);
  const world=emptyWorld();world.scene.vfx.audioResponse=corrupt;assert.throws(()=>validateWorld(world),/audio response/);
 }
});
