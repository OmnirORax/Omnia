import test from 'node:test';
import assert from 'node:assert/strict';
import { AUDIO_TUNING_CONTROLS,AUDIO_TUNING_DEFAULTS,frequencyRange } from '../src/scene/audioTuning.ts';
import { normalizeSceneVfx,createBassDynamics,followBass,serializeSceneVfx } from '../src/scene/vfx.ts';
import { createAutomaticPulse,createPulseEnvelope } from '../src/scene/pulse.ts';
import { emptyWorld } from '../src/core/model.ts';
import { parseWorkspaceFile } from '../src/core/transfer.ts';

const tuning=patch=>({...AUDIO_TUNING_DEFAULTS,...patch});
test('pulse noise and onset controls change actual detection',()=>{
  const sample=patch=>createAutomaticPulse().sample(.03,1/60,2,1.7,.03,.03,1,tuning(patch));
  assert.ok(sample({})>0);
  assert.equal(sample({audioNoiseFloor:.04}),0);
  assert.equal(sample({pulseOnsetFloor:.04}),0);
  assert.ok(sample({audioNoiseKnee:.1})<sample({}));
  assert.ok(sample({pulseReferenceWeight:1})<sample({}));
});

test('onset tracking duration changes residual spectral rises',()=>{
  const sample=time=>{
    const pulse=createAutomaticPulse(),bytes=new Uint8Array(512);bytes[10]=230;
    pulse.spectrum(bytes,0,1,512,1/60,tuning({pulseOnsetTime:time}));
    return pulse.spectrum(bytes,0,1,512,1/60,tuning({pulseOnsetTime:time})).change;
  };
  assert.ok(sample(100)>sample(5));
});

test('timing controls shape admitted pulses and trigger level',()=>{
  const sample=patch=>{
    const envelope=createPulseEnvelope(),settings=tuning(patch);envelope.sample(.5,.025,1000,settings);
    return envelope.sample(0,.025,1000,settings);
  };
  assert.ok(sample({})>0);
  assert.equal(sample({pulseTrigger:.6}),0);
  assert.ok(sample({pulseAttackFraction:.8})<sample({}));
  assert.equal(sample({pulseDuration:5}),0);
  assert.equal(sample({pulseIntervalFill:.1,pulseDuration:1000}),.5);
});

test('bounce controls change dynamics and remain bounded at extreme settings',()=>{
  const sample=patch=>createBassDynamics().sample(.05,1/60,tuning(patch));
  assert.ok(sample({bassReferenceMin:.3})<sample({}));
  assert.equal(sample({bassFloorRatio:.9}),0);
  assert.ok(followBass(0,1,.02,tuning({bassAttack:5}))>followBass(0,1,.02,tuning({bassAttack:100})));
  assert.ok(followBass(1,0,.02,tuning({bassRelease:100}))>followBass(1,0,.02,tuning({bassRelease:5})));
  for(const side of ['min','max']){
    const settings=tuning(Object.fromEntries(AUDIO_TUNING_CONTROLS.map(c=>[c.key,c[side]]))),bass=createBassDynamics();
    for(const amplitude of [0,.001,.01,.1,1]){const value=bass.sample(amplitude,1/60,settings);assert.ok(Number.isFinite(value)&&value>=0&&value<=1);}
  }
});

test('frequency controls stay within available non-DC bins and accept reversed ranges',()=>{
  assert.deepEqual(frequencyRange(20,20000,46.875,512),{first:1,last:427});
  assert.deepEqual(frequencyRange(20000,20,46.875,512),frequencyRange(20,20000,46.875,512));
  assert.deepEqual(frequencyRange(20000,20000,20,512),{first:511,last:512});
});

test('tuning survives export/copy and missing or invalid saved values normalize',()=>{
  const settings=normalizeSceneVfx({pulseHzMax:500,bassAttack:50,audioNoiseFloor:.005});
  assert.deepEqual(JSON.parse(serializeSceneVfx(settings)),settings);
  const world=emptyWorld();world.scene.vfx=settings;
  const restored=parseWorkspaceFile(JSON.stringify({format:'omnium-v2-workspace',version:1,world,scenes:[]}));
  assert.equal(restored.world.scene.vfx.pulseHzMax,500);assert.equal(restored.world.scene.vfx.bassAttack,50);
  assert.equal(normalizeSceneVfx({}).pulseOnsetTime,20);
  assert.equal(normalizeSceneVfx({pulseOnsetTime:Infinity}).pulseOnsetTime,20);
  assert.equal(normalizeSceneVfx({audioNoiseKnee:0}).audioNoiseKnee,.001);
});
