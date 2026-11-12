import test from 'node:test';
import assert from 'node:assert/strict';
import { createAutomaticPulse, createPulseEnvelope } from '../src/scene/pulse.ts';
import { createBassDynamics, normalizeSceneVfx, DEFAULT_SCENE_VFX, WAVE_PRESETS } from '../src/scene/vfx.ts';

test('10 Hz input cannot retrigger pulses faster than the selected interval', () => {
  for (const interval of [100,250,350,500,1000]) {
    const envelope = createPulseEnvelope(), starts = []; let previous = 0;
    for(let frame=0;frame<600;frame++) {
      const output=envelope.sample(frame%6<3?1:0,1/60,interval);
      if(output>0&&previous===0) starts.push(frame/60);
      previous=output;
    }
    assert.ok(starts.length>1);
    for(let i=1;i<starts.length;i++) assert.ok(starts[i]-starts[i-1]>=interval/1000-1e-8);
  }
});

test('pulse transitions rise and fade, sustained input does not keep flashing', () => {
  const envelope=createPulseEnvelope();
  assert.equal(envelope.sample(1,1/60,350),0);
  const rise=envelope.sample(1,1/60,350);assert.ok(rise>0&&rise<.5);
  for(let i=0;i<60;i++)envelope.sample(1,1/60,350);
  assert.equal(envelope.sample(1,1/60,350),0);
  envelope.reset();assert.equal(envelope.sample(0,1/60,350),0);
});

test('new scene defaults match the uploaded tuning without replacing saved values', () => {
  const settings=normalizeSceneVfx(undefined);
  assert.deepEqual(settings,DEFAULT_SCENE_VFX);
  assert.equal(settings.pulseSensitivity,2);assert.equal(settings.audioBounce,1.1);
  assert.equal(settings.pulseTintLow,'#ffffff');assert.equal(settings.pulseTintHigh,'#0062ff');
  assert.equal(settings.imageTint,'#00eeff');assert.equal(settings.pulseInterval,100);
  for(const key of ['waveAmplitudeX','waveAmplitudeY','waveFrequencyX','waveFrequencyY','waveSpeedX','waveSpeedY'])assert.equal(settings[key],WAVE_PRESETS[1][key]);
  assert.equal(normalizeSceneVfx({pulseInterval:500,pulseSensitivity:4}).pulseInterval,500);
  assert.equal(normalizeSceneVfx({pulseInterval:5}).pulseInterval,5);
  assert.equal(normalizeSceneVfx({pulseSensitivity:4}).pulseSensitivity,4);
});

test('faint repeated sounds stay below pulse and bounce admission even after adaptation', () => {
  const pulse = createAutomaticPulse(), bass = createBassDynamics();
  for (let frame = 0; frame < 3600; frame++) {
    const level = frame % 6 < 3 ? .008 : 0;
    assert.equal(pulse.sample(level, 1/60, 8, 1.7, level, level), 0);
    assert.equal(bass.sample(level, 1/60), 0);
  }
});

test('audible transients still react and near-floor sounds have a soft response', () => {
  const faint = createAutomaticPulse().sample(.012, 1/60, 8, 1.7);
  const strong = createAutomaticPulse().sample(.1, 1/60, 8, 1.7);
  assert.ok(faint >= 0 && faint < .05);
  assert.ok(strong > 1 && strong <= 1.7);
  const bass = createBassDynamics();
  assert.ok(bass.sample(.012, 1/60) < .05);
  assert.ok(bass.sample(.1, 1/60) > .9);
});

test('sustained tones stop flashing and silence releases bounce immediately', () => {
  const pulse = createAutomaticPulse(), bass = createBassDynamics();
  assert.ok(pulse.sample(.1, 1/60, 8, 1.7) > 0);
  assert.equal(pulse.sample(.1, 1/60, 8, 1.7, 0, .1), 0);
  bass.sample(.5, 1/60);
  assert.equal(bass.sample(0, 1/60), 0);
  pulse.reset(); bass.reset();
  assert.equal(pulse.sample(.008, 1/60, 8, 1.7), 0);
  assert.equal(bass.sample(.008, 1/60), 0);
});
